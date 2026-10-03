import { BadRequestException,ConflictException,ForbiddenException,Injectable } from '@nestjs/common';
import { Db,Executor } from '../database/db';
import { Actor,Row,allowed,canTransition,dateOnly,isStaff } from '../common/types';
import { ListDto,like } from '../common/dto';
import { ownCustomer } from '../auth/access';
import { RequestDto,StatusDto } from './requests.dto';
const from='ServiceRequests r JOIN Customers c ON c.Id=r.CustomerId JOIN Services s ON s.Id=r.ServiceId LEFT JOIN Users u ON u.Id=r.AssignedStaffId';
const select='r.*,c.DisplayName CustomerName,s.Name ServiceName,s.CategoryId,u.DisplayName AssignedStaffName';
@Injectable()
export class RequestsService {
 constructor(private db:Db) {}
 list(q:ListDto,a:Actor) {
  const clauses=['1=1'];const params:unknown[]=[];
  const add=(clause:string,value:unknown)=>{clauses.push(clause.replace('?', '@'+params.length));params.push(value);};
  if(!isStaff(a))add('r.CustomerId=?',a.customerId||null);
  else if(q.customerId)add('r.CustomerId=?',q.customerId);
  if(q.status)add('r.Status=?',q.status);
  if(q.serviceId)add('r.ServiceId=?',q.serviceId);
  if(q.categoryId)add('s.CategoryId=?',q.categoryId);
  if(q.tripId)add('r.TripId=?',q.tripId);
  if(q.date)add('r.PreferredDate=?',q.date);
  if(q.search){const n=params.length;params.push(like(q.search));clauses.push(`(r.RequestNumber LIKE @${n} OR c.DisplayName LIKE @${n} OR s.Name LIKE @${n})`);}
  const order=q.sort==='date'?'r.PreferredDate,r.PreferredTime,r.Id':q.sort==='oldest'?'r.CreatedAt,r.Id':'r.CreatedAt DESC,r.Id';
  return this.db.page(select,from,clauses.join(' AND '),params,q,order);
 }
 async detail(id:string,a:Actor) {
  const r=await this.db.get('ServiceRequests',id);ownCustomer(a,r.CustomerId);
  const item=await this.db.one('SELECT '+select+' FROM '+from+' WHERE r.Id=@0',[id]);
  const history=await this.db.query('SELECT TOP(200) h.*,u.DisplayName ActorName FROM ServiceRequestHistory h JOIN Users u ON u.Id=h.ActorId WHERE h.RequestId=@0 ORDER BY h.CreatedAt DESC,h.Id',[id]);
  return {...item,History:history};
 }
 async create(dto:RequestDto,a:Actor) {
  if(isStaff(a)&&!allowed(a,'requests.write'))throw new ForbiddenException();
  return this.db.transaction(async tx=>{
   const trip=await this.db.one('SELECT * FROM Trips WITH (UPDLOCK,ROWLOCK) WHERE Id=@0',[dto.TripId],tx);
   if(!trip)throw new BadRequestException('Choose an available trip.');ownCustomer(a,trip.CustomerId);
   if(dto.PreferredDate<dateOnly(trip.ArrivalDate)||dto.PreferredDate>dateOnly(trip.DepartureDate))throw new BadRequestException('Select a date within your trip.');
   const service=await this.db.one('SELECT s.* FROM Services s JOIN ServiceCategories c ON c.Id=s.CategoryId WHERE s.Id=@0 AND s.Active=1 AND c.Active=1',[dto.ServiceId],tx);
   if(!service)throw new BadRequestException('This service is no longer available.');
   if(dto.OptionId&&!await this.db.one('SELECT Id FROM ServiceOptions WHERE Id=@0 AND ServiceId=@1 AND Active=1',[dto.OptionId,dto.ServiceId],tx))throw new BadRequestException('Choose an available service option.');
   const request=await this.db.insert('ServiceRequests',{...dto,CustomerId:trip.CustomerId,Status:'Requested'},a.id,tx);
   await this.db.insert('ServiceRequestHistory',{RequestId:request.Id,PreviousStatus:null,NewStatus:'Requested',ActorId:a.id,Notes:dto.Notes},a.id,tx);
   await this.db.query(`INSERT INTO Notifications(UserId,Title,Body,Link) SELECT DISTINCT u.Id,'New service request',@0,@1 FROM Users u JOIN UserRoles ur ON ur.UserId=u.Id JOIN Roles r ON r.Id=ur.RoleId WHERE u.Active=1 AND r.Name IN ('SuperAdmin','Management','OperationsManager','ConciergeAgent','Dispatcher')`,[request.RequestNumber+' · '+service.Name,'/requests/'+request.Id],tx);
   await this.db.audit(a.id,'Service request created','ServiceRequests',request.Id,{status:'Requested'},tx);return request;
  });
 }
 async status(id:string,dto:StatusDto,a:Actor,executor?:Executor) {
  const change=async(tx:Executor)=>{
   const r=await this.db.one('SELECT * FROM ServiceRequests WITH (UPDLOCK,ROWLOCK) WHERE Id=@0',[id],tx);
   if(!r)throw new BadRequestException('This request is not available.');ownCustomer(a,r.CustomerId);
   if(!allowed(a,'requests.write')) {
    if(isStaff(a)||dto.AssignedStaffId!==undefined||dto.PreferredDate||dto.PreferredTime)throw new ForbiddenException();
    if(!((r.Status==='Quoted'&&dto.Status==='Client Approved')||(['Requested','Under Review','Quoted'].includes(r.Status)&&dto.Status==='Cancelled')))throw new ForbiddenException('Your concierge can help with this change.');
   }
   if(r.Version!==dto.Version)throw new ConflictException('This request changed. Refresh it before saving.');
   if(!canTransition(r.Status,dto.Status))throw new BadRequestException('This status change is not available.');
   if(dto.Status==='Rescheduled'&&(!dto.PreferredDate||!dto.PreferredTime))throw new BadRequestException('Choose the new date and time.');
   if((dto.PreferredDate||dto.PreferredTime)&&dto.Status!=='Rescheduled')throw new BadRequestException('Use Rescheduled to change the date and time.');
   const trip=await this.db.get('Trips',r.TripId,tx);
   if(dto.PreferredDate&&(dto.PreferredDate<dateOnly(trip.ArrivalDate)||dto.PreferredDate>dateOnly(trip.DepartureDate)))throw new BadRequestException('Select a date within the trip.');
   if(dto.AssignedStaffId) {
    const staff=await this.db.one("SELECT u.Id FROM Users u JOIN UserRoles ur ON ur.UserId=u.Id JOIN Roles ro ON ro.Id=ur.RoleId WHERE u.Id=@0 AND u.Active=1 AND ro.Name IN ('SuperAdmin','Management','OperationsManager','ConciergeAgent','Dispatcher')",[dto.AssignedStaffId],tx);
    if(!staff)throw new BadRequestException('Select an active operations team member.');
   }
   if(dto.Status==='Assigned'&&!(dto.AssignedStaffId||r.AssignedStaffId))throw new BadRequestException('Assign a team member first.');
   const updates:Row={Status:dto.Status,Version:r.Version+1,AssignedStaffId:dto.AssignedStaffId,PreferredDate:dto.PreferredDate,PreferredTime:dto.PreferredTime};
   const updated=await this.db.update('ServiceRequests',id,updates,a.id,tx);
   await this.db.insert('ServiceRequestHistory',{RequestId:id,PreviousStatus:r.Status,NewStatus:dto.Status,ActorId:a.id,Notes:dto.Notes},a.id,tx);
   if(dto.Status==='Confirmed') {
    const itinerary=await this.db.one('SELECT Id FROM Itineraries WHERE TripId=@0',[r.TripId],tx);
    if(!itinerary)throw new Error('Trip itinerary is missing');
    const service=await this.db.get('Services',r.ServiceId,tx);
    const existing=await this.db.one('SELECT Id FROM ItineraryItems WHERE RequestId=@0',[id],tx);
    const item={ItineraryId:itinerary.Id,RequestId:id,EventDate:dateOnly(updated.PreferredDate),EventTime:updated.PreferredTime,Activity:service.Name,Notes:r.SpecialRequirements,Active:true};
    if(existing)await this.db.update('ItineraryItems',existing.Id,item,a.id,tx);else await this.db.insert('ItineraryItems',item,a.id,tx);
   }
   if(['Cancelled','Unavailable','Refunded','Rescheduled'].includes(dto.Status))await this.db.query('UPDATE ItineraryItems SET Active=0,UpdatedAt=SYSUTCDATETIME(),UpdatedBy=@1 WHERE RequestId=@0',[id,a.id],tx);
   const customer=await this.db.get('Customers',r.CustomerId,tx);
   if(customer.UserId)await this.db.notify(customer.UserId,'Your experience has an update',r.RequestNumber+' is now '+dto.Status+'.',dto.Status==='Confirmed'?'/itinerary':'/requests/'+id,tx);
   await this.db.audit(a.id,'Request status changed','ServiceRequests',id,{previous:r.Status,status:dto.Status},tx);return updated;
  };
  return executor?change(executor):this.db.transaction(change);
 }
}

