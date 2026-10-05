import { Injectable, OnModuleDestroy, OnModuleInit, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createDataSource } from './data-source';
import { Row } from '../common/types';
import { ListDto, pageResult } from '../common/dto';
import { EventEmitter } from 'node:events';
export type Executor = EntityManager | DataSource;
const TABLES = new Set(["Users","Roles","UserRoles","Customers","CustomerPreferences","CustomerGuests","Trips","Flights","Accommodations","ServiceCategories","Services","ServiceOptions","ServiceRequests","ServiceRequestHistory","Itineraries","ItineraryItems","Notifications","AuditLogs","SystemSettings","AuthSessions","PasswordResetTokens","Messages","Quotes","QuoteItems","QuoteHistory","Invoices","InvoiceItems","Payments","Refunds","Vendors","VendorServices","VendorAssignments","VendorAssignmentHistory","Drivers","Vehicles","Transfers","TransferStatusHistory","Conversations","ConversationParticipants","BookingHistory","InvoiceBookings","PaymentAllocations"]);
function identifier(name: string) { if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) throw new Error('Invalid SQL identifier'); return `[${name}]`; }
function table(name: string) { if (!TABLES.has(name)) throw new Error('Invalid table'); return identifier(name); }
@Injectable()
export class Db implements OnModuleInit, OnModuleDestroy {
 source = createDataSource();
 readonly changes=new EventEmitter();
 async onModuleInit() { if (!this.source.isInitialized) await this.source.initialize(); }
 async onModuleDestroy() { if (this.source.isInitialized) await this.source.destroy(); }
 query<T = Row>(sql: string, params: unknown[] = [], tx: Executor = this.source): Promise<T[]> { return tx.query(sql, params); }
 async one(sql: string, params: unknown[] = [], tx: Executor = this.source): Promise<Row | undefined> { return (await this.query(sql,params,tx))[0]; }
 async get(name: string, id: string, tx: Executor = this.source): Promise<Row> {
  const row = await this.one(`SELECT * FROM ${table(name)} WHERE Id=@0`,[id],tx);
  if (!row) throw new NotFoundException('This item is no longer available.');
  return row;
 }
 async insert(name: string, input: Row, actor?: string, tx: Executor = this.source): Promise<Row> {
  const data = { ...input, CreatedBy: actor ?? null, UpdatedBy: actor ?? null };
  const keys = Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined);
  const values = keys.map(k => data[k as keyof typeof data]);
  return (await this.query(`INSERT INTO ${table(name)} (${keys.map(identifier).join(',')}) OUTPUT INSERTED.* VALUES (${keys.map((_,i)=>'@'+i).join(',')})`, values,tx))[0];
 }
 async update(name: string, id: string, input: Row, actor?: string, tx: Executor = this.source): Promise<Row> {
  const data = {...input,UpdatedBy:actor ?? null}; const keys = Object.keys(data).filter(k=>data[k as keyof typeof data] !== undefined);
  const rows = await this.query(`UPDATE ${table(name)} SET ${keys.map((k,i)=>identifier(k)+'=@'+i).join(',')}, UpdatedAt=SYSUTCDATETIME() OUTPUT INSERTED.* WHERE Id=@${keys.length}`, [...keys.map(k=>data[k as keyof typeof data]),id],tx);
  if (!rows[0]) throw new NotFoundException('This item is no longer available.'); return rows[0];
 }
 async transaction<T>(fn:(tx: EntityManager)=>Promise<T>) { const result=await this.source.transaction('READ COMMITTED',fn);this.changes.emit('change');return result; }
 async page(select:string,from:string,where:string,params:unknown[],q:ListDto,order:string) {
  const count=await this.one(`SELECT COUNT(*) Total FROM ${from} WHERE ${where}`,params);
  const items=await this.query(`SELECT ${select} FROM ${from} WHERE ${where} ORDER BY ${order} OFFSET @${params.length} ROWS FETCH NEXT @${params.length+1} ROWS ONLY`,[...params,(q.page-1)*q.limit,q.limit]);
  return pageResult(items,Number(count?.Total||0),q);
 }
 async audit(actor: string, action: string, entity: string, entityId: string | null, metadata: Row = {}, tx: Executor = this.source) {
  await this.insert('AuditLogs',{ActorId:actor,Action:action,Entity:entity,EntityId:entityId,Metadata:JSON.stringify(metadata)},actor,tx);
 }
 async notify(user: string, title: string, body: string, link: string, tx: Executor = this.source) {
  await this.insert('Notifications',{UserId:user,Title:title,Body:body,Link:link},undefined,tx);
 }
}

