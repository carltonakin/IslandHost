import { BadRequestException,ConflictException,ForbiddenException } from '@nestjs/common';
import { Db,Executor } from '../database/db';
import { Actor,PERMISSIONS,Row,allowed } from '../common/types';
import { Phase2ListDto } from './phase2.dto';
export function requirePermission(a:Actor,p:string){if(!allowed(a,p))throw new ForbiddenException('You do not have access to this action.');}
export function financialOwner(a:Actor,customerId:string,permission:string){if(!allowed(a,permission)&&a.customerId?.toLowerCase()!==customerId.toLowerCase())throw new ForbiddenException('You do not have access to this document.');}
export function version(row:Row,value:number){if(row.Version!==value)throw new ConflictException('This record changed. Refresh before saving.');}
export function dateRange(q:Phase2ListDto){if(q.from&&q.to&&q.from>q.to)throw new BadRequestException('The end date must follow the start date.');}
export class Conditions {
 clauses=['1=1'];params:unknown[]=[];
 add(sql:string,value:unknown){this.clauses.push(sql.replaceAll('?','@'+this.params.length));this.params.push(value);return this;}
 get sql(){return this.clauses.join(' AND ');}
}
export async function lock(db:Db,tx:Executor,resource:string){
 const result=await db.one("DECLARE @result int; EXEC @result=sys.sp_getapplock @Resource=@0,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; SELECT @result Result;",[resource.toLowerCase()],tx);
 if(!result||result.Result<0)throw new ConflictException('Another update is in progress. Please retry.');
}
export async function notifyTeam(db:Db,tx:Executor,permission:string,title:string,body:string,link:string){
 const roles=Object.entries(PERMISSIONS).filter(([,p])=>p.includes('*')||p.includes(permission)).map(([r])=>r);
 await db.query("INSERT INTO Notifications(UserId,Title,Body,Link) SELECT DISTINCT u.Id,@0,@1,@2 FROM Users u JOIN UserRoles ur ON ur.UserId=u.Id JOIN Roles r ON r.Id=ur.RoleId WHERE u.Active=1 AND r.Name IN ("+roles.map((_,i)=>'@'+(i+3)).join(',')+")",[title,body,link,...roles],tx);
}
export async function notifyCustomer(db:Db,tx:Executor,customerId:string,title:string,body:string,link:string){
 const customer=await db.get('Customers',customerId,tx);if(customer.UserId)await db.notify(customer.UserId,title,body,link,tx);
}
