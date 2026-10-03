import { BadRequestException,ForbiddenException,Injectable,NotFoundException } from '@nestjs/common';
import { Db } from '../database/db';
import { Actor,allowed,bahamasToday,dateOnly } from '../common/types';
import { like } from '../common/dto';
import { ActionDto,Phase2ListDto } from '../phase2/phase2.dto';
import { Conditions,dateRange,financialOwner,notifyCustomer,notifyTeam,requirePermission,version } from '../phase2/support';
import { QuoteDto } from './finance.dto';
import { FinancialCore } from './financial-core';
const effective="CASE WHEN q.Status IN ('Sent','Viewed') AND q.ValidUntil<CAST(@0 AS date) THEN 'Expired' ELSE q.Status END";
@Injectable()
export class QuotesService {
 constructor(private db:Db,private core:FinancialCore){}
 async list(q:Phase2ListDto,a:Actor){
  dateRange(q);const w=new Conditions();w.params.push(bahamasToday());
  if(!allowed(a,'quotes.read'))w.add('q.CustomerId=?',a.customerId||null);else if(q.customerId)w.add('q.CustomerId=?',q.customerId);
  if(!allowed(a,'quotes.read'))w.clauses.push("q.Status<>'Draft'");
  if(q.status)w.add(effective+'=?',q.status);if(q.requestId)w.add('q.RequestId=?',q.requestId);if(q.tripId)w.add('q.TripId=?',q.tripId);
  if(q.search)w.add('(q.QuoteNumber LIKE ? OR c.DisplayName LIKE ?)',like(q.search));
  if(q.from)w.add('q.CreatedAt>=?',q.from);if(q.to)w.add('q.CreatedAt<DATEADD(day,1,CAST(? AS date))',q.to);
  const result=await this.db.page('q.*,c.DisplayName CustomerName,r.RequestNumber,'+effective+' EffectiveStatus','Quotes q JOIN Customers c ON c.Id=q.CustomerId JOIN ServiceRequests r ON r.Id=q.RequestId',w.sql,w.params,q,'q.CreatedAt DESC,q.Id');
  return {...result,items:result.items.map(r=>({...r,Status:r.EffectiveStatus}))};
 }
 async detail(id:string,a:Actor){
  const q=await this.db.get('Quotes',id);financialOwner(a,q.CustomerId,'quotes.read');
  if(q.Status==='Draft'&&!allowed(a,'quotes.read'))throw new ForbiddenException('This quote is not ready to review.');
  const [items,history,customer]=await Promise.all([this.db.query('SELECT * FROM QuoteItems WHERE QuoteId=@0 ORDER BY DisplayOrder',[id]),this.db.query('SELECT TOP(200) h.*,u.DisplayName ActorName FROM QuoteHistory h JOIN Users u ON u.Id=h.ActorId WHERE QuoteId=@0 ORDER BY h.CreatedAt DESC,h.Id',[id]),this.db.get('Customers',q.CustomerId)]);
  return {...q,Status:['Sent','Viewed'].includes(q.Status)&&dateOnly(q.ValidUntil)<bahamasToday()?'Expired':q.Status,AmountDue:Number(q.Deposit)>0?q.Deposit:q.Total,Items:items,History:history,CustomerName:customer.DisplayName};
 }
 save(dto:QuoteDto,a:Actor,id?:string){
  requirePermission(a,'quotes.write');this.core.assertDate(dto.ValidUntil,'Quote validity');
  return this.db.transaction(async tx=>{
   const r=await this.db.one('SELECT * FROM ServiceRequests WITH(UPDLOCK,ROWLOCK) WHERE Id=@0',[dto.RequestId],tx);
   if(!r)throw new BadRequestException('Choose an available service request.');
   if(!['Requested','Under Review','Quoted'].includes(r.Status))throw new BadRequestException('This request is not available for a new or revised quote.');
   const previous=id?await this.db.one('SELECT * FROM Quotes WITH(UPDLOCK,ROWLOCK) WHERE Id=@0',[id],tx):null;
   if(id){if(!previous)throw new NotFoundException();version(previous,dto.Version||0);if(previous.Status!=='Draft'||previous.RequestId.toLowerCase()!==dto.RequestId.toLowerCase())throw new BadRequestException('Only a draft for the same request can be edited.');}
   const calculated=await this.core.calculate(dto,tx);
   const data={RequestId:r.Id,CustomerId:r.CustomerId,TripId:r.TripId,ValidUntil:dto.ValidUntil,Terms:dto.Terms,Notes:dto.Notes,...calculated.values,Version:previous?previous.Version+1:1};
   const quote=id?await this.db.update('Quotes',id,data,a.id,tx):await this.db.insert('Quotes',data,a.id,tx);
   if(id)await this.db.query('DELETE FROM QuoteItems WHERE QuoteId=@0',[id],tx);
   await this.core.items('QuoteItems',quote.Id,calculated.items,a,tx);
   await this.db.insert('QuoteHistory',{QuoteId:quote.Id,PreviousStatus:previous?.Status,NewStatus:'Draft',ActorId:a.id,Notes:id?'Draft revised.':'Quote created.'},a.id,tx);
   await this.db.audit(a.id,id?'Quote changed':'Quote created','Quotes',quote.Id,{total:quote.Total},tx);return quote;
  });
 }
 action(id:string,dto:ActionDto,a:Actor){
  return this.db.transaction(async tx=>{
   const q=await this.db.one('SELECT * FROM Quotes WITH(UPDLOCK,ROWLOCK) WHERE Id=@0',[id],tx);
   if(!q)throw new NotFoundException();financialOwner(a,q.CustomerId,'quotes.read');version(q,dto.Version);
   const customer=a.customerId?.toLowerCase()===q.CustomerId.toLowerCase()&&!allowed(a,'quotes.write'),next=dto.Status;
   if(customer&&!['Viewed','Approved','Rejected'].includes(next))throw new ForbiddenException();if(!customer)requirePermission(a,'quotes.write');
   const transitions:Record<string,string[]>={Draft:['Sent','Cancelled'],Sent:['Viewed','Approved','Rejected','Cancelled','Expired'],Viewed:['Approved','Rejected','Cancelled','Expired'],Approved:['Cancelled']};
   if(!transitions[q.Status]?.includes(next))throw new BadRequestException('This quote transition is not available.');
   if(['Viewed','Approved','Rejected'].includes(next)&&dateOnly(q.ValidUntil)<bahamasToday())throw new BadRequestException('This quote has expired. Please contact your concierge.');
   if(next==='Expired'&&dateOnly(q.ValidUntil)>=bahamasToday())throw new BadRequestException('This quote is still valid.');
   if(next==='Sent')this.core.assertDate(dateOnly(q.ValidUntil),'Quote validity');
   const result=await this.db.update('Quotes',id,{Status:next,Version:q.Version+1},a.id,tx);
   await this.db.insert('QuoteHistory',{QuoteId:id,PreviousStatus:q.Status,NewStatus:next,ActorId:a.id,Notes:dto.Notes},a.id,tx);
   if(next==='Sent')await this.core.requestState(q.RequestId,'Quoted',a,tx);
   if(next==='Approved')await this.core.requestState(q.RequestId,'Client Approved',a,tx);
   if(['Rejected','Expired','Cancelled'].includes(next)){const request=await this.db.get('ServiceRequests',q.RequestId,tx);if(request.Status==='Quoted')await this.core.requestState(q.RequestId,'Under Review',a,tx);}
   if(next==='Sent')await notifyCustomer(this.db,tx,q.CustomerId,'Quote ready',q.QuoteNumber+' is ready for your review.','/quotes/'+id);
   if(['Approved','Rejected'].includes(next))await notifyTeam(this.db,tx,'quotes.write','Quote '+next.toLowerCase(),q.QuoteNumber+' was '+next.toLowerCase()+'.','/quotes/'+id);
   await this.db.audit(a.id,'Quote '+next.toLowerCase(),'Quotes',id,{previous:q.Status,status:next},tx);return result;
  });
 }
}
