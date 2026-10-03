import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Db } from '../database/db';
import { Actor, PERMISSIONS, allowed } from '../common/types';
import { required } from '../config';
export const Public = () => SetMetadata('public',true);
export const Permit = (...permissions: string[]) => SetMetadata('permissions',permissions);
export const CurrentActor = createParamDecorator((_data:unknown, context:ExecutionContext):Actor => context.switchToHttp().getRequest().actor);
export type AuthRequest = Request & {actor:Actor};
export async function loadActor(db: Db, id: string, sid: string): Promise<Actor> {
 const user = await db.one('SELECT u.Id,u.Email,u.DisplayName,c.Id CustomerId FROM Users u LEFT JOIN Customers c ON c.UserId=u.Id WHERE u.Id=@0 AND u.Active=1',[id]);
 if (!user) throw new UnauthorizedException('Please sign in again.');
 const rows = await db.query('SELECT r.Name FROM Roles r INNER JOIN UserRoles ur ON ur.RoleId=r.Id WHERE ur.UserId=@0',[id]);
 const roles = rows.map(r=>String(r.Name));
 return {id:user.Id,email:user.Email,displayName:user.DisplayName,customerId:user.CustomerId ?? undefined,roles,permissions:[...new Set(roles.flatMap(r=>PERMISSIONS[r]||[]))],sessionId:sid};
}
@Injectable()
export class AccessGuard implements CanActivate {
 constructor(private reflector:Reflector,private jwt:JwtService,private db:Db) {}
 async canActivate(context:ExecutionContext) {
  if(this.reflector.getAllAndOverride<boolean>('public',[context.getHandler(),context.getClass()])) return true;
  const req=context.switchToHttp().getRequest<AuthRequest>();
  try {
   const token=req.cookies?.ih_access;
   if(typeof token !== 'string') throw new Error();
   const payload=await this.jwt.verifyAsync<{sub:string;sid:string}>(token,{secret:required('JWT_SECRET'),algorithms:['HS256'],issuer:'islandhost',audience:'islandhost-web'});
   const session=await this.db.one('SELECT Id FROM AuthSessions WHERE Id=@0 AND UserId=@1 AND RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME()',[payload.sid,payload.sub]);
   if(!session) throw new Error();
   req.actor=await loadActor(this.db,payload.sub,payload.sid);
  } catch { throw new UnauthorizedException('Please sign in to continue.'); }
  const permissions=this.reflector.getAllAndOverride<string[]>('permissions',[context.getHandler(),context.getClass()]) || [];
  if(permissions.length && !permissions.some(p=>allowed(req.actor,p))) throw new ForbiddenException('You do not have access to this action.');
  return true;
 }
}
export function ownCustomer(actor:Actor,customerId:string) {
 if(!allowed(actor,'operations.read') && actor.customerId?.toLowerCase() !== customerId.toLowerCase()) throw new ForbiddenException('You do not have access to this experience.');
}

