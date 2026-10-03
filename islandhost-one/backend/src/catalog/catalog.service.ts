import { BadRequestException,Injectable,NotFoundException } from '@nestjs/common';
import { Db } from '../database/db';
import { Actor,allowed } from '../common/types';
import { ListDto,like } from '../common/dto';
import { CategoryDto,CategoryPatchDto,ServiceDto,ServicePatchDto } from './catalog.dto';
@Injectable()
export class CatalogService {
 constructor(private db:Db) {}
 categories(q:ListDto,actor:Actor) {
  const all=q.all==='true' && allowed(actor,'catalog.write');
  const params:unknown[]=[];let where=all?'1=1':'c.Active=1';
  if(q.search){params.push(like(q.search));where+=' AND c.Name LIKE @0';}
  return this.db.page('c.*','ServiceCategories c',where,params,q,'c.DisplayOrder,c.Name,c.Id');
 }
 services(q:ListDto,actor:Actor) {
  const params:unknown[]=[];let where=q.all==='true'&&allowed(actor,'catalog.write')?'1=1':'s.Active=1 AND c.Active=1';
  if(q.categoryId){params.push(q.categoryId);where+=' AND s.CategoryId=@'+(params.length-1);}
  if(q.search){params.push(like(q.search));where+=' AND (s.Name LIKE @'+(params.length-1)+' OR s.ShortDescription LIKE @'+(params.length-1)+')';}
  return this.db.page('s.*,c.Name CategoryName','Services s JOIN ServiceCategories c ON c.Id=s.CategoryId',where,params,q,'s.Featured DESC,s.DisplayOrder,s.Name,s.Id');
 }
 async detail(id:string,actor:Actor) {
  const item=await this.db.one('SELECT s.*,c.Name CategoryName,c.Active CategoryActive FROM Services s JOIN ServiceCategories c ON c.Id=s.CategoryId WHERE s.Id=@0',[id]);
  if(!item||(!allowed(actor,'catalog.write')&&(!item.Active||!item.CategoryActive)))throw new NotFoundException('This experience is not available.');
  return {...item,Options:await this.db.query('SELECT * FROM ServiceOptions WHERE ServiceId=@0 AND Active=1 ORDER BY Name',[id])};
 }
 saveCategory(dto:CategoryDto|CategoryPatchDto,actor:Actor,id?:string) {
  return this.db.transaction(async tx=>{
   const result=id?await this.db.update('ServiceCategories',id,dto,actor.id,tx):await this.db.insert('ServiceCategories',dto,actor.id,tx);
   await this.db.audit(actor.id,id?'Category edited':'Category created','ServiceCategories',result.Id,{},tx);return result;
  });
 }
 saveService(dto:ServiceDto|ServicePatchDto,actor:Actor,id?:string) {
  if(dto.Image?.startsWith('https://') && !(process.env.SERVICE_IMAGE_HOSTS||'').split(',').includes(new URL(dto.Image).hostname)) throw new BadRequestException('This image host has not been approved. Use a local asset or an approved image host.');
  return this.db.transaction(async tx=>{
   if(dto.CategoryId)await this.db.get('ServiceCategories',dto.CategoryId,tx);
   const {Options,...data}=dto;
   const result=id?await this.db.update('Services',id,data,actor.id,tx):await this.db.insert('Services',data,actor.id,tx);
   if(Options){
    await this.db.query('UPDATE ServiceOptions SET Active=0,UpdatedAt=SYSUTCDATETIME() WHERE ServiceId=@0',[result.Id],tx);
    for(const option of Options)await this.db.insert('ServiceOptions',{...option,ServiceId:result.Id},actor.id,tx);
   }
   await this.db.audit(actor.id,id?'Service edited':'Service created','Services',result.Id,{},tx);return result;
  });
 }
}

