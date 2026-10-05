import { BadRequestException,Injectable,Logger,NotFoundException,PayloadTooLargeException,StreamableFile } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir,open,unlink,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Db } from '../database/db';
import { Actor } from '../common/types';
export const PHOTO_MAX_BYTES=5*1024*1024;
export type UploadedPhoto={buffer:Buffer;mimetype:string;size:number};
const mimeFormats:Record<string,string>={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
const invalid='Choose a valid JPG, PNG or WebP photo, up to 20 megapixels. Animated images are not supported.';
function detectedFormat(buffer:Buffer){
 if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return 'jpeg';
 if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
 if(buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return 'webp';
 return undefined;
}
@Injectable()
export class ServicePhotosService {
 private readonly logger=new Logger('ServicePhotos');
 private readonly directory=resolve(process.env.SERVICE_UPLOAD_DIR||resolve(__dirname,'../../../uploads/service-photos'));
 constructor(private db:Db){}
 async upload(file:UploadedPhoto|undefined,actor:Actor){
  if(!file?.buffer?.length)throw new BadRequestException('Choose a photo to upload.');
  if(file.buffer.length>PHOTO_MAX_BYTES)throw new PayloadTooLargeException('Each photo must be 5 MB or smaller.');
  const format=detectedFormat(file.buffer);
  if(!format||mimeFormats[file.mimetype]!==format)throw new BadRequestException(invalid);
  // Load on demand so a missing host image binary cannot stop unrelated API routes.
  const sharp=(await import('sharp')).default;
  let output:Awaited<ReturnType<ReturnType<typeof sharp>['toBuffer']>>;
  try{
   const pipeline=sharp(file.buffer,{limitInputPixels:20_000_000,failOn:'warning'});
   const metadata=await pipeline.metadata();
   if(metadata.format!==format||!metadata.width||!metadata.height||(metadata.pages||1)>1)throw new Error('Unsupported image');
   // Re-encoding validates image data, applies orientation and removes embedded metadata.
   output=await pipeline.rotate().resize(2000,2000,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
  }catch{throw new BadRequestException(invalid);}
  const id=randomUUID(),filename=id+'.webp',target=resolve(this.directory,filename);
  await mkdir(this.directory,{recursive:true});
  await writeFile(target,output.data,{flag:'wx',mode:0o600});
  try{await this.db.audit(actor.id,'Service photo uploaded','ServicePhotos',id,{bytes:output.info.size,width:output.info.width,height:output.info.height});}
  catch(error){await unlink(target).catch(()=>{this.logger.warn('Unattached service photo retained after audit failure.');});throw error;}
  return {Url:'/api/service-photos/'+filename,Width:output.info.width,Height:output.info.height,Size:output.info.size};
 }
 async read(filename:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(filename))throw new NotFoundException('Photo not found.');
  try{
   const file=await open(resolve(this.directory,filename),'r');
   const stats=await file.stat().catch(async error=>{await file.close();throw error;});
   if(!stats.isFile()){await file.close();throw new NotFoundException('Photo not found.');}
   return new StreamableFile(file.createReadStream(),{type:'image/webp',disposition:'inline',length:stats.size});
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new NotFoundException('Photo not found.');throw error;}
 }
}