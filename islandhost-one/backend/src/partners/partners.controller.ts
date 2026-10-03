import { Body,Controller,Get,Param,ParseUUIDPipe,Patch,Post,Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor,Permit } from '../auth/access';
import { Actor } from '../common/types';
import { ActionDto,Phase2ListDto } from '../phase2/phase2.dto';
import { VendorDto,VendorPatchDto,VendorServiceDto,AssignmentDto,VENDOR_TYPES } from './partners.dto';
import { VendorsService } from './vendors.service';
import { AssignmentsService } from './assignments.service';
@ApiTags('Vendors') @Permit('vendors.read') @Controller('vendors')
export class VendorsController {
 constructor(private vendors:VendorsService){}
 @Get('meta') meta(){return {types:VENDOR_TYPES};}
 @Permit('vendors.write') @Get('accounts') accounts(@Query() q:Phase2ListDto){return this.vendors.accounts(q);}
 @Get() list(@Query() q:Phase2ListDto){return this.vendors.list(q);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string){return this.vendors.detail(id);}
 @Permit('vendors.write') @Post() create(@Body() dto:VendorDto,@CurrentActor() a:Actor){return this.vendors.save(dto,a);}
 @Permit('vendors.write') @Patch(':id') edit(@Param('id',ParseUUIDPipe) id:string,@Body() dto:VendorPatchDto,@CurrentActor() a:Actor){return this.vendors.save(dto,a,id);}
 @Permit('vendors.write') @Post(':id/services') service(@Param('id',ParseUUIDPipe) id:string,@Body() dto:VendorServiceDto,@CurrentActor() a:Actor){return this.vendors.service(id,dto,a);}
}
@ApiTags('Vendor assignments') @Permit('vendors.read','vendor') @Controller('vendor-assignments')
export class AssignmentsController {
 constructor(private assignments:AssignmentsService){}
 @Get() list(@Query() q:Phase2ListDto,@CurrentActor() a:Actor){return this.assignments.list(q,a);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.assignments.detail(id,a);}
 @Permit('vendors.write') @Post() create(@Body() dto:AssignmentDto,@CurrentActor() a:Actor){return this.assignments.create(dto,a);}
 @Patch(':id/status') action(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ActionDto,@CurrentActor() a:Actor){return this.assignments.action(id,dto,a);}
}
