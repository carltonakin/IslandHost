import { BadRequestException,ForbiddenException,Injectable,NotFoundException } from '@nestjs/common';
import { Db,Executor } from '../database/db';
import { Actor,allowed,isStaff } from '../common/types';
import { ListDto,like } from '../common/dto';
import { Conditions,lock } from '../phase2/support';
import { ConversationDto,ConversationMessageDto,ConversationReadDto,MessageListDto } from './communications.dto';
@Injectable()
export class ConversationsService {
 constructor(private db:Db){}
 async member(id:string,a:Actor,tx:Executor=this.db.source){
  const conversation=await this.db.one('SELECT c.* FROM Conversations c JOIN ConversationParticipants p ON p.ConversationId=c.Id WHERE c.Id=@0 AND p.UserId=@1',[id,a.id],tx);
  if(!conversation)throw new ForbiddenException('This conversation is not available to your account.');return conversation;
 }
 contacts(q:ListDto){return this.db.page('u.Id,u.DisplayName','Users u',"u.Active=1 AND EXISTS(SELECT 1 FROM UserRoles ur JOIN Roles r ON r.Id=ur.RoleId WHERE ur.UserId=u.Id AND r.Name NOT IN ('Customer')) AND u.DisplayName LIKE @0",[like(q.search||'')],q,'u.DisplayName,u.Id');}
 list(q:ListDto,a:Actor){
  const w=new Conditions();w.add('p.UserId=?',a.id);if(q.search)w.add('c.Subject LIKE ?',like(q.search));
  return this.db.page("c.*,p.LastReadSequence,(SELECT COUNT(*) FROM Messages m WHERE m.ConversationId=c.Id AND m.MessageSequence>p.LastReadSequence AND m.SenderId<>p.UserId) UnreadCount,(SELECT TOP(1) LEFT(m.Body,100) FROM Messages m WHERE m.ConversationId=c.Id ORDER BY m.MessageSequence DESC) LastMessage",'Conversations c JOIN ConversationParticipants p ON p.ConversationId=c.Id',w.sql,w.params,q,'c.UpdatedAt DESC,c.Id');
 }
 async detail(id:string,a:Actor){
  const c=await this.member(id,a);return {...c,Participants:await this.db.query('SELECT p.UserId,p.LastReadSequence,u.DisplayName FROM ConversationParticipants p JOIN Users u ON u.Id=p.UserId WHERE p.ConversationId=@0 ORDER BY u.DisplayName',[id])};
 }
 unread(a:Actor){return this.db.one('SELECT COUNT(*) Count FROM Messages m JOIN ConversationParticipants p ON p.ConversationId=m.ConversationId WHERE p.UserId=@0 AND m.SenderId<>@0 AND m.MessageSequence>p.LastReadSequence',[a.id]);}
 private async populateCustomer(id:string,customer:string,a:Actor,tx:Executor){
  const c=await this.db.get('Customers',customer,tx);if(c.UserId)await this.db.query('INSERT INTO ConversationParticipants(ConversationId,UserId) SELECT @0,@1 WHERE NOT EXISTS(SELECT 1 FROM ConversationParticipants WHERE ConversationId=@0 AND UserId=@1)',[id,c.UserId],tx);
  await this.db.query("INSERT INTO ConversationParticipants(ConversationId,UserId) SELECT DISTINCT @0,u.Id FROM Users u JOIN UserRoles ur ON ur.UserId=u.Id JOIN Roles r ON r.Id=ur.RoleId WHERE u.Active=1 AND r.Name IN ('SuperAdmin','Management','OperationsManager','ConciergeAgent') AND NOT EXISTS(SELECT 1 FROM ConversationParticipants cp WHERE cp.ConversationId=@0 AND cp.UserId=u.Id)",[id],tx);
  if(allowed(a,'conversations.manage'))await this.db.query('INSERT INTO ConversationParticipants(ConversationId,UserId) SELECT @0,@1 WHERE NOT EXISTS(SELECT 1 FROM ConversationParticipants WHERE ConversationId=@0 AND UserId=@1)',[id,a.id],tx);
 }
 create(dto:ConversationDto,a:Actor){
  return this.db.transaction(async tx=>{
   const staff=allowed(a,'conversations.manage');
   if(!staff&&(dto.Kind!=='Customer'||!a.customerId||(dto.CustomerId&&dto.CustomerId.toLowerCase()!==a.customerId.toLowerCase())||dto.ParticipantIds?.length))throw new ForbiddenException();
   const customer=dto.Kind==='Customer'?(staff?dto.CustomerId:a.customerId):undefined;
   if(dto.Kind==='Customer'&&!customer)throw new BadRequestException('Choose a customer.');
   if(dto.Kind==='Operations'&&dto.CustomerId)throw new BadRequestException('An operational conversation has no customer participant.');
   const participants=[...new Set([a.id,...(dto.ParticipantIds||[])])];
   if(dto.Kind==='Customer'&&dto.ParticipantIds?.length)throw new BadRequestException('Customer conversations include the customer and concierge team automatically.');
   if(dto.Kind==='Operations'){
    const valid=await this.db.query("SELECT u.Id FROM Users u WHERE u.Active=1 AND u.Id IN ("+participants.map((_,i)=>'@'+i).join(',')+") AND EXISTS(SELECT 1 FROM UserRoles ur JOIN Roles r ON r.Id=ur.RoleId WHERE ur.UserId=u.Id AND r.Name<>'Customer')",participants,tx);
    if(valid.length!==participants.length)throw new BadRequestException('Operational participants must be active team, vendor or driver accounts.');
   }
   const c=await this.db.insert('Conversations',{Subject:dto.Subject.trim(),Kind:dto.Kind,CustomerId:customer},a.id,tx);
   if(customer)await this.populateCustomer(c.Id,customer,a,tx);else for(const user of participants)await this.db.insert('ConversationParticipants',{ConversationId:c.Id,UserId:user},a.id,tx);
   await this.db.audit(a.id,'Conversation created','Conversations',c.Id,{kind:c.Kind},tx);return c;
  });
 }
 async messages(id:string,q:ListDto,a:Actor){
  await this.member(id,a);return this.db.page("m.Id,m.MessageSequence,m.ConversationId,m.SenderId,m.Body,m.CreatedAt,u.DisplayName SenderName,(SELECT COUNT(*) FROM ConversationParticipants p WHERE p.ConversationId=m.ConversationId AND p.UserId<>m.SenderId AND p.LastReadSequence>=m.MessageSequence) ReadByCount",'Messages m JOIN Users u ON u.Id=m.SenderId','m.ConversationId=@0',[id],q,'m.MessageSequence DESC');
 }
 private async insertMessage(id:string,dto:ConversationMessageDto,a:Actor,tx:Executor){
  const c=await this.member(id,a,tx);
  const body=Array.from(dto.Body.trim()).filter(ch=>ch.charCodeAt(0)>=32||['\n','\r','\t'].includes(ch)).join('');
  if(!body.trim())throw new BadRequestException('Write a message before sending.');
  const message=await this.db.insert('Messages',{ConversationId:id,CustomerId:c.CustomerId,SenderId:a.id,Body:body},a.id,tx);
  await this.db.query('UPDATE Conversations SET UpdatedAt=SYSUTCDATETIME(),UpdatedBy=@1 WHERE Id=@0',[id,a.id],tx);
  await this.db.query("INSERT INTO Notifications(UserId,Title,Body,Link) SELECT p.UserId,'New concierge message',@1,@2 FROM ConversationParticipants p JOIN Users u ON u.Id=p.UserId WHERE p.ConversationId=@0 AND p.UserId<>@3 AND u.Active=1",[id,'A new message in '+c.Subject+'.','/inbox/'+id,a.id],tx);
  return message;
 }
 send(id:string,dto:ConversationMessageDto,a:Actor){return this.db.transaction(tx=>this.insertMessage(id,dto,a,tx));}
 read(id:string,dto:ConversationReadDto,a:Actor){
  return this.db.transaction(async tx=>{
   await this.member(id,a,tx);const row=await this.db.one('SELECT MAX(MessageSequence) LastSequence FROM Messages WHERE ConversationId=@0 AND MessageSequence<=@1',[id,dto.ThroughSequence],tx);
   const sequence=Number(row?.LastSequence||0);await this.db.query('UPDATE ConversationParticipants SET LastReadSequence=@2,UpdatedAt=SYSUTCDATETIME() WHERE ConversationId=@0 AND UserId=@1 AND LastReadSequence<@2',[id,a.id,sequence],tx);return {ThroughSequence:sequence};
  });
 }
 legacyMessages(q:MessageListDto,a:Actor){
  if(q.conversationId)return this.messages(q.conversationId,q,a);
  const w=new Conditions();w.add('p.UserId=?',a.id);w.clauses.push('co.IsLegacy=1');
  const customer=isStaff(a)?q.customerId:a.customerId;if(customer)w.add('m.CustomerId=?',customer);else if(!isStaff(a))w.clauses.push('1=0');
  return this.db.page('m.*,u.DisplayName SenderName,c.DisplayName CustomerName','Messages m JOIN Conversations co ON co.Id=m.ConversationId JOIN ConversationParticipants p ON p.ConversationId=co.Id JOIN Users u ON u.Id=m.SenderId JOIN Customers c ON c.Id=m.CustomerId',w.sql,w.params,q,'m.MessageSequence DESC');
 }
 legacySend(dto:{CustomerId?:string;Body:string},a:Actor){
  if(isStaff(a)&&!allowed(a,'customers.write'))throw new ForbiddenException();
  const customer=isStaff(a)?dto.CustomerId:a.customerId;if(!customer)throw new BadRequestException('Choose a customer.');
  return this.db.transaction(async tx=>{
   await lock(this.db,tx,'legacy-conversation:'+customer);
   let c=await this.db.one('SELECT * FROM Conversations WHERE CustomerId=@0 AND IsLegacy=1',[customer],tx);
   if(!c)c=await this.db.insert('Conversations',{Subject:'Your concierge',Kind:'Customer',CustomerId:customer,IsLegacy:true},a.id,tx);
   await this.populateCustomer(c.Id,customer,a,tx);return this.insertMessage(c.Id,dto,a,tx);
  });
 }
}
