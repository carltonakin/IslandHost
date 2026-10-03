import { Module,Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule,ThrottlerGuard } from '@nestjs/throttler';
import { Db } from './database/db';
import { AccessGuard } from './auth/access';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { Mailer } from './auth/mailer';
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
@Global() @Module({
 imports:[JwtModule.register({}),ThrottlerModule.forRoot([{ttl:60000,limit:180}])],
 controllers:[HealthController,AuthController,CategoriesController,ServicesController,CustomersController,TripsController,RequestsController,ItinerariesController,UsersController,SystemController],
 providers:[Db,AuthService,Mailer,CatalogService,CustomersService,TripsService,RequestsService,ItinerariesService,UsersService,InboxService,DashboardService,{provide:APP_GUARD,useClass:ThrottlerGuard},{provide:APP_GUARD,useClass:AccessGuard}],
 exports:[Db]
})
export class AppModule {}

