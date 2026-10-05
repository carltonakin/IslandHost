import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/server/app.module';
import { configureApp } from '../../src/server/bootstrap';
import { Db } from '../../src/server/database/db';
import { ensureRoles } from '../../src/server/database/seed';
import { hashPassword } from '../../src/server/auth/password';
import { required } from '../../src/server/config';
import { bahamasToday,Row } from '../../src/server/common/types';
describe('Marketplace confirmation and checkout against real SQL Server',()=>{
 let app:INestApplication,db:Db,serviceId:string,hiddenId:string;
 const agents:Record<string,ReturnType<typeof request.agent>>={};const users:Record<string,Row>={};
 const run=randomUUID().slice(0,8),password='Marketplace!'+randomUUID(),origin=required('APP_URL');
 const start=new Date(Date.now()+80*86400000).toISOString().slice(0,10),end=new Date(Date.now()+90*86400000).toISOString().slice(0,10);
 const planInput={Name:'Marketplace '+run,Destination:'Jamaica',ArrivalDate:start,DepartureDate:end,Adults:2,Children:0};
 const post=(role:string,path:string,body:Row)=>agents[role].post('/api'+path).set('Origin',origin).send(body);
 const patch=(role:string,path:string,body:Row)=>agents[role].patch('/api'+path).set('Origin',origin).send(body);
 const itemInput=()=>({ServiceId:serviceId,EventDate:start,EventTime:'10:00',Quantity:1,PartySize:2});
 const plan=async()=> (await post('member','/trip-plans',planInput).expect(201)).body.data;
 const add=async(id:string)=>(await post('member','/trip-plans/'+id+'/items',itemInput()).expect(201)).body.data;
 const state=async(role:string,item:Row,Status:string,extra:Row={})=>(await patch(role,'/bookings/'+item.Id+'/status',{Version:item.Version,Status,...extra}).expect(200)).body.data;
 const confirm=async(item:Row,amount='123.45')=>state('admin',await state('member',item,'PENDING_CONFIRMATION'),'CONFIRMED',{ConfirmedPrice:amount,ConfirmationReference:'REF-'+randomUUID(),ConfirmationExpiresAt:new Date(Date.now()+3600000).toISOString()});
 const checkout=(p:Row,items:Row[],key=randomUUID())=>post('member','/trip-plans/'+p.Id+'/checkout',{ItemIds:items.map(i=>i.Id),IdempotencyKey:key});
 const paymentInput=(invoice:Row)=>({InvoiceId:invoice.Id,Amount:String(invoice.Total),Method:'Bank Transfer',ProviderReference:'bank-'+randomUUID(),IdempotencyKey:randomUUID(),ReceivedDate:bahamasToday()});
 beforeAll(async()=>{
  const main=required('DB_DATABASE'),test=required('TEST_DB_DATABASE');if(main===test||!/_Test$/.test(test))throw new Error('A separate _Test database is required');
  process.env.DB_DATABASE=test;process.env.NODE_ENV='test';process.env.COOKIE_SECURE='false';process.env.MAIL_MODE='file';process.env.PAYMENT_PROVIDER='manual';process.env.SWAGGER_ENABLED='false';
  const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();configureApp(app);await app.init();db=app.get(Db);await db.source.runMigrations({transaction:'all'});await ensureRoles(db);
  const hash=await hashPassword(password);
  for(const [name,role] of Object.entries({admin:'SuperAdmin',member:'Customer',outsider:'Customer',supplier:'Vendor',otherSupplier:'Vendor'})){
   const user=await db.insert('Users',{Email:name+'-'+run+'@example.test',DisplayName:name+' '+run,PasswordHash:hash});users[name]=user;const r=await db.one('SELECT Id FROM Roles WHERE Name=@0',[role]);await db.insert('UserRoles',{UserId:user.Id,RoleId:r!.Id});if(role==='Customer')await db.insert('Customers',{UserId:user.Id,DisplayName:user.DisplayName,Email:user.Email});agents[name]=request.agent(app.getHttpServer());await post(name,'/auth/login',{email:user.Email,password}).expect(200);
  }
  const category=await db.insert('ServiceCategories',{Name:'Marketplace test '+run});
  const vendor=await db.insert('Vendors',{Name:'Supplier '+run,Type:'Tours',UserId:users.supplier.Id});
  serviceId=(await db.insert('Services',{CategoryId:category.Id,VendorId:vendor.Id,Name:'Jamaica experience '+run,ShortDescription:'Integration fixture',Description:'Verification only',PricingType:'Fixed',StartingPrice:'99.99',Destination:'Jamaica',Location:'Negril',Published:true,Bookable:true})).Id;
  hiddenId=(await db.insert('Services',{CategoryId:category.Id,Name:'Unpublished '+run,ShortDescription:'Private',Description:'Private fixture',PricingType:'Fixed',StartingPrice:'1.00',Published:false})).Id;
 },180000);
 afterAll(async()=>{await app?.close();});
 it('browses only public active listings with destination and location filters',async()=>{
  const result=await request(app.getHttpServer()).get('/api/marketplace/listings?destination=Jamaica&location=Negril&search='+run).expect(200);expect(result.body.data.items.map((r:Row)=>r.Id)).toContain(serviceId);expect(result.body.data.items.map((r:Row)=>r.Id)).not.toContain(hiddenId);
  const detail=(await request(app.getHttpServer()).get('/api/marketplace/listings/'+serviceId).expect(200)).body.data;expect(detail.VendorId).toBeUndefined();await request(app.getHttpServer()).get('/api/marketplace/listings/'+hiddenId).expect(404);
  const categories=(await request(app.getHttpServer()).get('/api/marketplace/categories').expect(200)).body.data;expect(categories.some((r:Row)=>r.Name==='Resorts')).toBe(true);
 });
 it('attaches a guest draft once, preserving details and enforcing account ownership',async()=>{
  const input={...planInput,GuestReference:randomUUID(),Items:[{...itemInput(),Notes:'Guest note',Pickup:'Hotel'}]};
  const a=(await post('member','/trip-plans/import',input).expect(201)).body.data;const b=(await post('member','/trip-plans/import',input).expect(201)).body.data;expect(a.Id).toBe(b.Id);
  const detail=(await agents.member.get('/api/trip-plans/'+a.Id).expect(200)).body.data;expect(detail.Items).toHaveLength(1);expect(detail.Items[0].Notes).toBe('Guest note');
  await post('outsider','/trip-plans/import',input).expect(403);await agents.outsider.get('/api/trip-plans/'+a.Id).expect(403);await patch('outsider','/bookings/'+detail.Items[0].Id,{Version:1,PartySize:4}).expect(403);
 });
 it('adds, edits and removes planned items without allowing price or status injection',async()=>{
  const p=await plan();let item=await add(p.Id);
  await post('member','/trip-plans/'+p.Id+'/items',{...itemInput(),ConfirmedPrice:'0.01',BookingStatus:'CONFIRMED'}).expect(400);
  await patch('member','/bookings/'+item.Id,{Version:item.Version,ConfirmedPrice:'0.01'}).expect(400);
  item=(await patch('member','/bookings/'+item.Id,{Version:item.Version,PartySize:3}).expect(200)).body.data;expect(item.PartySize).toBe(3);
  item=await state('member',item,'CANCELLED',{Notes:'Changed plans'});expect(item.Active).toBe(false);await checkout(p,[item]).expect(400);
 });
 it('blocks planned, pending, rejected and expired bookings and unauthorized confirmation',async()=>{
  const p=await plan();let item=await add(p.Id);await checkout(p,[item]).expect(400);
  item=await state('member',item,'PENDING_CONFIRMATION');await checkout(p,[item]).expect(400);
  const fields={Status:'CONFIRMED',Version:item.Version,ConfirmedPrice:'123.45',ConfirmationReference:'TEST'};
  await patch('member','/bookings/'+item.Id+'/status',fields).expect(403);await patch('otherSupplier','/bookings/'+item.Id+'/status',fields).expect(403);
  item=await state('supplier',item,'REJECTED',{Notes:'No availability'});await checkout(p,[item]).expect(400);
  item=await state('member',item,'PENDING_CONFIRMATION');item=await state('supplier',item,'CONFIRMED',{ConfirmedPrice:'123.45',ConfirmationReference:'SUPPLIER-TEST'});
  await db.update('ItineraryItems',item.Id,{ConfirmationExpiresAt:new Date(Date.now()-1000)});await checkout(p,[item]).expect(400);
  expect((await agents.member.get('/api/trip-plans/'+p.Id)).body.data.Items[0].EffectiveStatus).toBe('EXPIRED');
 });
 it('invalidates an invoice after a material change and requires reconfirmation',async()=>{
  const p=await plan();let item=await confirm(await add(p.Id));const invoice=(await checkout(p,[item]).expect(201)).body.data;
  item=(await patch('member','/bookings/'+item.Id,{Version:item.Version,PartySize:4}).expect(200)).body.data;expect(item.BookingStatus).toBe('CHANGE_REQUESTED');expect(item.ConfirmedPrice).toBeNull();expect((await db.get('Invoices',invoice.Id)).Status).toBe('Cancelled');await post('admin','/payments',paymentInput(invoice)).expect(400);await checkout(p,[item]).expect(400);
  item=await state('member',item,'RECONFIRMING');item=await state('admin',item,'CONFIRMED',{ConfirmedPrice:'150.00',ConfirmationReference:'RECONFIRMED'});const updated=(await checkout(p,[item]).expect(201)).body.data;expect(Number(updated.Total)).toBe(150);expect(updated.Id).not.toBe(invoice.Id);
 });
 it('uses confirmed totals, survives concurrent retries and settles exactly the selected items',async()=>{
  const p=await plan();let a=await confirm(await add(p.Id),'123.45');const b=await confirm(await add(p.Id),'21.10');const untouched=await add(p.Id);
  const key=randomUUID();const invoices=await Promise.all([checkout(p,[a,b],key),checkout(p,[a,b],key)]);expect(invoices.map(r=>r.status)).toEqual([201,201]);const invoice=invoices[0].body.data;expect(invoice.Id).toBe(invoices[1].body.data.Id);expect(Number(invoice.Total)).toBe(144.55);
  await checkout(p,[a,b]).expect(400);await checkout(p,[a],key).expect(409);await post('outsider','/trip-plans/'+p.Id+'/checkout',{ItemIds:[a.Id],IdempotencyKey:randomUUID()}).expect(403);
  a=(await patch('member','/bookings/'+a.Id,{Version:a.Version,Notes:'No material change'}).expect(200)).body.data;
  const input=paymentInput(invoice);await post('member','/payments',input).expect(403);await post('admin','/payments',{...input,Amount:'1.00'}).expect(400);
  const payments=await Promise.all([post('admin','/payments',input),post('admin','/payments',input)]);expect(payments.map(r=>r.status)).toEqual([201,201]);const payment=payments[0].body.data;expect(payment.Id).toBe(payments[1].body.data.Id);
  await post('admin','/payments',{...input,IdempotencyKey:randomUUID()}).expect(400);
  const allocation=await db.query('SELECT * FROM PaymentAllocations WHERE PaymentId=@0',[payment.Id]);expect(allocation).toHaveLength(2);expect(allocation.map(r=>r.ItineraryItemId).sort()).toEqual([a.Id,b.Id].sort());expect((await db.get('ItineraryItems',a.Id)).PaymentStatus).toBe('PAID');expect((await db.get('ItineraryItems',untouched.Id)).PaymentStatus).toBe('UNPAID');
  expect((await agents.member.get('/api/payments/'+payment.Id).expect(200)).body.data.Status).toBe('Paid');await agents.outsider.get('/api/payments/'+payment.Id).expect(403);
  const refund=(await post('admin','/refunds',{PaymentId:payment.Id,Amount:'144.55',Reason:'Integration reversal',ProviderReference:'refund-'+randomUUID(),IdempotencyKey:randomUUID(),RefundedDate:bahamasToday()}).expect(201)).body.data;expect(Number(refund.Amount)).toBe(144.55);expect((await db.get('ItineraryItems',a.Id)).PaymentStatus).toBe('REFUNDED');await checkout(p,[a]).expect(400);
 });
 it('keeps quote approval separate from marketplace confirmation',async()=>{
  const p=await plan();const pending=await state('member',await add(p.Id),'PENDING_CONFIRMATION');const stored=await db.get('ItineraryItems',pending.Id);
  const q=(await post('admin','/quotes',{RequestId:stored.RequestId,ValidUntil:end,Items:[{ServiceId:serviceId,Description:'Confirmed total proposal',Quantity:1,UnitPrice:'145.00'}]}).expect(201)).body.data;
  await patch('admin','/quotes/'+q.Id+'/status',{Status:'Sent',Version:1}).expect(200);await patch('member','/quotes/'+q.Id+'/status',{Status:'Approved',Version:2}).expect(200);
  const invoice=(await post('admin','/quotes/'+q.Id+'/invoice',{Version:3,DueDate:end}).expect(201)).body.data;await patch('admin','/invoices/'+invoice.Id+'/status',{Status:'Issued',Version:1}).expect(200);
  await post('admin','/payments',paymentInput(invoice)).expect(400);expect((await db.get('ItineraryItems',pending.Id)).BookingStatus).toBe('PENDING_CONFIRMATION');
  await state('admin',pending,'CONFIRMED',{ConfirmedPrice:'145.00',ConfirmationReference:'QUOTED-CONFIRMATION'});await post('admin','/payments',paymentInput(invoice)).expect(201);expect((await db.get('ItineraryItems',pending.Id)).PaymentStatus).toBe('PAID');
 });
 it('serializes a payment racing a material edit without collecting on an invalid confirmation',async()=>{
  const p=await plan();const item=await confirm(await add(p.Id));const invoice=(await checkout(p,[item]).expect(201)).body.data;
  const [edited,paid]=await Promise.all([patch('member','/bookings/'+item.Id,{Version:item.Version,Quantity:2}),post('admin','/payments',paymentInput(invoice))]);expect(edited.status).toBe(200);expect([201,400]).toContain(paid.status);const current=await db.get('ItineraryItems',item.Id);expect(current.BookingStatus).toBe('CHANGE_REQUESTED');expect(current.ConfirmedPrice).toBeNull();expect(current.PaymentStatus).toBe(paid.status===201?'PAID':'UNPAID');
 });
});