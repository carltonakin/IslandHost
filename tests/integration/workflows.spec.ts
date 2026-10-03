import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { readdir,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppModule } from '../../src/server/app.module';
import { configureApp } from '../../src/server/bootstrap';
import { Db } from '../../src/server/database/db';
import { ensureRoles } from '../../src/server/database/seed';
import { hashPassword } from '../../src/server/auth/password';
import { required } from '../../src/server/config';
import { Row } from '../../src/server/common/types';

describe('Phase 1 acceptance against real Microsoft SQL Server',()=>{
 let app:INestApplication;let db:Db;
 let admin:ReturnType<typeof request.agent>;let customer:ReturnType<typeof request.agent>;let outsider:ReturnType<typeof request.agent>;let finance:ReturnType<typeof request.agent>;
 const run=randomUUID().slice(0,8);const password='Integration!'+randomUUID();const origin=required('APP_URL');
 let customerId:string;let tripId:string;let serviceId:string;let categoryId:string;let requestId:string;let customerUserId:string;
 const email='guest-'+run+'@example.test';
 beforeAll(async()=>{
  const main=required('DB_DATABASE');const test=required('TEST_DB_DATABASE');
  if(test===main||!/_Test$/.test(test))throw new Error('Integration tests require a distinct database ending in _Test');
  process.env.DB_DATABASE=test;process.env.NODE_ENV='test';process.env.COOKIE_SECURE='false';process.env.MAIL_MODE='file';process.env.SWAGGER_ENABLED='false';
  console.info('Integration setup: creating Nest application');
  const module=await Test.createTestingModule({imports:[AppModule]}).compile();
  app=module.createNestApplication();configureApp(app);await app.init();db=app.get(Db);
  expect(db.source.options.type).toBe('mssql');
  console.info('Integration setup: applying SQL migrations');
  await db.source.runMigrations({transaction:'all'});await ensureRoles(db);
  console.info('Integration setup: creating scoped test accounts');
  const hash=await hashPassword(password);
  for(const [role,name] of [['SuperAdmin','admin'],['Finance','finance']]){
   const u=await db.insert('Users',{Email:name+'-'+run+'@example.test',DisplayName:'Test '+name,PasswordHash:hash});
   const r=await db.one('SELECT Id FROM Roles WHERE Name=@0',[role]);
   await db.insert('UserRoles',{UserId:u.Id,RoleId:r!.Id});
  }
  admin=request.agent(app.getHttpServer());customer=request.agent(app.getHttpServer());outsider=request.agent(app.getHttpServer());finance=request.agent(app.getHttpServer());
  console.info('Integration setup complete');
 },180000);
 afterAll(async()=>{await app?.close();});
 const post=(agent:ReturnType<typeof request.agent>,path:string,body:Row)=>agent.post('/api'+path).set('Origin',origin).send(body);
 const patch=(agent:ReturnType<typeof request.agent>,path:string,body:Row)=>agent.patch('/api'+path).set('Origin',origin).send(body);

 it('authenticates an admin with HttpOnly cookies and rejects unauthenticated and forged-origin calls',async()=>{
  await request(app.getHttpServer()).get('/api/customers').expect(401);
  await request(app.getHttpServer()).post('/api/auth/login').set('Origin','https://untrusted.example').send({email:'x@example.test',password}).expect(403);
  await post(admin,'/auth/login',{email:'admin-'+run+'@example.test',password:'wrong'}).expect(401);
  const login=await post(admin,'/auth/login',{email:'admin-'+run+'@example.test',password}).expect(200);
  expect(login.body.data.roles).toContain('SuperAdmin');
  expect(login.body.data.access).toBeUndefined();
  const cookies=login.headers['set-cookie'] as unknown as string[];
  expect(cookies.some(c=>c.startsWith('ih_access=')&&c.includes('HttpOnly'))).toBe(true);
  expect(cookies.some(c=>c.startsWith('ih_refresh=')&&c.includes('HttpOnly'))).toBe(true);
  await admin.get('/api/auth/me').expect(200);
  await post(finance,'/auth/login',{email:'finance-'+run+'@example.test',password}).expect(200);
 });
 it('creates a customer, category and service with validation and records audits',async()=>{
  const c=await post(admin,'/customers',{DisplayName:'Acceptance Guest',Email:email,Password:password,Phone:'+1 242 555 0133'}).expect(201);
  customerId=c.body.data.Id;customerUserId=c.body.data.UserId;
  const other=await post(admin,'/customers',{DisplayName:'Separate Guest',Email:'other-'+run+'@example.test',Password:password}).expect(201);
  expect(other.body.data.Id).not.toBe(customerId);
  const category=await post(admin,'/service-categories',{Name:'Private experiences '+run,DisplayOrder:1,Active:true}).expect(201);categoryId=category.body.data.Id;
  const service=await post(admin,'/services',{Name:'Acceptance sunset sail '+run,CategoryId:categoryId,ShortDescription:'A private sunset on Nassau waters.',Description:'An unhurried sunset sail with a private captain and personalised route.',PricingType:'Starting From',StartingPrice:450,Duration:'2 hours',Active:true,Options:[{Name:'Private captain',Price:0}]}).expect(201);
  serviceId=service.body.data.Id;
  await post(admin,'/services',{Name:'Invalid service',CategoryId:categoryId,StartingPrice:-1,Unexpected:true}).expect(400);
  const audit=await db.one("SELECT Id FROM AuditLogs WHERE EntityId=@0 AND Action='Service created'",[serviceId]);expect(audit).toBeTruthy();
 });
 it('enforces role restrictions on both reads and writes',async()=>{
  await post(customer,'/auth/login',{email,password}).expect(200);
  await post(outsider,'/auth/login',{email:'other-'+run+'@example.test',password}).expect(200);
  await customer.get('/api/users').expect(403);
  await customer.get('/api/customers').expect(403);
  await post(customer,'/service-categories',{Name:'Forbidden '+run}).expect(403);
  await post(finance,'/services',{Name:'Forbidden'}).expect(403);
  await finance.get('/api/dashboard').expect(200);
 });
 it('creates and updates a trip and keeps other customers out',async()=>{
  const trip=await post(customer,'/trips',{Name:'Acceptance Bahamas stay '+run,ArrivalDate:'2027-01-10',DepartureDate:'2027-01-17',Adults:2,Children:0,AccommodationName:'Paradise Island villa',ArrivalFlight:'BA 253',ArrivalTime:'14:30'}).expect(201);tripId=trip.body.data.Id;
  await patch(customer,'/trips/'+tripId,{SpecialOccasion:'Anniversary'}).expect(200);
  await outsider.get('/api/trips/'+tripId).expect(403);
  await patch(outsider,'/trips/'+tripId,{Name:'Not yours'}).expect(403);
  await post(customer,'/trips',{Name:'Invalid dates',ArrivalDate:'2027-01-17',DepartureDate:'2027-01-10',Adults:2,Children:0}).expect(400);
  await post(customer,'/trips',{Name:'Spoofed owner',CustomerId:(await db.one('SELECT Id FROM Customers WHERE Email=@0',['other-'+run+'@example.test']))!.Id,ArrivalDate:'2027-01-10',DepartureDate:'2027-01-17',Adults:2,Children:0}).expect(403);
  const detail=await customer.get('/api/trips/'+tripId).expect(200);expect(detail.body.data.AccommodationName).toBe('Paradise Island villa');expect(detail.body.data.ArrivalFlight).toBe('BA 253');
 });
 it('loads the SQL-backed catalog and creates a request with an atomic unique number',async()=>{
  const catalog=await customer.get('/api/services?search='+run).expect(200);
  expect(catalog.body.data.items.some((r:Row)=>r.Id===serviceId)).toBe(true);
  const input={TripId:tripId,ServiceId:serviceId,PreferredDate:'2027-01-12',PreferredTime:'16:30',Guests:2,SpecialRequirements:'Anniversary; no shellfish'};
  await post(customer,'/service-requests',{...input,PreferredDate:'2027-01-20'}).expect(400);
  const created=await post(customer,'/service-requests',input).expect(201);requestId=created.body.data.Id;
  expect(created.body.data.RequestNumber).toMatch(/^IHC-REQ-\d{6,}$/);
  expect(created.body.data.Status).toBe('Requested');
  const second=await post(customer,'/service-requests',input).expect(201);
  expect(second.body.data.RequestNumber).not.toBe(created.body.data.RequestNumber);
  await outsider.get('/api/service-requests/'+requestId).expect(403);
  expect((await outsider.get('/api/service-requests')).body.data.items).toEqual([]);
 });
 it('reviews and confirms a request, recording history, itinerary, notification and audit together',async()=>{
  const listing=await admin.get('/api/service-requests?customerId='+customerId+'&status=Requested').expect(200);
  expect(listing.body.data.items.some((r:Row)=>r.Id===requestId)).toBe(true);
  await patch(customer,'/service-requests/'+requestId+'/status',{Status:'Confirmed',Version:1}).expect(403);
  await patch(finance,'/service-requests/'+requestId+'/status',{Status:'Confirmed',Version:1}).expect(403);
  await patch(admin,'/service-requests/'+requestId+'/status',{Status:'Completed',Version:1}).expect(400);
  await patch(admin,'/service-requests/'+requestId+'/status',{Status:'Under Review',Version:1,Notes:'Checking the best departure time.'}).expect(200);
  await patch(admin,'/service-requests/'+requestId+'/status',{Status:'Confirmed',Version:1}).expect(409);
  const confirmations=await Promise.all([patch(admin,'/service-requests/'+requestId+'/status',{Status:'Confirmed',Version:2,Notes:'Your captain is ready.'}),patch(admin,'/service-requests/'+requestId+'/status',{Status:'Confirmed',Version:2,Notes:'Concurrent confirmation.'})]);
  expect(confirmations.map(r=>r.status).sort()).toEqual([200,409]);
  const detail=await customer.get('/api/service-requests/'+requestId).expect(200);
  expect(detail.body.data.History).toHaveLength(3);
  const itinerary=await customer.get('/api/itineraries?tripId='+tripId).expect(200);
  expect(itinerary.body.data.items.filter((r:Row)=>r.RequestId===requestId)).toHaveLength(1);
  const notifications=await customer.get('/api/notifications').expect(200);
  expect(notifications.body.data.items.some((n:Row)=>n.Body.includes('Confirmed'))).toBe(true);
  const audit=await db.query("SELECT * FROM AuditLogs WHERE EntityId=@0 AND Action='Request status changed'",[requestId]);expect(audit).toHaveLength(2);
  const dashboard=await admin.get('/api/dashboard').expect(200);expect(dashboard.body.data.kpis.ConfirmedServices).toBeGreaterThan(0);
 });
 it('reschedules without duplicate itinerary entries, supports authorised manual entries and cancellation',async()=>{
  await patch(admin,'/service-requests/'+requestId+'/status',{Status:'Rescheduled',Version:3,PreferredDate:'2027-01-13',PreferredTime:'15:00'}).expect(200);
  expect((await customer.get('/api/itineraries?tripId='+tripId)).body.data.items).toHaveLength(0);
  await patch(admin,'/service-requests/'+requestId+'/status',{Status:'Confirmed',Version:4}).expect(200);
  const rows=await db.query('SELECT * FROM ItineraryItems WHERE RequestId=@0',[requestId]);expect(rows).toHaveLength(1);expect(rows[0].EventTime).toBe('15:00');
  await post(customer,'/itineraries',{TripId:tripId,Activity:'Not authorised',EventDate:'2027-01-14',EventTime:'10:00'}).expect(403);
  await post(admin,'/itineraries',{TripId:tripId,Activity:'A personal welcome',EventDate:'2027-01-14',EventTime:'10:00',Location:'Villa terrace'}).expect(201);
  await patch(customer,'/trips/'+tripId,{ArrivalDate:'2027-01-14'}).expect(400);
  await patch(admin,'/service-requests/'+requestId+'/status',{Status:'Cancelled',Version:5}).expect(200);
  const final=await customer.get('/api/itineraries?tripId='+tripId).expect(200);expect(final.body.data.items).toHaveLength(1);expect(final.body.data.items[0].Activity).toBe('A personal welcome');
 });
 it('scopes search, messages and notifications and validates pagination',async()=>{
  const foreign=await outsider.get('/api/search?search='+run).expect(200);expect(foreign.body.data.some((r:Row)=>r.href.includes(tripId))).toBe(false);
  await post(customer,'/messages',{Body:'Could we arrange flowers for the villa?'}).expect(201);
  const messages=await admin.get('/api/messages?customerId='+customerId).expect(200);expect(messages.body.data.items[0].Body).toContain('flowers');
  await post(admin,'/messages',{CustomerId:customerId,Body:'Of course. We will take care of it.'}).expect(201);
  expect((await outsider.get('/api/messages?customerId='+customerId)).body.data.items).toHaveLength(0);
  const before=await customer.get('/api/notifications/unread');expect(before.body.data.Count).toBeGreaterThan(0);
  await post(customer,'/notifications/read-all',{}).expect(201);
  expect((await customer.get('/api/notifications/unread')).body.data.Count).toBe(0);
  await customer.get('/api/services?limit=1000').expect(400);
  await customer.get('/api/services?page=0').expect(400);
  await customer.get('/api/service-requests?date=not-a-date').expect(400);
  await customer.get('/api/itineraries?tripId=not-a-guid').expect(400);
 });
 it('rotates refresh tokens and rejects replay, then revokes the session on logout',async()=>{
  const session=await post(outsider,'/auth/refresh',{}).expect(200);
  const oldCookie=(session.headers['set-cookie'] as unknown as string[]).find(c=>c.startsWith('ih_refresh='))!.split(';')[0];
  await post(outsider,'/auth/refresh',{}).expect(200);
  await request(app.getHttpServer()).post('/api/auth/refresh').set('Origin',origin).set('Cookie',oldCookie).send({}).expect(401);
  await post(outsider,'/auth/logout',{}).expect(200);
  await outsider.get('/api/auth/me').expect(401);
 });
 it('resets a password with a single-use token and revokes existing sessions',async()=>{
  await post(customer,'/auth/forgot-password',{email}).expect(200);
  const folder=resolve(__dirname,'../../.local-mail');
  let token='';
  for(const file of await readdir(folder)){
   const mail=await readFile(resolve(folder,file),'utf8');
   if(mail.startsWith('To: '+email+'\n'))token=mail.match(/token=([a-f0-9]{64})/)?.[1]||'';
  }
  expect(token).toHaveLength(64);
  const nextPassword='New-password!'+randomUUID();
  await post(customer,'/auth/reset-password',{token,password:nextPassword}).expect(200);
  await post(customer,'/auth/reset-password',{token,password:nextPassword}).expect(400);
  await customer.get('/api/auth/me').expect(401);
  await post(customer,'/auth/login',{email,password:nextPassword}).expect(200);
  await post(customer,'/auth/change-password',{currentPassword:nextPassword,password:'Changed-again!'+randomUUID()}).expect(200);
  const live=await db.one('SELECT COUNT(*) Count FROM AuthSessions WHERE UserId=@0 AND RevokedAt IS NULL',[customerUserId]);expect(live!.Count).toBe(0);
 });
});

