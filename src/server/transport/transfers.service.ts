import { BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException } from '@nestjs/common';
import { Db,Executor } from '../database/db';
import { Actor,Row,allowed,bahamasToday,dateOnly } from '../common/types';
import { like } from '../common/dto';
import { ActionDto,Phase2ListDto } from '../phase2/phase2.dto';
import { Conditions,dateRange,lock,notifyCustomer,notifyTeam,requirePermission,version } from '../phase2/support';
import { TransferDto,TransferEditDto,TransferAssignDto } from './transport.dto';
import { cents,money } from '../finance/money';
const from='Transfers t JOIN Customers c ON c.Id=t.CustomerId JOIN ServiceRequests r ON r.Id=t.RequestId LEFT JOIN Drivers d ON d.Id=t.DriverId LEFT JOIN Vehicles v ON v.Id=t.VehicleId';
const safe='t.Id,t.TransferNumber,t.RequestId,t.Type,t.Pickup,t.Destination,t.Passengers,t.ScheduledDate,t.ScheduledTime,t.DurationMinutes,t.FlightNumber,t.OperationalNotes,t.DriverId,t.VehicleId,t.Status,t.Version,t.CreatedAt,c.DisplayName CustomerName,c.Phone CustomerPhone,r.RequestNumber,d.DisplayName DriverName,v.Name VehicleName,v.Registration';
export const TRANSFER_TRANSITIONS:Record<string,string[]>={Unassigned:['Cancelled'],Assigned:['En Route','Cancelled'],'En Route':['Arrived','Cancelled'],Arrived:['Passenger Onboard','No Show','Cancelled'],'Passenger Onboard':['Completed','Cancelled'],Completed:[],Cancelled:[],'No Show':[]};
@Injectable()
export class TransfersService {
 constructor(private db:Db){}
 private async scope(id:string,a:Actor,tx:Executor=this.db.source){
  const t=await this.db.one('SELECT t.*,d.UserId DriverUserId,d.Active DriverActive FROM Transfers t LEFT JOIN Drivers d ON d.Id=t.DriverId WHERE t.Id=@0',[id],tx);if(!t)throw new NotFoundException();
  if(!allowed(a,'dispatch.read')&&(t.DriverUserId?.toLowerCase()!==a.id.toLowerCase()||!t.DriverActive))throw new ForbiddenException('This transfer is not assigned to you.');return t;
 }
 list(q:Phase2ListDto,a:Actor){
  dateRange(q);const w=new Conditions(),today=bahamasToday();if(!allowed(a,'dispatch.read')){w.add('d.UserId=?',a.id);w.clauses.push('d.Active=1');}
  if(q.status)w.add('t.Status=?',q.status);if(q.date)w.add('t.ScheduledDate=?',q.date);if(q.driverId)w.add('t.DriverId=?',q.driverId);if(q.vehicleId)w.add('t.VehicleId=?',q.vehicleId);if(q.requestId)w.add('t.RequestId=?',q.requestId);
  if(q.from)w.add('t.ScheduledDate>=?',q.from);if(q.to)w.add('t.ScheduledDate<=?',q.to);
  if(q.view==='Today')w.add('t.ScheduledDate=?',today);
  if(q.view==='Upcoming')w.add('t.ScheduledDate>=?',today);
  if(q.view==='Unassigned')w.clauses.push("t.Status='Unassigned'");
  if(q.view==='Active')w.clauses.push("t.Status IN ('Assigned','En Route','Arrived','Passenger Onboard')");
  if(q.view==='Completed')w.clauses.push("t.Status='Completed'");
  if(q.search)w.add('(t.TransferNumber LIKE ? OR c.DisplayName LIKE ? OR t.Pickup LIKE ? OR t.Destination LIKE ?)',like(q.search));
  return this.db.page(safe+(allowed(a,'dispatch.read')?',t.DirectCost':''),from,w.sql,w.params,q,'t.ScheduledDate,t.ScheduledTime,t.Id');
 }
 async current(a:Actor){const q=new Phase2ListDto();q.limit=1;q.view='Active';return (await this.list(q,a)).items[0]||null;}
 async detail(id:string,a:Actor){
  const r=await this.scope(id,a),item=await this.db.one('SELECT '+safe+(allowed(a,'dispatch.read')?',t.DirectCost':'')+' FROM '+from+' WHERE t.Id=@0',[id]);
  const history=await this.db.query('SELECT TOP(100) h.NewStatus,h.PreviousStatus,h.CreatedAt,h.Notes,u.DisplayName ActorName FROM TransferStatusHistory h JOIN Users u ON u.Id=h.ActorId WHERE TransferId=@0 ORDER BY h.CreatedAt DESC,h.Id',[id]);
  const transitions=TRANSFER_TRANSITIONS[r.Status]||[];
  return {...item,History:history,Transitions:allowed(a,'dispatch.write')?transitions:transitions.filter(s=>!['Cancelled','No Show'].includes(s))};
 }
 private async conflict(t:Row,driver:string,vehicle:string,tx:Executor){
  const d=await this.db.get('Drivers',driver,tx),v=await this.db.get('Vehicles',vehicle,tx);
  const user=await this.db.one("SELECT u.Id FROM Users u WHERE u.Id=@0 AND u.Active=1 AND EXISTS(SELECT 1 FROM UserRoles ur JOIN Roles r ON r.Id=ur.RoleId WHERE ur.UserId=u.Id AND r.Name='Driver')",[d.UserId],tx);
  if(!d.Active||!v.Active||!user)throw new BadRequestException('Choose an active driver and vehicle.');
  if(v.Capacity<t.Passengers)throw new BadRequestException('The vehicle does not have enough passenger capacity.');
  const start=dateOnly(t.ScheduledDate)+'T'+t.ScheduledTime+':00',end=new Date(new Date(start+'Z').getTime()+t.DurationMinutes*60000).toISOString().slice(0,19);
  const overlap=await this.db.one("SELECT TOP(1) TransferNumber FROM Transfers WHERE Id<>@0 AND Status NOT IN ('Completed','Cancelled','No Show') AND (DriverId=@1 OR VehicleId=@2) AND CAST(CONVERT(char(10),ScheduledDate,126)+'T'+ScheduledTime+':00' AS datetime2)<CAST(@4 AS datetime2) AND DATEADD(minute,DurationMinutes,CAST(CONVERT(char(10),ScheduledDate,126)+'T'+ScheduledTime+':00' AS datetime2))>CAST(@3 AS datetime2)",[t.Id,driver,vehicle,start,end],tx);
  if(overlap)throw new ConflictException('The driver or vehicle already has an overlapping transfer.');
 }
 save(dto:TransferDto|TransferEditDto,a:Actor,id?:string){
  requirePermission(a,'dispatch.write');
  return this.db.transaction(async tx=>{
   await lock(this.db,tx,'dispatch-scheduling');
   const r=await this.db.get('ServiceRequests',dto.RequestId,tx),service=await this.db.get('Services',r.ServiceId,tx),trip=await this.db.get('Trips',r.TripId,tx);
   if(!service.TransportApplicable)throw new BadRequestException('Mark this service as transportation-enabled before creating a transfer.');
   if(!['Confirmed','Assigned','In Progress'].includes(r.Status))throw new BadRequestException('Confirm the service request before dispatching it.');
   if(dto.ScheduledDate<dateOnly(trip.ArrivalDate)||dto.ScheduledDate>dateOnly(trip.DepartureDate))throw new BadRequestException('Choose a transfer date within the trip.');
   const previous=id?await this.scope(id,a,tx):null;
   if(previous){version(previous,(dto as TransferEditDto).Version);if(!['Unassigned','Assigned'].includes(previous.Status)||previous.RequestId.toLowerCase()!==dto.RequestId.toLowerCase())throw new BadRequestException('Only an unstarted transfer for the same request can be edited.');}
   const {Version:_version,...fields}=dto as TransferEditDto;
   const data={...fields,TripId:r.TripId,CustomerId:r.CustomerId,DirectCost:money(cents(dto.DirectCost??previous?.DirectCost??0)),Version:previous?previous.Version+1:1};
   if(previous?.DriverId)await this.conflict({...previous,...data},previous.DriverId,previous.VehicleId,tx);
   const item=id?await this.db.update('Transfers',id,data,a.id,tx):await this.db.insert('Transfers',data,a.id,tx);
   await this.db.insert('TransferStatusHistory',{TransferId:item.Id,PreviousStatus:previous?.Status,NewStatus:item.Status,DriverId:item.DriverId,VehicleId:item.VehicleId,ActorId:a.id,Notes:id?'Schedule details updated.':'Transfer created.'},a.id,tx);
   await this.db.audit(a.id,id?'Transfer edited':'Transfer created','Transfers',item.Id,{directCost:item.DirectCost},tx);return item;
  });
 }
 assign(id:string,dto:TransferAssignDto,a:Actor){
  requirePermission(a,'dispatch.write');
  return this.db.transaction(async tx=>{
   await lock(this.db,tx,'dispatch-scheduling');const t=await this.scope(id,a,tx);version(t,dto.Version);
   if(!['Unassigned','Assigned'].includes(t.Status))throw new BadRequestException('Only an unstarted transfer can be assigned.');
   await this.conflict(t,dto.DriverId,dto.VehicleId,tx);
   const result=await this.db.update('Transfers',id,{DriverId:dto.DriverId,VehicleId:dto.VehicleId,Status:'Assigned',Version:t.Version+1},a.id,tx);
   await this.db.insert('TransferStatusHistory',{TransferId:id,PreviousStatus:t.Status,NewStatus:'Assigned',DriverId:dto.DriverId,VehicleId:dto.VehicleId,ActorId:a.id,Notes:dto.Notes},a.id,tx);
   const driver=await this.db.get('Drivers',dto.DriverId,tx);await this.db.notify(driver.UserId,'Transfer assigned',t.TransferNumber+' has been assigned to you.','/transfers/'+id,tx);
   await notifyCustomer(this.db,tx,t.CustomerId,'Transfer assigned','Your driver and vehicle are arranged.','/requests/'+t.RequestId);
   await this.db.audit(a.id,'Driver assigned','Transfers',id,{driver:dto.DriverId},tx);await this.db.audit(a.id,'Vehicle assigned','Transfers',id,{vehicle:dto.VehicleId},tx);return result;
  });
 }
 action(id:string,dto:ActionDto,a:Actor){
  return this.db.transaction(async tx=>{
   await lock(this.db,tx,'dispatch-scheduling');const t=await this.scope(id,a,tx);version(t,dto.Version);
   if(!allowed(a,'dispatch.write')&&['Cancelled','No Show'].includes(dto.Status))throw new ForbiddenException();
   if(!TRANSFER_TRANSITIONS[t.Status]?.includes(dto.Status))throw new BadRequestException('This transfer transition is not available.');
   await this.db.update('Transfers',id,{Status:dto.Status,Version:t.Version+1},a.id,tx);
   await this.db.insert('TransferStatusHistory',{TransferId:id,PreviousStatus:t.Status,NewStatus:dto.Status,DriverId:t.DriverId,VehicleId:t.VehicleId,ActorId:a.id,Notes:dto.Notes},a.id,tx);
   const title=({'En Route':'Driver en route',Arrived:'Driver arrived',Completed:'Transfer completed'} as Record<string,string>)[dto.Status]||'Transfer update';
   await notifyCustomer(this.db,tx,t.CustomerId,title,t.TransferNumber+' is now '+dto.Status+'.','/requests/'+t.RequestId);
   await notifyTeam(this.db,tx,'dispatch.read',title,t.TransferNumber+' is now '+dto.Status+'.','/transfers/'+id);
   await this.db.audit(a.id,'Transfer status changed','Transfers',id,{previous:t.Status,status:dto.Status},tx);
   return {Id:id,Status:dto.Status,Version:t.Version+1};
  });
 }
}
