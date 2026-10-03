import { BadRequestException,ForbiddenException,Injectable,NotFoundException } from '@nestjs/common';
import { Db,Executor } from '../database/db';
import { Actor,allowed } from '../common/types';
import { like } from '../common/dto';
import { ActionDto,Phase2ListDto } from '../phase2/phase2.dto';
import { Conditions,notifyTeam,requirePermission,version } from '../phase2/support';
import { AssignmentDto } from './partners.dto';
import { cents,money } from '../finance/money';
const from='VendorAssignments a JOIN Vendors v ON v.Id=a.VendorId JOIN ServiceRequests r ON r.Id=a.RequestId JOIN Services s ON s.Id=r.ServiceId JOIN Customers c ON c.Id=r.CustomerId';
const select='a.*,v.Name VendorName,r.RequestNumber,r.PreferredDate,r.PreferredTime,r.Guests,s.Name ServiceName,c.DisplayName CustomerName';
export const ASSIGNMENT_TRANSITIONS:Record<string,string[]>={Pending:['Assigned','Cancelled'],Assigned:['Accepted','Declined','Cancelled'],Accepted:['In Progress','Cancelled'],Declined:[],'In Progress':['Completed','Cancelled'],Completed:[],Cancelled:[]};
@Injectable()
export class AssignmentsService {
 constructor(private db:Db){}
 private async scope(id:string,a:Actor,tx:Executor=this.db.source){
  const r=await this.db.one('SELECT a.*,v.UserId VendorUserId,v.Active VendorActive FROM VendorAssignments a JOIN Vendors v ON v.Id=a.VendorId WHERE a.Id=@0',[id],tx);if(!r)throw new NotFoundException();
  if(!allowed(a,'vendors.read')&&(r.VendorUserId?.toLowerCase()!==a.id.toLowerCase()||!r.VendorActive))throw new ForbiddenException('This assignment is not available to your account.');return r;
 }
 list(q:Phase2ListDto,a:Actor){
  const w=new Conditions();if(!allowed(a,'vendors.read')){w.add('v.UserId=?',a.id);w.clauses.push('v.Active=1');}
  if(q.vendorId)w.add('a.VendorId=?',q.vendorId);if(q.requestId)w.add('a.RequestId=?',q.requestId);if(q.status)w.add('a.Status=?',q.status);
  if(q.search)w.add('(r.RequestNumber LIKE ? OR s.Name LIKE ? OR v.Name LIKE ?)',like(q.search));
  return this.db.page(select,from,w.sql,w.params,q,'a.CreatedAt DESC,a.Id');
 }
 async detail(id:string,a:Actor){
  await this.scope(id,a);const item=await this.db.one('SELECT '+select+',r.SpecialRequirements FROM '+from+' WHERE a.Id=@0',[id]);
  const history=await this.db.query('SELECT TOP(100) h.*,u.DisplayName ActorName FROM VendorAssignmentHistory h JOIN Users u ON u.Id=h.ActorId WHERE AssignmentId=@0 ORDER BY h.CreatedAt DESC',[id]);
  const transitions=ASSIGNMENT_TRANSITIONS[item!.Status]||[];
  return {...item,History:history,Transitions:allowed(a,'vendors.write')?transitions:transitions.filter(s=>s!=='Cancelled'&&s!=='Assigned')};
 }
 create(dto:AssignmentDto,a:Actor){
  requirePermission(a,'vendors.write');
  return this.db.transaction(async tx=>{
   const vendor=await this.db.get('Vendors',dto.VendorId,tx),request=await this.db.get('ServiceRequests',dto.RequestId,tx);
   if(!vendor.Active||['Cancelled','Unavailable','Refunded','Completed'].includes(request.Status))throw new BadRequestException('Choose an active vendor and an open request.');
   const price=await this.db.one('SELECT Cost FROM VendorServices WHERE VendorId=@0 AND ServiceId=@1 AND Active=1',[dto.VendorId,request.ServiceId],tx);
   if(!price)throw new BadRequestException('Assign this service to the vendor before creating an assignment.');
   const assignment=await this.db.insert('VendorAssignments',{...dto,TripId:request.TripId,Cost:money(cents(dto.Cost??price.Cost))},a.id,tx);
   await this.db.insert('VendorAssignmentHistory',{AssignmentId:assignment.Id,NewStatus:'Pending',ActorId:a.id},a.id,tx);
   await this.db.audit(a.id,'Vendor assignment created','VendorAssignments',assignment.Id,{cost:assignment.Cost},tx);return assignment;
  });
 }
 action(id:string,dto:ActionDto,a:Actor){
  return this.db.transaction(async tx=>{
   await this.db.one('SELECT Id FROM VendorAssignments WITH(UPDLOCK,ROWLOCK) WHERE Id=@0',[id],tx);const r=await this.scope(id,a,tx);version(r,dto.Version);
   if(!allowed(a,'vendors.write')&&['Cancelled','Assigned'].includes(dto.Status))throw new ForbiddenException();
   if(!ASSIGNMENT_TRANSITIONS[r.Status]?.includes(dto.Status))throw new BadRequestException('This assignment transition is not available.');
   const result=await this.db.update('VendorAssignments',id,{Status:dto.Status,Version:r.Version+1},a.id,tx);
   await this.db.insert('VendorAssignmentHistory',{AssignmentId:id,PreviousStatus:r.Status,NewStatus:dto.Status,ActorId:a.id,Notes:dto.Notes},a.id,tx);
   if(r.VendorUserId)await this.db.notify(r.VendorUserId,'Vendor assignment update','Your assignment is now '+dto.Status+'.','/vendor-assignments/'+id,tx);
   await notifyTeam(this.db,tx,'vendors.read','Vendor assignment update','An assignment is now '+dto.Status+'.','/vendor-assignments/'+id);
   await this.db.audit(a.id,'Vendor assignment changed','VendorAssignments',id,{previous:r.Status,status:dto.Status},tx);return result;
  });
 }
}
