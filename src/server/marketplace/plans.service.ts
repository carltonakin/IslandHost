import { BadRequestException,ForbiddenException,Injectable,NotFoundException } from '@nestjs/common';
import { Db,Executor } from '../database/db';
import { Actor,Row,allowed,dateOnly } from '../common/types';
import { lock,notifyCustomer,notifyTeam,version } from '../phase2/support';
import { cents,money } from '../finance/money';
import { BookingCheckoutService } from './checkout.service';
import { effectiveStatus,ineligibleReason,materialChange } from './booking-rules';
import { PlanDto,ImportPlanDto,PlanItemDto,ChangeItemDto,BookingActionDto,MarketplaceQuery } from './marketplace.dto';
@Injectable()
export class ItineraryPlansService {
 constructor(private db:Db,private checkout:BookingCheckoutService){}
 private customer(a:Actor){if(!a.customerId)throw new ForbiddenException('A customer account is required to save a personal trip.');return a.customerId;}
 private dates(dto:PlanDto){if(dto.ArrivalDate>dto.DepartureDate)throw new BadRequestException('End date must follow start date.');}
 list(a:Actor){return this.db.query('SELECT TOP(100) it.*,t.ArrivalDate,t.DepartureDate,t.Adults,t.Children,(SELECT COUNT(*) FROM ItineraryItems i WHERE i.ItineraryId=it.Id AND i.Active=1) ItemCount FROM Itineraries it JOIN Trips t ON t.Id=it.TripId WHERE t.CustomerId=@0 ORDER BY it.CreatedAt DESC',[this.customer(a)]);}
 async detail(id:string,a:Actor){
  const plan=await this.checkout.ownedPlan(id,a);
  const items=await this.db.query('SELECT i.*,s.Image,s.Bookable,v.Name VendorName FROM ItineraryItems i LEFT JOIN Services s ON s.Id=i.ServiceId LEFT JOIN Vendors v ON v.Id=i.VendorId WHERE i.ItineraryId=@0 ORDER BY i.EventDate,i.EventTime,i.Id',[id]);
  return {...plan,Items:items.map(i=>({...i,EffectiveStatus:effectiveStatus(i),Payable:!ineligibleReason(i),PaymentReason:ineligibleReason(i)}))};
 }
 async create(dto:PlanDto,a:Actor,imported?:ImportPlanDto){
  this.dates(dto);const owner=this.customer(a);
  return this.db.transaction(async tx=>{
   if(imported){
    await lock(this.db,tx,'guest-plan:'+imported.GuestReference.toLowerCase());
    const existing=await this.db.one('SELECT it.Id,t.CustomerId FROM Itineraries it JOIN Trips t ON t.Id=it.TripId WHERE GuestReference=@0',[imported.GuestReference],tx);
    if(existing){if(existing.CustomerId.toLowerCase()!==owner.toLowerCase())throw new ForbiddenException('This draft has already been attached to another account.');return this.db.get('Itineraries',existing.Id,tx);}
   }
   const {Name,ArrivalDate,DepartureDate,Adults,Children}=dto;
   const trip=await this.db.insert('Trips',{Name,ArrivalDate,DepartureDate,Adults,Children,CustomerId:owner},a.id,tx);
   const plan=await this.db.insert('Itineraries',{TripId:trip.Id,Name,Destination:dto.Destination,GuestReference:imported?.GuestReference},a.id,tx);
   for(const item of imported?.Items||[])await this.addInside({...plan,...trip,Id:plan.Id},item,a,tx);
   await this.db.audit(a.id,imported?'Guest itinerary attached':'Itinerary planned','Itineraries',plan.Id,{items:imported?.Items.length||0},tx);return plan;
  });
 }
 update(id:string,dto:PlanDto,a:Actor){
  this.dates(dto);return this.db.transaction(async tx=>{
   await lock(this.db,tx,'itinerary:'+id);const plan=await this.checkout.ownedPlan(id,a,tx);
   if(await this.db.one('SELECT TOP(1) Id FROM ItineraryItems WHERE ItineraryId=@0 AND Active=1 AND (EventDate<@1 OR EventDate>@2)',[id,dto.ArrivalDate,dto.DepartureDate],tx))throw new BadRequestException('Move or remove itinerary items outside the new dates first.');
   if(await this.db.one("SELECT TOP(1) Id FROM ServiceRequests WHERE TripId=@0 AND Status NOT IN ('Cancelled','Unavailable','Refunded') AND (PreferredDate<@1 OR PreferredDate>@2)",[plan.TripId,dto.ArrivalDate,dto.DepartureDate],tx))throw new BadRequestException('Update requests outside the new trip dates first.');
   const {Name,ArrivalDate,DepartureDate,Adults,Children}=dto;
   await this.db.update('Trips',plan.TripId,{Name,ArrivalDate,DepartureDate,Adults,Children},a.id,tx);
   await this.db.audit(a.id,'Itinerary details updated','Itineraries',id,{},tx);
   return this.db.update('Itineraries',id,{Name,Destination:dto.Destination},a.id,tx);
  });
 }
 private async validateItem(plan:Row,dto:PlanItemDto,tx:Executor,existing=false){
  if(dto.EventDate<dateOnly(plan.ArrivalDate)||dto.EventDate>dateOnly(plan.DepartureDate))throw new BadRequestException('Choose an item date within your trip.');
  const service=await this.db.one('SELECT s.*,c.Active CategoryActive FROM Services s JOIN ServiceCategories c ON c.Id=s.CategoryId WHERE s.Id=@0',[dto.ServiceId],tx);
  if(!service||!service.Active||!service.CategoryActive||(!existing&&!service.Published))throw new BadRequestException('This listing is not currently available.');
  if(dto.OptionId&&!await this.db.one('SELECT Id FROM ServiceOptions WHERE Id=@0 AND ServiceId=@1 AND Active=1',[dto.OptionId,dto.ServiceId],tx))throw new BadRequestException('Choose an available option.');
  return service;
 }
 private async history(item:Row,previous:string|null,notes:string|undefined,a:Actor,tx:Executor){
  await this.db.insert('BookingHistory',{ItineraryItemId:item.Id,PreviousStatus:previous,NewStatus:item.BookingStatus,ActorId:a.id,Notes:notes,Snapshot:JSON.stringify({date:dateOnly(item.EventDate),time:item.EventTime,quantity:item.Quantity,partySize:item.PartySize,optionId:item.OptionId,pickup:item.Pickup,dropoff:item.Dropoff,price:item.ConfirmedPrice,reference:item.ConfirmationReference,expires:item.ConfirmationExpiresAt,version:item.Version})},a.id,tx);
  await this.db.audit(a.id,'Booking '+item.BookingStatus.toLowerCase(),'ItineraryItems',item.Id,{previous,version:item.Version},tx);
 }
 private async addInside(plan:Row,dto:PlanItemDto,a:Actor,tx:Executor){
  const service=await this.validateItem(plan,dto,tx);
  const item=await this.db.insert('ItineraryItems',{...dto,ItineraryId:plan.Id,Activity:service.Name,Location:service.Location,VendorId:service.VendorId,QuotedPrice:service.StartingPrice,ManagedBooking:true},a.id,tx);
  await this.history(item,null,'Added to trip.',a,tx);return item;
 }
 add(id:string,dto:PlanItemDto,a:Actor){return this.db.transaction(async tx=>{const plan=await this.checkout.ownedPlan(id,a,tx);await lock(this.db,tx,'itinerary:'+id);return this.addInside(plan,dto,a,tx);});}
 async context(itemId:string,tx:Executor){
  const initial=await this.db.get('ItineraryItems',itemId,tx);await lock(this.db,tx,'itinerary:'+initial.ItineraryId);
  const item=await this.db.get('ItineraryItems',itemId,tx);const plan=await this.db.one('SELECT it.*,t.CustomerId,t.ArrivalDate,t.DepartureDate FROM Itineraries it JOIN Trips t ON t.Id=it.TripId WHERE it.Id=@0',[item.ItineraryId],tx);if(!plan)throw new NotFoundException();return {item,plan};
 }
 edit(itemId:string,dto:ChangeItemDto,a:Actor){return this.db.transaction(async tx=>{
  const {item,plan}=await this.context(itemId,tx);await this.checkout.ownedPlan(plan.Id,a,tx);version(item,dto.Version);
  if(!item.Active||['CANCELLED','COMPLETED'].includes(item.BookingStatus))throw new BadRequestException('This booking cannot be changed.');
  if(dto.ServiceId&&dto.ServiceId.toLowerCase()!==item.ServiceId?.toLowerCase())throw new BadRequestException('Add the new listing as a separate item.');
  const next={...item,...dto,EventDate:dto.EventDate||dateOnly(item.EventDate)};await this.validateItem(plan,next as PlanItemDto,tx,true);
  const material=materialChange(item,dto);let status=item.BookingStatus;
  if(material){await this.checkout.invalidate(item,a,tx);if(item.BookingStatus==='CONFIRMED')status='CHANGE_REQUESTED';else if(['PENDING_CONFIRMATION','RECONFIRMING','CHANGE_REQUESTED'].includes(item.BookingStatus))status='RECONFIRMING';else status='PLANNED';}
  const {Version:_version,ServiceId:_service,...changes}=dto;
  const updated=await this.db.update('ItineraryItems',itemId,{...changes,Version:item.Version+1,BookingStatus:status,...(material?{ConfirmedPrice:null,ConfirmationReference:null,ConfirmedAt:null,ConfirmationExpiresAt:null,ConfirmationConditions:null,ConfirmedBy:null}: {})},a.id,tx);
  // Notes do not change availability or price; preserve a valid existing checkout version.
  if(!material&&item.CheckoutInvoiceId&&item.PaymentStatus==='PENDING')await this.db.query('UPDATE InvoiceBookings SET BookingVersion=@1 WHERE InvoiceId=@0 AND ItineraryItemId=@2',[item.CheckoutInvoiceId,updated.Version,itemId],tx);
  if(material&&item.RequestId)await this.syncRequest(updated,plan,a,tx,'Under Review');
  await this.history(updated,item.BookingStatus,material?'Booking details changed; confirmation invalidated.':'Customer notes updated.',a,tx);return updated;
 });}
 private async canConfirm(item:Row,a:Actor,tx:Executor){
  if(allowed(a,'bookings.manage'))return true;
  if(!allowed(a,'vendor')||!item.VendorId)return false;
  return !!await this.db.one('SELECT Id FROM Vendors WHERE Id=@0 AND UserId=@1 AND Active=1',[item.VendorId,a.id],tx);
 }
 private async syncRequest(item:Row,plan:Row,a:Actor,tx:Executor,status:string){
  let id=item.RequestId;
  if(!id){const request=await this.db.insert('ServiceRequests',{TripId:plan.TripId,CustomerId:plan.CustomerId,ServiceId:item.ServiceId,OptionId:item.OptionId,PreferredDate:dateOnly(item.EventDate),PreferredTime:item.EventTime,Guests:item.PartySize,SpecialRequirements:item.Notes,Status:status},a.id,tx);id=request.Id;await this.db.update('ItineraryItems',item.Id,{RequestId:id},a.id,tx);await this.db.insert('ServiceRequestHistory',{RequestId:id,NewStatus:status,ActorId:a.id,Notes:'Created from the itinerary.'},a.id,tx);}
  else{const request=await this.db.get('ServiceRequests',id,tx);await this.db.update('ServiceRequests',id,{Status:status,PreferredDate:dateOnly(item.EventDate),PreferredTime:item.EventTime,Guests:item.PartySize,OptionId:item.OptionId,Version:request.Version+1},a.id,tx);await this.db.insert('ServiceRequestHistory',{RequestId:id,PreviousStatus:request.Status,NewStatus:status,ActorId:a.id,Notes:'Updated through booking confirmation.'},a.id,tx);}
 }
 action(itemId:string,dto:BookingActionDto,a:Actor){return this.db.transaction(async tx=>{
  const {item,plan}=await this.context(itemId,tx);version(item,dto.Version);const staff=await this.canConfirm(item,a,tx);
  const owner=plan.CustomerId.toLowerCase()===a.customerId?.toLowerCase();if(!owner&&!staff)throw new ForbiddenException();
  const next=dto.Status;const current=effectiveStatus(item);
  if(!item.Active||current==='COMPLETED'||current==='CANCELLED')throw new BadRequestException('This booking is closed.');
  let data:Row={BookingStatus:next,Version:item.Version+1,ManagedBooking:true};
  if(next==='PENDING_CONFIRMATION'||next==='RECONFIRMING'){
   if(!owner&&!allowed(a,'bookings.manage'))throw new ForbiddenException();
   if(!['PLANNED','CHANGE_REQUESTED','REJECTED','EXPIRED'].includes(current))throw new BadRequestException('This booking is already submitted.');
   const service=await this.db.get('Services',item.ServiceId,tx);if(!service.Bookable||!service.Active)throw new BadRequestException('This place can be planned but cannot be booked.');
   await this.checkout.invalidate(item,a,tx);data={...data,BookingStatus:current==='CHANGE_REQUESTED'?'RECONFIRMING':'PENDING_CONFIRMATION',ConfirmedPrice:null,ConfirmedAt:null,ConfirmationReference:null,ConfirmationExpiresAt:null};
  }else if(next==='CONFIRMED'){
   if(!staff)throw new ForbiddenException();if(!['PENDING_CONFIRMATION','RECONFIRMING','CHANGE_REQUESTED'].includes(current))throw new BadRequestException('Submit this booking for confirmation first.');
   if(!dto.ConfirmedPrice||cents(dto.ConfirmedPrice)<=0n||!dto.ConfirmationReference?.trim())throw new BadRequestException('Enter the final inclusive price and confirmation reference.');
   if(dto.ConfirmationExpiresAt&&(!/(Z|[+-]\d\d:\d\d)$/.test(dto.ConfirmationExpiresAt)||new Date(dto.ConfirmationExpiresAt)<=new Date()))throw new BadRequestException('Confirmation expiry must be a future time with a timezone.');
   if(item.PaymentStatus!=='UNPAID'&&item.PaymentStatus!=='PENDING'){
    const paid=await this.db.one('SELECT SUM(Amount-RefundedAmount) Paid FROM PaymentAllocations WHERE ItineraryItemId=@0',[itemId],tx);
    if(!paid?.Paid||cents(paid.Paid)!==cents(dto.ConfirmedPrice))throw new BadRequestException('A settled booking requires a Finance adjustment before its price can change.');
   }
   await this.checkout.invalidate(item,a,tx);data={...data,ConfirmedPrice:money(cents(dto.ConfirmedPrice)),ConfirmationReference:dto.ConfirmationReference.trim(),ConfirmationConditions:dto.ConfirmationConditions,ConfirmationExpiresAt:dto.ConfirmationExpiresAt?new Date(dto.ConfirmationExpiresAt):null,ConfirmedAt:new Date(),ConfirmedBy:a.id};
  }else if(next==='REJECTED'){
   if(!staff)throw new ForbiddenException();if(!['PENDING_CONFIRMATION','RECONFIRMING','CHANGE_REQUESTED'].includes(current)||!dto.Notes?.trim())throw new BadRequestException('A pending request and rejection reason are required.');await this.checkout.invalidate(item,a,tx);
  }else if(next==='CANCELLED'){
   await this.checkout.invalidate(item,a,tx);if(!dto.Notes?.trim())throw new BadRequestException('Please provide a cancellation reason.');data.Active=false;
  }else if(next==='COMPLETED'){
   if(!staff||current!=='CONFIRMED')throw new ForbiddenException();
  }else throw new BadRequestException('Use the booking actions to change status.');
  const updated=await this.db.update('ItineraryItems',itemId,data,a.id,tx);
  const requestStatus:Record<string,string>={PENDING_CONFIRMATION:'Under Review',RECONFIRMING:'Under Review',CONFIRMED:'Confirmed',REJECTED:'Unavailable',CANCELLED:'Cancelled',COMPLETED:'Completed'};
  if(updated.ServiceId&&(item.RequestId||!['CANCELLED'].includes(next)))await this.syncRequest(updated,plan,a,tx,requestStatus[updated.BookingStatus]);
  await this.history(updated,item.BookingStatus,dto.Notes,a,tx);
  if(['PENDING_CONFIRMATION','RECONFIRMING'].includes(updated.BookingStatus))await notifyTeam(this.db,tx,'bookings.manage','Booking needs confirmation',updated.Activity,'/bookings');
  else await notifyCustomer(this.db,tx,plan.CustomerId,'Booking updated',updated.Activity+': '+updated.BookingStatus.toLowerCase().replaceAll('_',' '),'/my-trip?id='+plan.Id);
  return updated;
 });}
 async queue(q:MarketplaceQuery,a:Actor){
  if(!allowed(a,'bookings.manage')&&!allowed(a,'vendor'))throw new ForbiddenException();
  const params:unknown[]=[];let where='i.ServiceId IS NOT NULL';
  if(!allowed(a,'bookings.manage')){params.push(a.id);where+=' AND v.UserId=@0 AND v.Active=1';}
  if(q.status){where+=' AND i.BookingStatus=@'+params.length;params.push(q.status);}
  const result=await this.db.page('i.*,it.Name TripName,t.CustomerId,c.DisplayName CustomerName,v.Name VendorName','ItineraryItems i JOIN Itineraries it ON it.Id=i.ItineraryId JOIN Trips t ON t.Id=it.TripId JOIN Customers c ON c.Id=t.CustomerId LEFT JOIN Vendors v ON v.Id=i.VendorId',where,params,q,'i.EventDate,i.EventTime,i.Id');
  return {...result,items:result.items.map(i=>({...i,EffectiveStatus:effectiveStatus(i)}))};
 }
 async historyFor(id:string,a:Actor){
  const item=await this.db.get('ItineraryItems',id);
  if(!await this.canConfirm(item,a,this.db.source))await this.checkout.ownedPlan(item.ItineraryId,a);
  return this.db.query('SELECT TOP(100) h.*,u.DisplayName ActorName FROM BookingHistory h JOIN Users u ON u.Id=h.ActorId WHERE h.ItineraryItemId=@0 ORDER BY h.CreatedAt DESC,h.Id',[id]);
 }
}