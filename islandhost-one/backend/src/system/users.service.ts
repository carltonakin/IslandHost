import { BadRequestException,Injectable } from '@nestjs/common';
import { Db,Executor } from '../database/db';
import { Actor,PERMISSIONS } from '../common/types';
import { ListDto,like } from '../common/dto';
import { hashPassword } from '../auth/password';
import { UserDto,UserPatchDto,MePatchDto } from './system.dto';
@Injectable()
export class UsersService {
 constructor(private db:Db) {}
 async roles(){const roles=await this.db.query('SELECT Id,Name FROM Roles ORDER BY Name');return roles.map(r=>({...r,Permissions:PERMISSIONS[r.Name]}));}
 async list(q:ListDto) {
  return this.db.page("u.Id,u.Email,u.DisplayName,u.Phone,u.Active,u.CreatedAt,(SELECT STRING_AGG(r.Name,', ') FROM UserRoles ur JOIN Roles r ON r.Id=ur.RoleId WHERE ur.UserId=u.Id) Roles",'Users u',q.search?'(u.Email LIKE @0 OR u.DisplayName LIKE @0)':'1=1',q.search?[like(q.search)]:[],q,'u.DisplayName,u.Id');
 }
 async staff(q:ListDto) {return this.db.query("SELECT DISTINCT TOP(100) u.Id,u.DisplayName FROM Users u JOIN UserRoles ur ON ur.UserId=u.Id JOIN Roles r ON r.Id=ur.RoleId WHERE u.Active=1 AND r.Name IN ('SuperAdmin','Management','OperationsManager','ConciergeAgent','Dispatcher') AND (u.DisplayName LIKE @0 OR u.Email LIKE @0) ORDER BY u.DisplayName",[like(q.search||'')]);}
 private async setRoles(id:string,roles:string[],actor:string,tx:Executor){
  await this.db.query('DELETE FROM UserRoles WHERE UserId=@0',[id],tx);
  for(const name of [...new Set(roles)]) {
   const role=await this.db.one('SELECT Id FROM Roles WHERE Name=@0',[name],tx);
   if(!role)throw new BadRequestException('The selected role is not available.');
   await this.db.insert('UserRoles',{UserId:id,RoleId:role.Id},actor,tx);
  }
 }
 async create(dto:UserDto,a:Actor){
  if(dto.Roles.includes('Customer'))throw new BadRequestException('Create customer accounts in Customers.');
  const hash=await hashPassword(dto.Password);
  return this.db.transaction(async tx=>{
   const user=await this.db.insert('Users',{Email:dto.Email.toLowerCase(),DisplayName:dto.DisplayName,PasswordHash:hash},a.id,tx);
   await this.setRoles(user.Id,dto.Roles,a.id,tx);await this.db.audit(a.id,'User created','Users',user.Id,{roles:dto.Roles},tx);
   return {Id:user.Id,Email:user.Email,DisplayName:user.DisplayName,Roles:dto.Roles};
  });
 }
 async patch(id:string,dto:UserPatchDto,a:Actor){
  if(id.toLowerCase()===a.id.toLowerCase()&&(dto.Roles||dto.Active===false))throw new BadRequestException('You cannot remove your own administrative access.');
  return this.db.transaction(async tx=>{
   const {Roles,...fields}=dto;
   if(Roles?.includes('Customer')&&!await this.db.one('SELECT Id FROM Customers WHERE UserId=@0',[id],tx))throw new BadRequestException('This user has no customer profile.');
   const u=await this.db.update('Users',id,fields,a.id,tx);
   if(Roles)await this.setRoles(id,Roles,a.id,tx);
   if(Roles||dto.Active===false)await this.db.query('UPDATE AuthSessions SET RevokedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE UserId=@0',[id],tx);
   await this.db.audit(a.id,Roles?'Role changed':'User edited','Users',id,{roles:Roles,active:dto.Active},tx);
   return {Id:u.Id,Email:u.Email,DisplayName:u.DisplayName,Active:u.Active};
  });
 }
 async profile(a:Actor){return this.db.one('SELECT Id,Email,DisplayName,Phone FROM Users WHERE Id=@0',[a.id]);}
 async me(dto:MePatchDto,a:Actor){
  return this.db.transaction(async tx=>{
   const u=await this.db.update('Users',a.id,dto,a.id,tx);
   if(a.customerId)await this.db.update('Customers',a.customerId,dto,a.id,tx);
   return {Id:u.Id,Email:u.Email,DisplayName:u.DisplayName,Phone:u.Phone};
  });
 }
}

