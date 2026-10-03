import { ForbiddenException,Injectable } from '@nestjs/common';
import { Db } from '../database/db';
import { Actor,allowed } from '../common/types';
import { ListDto,like } from '../common/dto';
import { ownCustomer } from '../auth/access';
import { hashPassword } from '../auth/password';
import { CustomerDto,CustomerPatchDto,ProfileDto,PreferencesDto,GuestDto } from './crm.dto';
@Injectable()
export class CustomersService {
 constructor(private db:Db) {}
 list(q:ListDto) {
  const params:unknown[]=[];let where='1=1';
  if(q.search){params.push(like(q.search));where='(c.DisplayName LIKE @0 OR c.Email LIKE @0)';}
  return this.db.page("c.*, (SELECT COUNT(*) FROM ServiceRequests r WHERE r.CustomerId=c.Id AND r.Status NOT IN ('Completed','Cancelled','Refunded','Unavailable')) ActiveRequests,(SELECT MIN(t.ArrivalDate) FROM Trips t WHERE t.CustomerId=c.Id AND t.DepartureDate>=CAST(GETUTCDATE() AS date)) UpcomingTrip",'Customers c',where,params,q,'c.DisplayName,c.Id');
 }
 async detail(id:string,a:Actor) {
  ownCustomer(a,id);const c=await this.db.get('Customers',id);
  const [preferences,guests]=await Promise.all([this.db.one('SELECT * FROM CustomerPreferences WHERE CustomerId=@0',[id]),this.db.query('SELECT TOP (100) * FROM CustomerGuests WHERE CustomerId=@0 ORDER BY DisplayName',[id])]);
  return {...c,Preferences:preferences||{},Guests:guests};
 }
 async create(dto:CustomerDto,a:Actor) {
  const hash=await hashPassword(dto.Password);
  return this.db.transaction(async tx=>{
   const user=await this.db.insert('Users',{Email:dto.Email.toLowerCase(),DisplayName:dto.DisplayName,Phone:dto.Phone,PasswordHash:hash},a.id,tx);
   const role=await this.db.one("SELECT Id FROM Roles WHERE Name='Customer'",[],tx);
   if(!role)throw new Error('Roles are not initialized');
   await this.db.insert('UserRoles',{UserId:user.Id,RoleId:role.Id},a.id,tx);
   const customer=await this.db.insert('Customers',{UserId:user.Id,DisplayName:dto.DisplayName,Email:dto.Email.toLowerCase(),Phone:dto.Phone,Notes:dto.Notes},a.id,tx);
   await this.db.insert('CustomerPreferences',{CustomerId:customer.Id},a.id,tx);
   await this.db.audit(a.id,'Customer created','Customers',customer.Id,{},tx);return customer;
  });
 }
 async patch(id:string,dto:CustomerPatchDto|ProfileDto,a:Actor) {
  ownCustomer(a,id);
  return this.db.transaction(async tx=>{
   const c=await this.db.update('Customers',id,dto,a.id,tx);
   if(c.UserId)await this.db.update('Users',c.UserId,{DisplayName:c.DisplayName,Phone:c.Phone},a.id,tx);
   await this.db.audit(a.id,'Customer edited','Customers',id,{},tx);return c;
  });
 }
 async preferences(id:string,dto:PreferencesDto,a:Actor) {
  ownCustomer(a,id);
  if(!allowed(a,'customers.write')&&a.customerId!==id)throw new ForbiddenException();
  return this.db.transaction(async tx=>{
   await this.db.one('SELECT Id FROM Customers WITH (UPDLOCK,ROWLOCK) WHERE Id=@0',[id],tx);
   const existing=await this.db.one('SELECT Id FROM CustomerPreferences WHERE CustomerId=@0',[id],tx);
   const result=existing?await this.db.update('CustomerPreferences',existing.Id,dto,a.id,tx):await this.db.insert('CustomerPreferences',{...dto,CustomerId:id},a.id,tx);
   await this.db.audit(a.id,'Preferences changed','Customers',id,{},tx);return result;
  });
 }
 async guest(id:string,dto:GuestDto,a:Actor) {
  ownCustomer(a,id);if(!allowed(a,'customers.write')&&a.customerId!==id)throw new ForbiddenException();
  return this.db.transaction(async tx=>{
   const result=await this.db.insert('CustomerGuests',{...dto,CustomerId:id},a.id,tx);
   await this.db.audit(a.id,'Guest added','Customers',id,{},tx);return result;
  });
 }
}

