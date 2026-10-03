import { BadRequestException,Injectable } from '@nestjs/common';
import { Db } from '../database/db';
import { Actor } from '../common/types';
import { like } from '../common/dto';
import { Phase2ListDto } from '../phase2/phase2.dto';
import { Conditions,lock,requirePermission } from '../phase2/support';
import { VendorDto,VendorPatchDto,VendorServiceDto } from './partners.dto';
import { cents,money } from '../finance/money';
@Injectable()
export class VendorsService {
 constructor(private db:Db){}
 list(q:Phase2ListDto){const w=new Conditions();if(q.search)w.add('(v.Name LIKE ? OR v.Email LIKE ?)',like(q.search));if(q.type)w.add('v.Type=?',q.type);if(q.status)w.add('v.Active=?',q.status==='Active');return this.db.page('v.*','Vendors v',w.sql,w.params,q,'v.Name,v.Id');}
 accounts(q:Phase2ListDto){return this.db.page('u.Id,u.DisplayName,u.Email','Users u',"u.Active=1 AND EXISTS(SELECT 1 FROM UserRoles ur JOIN Roles r ON r.Id=ur.RoleId WHERE ur.UserId=u.Id AND r.Name='Vendor') AND (u.DisplayName LIKE @0 OR u.Email LIKE @0)",[like(q.search||'')],q,'u.DisplayName,u.Id');}
 async detail(id:string){
  const vendor=await this.db.get('Vendors',id);const services=await this.db.query('SELECT TOP(100) vs.*,s.Name ServiceName FROM VendorServices vs JOIN Services s ON s.Id=vs.ServiceId WHERE vs.VendorId=@0 ORDER BY s.Name',[id]);
  const counts=await this.db.one("SELECT COUNT(*) Total,SUM(CASE WHEN Status='Completed' THEN 1 ELSE 0 END) Completed,SUM(CASE WHEN Status NOT IN ('Completed','Cancelled','Declined') THEN 1 ELSE 0 END) CurrentAssignments FROM VendorAssignments WHERE VendorId=@0",[id]);
  return {...vendor,Services:services,Summary:counts};
 }
 save(dto:VendorDto|VendorPatchDto,a:Actor,id?:string){
  requirePermission(a,'vendors.write');
  return this.db.transaction(async tx=>{
   if(dto.UserId&&!await this.db.one("SELECT u.Id FROM Users u JOIN UserRoles ur ON ur.UserId=u.Id JOIN Roles r ON r.Id=ur.RoleId WHERE u.Id=@0 AND u.Active=1 AND r.Name='Vendor'",[dto.UserId],tx))throw new BadRequestException('Choose an active Vendor account.');
   const vendor=id?await this.db.update('Vendors',id,dto,a.id,tx):await this.db.insert('Vendors',dto,a.id,tx);
   await this.db.audit(a.id,id?'Vendor edited':'Vendor created','Vendors',vendor.Id,{active:vendor.Active},tx);return vendor;
  });
 }
 service(id:string,dto:VendorServiceDto,a:Actor){
  requirePermission(a,'vendors.write');
  return this.db.transaction(async tx=>{
   await lock(this.db,tx,'vendor-service:'+id+':'+dto.ServiceId);await this.db.get('Vendors',id,tx);await this.db.get('Services',dto.ServiceId,tx);
   const old=await this.db.one('SELECT Id FROM VendorServices WHERE VendorId=@0 AND ServiceId=@1',[id,dto.ServiceId],tx),data={...dto,VendorId:id,Cost:money(cents(dto.Cost))};
   const result=old?await this.db.update('VendorServices',old.Id,data,a.id,tx):await this.db.insert('VendorServices',data,a.id,tx);
   await this.db.audit(a.id,'Vendor service pricing changed','VendorServices',result.Id,{cost:result.Cost},tx);return result;
  });
 }
}
