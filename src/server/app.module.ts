import { Module,Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule,ThrottlerGuard } from '@nestjs/throttler';
import { Db } from './database/db';
import { AccessGuard } from './auth/access';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { Mailer } from './auth/mailer';
import { ServicePhotosController } from './catalog/service-photos.controller';
import { ServicePhotosService } from './catalog/service-photos.service';
import { CatalogService } from './catalog/catalog.service';
import { CategoriesController,ServicesController } from './catalog/catalog.controller';
import { CustomersService } from './crm/customers.service';
import { TripsService } from './crm/trips.service';
import { CustomersController,TripsController } from './crm/crm.controller';
import { RequestsService } from './requests/requests.service';
import { ItinerariesService } from './requests/itineraries.service';
import { RequestsController,ItinerariesController } from './requests/requests.controller';
import { UsersService } from './system/users.service';
import { InboxService } from './system/inbox.service';
import { DashboardService } from './system/dashboard.service';
import { UsersController,SystemController } from './system/system.controller';
import { HealthController } from './health.controller';
import { QuotesController,InvoicesController,PaymentsController,RefundsController,FinancialDashboardController } from './finance/finance.controller';
import { FinancialCore } from './finance/financial-core';
import { QuotesService } from './finance/quotes.service';
import { InvoicesService } from './finance/invoices.service';
import { PaymentsService } from './finance/payments.service';
import { ReportsService } from './finance/reports.service';
import { ManualPaymentProvider,PaymentProviders } from './finance/payment-provider';
import { VendorsController,AssignmentsController } from './partners/partners.controller';
import { VendorsService } from './partners/vendors.service';
import { AssignmentsService } from './partners/assignments.service';
import { DriversController,VehiclesController,TransfersController,DispatchController } from './transport/transport.controller';
import { FleetService } from './transport/fleet.service';
import { TransfersService } from './transport/transfers.service';
import { ConversationsController } from './communications/communications.controller';
import { ConversationsService } from './communications/conversations.service';
import { MarketplaceController,TripPlansController,BookingsController,InvoiceBookingsController } from './marketplace/marketplace.controller';
import { ItineraryPlansService } from './marketplace/plans.service';
import { BookingCheckoutService } from './marketplace/checkout.service';
import { RealtimeGateway } from './communications/realtime.gateway';
@Global() @Module({
 imports:[JwtModule.register({}),ThrottlerModule.forRoot([{ttl:60000,limit:180}])],
 controllers:[ServicePhotosController,MarketplaceController,TripPlansController,BookingsController,InvoiceBookingsController,HealthController,AuthController,CategoriesController,ServicesController,CustomersController,TripsController,RequestsController,ItinerariesController,UsersController,SystemController,QuotesController,InvoicesController,PaymentsController,RefundsController,FinancialDashboardController,VendorsController,AssignmentsController,DriversController,VehiclesController,TransfersController,DispatchController,ConversationsController],
 providers:[ServicePhotosService,ItineraryPlansService,BookingCheckoutService,Db,AuthService,Mailer,CatalogService,CustomersService,TripsService,RequestsService,ItinerariesService,UsersService,InboxService,DashboardService,FinancialCore,QuotesService,InvoicesService,PaymentsService,ReportsService,ManualPaymentProvider,PaymentProviders,VendorsService,AssignmentsService,FleetService,TransfersService,ConversationsService,RealtimeGateway,{provide:APP_GUARD,useClass:ThrottlerGuard},{provide:APP_GUARD,useClass:AccessGuard}],
 exports:[Db]
})
export class AppModule {}

