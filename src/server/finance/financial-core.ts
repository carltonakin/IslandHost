import { BadRequestException,Injectable } from '@nestjs/common';
import { Db,Executor } from '../database/db';
import { Actor,Row,Status,bahamasToday } from '../common/types';
import { RequestsService } from '../requests/requests.service';
import { AmountsDto } from './finance.dto';
import { totals } from './money';
@Injectable()
export class FinancialCore {
 constructor(private db:Db,private requests:RequestsService){}
 async calculate(dto:AmountsDto,tx:Executor){
  const amounts=totals(dto.Items,dto.TaxRate??0,dto.Fees??0,dto.Discount??0,dto.Deposit??0);
  const ids=[...new Set(dto.Items.map(i=>i.ServiceId).filter(Boolean))];
  const services=ids.length?await this.db.query('SELECT s.Id,s.Name,s.CategoryId,c.Name CategoryName FROM Services s JOIN ServiceCategories c ON c.Id=s.CategoryId WHERE s.Id IN ('+ids.map((_,i)=>'@'+i).join(',')+')',ids,tx):[];
  const items=dto.Items.map((line,i)=>{const service=services.find(s=>s.Id.toLowerCase()===line.ServiceId?.toLowerCase());if(line.ServiceId&&!service)throw new BadRequestException('A selected service is not available.');return {ServiceId:service?.Id,CategoryId:service?.CategoryId,ServiceName:service?.Name,CategoryName:service?.CategoryName,Description:line.Description,Quantity:line.Quantity,UnitPrice:line.UnitPrice,LineTotal:amounts.Lines[i],DisplayOrder:i};});
  const {Lines:_lines,...values}=amounts;return {values,items};
 }
 async items(table:'QuoteItems'|'InvoiceItems',parent:string,items:Row[],a:Actor,tx:Executor){
  for(const item of items){const {Id:_id,CreatedAt:_created,UpdatedAt:_updated,CreatedBy:_by,UpdatedBy:_up,QuoteId:_quote,InvoiceId:_invoice,...data}=item;await this.db.insert(table,{...data,[table==='QuoteItems'?'QuoteId':'InvoiceId']:parent},a.id,tx);}
 }
 async requestState(id:string,target:Status,a:Actor,tx:Executor){
  let r=await this.db.get('ServiceRequests',id,tx);
  const elevated={...a,permissions:[...a.permissions,'requests.write','operations.read']};
  const stages:Record<string,Status[]>={Quoted:['Under Review','Quoted'],'Client Approved':['Client Approved'],'Payment Required':['Payment Required'],Confirmed:['Confirmed'],'Under Review':['Under Review']};
  if(target==='Quoted'&&r.Status==='Under Review')stages.Quoted=['Quoted'];
  if(r.Status===target)return r;
  for(const next of stages[target]||[]){
   if(r.Status===next)continue;
   if(target==='Confirmed'&&['Confirmed','Assigned','In Progress','Completed','Cancelled','Refunded','Unavailable'].includes(r.Status))return r;
   r=await this.requests.status(id,{Status:next,Version:r.Version,Notes:'Updated through '+(target==='Confirmed'?'payment confirmation':'the quotation workflow')+'.'},elevated,tx);
  }return r;
 }
 assertDate(date:string,label:string){if(date<bahamasToday())throw new BadRequestException(label+' cannot be in the past.');}
}
