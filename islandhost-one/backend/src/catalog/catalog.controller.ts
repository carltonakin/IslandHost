import { Body,Controller,Get,Param,ParseUUIDPipe,Patch,Post,Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor,Permit } from '../auth/access';
import { Actor } from '../common/types';
import { ListDto } from '../common/dto';
import { CatalogService } from './catalog.service';
import { CategoryDto,CategoryPatchDto,ServiceDto,ServicePatchDto } from './catalog.dto';
@ApiTags('Catalog') @Permit('customer','operations.read','catalog.write') @Controller('service-categories')
export class CategoriesController {
 constructor(private catalog:CatalogService) {}
 @Get() list(@Query() q:ListDto,@CurrentActor() a:Actor){return this.catalog.categories(q,a);}
 @Permit('catalog.write') @Post() create(@Body() dto:CategoryDto,@CurrentActor() a:Actor){return this.catalog.saveCategory(dto,a);}
 @Permit('catalog.write') @Patch(':id') patch(@Param('id',ParseUUIDPipe) id:string,@Body() dto:CategoryPatchDto,@CurrentActor() a:Actor){return this.catalog.saveCategory(dto,a,id);}
}
@ApiTags('Catalog') @Permit('customer','operations.read','catalog.write') @Controller('services')
export class ServicesController {
 constructor(private catalog:CatalogService) {}
 @Get() list(@Query() q:ListDto,@CurrentActor() a:Actor){return this.catalog.services(q,a);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.catalog.detail(id,a);}
 @Permit('catalog.write') @Post() create(@Body() dto:ServiceDto,@CurrentActor() a:Actor){return this.catalog.saveService(dto,a);}
 @Permit('catalog.write') @Patch(':id') patch(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ServicePatchDto,@CurrentActor() a:Actor){return this.catalog.saveService(dto,a,id);}
}

