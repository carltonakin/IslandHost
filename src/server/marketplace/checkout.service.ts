import { BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Db,Executor } from '../database/db';
import { Actor,Row,allowed,bahamasToday } from '../common/types';
import { lock,notifyCustomer } from '../phase2/support';
import { cents,money } from '../finance/money';
import { assertEligible,ineligibleReason } from './booking-rules';
import { CheckoutDto } from './marketplace.dto';
@Injectable()
export class BookingCheckoutService {
 constructor(private db:Db){}
 async ownedPlan(id:string,a:Actor,tx:Executor=this.db.source){
  const plan=await this.db.one('SELECT it.*,t.CustomerId,t.ArrivalDate,t.DepartureDate,t.Adults,t.Children FROM Itineraries it JOIN Trips t ON t.Id=it.TripId WHERE it.Id=@0',[id],tx);
  if(!plan)throw new NotFoundException();
  if(plan.CustomerId.toLowerCase()!==a.customerId?.toLowerCase()&&!allowed(a,'invoices.write')&&!allowed(a,'bookings.manage'))throw new ForbiddenException();
  return plan;
 }
 async selection(planId:string,ids:string[],tx:Executor,invoiceId?:string){
  const normalized=ids.map(id=>id.toLowerCase());
  if(!ids.length||new Set(normalized).size!==ids.length)throw new BadRequestException('Select each booking only once.');
  const items:Row[]=[];
  for(const id of [...normalized].sort()){
   const item=await this.db.one('SELECT * FROM ItineraryItems WITH(UPDLOCK,ROWLOCK) WHERE Id=@0 AND ItineraryId=@1',[id,planId],tx);
   if(!item)throw new BadRequestException('A selected booking does not belong to this itinerary.');
   assertEligible(item,new Date(),invoiceId);items.push(item);
  }
  return items;
 }
 async preview(id:string,a:Actor){
  const plan=await this.ownedPlan(id,a);
  const items=await this.db.query('SELECT * FROM ItineraryItems WHERE ItineraryId=@0 AND Active=1 ORDER BY EventDate,EventTime,Id',[id]);
  const payable=items.filter(i=>!ineligibleReason(i));
  const settings=await this.db.one("SELECT Value FROM SystemSettings WHERE SettingKey='PaymentInstructions'");
  return {ItineraryId:id,Currency:plan.Currency,Items:items.map(i=>({...i,Payable:!ineligibleReason(i),PaymentReason:ineligibleReason(i)})),Total:money(payable.reduce((sum,i)=>sum+cents(i.ConfirmedPrice),0n)),OnlinePaymentAvailable:false,PaymentInstructions:settings?.Value||'Contact your concierge to arrange payment using your invoice reference.'};
 }
 prepare(id:string,dto:CheckoutDto,a:Actor){
  return this.db.transaction(async tx=>{
   const plan=await this.ownedPlan(id,a,tx);
   await lock(this.db,tx,'itinerary:'+id);
   const key=createHash('sha256').update(a.id+':'+dto.IdempotencyKey).digest('hex');
   await lock(this.db,tx,'checkout:'+key);
   const fingerprint=createHash('sha256').update(JSON.stringify([id.toLowerCase(),dto.ItemIds.map(i=>i.toLowerCase()).sort()])).digest('hex');
   const existing=await this.db.one('SELECT * FROM Invoices WHERE CheckoutKey=@0',[key],tx);
   if(existing){if(existing.CheckoutHash!==fingerprint)throw new ConflictException('This checkout key belongs to a different selection.');if(existing.Status==='Cancelled')throw new ConflictException('This checkout was cancelled. Review the updated bookings and try again.');return existing;}
   const items=await this.selection(id,dto.ItemIds,tx);
   const total=money(items.reduce((sum,i)=>sum+cents(i.ConfirmedPrice),0n));
   const invoice=await this.db.insert('Invoices',{ItineraryId:id,TripId:plan.TripId,CustomerId:plan.CustomerId,DueDate:bahamasToday(),IssuedDate:bahamasToday(),Currency:plan.Currency,Status:'Issued',Subtotal:total,TaxRate:'0.00',Tax:'0.00',Fees:'0.00',Discount:'0.00',Total:total,Deposit:'0.00',Terms:'Confirmed booking totals include applicable taxes and fees. Confirmation expiry still applies.',CheckoutKey:key,CheckoutHash:fingerprint},a.id,tx);
   for(let index=0;index<items.length;index++){
    const item=items[index];const service=await this.db.get('Services',item.ServiceId,tx);
    const category=await this.db.get('ServiceCategories',service.CategoryId,tx);
    await this.db.insert('InvoiceItems',{InvoiceId:invoice.Id,ServiceId:service.Id,CategoryId:category.Id,ServiceName:service.Name,CategoryName:category.Name,Description:item.Activity+' - confirmed booking',Quantity:1,UnitPrice:money(cents(item.ConfirmedPrice)),LineTotal:money(cents(item.ConfirmedPrice)),DisplayOrder:index},a.id,tx);
   }
   await this.attach(invoice,items,a,tx);
   await notifyCustomer(this.db,tx,plan.CustomerId,'Your confirmed bookings are ready',invoice.InvoiceNumber+' is ready for payment.','/invoices/'+invoice.Id);
   await this.db.audit(a.id,'Confirmed checkout created','Invoices',invoice.Id,{items:items.map(i=>i.Id),total},tx);
   return invoice;
  });
 }
 private async attach(invoice:Row,items:Row[],a:Actor,tx:Executor){
  if(cents(invoice.Total)!==items.reduce((sum,i)=>sum+cents(i.ConfirmedPrice),0n))throw new BadRequestException('Invoice total must match the confirmed booking totals.');
  for(const item of items){
   await this.db.insert('InvoiceBookings',{InvoiceId:invoice.Id,ItineraryItemId:item.Id,BookingVersion:item.Version,ConfirmedAmount:money(cents(item.ConfirmedPrice))},a.id,tx);
   await this.db.update('ItineraryItems',item.Id,{CheckoutInvoiceId:invoice.Id,PaymentStatus:'PENDING'},a.id,tx);
  }
  await this.db.update('Invoices',invoice.Id,{ItineraryId:items[0].ItineraryId},a.id,tx);
 }
 async invoiceOptions(id:string,a:Actor){const invoice=await this.db.get('Invoices',id);const plan=await this.db.one('SELECT Id FROM Itineraries WHERE TripId=@0',[invoice.TripId]);if(!plan)throw new NotFoundException();return this.preview(plan.Id,a);}
 async link(invoiceId:string,ids:string[],a:Actor){
  if(!allowed(a,'invoices.write'))throw new ForbiddenException();
  return this.db.transaction(async tx=>{
   const original=await this.db.get('Invoices',invoiceId,tx);
   const plan=await this.db.one('SELECT * FROM Itineraries WHERE TripId=@0',[original.TripId],tx);if(!plan)throw new BadRequestException('Trip itinerary is missing.');
   await lock(this.db,tx,'itinerary:'+plan.Id);
   const invoice=await this.db.get('Invoices',invoiceId,tx);
   if(!['Draft','Issued','Overdue'].includes(invoice.Status)||Number(invoice.AmountPaid)||Number(invoice.RefundedAmount))throw new BadRequestException('Only an unpaid invoice can be linked.');
   if(await this.db.one('SELECT Id FROM InvoiceBookings WHERE InvoiceId=@0',[invoiceId],tx))throw new ConflictException('This invoice already has linked bookings.');
   const items=await this.selection(plan.Id,ids,tx);await this.attach(invoice,items,a,tx);
   await this.db.audit(a.id,'Invoice bookings linked','Invoices',invoiceId,{items:ids},tx);return this.db.get('Invoices',invoiceId,tx);
  });
 }
 async lockInvoice(id:string,tx:Executor){
  const invoice=await this.db.get('Invoices',id,tx);
  const plan=await this.db.one('SELECT Id FROM Itineraries WHERE TripId=@0',[invoice.TripId],tx);
  if(plan)await lock(this.db,tx,'itinerary:'+plan.Id);
 }
 async assertInvoice(invoice:Row,a:Actor,tx:Executor){
  let links=await this.db.query('SELECT * FROM InvoiceBookings WHERE InvoiceId=@0 ORDER BY ItineraryItemId',[invoice.Id],tx);
  // Safely adopt a legacy request invoice only after explicit booking confirmation.
  if(!links.length&&invoice.RequestId){
   const item=await this.db.one('SELECT * FROM ItineraryItems WHERE RequestId=@0',[invoice.RequestId],tx);
   if(item){assertEligible(item);await this.attach(invoice,[item],a,tx);links=await this.db.query('SELECT * FROM InvoiceBookings WHERE InvoiceId=@0',[invoice.Id],tx);}
  }
  if(!links.length)throw new BadRequestException('Link confirmed bookings to this invoice before recording payment.');
  let total=0n;
  for(const link of links){
   const item=await this.db.get('ItineraryItems',link.ItineraryItemId,tx);
   assertEligible(item,new Date(),invoice.Id);
   if(item.Version!==link.BookingVersion||cents(item.ConfirmedPrice)!==cents(link.ConfirmedAmount))throw new ConflictException('A booking changed. Create an invoice from its new confirmation.');
   const plan=await this.db.get('Itineraries',item.ItineraryId,tx);
   if(plan.TripId.toLowerCase()!==invoice.TripId.toLowerCase())throw new BadRequestException('Invoice and bookings must belong to the same trip.');
   total+=cents(link.ConfirmedAmount);
  }
  if(total!==cents(invoice.Total))throw new BadRequestException('The invoice does not match the confirmed total.');
  return links;
 }
 async settle(invoice:Row,payment:Row,a:Actor,tx:Executor){
  const links=await this.assertInvoice(invoice,a,tx);
  for(const link of links){
   await this.db.insert('PaymentAllocations',{PaymentId:payment.Id,ItineraryItemId:link.ItineraryItemId,Amount:money(cents(link.ConfirmedAmount))},a.id,tx);
   await this.db.update('ItineraryItems',link.ItineraryItemId,{PaymentStatus:'PAID'},a.id,tx);
  }
 }
 async refund(paymentId:string,amount:bigint,a:Actor,tx:Executor){
  const allocations=await this.db.query('SELECT * FROM PaymentAllocations WHERE PaymentId=@0 ORDER BY ItineraryItemId',[paymentId],tx);let remaining=amount;
  for(const allocation of allocations){
   if(!remaining)break;const available=cents(allocation.Amount)-cents(allocation.RefundedAmount);const part=remaining<available?remaining:available;if(!part)continue;
   const refunded=cents(allocation.RefundedAmount)+part;remaining-=part;
   await this.db.update('PaymentAllocations',allocation.Id,{RefundedAmount:money(refunded)},a.id,tx);
   await this.db.update('ItineraryItems',allocation.ItineraryItemId,{PaymentStatus:refunded===cents(allocation.Amount)?'REFUNDED':'PARTIALLY_REFUNDED'},a.id,tx);
   await this.db.audit(a.id,'Booking refund allocated','ItineraryItems',allocation.ItineraryItemId,{paymentId,amount:money(part)},tx);
  }
 }
 async releaseInvoice(id:string,a:Actor,tx:Executor){
  await this.db.query("UPDATE ItineraryItems SET CheckoutInvoiceId=NULL,PaymentStatus='UNPAID',UpdatedAt=SYSUTCDATETIME(),UpdatedBy=@1 WHERE CheckoutInvoiceId=@0 AND PaymentStatus='PENDING'",[id,a.id],tx);
 }
 async invalidate(item:Row,a:Actor,tx:Executor){
  if(!item.CheckoutInvoiceId||item.PaymentStatus!=='PENDING')return;
  const invoice=await this.db.get('Invoices',item.CheckoutInvoiceId,tx);
  if(Number(invoice.AmountPaid)||Number(invoice.RefundedAmount))throw new ConflictException('Contact Finance before changing a settled booking.');
  await this.db.update('Invoices',invoice.Id,{Status:'Cancelled',Version:invoice.Version+1},a.id,tx);
  await this.releaseInvoice(invoice.Id,a,tx);
  await this.db.audit(a.id,'Checkout invalidated by booking change','Invoices',invoice.Id,{item:item.Id},tx);
 }
}