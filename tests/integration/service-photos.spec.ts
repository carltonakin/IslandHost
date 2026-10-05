import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir,mkdtemp,readdir,readFile } from 'node:fs/promises';
import { resolve,basename } from 'node:path';
import { AppModule } from '../../src/server/app.module';
import { configureApp } from '../../src/server/bootstrap';
import { Db } from '../../src/server/database/db';
import { ensureRoles } from '../../src/server/database/seed';
import { hashPassword } from '../../src/server/auth/password';
import { required } from '../../src/server/config';
import { PHOTO_MAX_BYTES,ServicePhotosService } from '../../src/server/catalog/service-photos.service';
describe('Service photo uploads against the real API and SQL Server',()=>{
 let app:INestApplication,db:Db,folder:string,png:Buffer;const agents:Record<string,ReturnType<typeof request.agent>>={};
 const origin=required('APP_URL'),run=randomUUID().slice(0,8),password='PhotoUpload!'+randomUUID();
 const send=(role:string,data:Buffer,mime='image/png',name='photo.png')=>agents[role].post('/api/service-photos').set('Origin',origin).attach('file',data,{filename:name,contentType:mime});
 beforeAll(async()=>{
  const test=required('TEST_DB_DATABASE');if(test===required('DB_DATABASE')||!/_Test$/.test(test))throw new Error('A separate _Test database is required');
  await mkdir(resolve('.runtime'),{recursive:true});folder=await mkdtemp(resolve('.runtime/photo-upload-test-'));
  process.env.SERVICE_UPLOAD_DIR=folder;process.env.DB_DATABASE=test;process.env.NODE_ENV='test';process.env.COOKIE_SECURE='false';process.env.MAIL_MODE='file';process.env.SWAGGER_ENABLED='false';
  const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();configureApp(app);await app.init();db=app.get(Db);await db.source.runMigrations({transaction:'all'});await ensureRoles(db);
  const hash=await hashPassword(password);for(const role of ['SuperAdmin','Customer','Finance','Vendor']){const user=await db.insert('Users',{Email:role+'-photo-'+run+'@example.test',DisplayName:'Photo '+role,PasswordHash:hash});const assignment=await db.one('SELECT Id FROM Roles WHERE Name=@0',[role]);await db.insert('UserRoles',{UserId:user.Id,RoleId:assignment!.Id});agents[role]=request.agent(app.getHttpServer());await agents[role].post('/api/auth/login').set('Origin',origin).send({email:user.Email,password}).expect(200);}
  png=await sharp({create:{width:320,height:240,channels:3,background:'#0E7A86'}}).png().toBuffer();
 },180000);
 afterAll(async()=>{await app?.close();});
 it('rejects anonymous, customer, finance, supplier and forged-origin uploads without storing files',async()=>{
  const before=await readdir(folder);await request(app.getHttpServer()).post('/api/service-photos').set('Origin',origin).attach('file',png,'photo.png').expect(401);
  for(const role of ['Customer','Finance','Vendor'])await send(role,png).expect(403);
  await agents.SuperAdmin.post('/api/service-photos').set('Origin','https://untrusted.example').attach('file',png,'photo.png').expect(403);expect(await readdir(folder)).toEqual(before);
 });
 it('normalizes a real image, strips metadata and serves it publicly as an immutable image',async()=>{
  const jpeg=await sharp({create:{width:3000,height:1500,channels:3,background:'#29A5D2'}}).withMetadata({orientation:6}).jpeg().toBuffer();
  const uploaded=(await send('SuperAdmin',jpeg,'image/jpeg','../../web.config').expect(201)).body.data;
  expect(uploaded.Url).toMatch(/^\/api\/service-photos\/[0-9a-f-]+\.webp$/);expect(uploaded.Width).toBe(1000);expect(uploaded.Height).toBe(2000);
  const saved=await readFile(resolve(folder,basename(uploaded.Url)));const metadata=await sharp(saved).metadata();expect(metadata.format).toBe('webp');expect(metadata.exif).toBeUndefined();expect(metadata.orientation).toBeUndefined();
  const publicImage=await request(app.getHttpServer()).get(uploaded.Url).expect(200);expect(publicImage.headers['content-type']).toContain('image/webp');expect(publicImage.headers['x-content-type-options']).toBe('nosniff');expect(publicImage.headers['cache-control']).toContain('immutable');expect(publicImage.body).toEqual(saved);
  const restartedStorage=new ServicePhotosService(db);const reopened=await restartedStorage.read(basename(uploaded.Url));expect(reopened.getHeaders().length).toBe(saved.length);reopened.getStream().destroy();
  expect(await db.one("SELECT Id FROM AuditLogs WHERE Entity='ServicePhotos' AND EntityId=@0",[basename(uploaded.Url,'.webp')])).toBeTruthy();
 });
 it('keeps existing-name uploads distinct and attaches photos to a published service',async()=>{
  const a=(await send('SuperAdmin',png).expect(201)).body.data,b=(await send('SuperAdmin',png).expect(201)).body.data;expect(a.Url).not.toBe(b.Url);
  const category=await db.insert('ServiceCategories',{Name:'Photo category '+run});
  const service=(await agents.SuperAdmin.post('/api/services').set('Origin',origin).send({CategoryId:category.Id,Name:'Photo listing '+run,ShortDescription:'Photo integration fixture',Description:'Temporary image test listing',PricingType:'Fixed',Image:a.Url,Images:JSON.stringify([b.Url]),Published:true,Destination:'Jamaica'}).expect(201)).body.data;
  const listing=(await request(app.getHttpServer()).get('/api/marketplace/listings/'+service.Id).expect(200)).body.data;expect(listing.Image).toBe(a.Url);expect(JSON.parse(listing.Images)).toEqual([b.Url]);
  await agents.SuperAdmin.patch('/api/services/'+service.Id).set('Origin',origin).send({Image:b.Url,Images:'[]'}).expect(200);expect((await db.get('Services',service.Id)).Image).toBe(b.Url);await request(app.getHttpServer()).get(a.Url).expect(200);
 });
 it('rejects disguised, unsupported, corrupt, oversized and multiple files',async()=>{
  const before=await readdir(folder);
  await send('SuperAdmin',Buffer.from('<script>alert(1)</script>'),'image/png').expect(400);
  await send('SuperAdmin',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),'image/svg+xml','photo.svg').expect(400);
  await send('SuperAdmin',png,'image/jpeg','photo.jpg').expect(400);await send('SuperAdmin',png.subarray(0,30)).expect(400);
  await send('SuperAdmin',Buffer.alloc(PHOTO_MAX_BYTES+1,1)).expect(413);
  await agents.SuperAdmin.post('/api/service-photos').set('Origin',origin).attach('file',png,'one.png').attach('file',png,'two.png').expect(400);
  await agents.SuperAdmin.post('/api/service-photos').set('Origin',origin).send({}).expect(400);expect(await readdir(folder)).toEqual(before);
 });
 it('rejects excessive decoded dimensions and cannot read arbitrary paths',async()=>{
  const large=await sharp({create:{width:6000,height:4000,channels:3,background:'#F1C232'}}).png().toBuffer();await send('SuperAdmin',large).expect(400);
  for(const path of ['/api/service-photos/web.config','/api/service-photos/.env','/api/service-photos/%2e%2e%5cweb.config','/api/service-photos/'+randomUUID()+'.webp'])await request(app.getHttpServer()).get(path).expect(404);
 });
});