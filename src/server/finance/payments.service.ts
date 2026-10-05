import { BadRequestException,ConflictException,Injectable,NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Db } from '../database/db';
import { Actor,Row,allowed,bahamasToday,dateOnly } from '../common/types';
import { like } from '../common/dto';
import { Phase2ListDto } from '../phase2/phase2.dto';
import { Conditions,dateRange,financialOwner,lock,notifyCustomer,requirePermission } from '../phase2/support';
import { PaymentDto,RefundDto } from './finance.dto';
import { cents,money } from './money';
import { FinancialCore } from './financial-core';
import { BookingCheckoutService } from '../marketplace/checkout.service';
import { PaymentProviders } from './payment-provider';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const publicPayment=(row:Row)=>{const {RequestHash:_hash,IdempotencyKey:_key,...result}=row;return result;};
@Injectable()
export class PaymentsService {
 constructor(private db:Db,private providers:PaymentProviders,private core:FinancialCore,private checkout:BookingCheckoutService){}
 async list(q:Phase2ListDto,a:Actor){
  dateRange(q);const w=new Conditions();
  if(!allowed(a,'payments.read'))w.add('i.CustomerId=?',a.customerId||null);else if(q.customerId)w.add('i.CustomerId=?',q.customerId);
  if(q.invoiceId)w.add('p.InvoiceId=?',q.invoiceId);if(q.status)w.add('p.Status=?',q.status);
  if(q.search)w.add('(p.PaymentNumber LIKE ? OR i.InvoiceNumber LIKE ? OR c.DisplayName LIKE ?)',like(q.search));
  if(q.from)w.add('p.ReceivedDate>=?',q.from);if(q.to)w.add('p.ReceivedDate<=?',q.to);
  const result=await this.db.page('p.*,i.InvoiceNumber,c.DisplayName CustomerName','Payments p JOIN Invoices i ON i.Id=p.InvoiceId JOIN Customers c ON c.Id=i.CustomerId',w.sql,w.params,q,'p.CreatedAt DESC,p.Id');
  return {...result,items:result.items.map(publicPayment)};
 }
 async detail(id:string,a:Actor){
  const p=await this.db.get('Payments',id),i=await this.db.get('Invoices',p.InvoiceId);financialOwner(a,i.CustomerId,'payments.read');
  const refunds=await this.db.query('SELECT TOP(100) Id,RefundNumber,Amount,Reason,Status,ProviderReference,RefundedDate FROM Refunds WHERE PaymentId=@0 ORDER BY CreatedAt DESC',[id]);
  return {...publicPayment(p),InvoiceNumber:i.InvoiceNumber,Refunds:refunds,RefundableBalance:money(cents(p.Amount)-cents(p.RefundedAmount))};
 }
 record(dto:PaymentDto,a:Actor){
  requirePermission(a,'payments.write');const amount=cents(dto.Amount);
  if(amount<=0n||dto.ReceivedDate>bahamasToday())throw new BadRequestException('Enter a positive amount received today or earlier.');
  const provider=this.providers.configured(),receipt=provider.offlineReceipt(dto.ProviderReference.trim());
  const fingerprint=hash([dto.InvoiceId.toLowerCase(),money(amount),dto.Method,receipt.provider,receipt.reference,dto.ReceivedDate,dto.Notes||'']);
  return this.db.transaction(async tx=>{
   await lock(this.db,tx,'payment:'+dto.IdempotencyKey);
   const previous=await this.db.one('SELECT * FROM Payments WHERE IdempotencyKey=@0',[dto.IdempotencyKey],tx);
   if(previous){if(previous.RequestHash!==fingerprint)throw new ConflictException('This payment key belongs to a different payment.');return publicPayment(previous);}
   await this.checkout.lockInvoice(dto.InvoiceId,tx);
   const invoice=await this.db.one('SELECT * FROM Invoices WITH(UPDLOCK,ROWLOCK) WHERE Id=@0',[dto.InvoiceId],tx);if(!invoice)throw new NotFoundException();
   if(!['Issued','Partially Paid','Overdue'].includes(invoice.Status))throw new BadRequestException('This invoice cannot receive a payment.');
   if(dto.ReceivedDate<dateOnly(invoice.IssuedDate))throw new BadRequestException('Payment date cannot precede invoice issue.');
   if(amount>cents(invoice.BalanceDue))throw new BadRequestException('Payment exceeds the outstanding balance.');
   await this.checkout.assertInvoice(invoice,a,tx);
   if(amount!==cents(invoice.BalanceDue)||Number(invoice.AmountPaid)>0)throw new BadRequestException('Pay the exact confirmed invoice balance. Choose fewer bookings for a smaller checkout.');
   const payment=await this.db.insert('Payments',{...dto,Amount:money(amount),Currency:invoice.Currency,Provider:receipt.provider,ProviderReference:receipt.reference,RequestHash:fingerprint,Status:receipt.status},a.id,tx);
   const paid=cents(invoice.AmountPaid)+amount,balance=cents(invoice.Total)-paid-cents(invoice.RefundedAmount);
   await this.db.update('Invoices',invoice.Id,{AmountPaid:money(paid),Status:balance===0n?'Paid':'Partially Paid',Version:invoice.Version+1},a.id,tx);
   await this.checkout.settle(invoice,payment,a,tx);
   await notifyCustomer(this.db,tx,invoice.CustomerId,'Payment received',payment.PaymentNumber+' was recorded against '+invoice.InvoiceNumber+'.','/invoices/'+invoice.Id);
   await this.db.audit(a.id,'Payment recorded','Payments',payment.Id,{invoice:invoice.Id,amount:money(amount),method:dto.Method},tx);
   await this.db.audit(a.id,'Payment status changed','Payments',payment.Id,{status:receipt.status},tx);return publicPayment(payment);
  });
 }
 refund(dto:RefundDto,a:Actor){
  requirePermission(a,'refunds.write');const amount=cents(dto.Amount);
  if(amount<=0n||dto.RefundedDate>bahamasToday())throw new BadRequestException('Enter a positive refund settled today or earlier.');
  const fingerprint=hash([dto.PaymentId.toLowerCase(),money(amount),dto.ProviderReference.trim(),dto.Reason,dto.RefundedDate]);
  return this.db.transaction(async tx=>{
   await lock(this.db,tx,'refund:'+dto.IdempotencyKey);
   const prior=await this.db.one('SELECT * FROM Refunds WHERE IdempotencyKey=@0',[dto.IdempotencyKey],tx);
   if(prior){if(prior.RequestHash!==fingerprint)throw new ConflictException('This refund key belongs to a different refund.');return publicPayment(prior);}
   const original=await this.db.get('Payments',dto.PaymentId,tx);
   await this.checkout.lockInvoice(original.InvoiceId,tx);
   const invoice=await this.db.one('SELECT * FROM Invoices WITH(UPDLOCK,ROWLOCK) WHERE Id=@0',[original.InvoiceId],tx);
   const payment=await this.db.one('SELECT * FROM Payments WITH(UPDLOCK,ROWLOCK) WHERE Id=@0',[dto.PaymentId],tx);
   if(!invoice||!payment)throw new NotFoundException();
   if(!['Paid','Partially Refunded'].includes(payment.Status)||amount>cents(payment.Amount)-cents(payment.RefundedAmount))throw new BadRequestException('Refund exceeds the refundable balance.');
   if(dto.RefundedDate<dateOnly(payment.ReceivedDate))throw new BadRequestException('Refund date cannot precede payment.');
   const receipt=this.providers.forRecorded(payment.Provider).refundReceipt(dto.ProviderReference.trim());
   const refund=await this.db.insert('Refunds',{...dto,Amount:money(amount),ProviderReference:receipt.reference,RequestHash:fingerprint,Status:receipt.status},a.id,tx);
   const refunded=cents(payment.RefundedAmount)+amount,invoiceRefunds=cents(invoice.RefundedAmount)+amount;
   await this.db.update('Payments',payment.Id,{RefundedAmount:money(refunded),Status:refunded===cents(payment.Amount)?'Refunded':'Partially Refunded'},a.id,tx);
   await this.db.update('Invoices',invoice.Id,{AmountPaid:money(cents(invoice.AmountPaid)-amount),RefundedAmount:money(invoiceRefunds),Status:invoiceRefunds===cents(invoice.Total)?'Refunded':Number(invoice.BalanceDue)===0?'Paid':'Partially Paid',Version:invoice.Version+1},a.id,tx);
   await this.checkout.refund(payment.Id,amount,a,tx);
   await notifyCustomer(this.db,tx,invoice.CustomerId,'Refund recorded',refund.RefundNumber+' was recorded against '+payment.PaymentNumber+'.','/payments/'+payment.Id);
   await this.db.audit(a.id,'Refund created','Refunds',refund.Id,{payment:payment.Id,amount:money(amount),reason:dto.Reason},tx);
   await this.db.audit(a.id,'Financial adjustment performed','Invoices',invoice.Id,{refund:refund.Id,amount:money(amount)},tx);return publicPayment(refund);
  });
 }
 async refunds(q:Phase2ListDto,a:Actor){
  const w=new Conditions();if(!allowed(a,'payments.read'))w.add('i.CustomerId=?',a.customerId||null);if(q.invoiceId)w.add('i.Id=?',q.invoiceId);
  const result=await this.db.page('r.*,p.PaymentNumber,i.InvoiceNumber','Refunds r JOIN Payments p ON p.Id=r.PaymentId JOIN Invoices i ON i.Id=p.InvoiceId',w.sql,w.params,q,'r.CreatedAt DESC,r.Id');return {...result,items:result.items.map(publicPayment)};
 }
}
