import { BadRequestException,ForbiddenException,Injectable,NotFoundException } from '@nestjs/common';
import { Db } from '../database/db';
import { Actor,allowed,bahamasToday,dateOnly } from '../common/types';
import { like } from '../common/dto';
import { ActionDto,Phase2ListDto } from '../phase2/phase2.dto';
import { Conditions,dateRange,financialOwner,notifyCustomer,requirePermission,version } from '../phase2/support';
import { ConvertQuoteDto,InvoiceDto } from './finance.dto';
import { BookingCheckoutService } from '../marketplace/checkout.service';
import { FinancialCore } from './financial-core';
@Injectable()
export class InvoicesService {
 constructor(private db:Db,private core:FinancialCore,private checkout:BookingCheckoutService){}
 async list(q:Phase2ListDto,a:Actor){
  dateRange(q);const w=new Conditions();w.params.push(bahamasToday());
  const effective="CASE WHEN i.Status IN ('Issued','Partially Paid','Overdue') AND i.BalanceDue>0 AND i.DueDate<CAST(@0 AS date) THEN 'Overdue' ELSE i.Status END";
  if(!allowed(a,'invoices.read')){w.add('i.CustomerId=?',a.customerId||null);w.clauses.push("i.Status<>'Draft'");}else if(q.customerId)w.add('i.CustomerId=?',q.customerId);
  if(q.status)w.add(effective+'=?',q.status);if(q.tripId)w.add('i.TripId=?',q.tripId);if(q.requestId)w.add('i.RequestId=?',q.requestId);
  if(q.search)w.add('(i.InvoiceNumber LIKE ? OR c.DisplayName LIKE ?)',like(q.search));
  if(q.from)w.add('i.CreatedAt>=?',q.from);if(q.to)w.add('i.CreatedAt<DATEADD(day,1,CAST(? AS date))',q.to);
  const result=await this.db.page('i.*,c.DisplayName CustomerName,'+effective+' EffectiveStatus','Invoices i JOIN Customers c ON c.Id=i.CustomerId',w.sql,w.params,q,'i.CreatedAt DESC,i.Id');
  return {...result,items:result.items.map(r=>({...r,Status:r.EffectiveStatus}))};
 }
 async detail(id:string,a:Actor){
  const invoice=await this.db.get('Invoices',id);financialOwner(a,invoice.CustomerId,'invoices.read');
  if(invoice.Status==='Draft'&&!allowed(a,'invoices.read'))throw new ForbiddenException('This invoice has not been issued.');
  const [items,payments,customer,trip]=await Promise.all([this.db.query('SELECT * FROM InvoiceItems WHERE InvoiceId=@0 ORDER BY DisplayOrder',[id]),this.db.query('SELECT TOP(100) Id,PaymentNumber,Amount,RefundedAmount,Status,Method,ReceivedDate,ProviderReference FROM Payments WHERE InvoiceId=@0 ORDER BY CreatedAt DESC',[id]),this.db.get('Customers',invoice.CustomerId),this.db.get('Trips',invoice.TripId)]);
  const paymentSettings=await this.db.one("SELECT Value FROM SystemSettings WHERE SettingKey='PaymentInstructions'");
  return {...invoice,PaymentInstructions:paymentSettings?.Value,Status:['Issued','Partially Paid','Overdue'].includes(invoice.Status)&&Number(invoice.BalanceDue)>0&&dateOnly(invoice.DueDate)<bahamasToday()?'Overdue':invoice.Status,Items:items,Payments:payments,CustomerName:customer.DisplayName,CustomerEmail:customer.Email,TripName:trip.Name};
 }
 create(dto:InvoiceDto,a:Actor){
  requirePermission(a,'invoices.write');this.core.assertDate(dto.DueDate,'Due date');
  return this.db.transaction(async tx=>{
   const trip=await this.db.get('Trips',dto.TripId,tx),calculated=await this.core.calculate(dto,tx);
   const invoice=await this.db.insert('Invoices',{TripId:trip.Id,CustomerId:trip.CustomerId,DueDate:dto.DueDate,Terms:dto.Terms,Notes:dto.Notes,...calculated.values},a.id,tx);
   await this.core.items('InvoiceItems',invoice.Id,calculated.items,a,tx);
   await this.db.audit(a.id,'Invoice created','Invoices',invoice.Id,{manual:true,total:invoice.Total},tx);return invoice;
  });
 }
 convert(id:string,dto:ConvertQuoteDto,a:Actor){
  requirePermission(a,'invoices.write');this.core.assertDate(dto.DueDate,'Due date');
  return this.db.transaction(async tx=>{
   const q=await this.db.one('SELECT * FROM Quotes WITH(UPDLOCK,ROWLOCK) WHERE Id=@0',[id],tx);if(!q)throw new NotFoundException();
   if(q.Status==='Converted'){const existing=await this.db.one('SELECT * FROM Invoices WHERE QuoteId=@0',[id],tx);if(existing)return existing;}
   version(q,dto.Version);if(q.Status!=='Approved')throw new BadRequestException('Approve this quote before converting it.');
   const invoice=await this.db.insert('Invoices',{QuoteId:q.Id,RequestId:q.RequestId,CustomerId:q.CustomerId,TripId:q.TripId,DueDate:dto.DueDate,Terms:q.Terms,Notes:q.Notes,Currency:q.Currency,Subtotal:q.Subtotal,TaxRate:q.TaxRate,Tax:q.Tax,Fees:q.Fees,Discount:q.Discount,Total:q.Total,Deposit:q.Deposit},a.id,tx);
   await this.core.items('InvoiceItems',invoice.Id,await this.db.query('SELECT * FROM QuoteItems WHERE QuoteId=@0 ORDER BY DisplayOrder',[id],tx),a,tx);
   await this.db.update('Quotes',id,{Status:'Converted',Version:q.Version+1},a.id,tx);
   await this.db.insert('QuoteHistory',{QuoteId:id,PreviousStatus:'Approved',NewStatus:'Converted',ActorId:a.id,Notes:'Converted to '+invoice.InvoiceNumber},a.id,tx);
   await this.db.audit(a.id,'Invoice created','Invoices',invoice.Id,{quote:id,total:invoice.Total},tx);return invoice;
  });
 }
 action(id:string,dto:ActionDto,a:Actor){
  requirePermission(a,'invoices.write');
  return this.db.transaction(async tx=>{
   await this.checkout.lockInvoice(id,tx);
   const i=await this.db.one('SELECT * FROM Invoices WITH(UPDLOCK,ROWLOCK) WHERE Id=@0',[id],tx);if(!i)throw new NotFoundException();version(i,dto.Version);
   if(dto.Status==='Issued'){if(i.Status!=='Draft')throw new BadRequestException('Only a draft can be issued.');}
   else if(dto.Status==='Cancelled'){if(!['Draft','Issued','Overdue'].includes(i.Status)||Number(i.AmountPaid)+Number(i.RefundedAmount)>0)throw new BadRequestException('Paid invoices must be refunded rather than cancelled.');}
   else throw new BadRequestException('This invoice transition is not available.');
   const result=await this.db.update('Invoices',id,{Status:dto.Status,IssuedDate:dto.Status==='Issued'?bahamasToday():i.IssuedDate,Version:i.Version+1},a.id,tx);
   if(dto.Status==='Issued'){if(i.RequestId)await this.core.requestState(i.RequestId,'Payment Required',a,tx);await notifyCustomer(this.db,tx,i.CustomerId,'Invoice issued',i.InvoiceNumber+' is ready.','/invoices/'+id);}
   if(dto.Status==='Cancelled')await this.checkout.releaseInvoice(id,a,tx);
   await this.db.audit(a.id,'Invoice '+dto.Status.toLowerCase(),'Invoices',id,{notes:dto.Notes},tx);return result;
  });
 }
}
