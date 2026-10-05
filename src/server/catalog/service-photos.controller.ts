import { BadRequestException,Controller,Get,Header,Param,Post,UploadedFile,UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiConsumes,ApiTags } from '@nestjs/swagger';
import { CurrentActor,Permit,Public } from '../auth/access';
import { Actor } from '../common/types';
import { PHOTO_MAX_BYTES,ServicePhotosService,UploadedPhoto } from './service-photos.service';
@ApiTags('Catalog photos') @Controller('service-photos')
export class ServicePhotosController {
 constructor(private photos:ServicePhotosService){}
 @Permit('catalog.write') @Post() @ApiConsumes('multipart/form-data')
 @Throttle({default:{limit:30,ttl:60000}})
 @UseInterceptors(FileInterceptor('file',{
  limits:{fileSize:PHOTO_MAX_BYTES,files:1,fields:0,parts:2,fieldNameSize:50,headerPairs:50},
  fileFilter:(_request,file,callback)=>callback(['image/jpeg','image/png','image/webp'].includes(file.mimetype)?null:new BadRequestException('Choose a JPG, PNG or WebP photo.'),true)
 }))
 upload(@UploadedFile() file:UploadedPhoto|undefined,@CurrentActor() actor:Actor){return this.photos.upload(file,actor);}
 @Public() @Get(':filename') @Throttle({default:{limit:600,ttl:60000}})
 @Header('Cache-Control','public, max-age=31536000, immutable')
 @Header('X-Content-Type-Options','nosniff')
 read(@Param('filename') filename:string){return this.photos.read(filename);}
}