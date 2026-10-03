import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes,randomUUID } from 'node:crypto';
import { Db,Executor } from '../database/db';
import { required } from '../config';
import { hashPassword,verifyPassword,tokenHash } from './password';
import { loadActor } from './access';
import { Mailer } from './mailer';
import { Actor } from '../common/types';
@Injectable()
export class AuthService {
 private logger=new Logger('Auth');
 constructor(private db:Db,private jwt:JwtService,private mailer:Mailer) {}
 private async tokens(userId:string,sessionId:string,tx:Executor) {
  const nonce=randomUUID();
  const access=await this.jwt.signAsync({sub:userId,sid:sessionId},{secret:required('JWT_SECRET'),expiresIn:'15m',issuer:'islandhost',audience:'islandhost-web'});
  const refresh=await this.jwt.signAsync({sub:userId,sid:sessionId,jti:nonce},{secret:required('JWT_REFRESH_SECRET'),expiresIn:'7d',issuer:'islandhost',audience:'islandhost-refresh'});
  await this.db.update('AuthSessions',sessionId,{TokenHash:tokenHash(refresh),ExpiresAt:new Date(Date.now()+7*86400000)},userId,tx);
  return {access,refresh};
 }
 async login(email:string,password:string) {
  const user=await this.db.one('SELECT * FROM Users WHERE Email=@0',[email.trim().toLowerCase()]);
  const valid=user?await verifyPassword(password,user.PasswordHash):(await hashPassword(password),false);
  if(!user || !user.Active || !valid) throw new UnauthorizedException('Email or password is incorrect.');
  const result=await this.db.transaction(async tx=>{
   const session=await this.db.insert('AuthSessions',{UserId:user.Id,TokenHash:'pending',ExpiresAt:new Date(Date.now()+7*86400000)},user.Id,tx);
   return {tokens:await this.tokens(user.Id,session.Id,tx),sessionId:session.Id};
  });
  return {...result,actor:await loadActor(this.db,user.Id,result.sessionId)};
 }
 async refresh(token?:string) {
  if(!token) throw new UnauthorizedException('Please sign in again.');
  let payload:{sub:string;sid:string};
  try { payload=await this.jwt.verifyAsync(token,{secret:required('JWT_REFRESH_SECRET'),algorithms:['HS256'],issuer:'islandhost',audience:'islandhost-refresh'}); }
  catch { throw new UnauthorizedException('Please sign in again.'); }
  return this.db.transaction(async tx=>{
   const session=await this.db.one('SELECT s.Id FROM AuthSessions s WITH (UPDLOCK,ROWLOCK) JOIN Users u ON u.Id=s.UserId WHERE s.Id=@0 AND s.UserId=@1 AND s.TokenHash=@2 AND s.RevokedAt IS NULL AND s.ExpiresAt>SYSUTCDATETIME() AND u.Active=1',[payload.sid,payload.sub,tokenHash(token)],tx);
   if(!session) throw new UnauthorizedException('Please sign in again.');
   return this.tokens(payload.sub,payload.sid,tx);
  });
 }
 async logout(actor:Actor) { await this.db.update('AuthSessions',actor.sessionId,{RevokedAt:new Date()},actor.id); return {message:'Signed out.'}; }
 async change(actor:Actor,current:string,password:string) {
  const user=await this.db.get('Users',actor.id);
  if(!await verifyPassword(current,user.PasswordHash)) throw new BadRequestException('Current password is incorrect.');
  const hash=await hashPassword(password);
  await this.db.transaction(async tx=>{
   await this.db.update('Users',actor.id,{PasswordHash:hash},actor.id,tx);
   await this.db.query('UPDATE AuthSessions SET RevokedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE UserId=@0',[actor.id],tx);
   await this.db.audit(actor.id,'Password changed','Users',actor.id,{},tx);
  }); return {message:'Password changed. Please sign in again.'};
 }
 async forgot(email:string) {
  const user=await this.db.one('SELECT Id,Email FROM Users WHERE Email=@0 AND Active=1',[email.trim().toLowerCase()]);
  if(user) {
   const token=randomBytes(32).toString('hex');
   await this.db.transaction(async tx=>{
    await this.db.query('UPDATE PasswordResetTokens SET UsedAt=SYSUTCDATETIME() WHERE UserId=@0 AND UsedAt IS NULL',[user.Id],tx);
    await this.db.insert('PasswordResetTokens',{UserId:user.Id,TokenHash:tokenHash(token),ExpiresAt:new Date(Date.now()+30*60000)},undefined,tx);
   });
   try { await this.mailer.passwordReset(user.Email,token); } catch { this.logger.error(JSON.stringify({event:'password_reset_delivery_failed'})); }
  }
  return {message:'If that email belongs to an active account, a reset link will be sent.'};
 }
 async reset(token:string,password:string) {
  const hash=await hashPassword(password);
  await this.db.transaction(async tx=>{
   const reset=await this.db.one('SELECT * FROM PasswordResetTokens WITH (UPDLOCK,ROWLOCK) WHERE TokenHash=@0 AND UsedAt IS NULL AND ExpiresAt>SYSUTCDATETIME()',[tokenHash(token)],tx);
   if(!reset) throw new BadRequestException('This reset link has expired or has already been used.');
   await this.db.update('Users',reset.UserId,{PasswordHash:hash},reset.UserId,tx);
   await this.db.query('UPDATE PasswordResetTokens SET UsedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE UserId=@0 AND UsedAt IS NULL',[reset.UserId],tx);
   await this.db.query('UPDATE AuthSessions SET RevokedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE UserId=@0',[reset.UserId],tx);
   await this.db.audit(reset.UserId,'Password reset','Users',reset.UserId,{},tx);
  }); return {message:'Your password has been reset. You can now sign in.'};
 }
}

