import { Body,Controller,Get,Param,ParseUUIDPipe,Patch,Post,Query,BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor,Permit } from '../auth/access';
import { Actor } from '../common/types';
import { ListDto } from '../common/dto';
import { CustomersService } from './customers.service';
import { TripsService } from './trips.service';
import { CustomerDto,CustomerPatchDto,ProfileDto,PreferencesDto,GuestDto,TripDto,TripPatchDto } from './crm.dto';
@ApiTags('Customers') @Permit('customer','operations.read') @Controller('customers')
export class CustomersController {
 constructor(private customers:CustomersService) {}
 @Get('me') me(@CurrentActor() a:Actor){if(!a.customerId)throw new BadRequestException('No customer profile is attached.');return this.customers.detail(a.customerId,a);}
 @Patch('me') profile(@Body() dto:ProfileDto,@CurrentActor() a:Actor){if(!a.customerId)throw new BadRequestException();return this.customers.patch(a.customerId,dto,a);}
 @Permit('operations.read') @Get() list(@Query() q:ListDto){return this.customers.list(q);}
 @Permit('customers.write') @Post() create(@Body() dto:CustomerDto,@CurrentActor() a:Actor){return this.customers.create(dto,a);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.customers.detail(id,a);}
 @Permit('customers.write') @Patch(':id') patch(@Param('id',ParseUUIDPipe) id:string,@Body() dto:CustomerPatchDto,@CurrentActor() a:Actor){return this.customers.patch(id,dto,a);}
 @Patch(':id/preferences') prefs(@Param('id',ParseUUIDPipe) id:string,@Body() dto:PreferencesDto,@CurrentActor() a:Actor){return this.customers.preferences(id,dto,a);}
 @Post(':id/guests') guests(@Param('id',ParseUUIDPipe) id:string,@Body() dto:GuestDto,@CurrentActor() a:Actor){return this.customers.guest(id,dto,a);}
}
@ApiTags('Trips') @Permit('customer','operations.read') @Controller('trips')
export class TripsController {
 constructor(private trips:TripsService) {}
 @Get() list(@Query() q:ListDto,@CurrentActor() a:Actor){return this.trips.list(q,a);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.trips.detail(id,a);}
 @Permit('customer','trips.write') @Post() create(@Body() dto:TripDto,@CurrentActor() a:Actor){return this.trips.save(dto,a);}
 @Permit('customer','trips.write') @Patch(':id') patch(@Param('id',ParseUUIDPipe) id:string,@Body() dto:TripPatchDto,@CurrentActor() a:Actor){return this.trips.save(dto,a,id);}
}

