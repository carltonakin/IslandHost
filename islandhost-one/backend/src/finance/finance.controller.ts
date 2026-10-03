import { Body,Controller,Get,Param,ParseUUIDPipe,Patch,Post,Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentActor,Permit } from '../auth/access';
import { Actor } from '../common/types';
import { ActionDto,Phase2ListDto } from '../phase2/phase2.dto';
import { QuoteDto,InvoiceDto,ConvertQuoteDto,PaymentDto,RefundDto } from './finance.dto';
import { QuotesService } from './quotes.service';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { ReportsService } from './reports.service';
@ApiTags('Quotes') @Permit('quotes.read','customer') @Controller('quotes')
export class QuotesController {
 constructor(private quotes:QuotesService,private invoices:InvoicesService){}
 @Get() list(@Query() q:Phase2ListDto,@CurrentActor() a:Actor){return this.quotes.list(q,a);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.quotes.detail(id,a);}
 @Permit('quotes.write') @Post() create(@Body() dto:QuoteDto,@CurrentActor() a:Actor){return this.quotes.save(dto,a);}
 @Permit('quotes.write') @Patch(':id') edit(@Param('id',ParseUUIDPipe) id:string,@Body() dto:QuoteDto,@CurrentActor() a:Actor){return this.quotes.save(dto,a,id);}
 @Patch(':id/status') action(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ActionDto,@CurrentActor() a:Actor){return this.quotes.action(id,dto,a);}
 @Permit('invoices.write') @Post(':id/invoice') convert(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ConvertQuoteDto,@CurrentActor() a:Actor){return this.invoices.convert(id,dto,a);}
}
@ApiTags('Invoices') @Permit('invoices.read','customer') @Controller('invoices')
export class InvoicesController {
 constructor(private invoices:InvoicesService){}
 @Get() list(@Query() q:Phase2ListDto,@CurrentActor() a:Actor){return this.invoices.list(q,a);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.invoices.detail(id,a);}
 @Permit('invoices.write') @Post() create(@Body() dto:InvoiceDto,@CurrentActor() a:Actor){return this.invoices.create(dto,a);}
 @Permit('invoices.write') @Patch(':id/status') action(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ActionDto,@CurrentActor() a:Actor){return this.invoices.action(id,dto,a);}
}
@ApiTags('Payments') @Permit('payments.read','customer') @Controller('payments')
export class PaymentsController {
 constructor(private payments:PaymentsService){}
 @Get() list(@Query() q:Phase2ListDto,@CurrentActor() a:Actor){return this.payments.list(q,a);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.payments.detail(id,a);}
 @Permit('payments.write') @Throttle({default:{limit:30,ttl:60000}}) @Post() create(@Body() dto:PaymentDto,@CurrentActor() a:Actor){return this.payments.record(dto,a);}
}
@ApiTags('Refunds') @Permit('payments.read','customer') @Controller('refunds')
export class RefundsController {
 constructor(private payments:PaymentsService){}
 @Get() list(@Query() q:Phase2ListDto,@CurrentActor() a:Actor){return this.payments.refunds(q,a);}
 @Permit('refunds.write') @Throttle({default:{limit:20,ttl:60000}}) @Post() create(@Body() dto:RefundDto,@CurrentActor() a:Actor){return this.payments.refund(dto,a);}
}
@ApiTags('Financial reports') @Permit('financial.read') @Controller('financial-dashboard')
export class FinancialDashboardController {
 constructor(private reports:ReportsService){}
 @Get() report(@Query() q:Phase2ListDto){return this.reports.summary(q);}
}
