import { Body,Controller,Get,Param,ParseUUIDPipe,Patch,Post,Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor,Permit } from '../auth/access';
import { Actor,STATUSES,TRANSITIONS,allowed } from '../common/types';
import { ListDto } from '../common/dto';
import { RequestsService } from './requests.service';
import { ItinerariesService } from './itineraries.service';
import { RequestDto,StatusDto,ItineraryDto } from './requests.dto';
@ApiTags('Service requests') @Permit('customer','operations.read') @Controller('service-requests')
export class RequestsController {
 constructor(private requests:RequestsService) {}
 @Get('meta') meta(@CurrentActor() a:Actor){return {statuses:STATUSES,transitions:allowed(a,'requests.write')?TRANSITIONS:{Requested:['Cancelled'],'Under Review':['Cancelled'],Quoted:['Client Approved','Cancelled']}};}
 @Get() list(@Query() q:ListDto,@CurrentActor() a:Actor){return this.requests.list(q,a);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.requests.detail(id,a);}
 @Permit('customer','requests.write') @Post() create(@Body() dto:RequestDto,@CurrentActor() a:Actor){return this.requests.create(dto,a);}
 @Permit('customer','requests.write') @Patch(':id/status') status(@Param('id',ParseUUIDPipe) id:string,@Body() dto:StatusDto,@CurrentActor() a:Actor){return this.requests.status(id,dto,a);}
}
@ApiTags('Itineraries') @Permit('customer','operations.read') @Controller('itineraries')
export class ItinerariesController {
 constructor(private itineraries:ItinerariesService) {}
 @Get() list(@Query() q:ListDto,@CurrentActor() a:Actor){return this.itineraries.list(q,a);}
 @Permit('itineraries.write') @Post() create(@Body() dto:ItineraryDto,@CurrentActor() a:Actor){return this.itineraries.create(dto,a);}
}

