import { BadRequestException,Injectable } from '@nestjs/common';
import { Db } from '../database/db';
import { Actor } from '../common/types';
import { like } from '../common/dto';
import { Phase2ListDto } from '../phase2/phase2.dto';
import { Conditions,lock,requirePermission } from '../phase2/support';
import { DriverDto,DriverPatchDto,VehicleDto,VehiclePatchDto } from './transport.dto';
@Injectable()
export class FleetService {
 constructor(private db:Db){}
 accounts(q:Phase2ListDto){return this.db.page('u.Id,u.DisplayName,u.Email','Users u',"u.Active=1 AND EXISTS(SELECT 1 FROM UserRoles ur JOIN Roles r ON r.Id=ur.RoleId WHERE ur.UserId=u.Id AND r.Name='Driver') AND (u.DisplayName LIKE @0 OR u.Email LIKE @0)",[like(q.search||'')],q,'u.DisplayName,u.Id');}
 list(kind:'Drivers'|'Vehicles',q:Phase2ListDto){
  const w=new Conditions();if(q.search)w.add(kind==='Drivers'?'(DisplayName LIKE ? OR Phone LIKE ?)':'(Name LIKE ? OR Registration LIKE ?)',like(q.search));
  if(q.status)w.add('Active=?',q.status==='Active');
  return this.db.page('*',kind,w.sql,w.params,q,(kind==='Drivers'?'DisplayName':'Name')+',Id');
 }
 detail(kind:'Drivers'|'Vehicles',id:string){return this.db.get(kind,id);}
 save(kind:'Drivers'|'Vehicles',dto:DriverDto|DriverPatchDto|VehicleDto|VehiclePatchDto,a:Actor,id?:string){
  requirePermission(a,'dispatch.write');
  return this.db.transaction(async tx=>{
   await lock(this.db,tx,'dispatch-scheduling');
   if(kind==='Drivers'&&'UserId' in dto&&dto.UserId&&!await this.db.one("SELECT u.Id FROM Users u JOIN UserRoles ur ON ur.UserId=u.Id JOIN Roles r ON r.Id=ur.RoleId WHERE u.Id=@0 AND u.Active=1 AND r.Name='Driver'",[dto.UserId],tx))throw new BadRequestException('Choose an active Driver account.');
   if(id){
    const old=await this.db.get(kind,id,tx);
    if(kind==='Drivers'&&'UserId' in dto&&dto.UserId&&dto.UserId.toLowerCase()!==old.UserId.toLowerCase())throw new BadRequestException('A driver account cannot be reassigned. Create another driver.');
    const pending=await this.db.one("SELECT TOP(1) Id,Passengers FROM Transfers WHERE "+(kind==='Drivers'?'DriverId':'VehicleId')+"=@0 AND Status NOT IN ('Completed','Cancelled','No Show') ORDER BY Passengers DESC",[id],tx);
    if(pending&&(dto.Active===false||('Capacity' in dto&&dto.Capacity!==undefined&&dto.Capacity<pending.Passengers)))throw new BadRequestException('Reassign active transfers before deactivation or reducing capacity.');
   }
   const item=id?await this.db.update(kind,id,dto,a.id,tx):await this.db.insert(kind,dto,a.id,tx);
   await this.db.audit(a.id,(kind==='Drivers'?'Driver':'Vehicle')+(id?' edited':' created'),kind,item.Id,{},tx);return item;
  });
 }
}
