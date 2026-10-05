import { Body,Controller,Get,Param,ParseUUIDPipe,Patch,Post,Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public,Permit,CurrentActor } from '../auth/access';
import { Actor } from '../common/types';
import { CatalogService } from '../catalog/catalog.service';
import { ItineraryPlansService } from './plans.service';
import { BookingCheckoutService } from './checkout.service';
import { PlanDto,ImportPlanDto,PlanItemDto,ChangeItemDto,BookingActionDto,MarketplaceQuery,CheckoutDto,SelectionDto } from './marketplace.dto';
@Public() @Controller('marketplace')
export class MarketplaceController {
 constructor(private catalog:CatalogService){}
 @Get('categories') categories(){return this.catalog.publicCategories();}
 @Get('listings') list(@Query() q:MarketplaceQuery){return this.catalog.publicListings(q);}
 @Get('listings/:id') detail(@Param('id',ParseUUIDPipe) id:string){return this.catalog.publicDetail(id);}
}
@Permit('customer','bookings.manage','invoices.read') @Controller('trip-plans')
export class TripPlansController {
 constructor(private plans:ItineraryPlansService,private checkout:BookingCheckoutService){}
 @Get() list(@CurrentActor() a:Actor){return this.plans.list(a);}
 @Permit('customer') @Post() create(@Body() dto:PlanDto,@CurrentActor() a:Actor){return this.plans.create(dto,a);}
 @Permit('customer') @Throttle({default:{limit:10,ttl:60000}}) @Post('import') import(@Body() dto:ImportPlanDto,@CurrentActor() a:Actor){return this.plans.create(dto,a,dto);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.plans.detail(id,a);}
 @Permit('customer','bookings.manage') @Patch(':id') update(@Param('id',ParseUUIDPipe) id:string,@Body() dto:PlanDto,@CurrentActor() a:Actor){return this.plans.update(id,dto,a);}
 @Permit('customer','bookings.manage') @Post(':id/items') add(@Param('id',ParseUUIDPipe) id:string,@Body() dto:PlanItemDto,@CurrentActor() a:Actor){return this.plans.add(id,dto,a);}
 @Get(':id/checkout') preview(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.checkout.preview(id,a);}
 @Permit('customer','invoices.write') @Post(':id/checkout') checkoutPlan(@Param('id',ParseUUIDPipe) id:string,@Body() dto:CheckoutDto,@CurrentActor() a:Actor){return this.checkout.prepare(id,dto,a);}
}
@Permit('customer','bookings.manage','vendor') @Controller('bookings')
export class BookingsController {
 constructor(private plans:ItineraryPlansService){}
 @Permit('bookings.manage','vendor') @Get() queue(@Query() q:MarketplaceQuery,@CurrentActor() a:Actor){return this.plans.queue(q,a);}
 @Permit('customer','bookings.manage') @Patch(':id') edit(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ChangeItemDto,@CurrentActor() a:Actor){return this.plans.edit(id,dto,a);}
 @Patch(':id/status') action(@Param('id',ParseUUIDPipe) id:string,@Body() dto:BookingActionDto,@CurrentActor() a:Actor){return this.plans.action(id,dto,a);}
 @Get(':id/history') history(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.plans.historyFor(id,a);}
}
@Permit('invoices.write') @Controller('invoices')
export class InvoiceBookingsController {
 constructor(private checkout:BookingCheckoutService){}
 @Get(':id/booking-options') options(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.checkout.invoiceOptions(id,a);}
 @Post(':id/bookings') link(@Param('id',ParseUUIDPipe) id:string,@Body() dto:SelectionDto,@CurrentActor() a:Actor){return this.checkout.link(id,dto.ItemIds,a);}
}