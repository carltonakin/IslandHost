import { BadRequestException,ForbiddenException,Injectable } from '@nestjs/common';
import { Db } from '../database/db';
import { Actor,allowed,isStaff } from '../common/types';
import { ListDto } from '../common/dto';
import { ownCustomer } from '../auth/access';
import { MessageDto,SettingDto } from './system.dto';
@Injectable()
export class InboxService {
 constructor(private db:Db) {}
 notifications(q:ListDto,a:Actor){return this.db.page('*','Notifications','UserId=@0'+(q.status==='unread'?' AND ReadAt IS NULL':''),[a.id],q,'CreatedAt DESC,Id');}
 async unread(a:Actor){return this.db.one('SELECT COUNT(*) Count FROM Notifications WHERE UserId=@0 AND ReadAt IS NULL',[a.id]);}
 async read(a:Actor,id?:string){await this.db.query('UPDATE Notifications SET ReadAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE UserId=@0 AND ReadAt IS NULL'+(id?' AND Id=@1':''),id?[a.id,id]:[a.id]);return {message:'Notifications updated.'};}
 messages(q:ListDto,a:Actor){
  const customerId=isStaff(a)?q.customerId:a.customerId;
  const where=customerId?'m.CustomerId=@0':isStaff(a)?'1=1':'1=0';
  return this.db.page('m.*,u.DisplayName SenderName,c.DisplayName CustomerName','Messages m JOIN Users u ON u.Id=m.SenderId JOIN Customers c ON c.Id=m.CustomerId',where,customerId?[customerId]:[],q,'m.CreatedAt DESC,m.Id');
 }
 async send(dto:MessageDto,a:Actor){
  if(isStaff(a)&&!allowed(a,'customers.write'))throw new ForbiddenException();
  const customerId=isStaff(a)?dto.CustomerId:a.customerId;
  if(!customerId)throw new BadRequestException('Choose a customer.');ownCustomer(a,customerId);
  return this.db.transaction(async tx=>{
   const c=await this.db.get('Customers',customerId,tx);
   const result=await this.db.insert('Messages',{CustomerId:customerId,SenderId:a.id,Body:dto.Body},a.id,tx);
   if(isStaff(a)&&c.UserId)await this.db.notify(c.UserId,'A note from your concierge','Your concierge sent you a message.','/messages',tx);
   else await this.db.query("INSERT INTO Notifications(UserId,Title,Body,Link) SELECT DISTINCT u.Id,'New concierge message',@0,'/messages' FROM Users u JOIN UserRoles ur ON ur.UserId=u.Id JOIN Roles r ON r.Id=ur.RoleId WHERE u.Active=1 AND r.Name IN ('SuperAdmin','Management','OperationsManager','ConciergeAgent')",[c.DisplayName+' sent a message.'],tx);
   return result;
  });
 }
 settings(){return this.db.query('SELECT Id,SettingKey,Value,UpdatedAt FROM SystemSettings ORDER BY SettingKey');}
 setting(dto:SettingDto,a:Actor){
  return this.db.transaction(async tx=>{
   const previous=await this.db.one('SELECT Id FROM SystemSettings WITH (UPDLOCK,HOLDLOCK) WHERE SettingKey=@0',[dto.SettingKey],tx);
   const r=previous?await this.db.update('SystemSettings',previous.Id,{Value:dto.Value},a.id,tx):await this.db.insert('SystemSettings',dto,a.id,tx);
   await this.db.audit(a.id,'System setting changed','SystemSettings',r.Id,{key:dto.SettingKey},tx);return r;
  });
 }
 audit(q:ListDto){return this.db.page('a.*,u.DisplayName ActorName','AuditLogs a LEFT JOIN Users u ON u.Id=a.ActorId','1=1',[],q,'a.CreatedAt DESC,a.Id');}
}

