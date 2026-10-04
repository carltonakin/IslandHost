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

describe('Phase 2 persistence and permissions against real SQL Server',()=>{
 let app:INestApplication;let db:Db;
 let admin:ReturnType<typeof request.agent>;let member:ReturnType<typeof request.agent>;let vendor:ReturnType<typeof request.agent>;let driver:ReturnType<typeof request.agent>;
 let adminUserId:string;let tripId:string;let serviceId:string;let requestId:string;let driverUserId:string;let vendorUserId:string;
 const run=randomUUID().slice(0,8);const password='Phase2!'+randomUUID();const origin=required('APP_URL');
 const arrival=new Date(Date.now()+60*86400000).toISOString().slice(0,10);const departure=new Date(Date.now()+65*86400000).toISOString().slice(0,10);
 const post=(agent:ReturnType<typeof request.agent>,path:string,body:Row)=>agent.post('/api'+path).set('Origin',origin).send(body);
 const patch=(agent:ReturnType<typeof request.agent>,path:string,body:Row)=>agent.patch('/api'+path).set('Origin',origin).send(body);
 beforeAll(async()=>{
  const main=required('DB_DATABASE');const test=required('TEST_DB_DATABASE');if(test===main||!/_Test$/.test(test))throw new Error('Phase 2 tests require a separate database ending in _Test');
  process.env.DB_DATABASE=test;process.env.NODE_ENV='test';process.env.COOKIE_SECURE='false';process.env.MAIL_MODE='file';process.env.SWAGGER_ENABLED='false';process.env.PAYMENT_PROVIDER='manual';
  const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();configureApp(app);await app.init();db=app.get(Db);
  await db.source.runMigrations({transaction:'all'});await ensureRoles(db);const hash=await hashPassword(password);const users:Record<string,Row>={};
  for(const role of ['SuperAdmin','Customer','Vendor','Driver']){
   const user=await db.insert('Users',{Email:role.toLowerCase()+'-'+run+'@example.test',DisplayName:role+' '+run,PasswordHash:hash});
   const assignment=await db.one('SELECT Id FROM Roles WHERE Name=@0',[role]);await db.insert('UserRoles',{UserId:user.Id,RoleId:assignment!.Id});users[role]=user;
  }
  adminUserId=users.SuperAdmin.Id;driverUserId=users.Driver.Id;vendorUserId=users.Vendor.Id;
  await db.insert('Customers',{UserId:users.Customer.Id,DisplayName:'Phase 2 '+run,Email:users.Customer.Email});

  const category=await db.insert('ServiceCategories',{Name:'Phase 2 '+run});
  serviceId=(await db.insert('Services',{CategoryId:category.Id,Name:'Phase 2 transfer '+run,ShortDescription:'Private SQL verification transfer',Description:'Isolated automated test fixture',PricingType:'Fixed',StartingPrice:100.10,TransportApplicable:true})).Id;
  admin=request.agent(app.getHttpServer());member=request.agent(app.getHttpServer());vendor=request.agent(app.getHttpServer());driver=request.agent(app.getHttpServer());
  for(const [agent,role] of [[admin,'SuperAdmin'],[member,'Customer'],[vendor,'Vendor'],[driver,'Driver']] as const)await post(agent,'/auth/login',{email:users[role].Email,password}).expect(200);
  tripId=(await post(member,'/trips',{Name:'Phase 2 '+run,ArrivalDate:arrival,DepartureDate:departure,Adults:2,Children:0}).expect(201)).body.data.Id;
  requestId=(await post(member,'/service-requests',{TripId:tripId,ServiceId:serviceId,PreferredDate:arrival,PreferredTime:'10:00',Guests:2}).expect(201)).body.data.Id;
 },180000);
 afterAll(async()=>{await app?.close();});
 it('persists quotes, invoices, idempotent payments and refunds with member ownership',async()=>{
  const quote=(await post(admin,'/quotes',{RequestId:requestId,ValidUntil:departure,Items:[{ServiceId:serviceId,Description:'SQL transfer verification',Quantity:2,UnitPrice:'100.10'}],TaxRate:'10',Fees:'5.05'}).expect(201)).body.data;
  expect(Number(quote.Total)).toBe(225.27);
  await member.get('/api/quotes/'+quote.Id).expect(403);
  await patch(admin,'/quotes/'+quote.Id+'/status',{Status:'Sent',Version:1}).expect(200);
  await member.get('/api/quotes/'+quote.Id).expect(200);
  await patch(member,'/quotes/'+quote.Id+'/status',{Status:'Approved',Version:2}).expect(200);
  const invoice=(await post(admin,'/quotes/'+quote.Id+'/invoice',{Version:3,DueDate:departure}).expect(201)).body.data;
  await patch(admin,'/invoices/'+invoice.Id+'/status',{Status:'Issued',Version:1}).expect(200);
  const paymentInput={InvoiceId:invoice.Id,Amount:'225.27',Method:'Cash',ProviderReference:'payment-'+run,IdempotencyKey:'payment-'+randomUUID(),ReceivedDate:bahamasToday()};
  await post(member,'/payments',paymentInput).expect(403);
  const payment=(await post(admin,'/payments',paymentInput).expect(201)).body.data;
  expect((await post(admin,'/payments',paymentInput).expect(201)).body.data.Id).toBe(payment.Id);
  expect((await admin.get('/api/service-requests/'+requestId).expect(200)).body.data.Status).toBe('Confirmed');
  const refundInput={PaymentId:payment.Id,Amount:'25.27',Reason:'SQL verification credit',ProviderReference:'refund-'+run,IdempotencyKey:'refund-'+randomUUID(),RefundedDate:bahamasToday()};
  const refund=(await post(admin,'/refunds',refundInput).expect(201)).body.data;
  expect((await post(admin,'/refunds',refundInput).expect(201)).body.data.Id).toBe(refund.Id);
  const final=(await member.get('/api/invoices/'+invoice.Id).expect(200)).body.data;
  expect(Number(final.AmountPaid)).toBe(200);expect(Number(final.RefundedAmount)).toBe(25.27);expect(Number(final.BalanceDue)).toBe(0);
  await admin.get('/api/financial-dashboard').expect(200);await member.get('/api/financial-dashboard').expect(403);
  await vendor.get('/api/invoices/'+invoice.Id).expect(403);
 });
 it('persists vendor services, assignments and role-scoped status history',async()=>{
  const partner=(await post(admin,'/vendors',{Name:'Partner '+run,Type:'Transportation',UserId:vendorUserId}).expect(201)).body.data;
  await post(admin,'/vendors/'+partner.Id+'/services',{ServiceId:serviceId,Cost:'80.10'}).expect(201);
  const assignment=(await post(admin,'/vendor-assignments',{VendorId:partner.Id,RequestId:requestId}).expect(201)).body.data;
  expect(Number(assignment.Cost)).toBe(80.10);
  await patch(admin,'/vendor-assignments/'+assignment.Id+'/status',{Status:'Assigned',Version:1}).expect(200);
  await patch(vendor,'/vendor-assignments/'+assignment.Id+'/status',{Status:'Accepted',Version:2}).expect(200);
  const detail=(await vendor.get('/api/vendor-assignments/'+assignment.Id).expect(200)).body.data;expect(detail.History).toHaveLength(3);
  await member.get('/api/vendor-assignments/'+assignment.Id).expect(403);
 });
 it('persists drivers, vehicles, dispatch assignments and driver status updates',async()=>{
  const person=(await post(admin,'/drivers',{UserId:driverUserId,DisplayName:'Driver '+run,LicenseNumber:'TEST-'+run}).expect(201)).body.data;
  const vehicle=(await post(admin,'/vehicles',{Name:'Vehicle '+run,Registration:'TEST-'+run,Capacity:4}).expect(201)).body.data;
  const transfer=(await post(admin,'/transfers',{RequestId:requestId,Type:'Airport Pickup',Pickup:'Test airport',Destination:'Test hotel',Passengers:2,ScheduledDate:arrival,ScheduledTime:'10:00',DurationMinutes:60,DirectCost:'60.25'}).expect(201)).body.data;
  await patch(admin,'/transfers/'+transfer.Id+'/assign',{DriverId:person.Id,VehicleId:vehicle.Id,Version:1}).expect(200);
  await patch(driver,'/transfers/'+transfer.Id+'/status',{Status:'En Route',Version:2}).expect(200);
  const detail=(await driver.get('/api/transfers/'+transfer.Id).expect(200)).body.data;
  expect(detail.Status).toBe('En Route');expect(detail.History).toHaveLength(3);expect(detail.DirectCost).toBeUndefined();
  await member.get('/api/transfers/'+transfer.Id).expect(403);
  await admin.get('/api/dispatch?date='+arrival).expect(200);
 });
 it('persists conversations, messages and read positions without exposing them to outsiders',async()=>{
  const conversation=(await post(member,'/conversations',{Subject:'Conversation '+run,Kind:'Customer'}).expect(201)).body.data;
  const message=(await post(member,'/conversations/'+conversation.Id+'/messages',{Body:'Please confirm the transfer details.'}).expect(201)).body.data;
  const listing=(await admin.get('/api/conversations/'+conversation.Id+'/messages').expect(200)).body.data;
  expect(listing.items.some((row:Row)=>row.Id===message.Id)).toBe(true);
  await post(admin,'/conversations/'+conversation.Id+'/read',{ThroughSequence:Number(message.MessageSequence)}).expect(201);
  const participant=await db.one('SELECT LastReadSequence FROM ConversationParticipants WHERE ConversationId=@0 AND UserId=@1',[conversation.Id,adminUserId]);
  expect(Number(participant?.LastReadSequence)).toBe(Number(message.MessageSequence));
  await vendor.get('/api/conversations/'+conversation.Id).expect(403);
  await member.get('/api/users').expect(403);
 });
});
