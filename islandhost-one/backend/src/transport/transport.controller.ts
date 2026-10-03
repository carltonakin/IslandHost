import { Body,Controller,Get,Param,ParseUUIDPipe,Patch,Post,Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor,Permit } from '../auth/access';
import { Actor } from '../common/types';
import { ActionDto,Phase2ListDto } from '../phase2/phase2.dto';
import { DriverDto,DriverPatchDto,VehicleDto,VehiclePatchDto,TransferDto,TransferEditDto,TransferAssignDto,TRANSFER_TYPES } from './transport.dto';
import { FleetService } from './fleet.service';
import { TransfersService } from './transfers.service';
@ApiTags('Drivers') @Permit('dispatch.read') @Controller('drivers')
export class DriversController {
 constructor(private fleet:FleetService){}
 @Get('accounts') accounts(@Query() q:Phase2ListDto){return this.fleet.accounts(q);}
 @Get() list(@Query() q:Phase2ListDto){return this.fleet.list('Drivers',q);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string){return this.fleet.detail('Drivers',id);}
 @Permit('dispatch.write') @Post() create(@Body() dto:DriverDto,@CurrentActor() a:Actor){return this.fleet.save('Drivers',dto,a);}
 @Permit('dispatch.write') @Patch(':id') edit(@Param('id',ParseUUIDPipe) id:string,@Body() dto:DriverPatchDto,@CurrentActor() a:Actor){return this.fleet.save('Drivers',dto,a,id);}
}
@ApiTags('Vehicles') @Permit('dispatch.read') @Controller('vehicles')
export class VehiclesController {
 constructor(private fleet:FleetService){}
 @Get() list(@Query() q:Phase2ListDto){return this.fleet.list('Vehicles',q);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string){return this.fleet.detail('Vehicles',id);}
 @Permit('dispatch.write') @Post() create(@Body() dto:VehicleDto,@CurrentActor() a:Actor){return this.fleet.save('Vehicles',dto,a);}
 @Permit('dispatch.write') @Patch(':id') edit(@Param('id',ParseUUIDPipe) id:string,@Body() dto:VehiclePatchDto,@CurrentActor() a:Actor){return this.fleet.save('Vehicles',dto,a,id);}
}
@ApiTags('Transfers') @Permit('dispatch.read','driver') @Controller('transfers')
export class TransfersController {
 constructor(private transfers:TransfersService){}
 @Get('meta') meta(){return {types:TRANSFER_TYPES};}
 @Get('current') current(@CurrentActor() a:Actor){return this.transfers.current(a);}
 @Get() list(@Query() q:Phase2ListDto,@CurrentActor() a:Actor){return this.transfers.list(q,a);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.transfers.detail(id,a);}
 @Permit('dispatch.write') @Post() create(@Body() dto:TransferDto,@CurrentActor() a:Actor){return this.transfers.save(dto,a);}
 @Permit('dispatch.write') @Patch(':id') edit(@Param('id',ParseUUIDPipe) id:string,@Body() dto:TransferEditDto,@CurrentActor() a:Actor){return this.transfers.save(dto,a,id);}
 @Permit('dispatch.write') @Patch(':id/assign') assign(@Param('id',ParseUUIDPipe) id:string,@Body() dto:TransferAssignDto,@CurrentActor() a:Actor){return this.transfers.assign(id,dto,a);}
 @Patch(':id/status') action(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ActionDto,@CurrentActor() a:Actor){return this.transfers.action(id,dto,a);}
}
@ApiTags('Dispatch') @Permit('dispatch.read') @Controller('dispatch')
export class DispatchController {
 constructor(private transfers:TransfersService){}
 @Get() board(@Query() q:Phase2ListDto,@CurrentActor() a:Actor){return this.transfers.list(q,a);}
}
