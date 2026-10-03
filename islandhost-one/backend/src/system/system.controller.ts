import { Body,Controller,Get,Param,ParseUUIDPipe,Patch,Post,Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor,Permit } from '../auth/access';
import { Actor } from '../common/types';
import { ListDto } from '../common/dto';
import { UsersService } from './users.service';
import { InboxService } from './inbox.service';
import { DashboardService } from './dashboard.service';
import { UserDto,UserPatchDto,MePatchDto,MessageDto,SettingDto } from './system.dto';
@ApiTags('Users') @Controller('users')
export class UsersController {
 constructor(private users:UsersService) {}
 @Get('me') me(@CurrentActor() a:Actor){return this.users.profile(a);}
 @Patch('me') profile(@Body() dto:MePatchDto,@CurrentActor() a:Actor){return this.users.me(dto,a);}
 @Permit('requests.write') @Get('staff') staff(@Query() q:ListDto){return this.users.staff(q);}
 @Permit('users.manage') @Get() list(@Query() q:ListDto){return this.users.list(q);}
 @Permit('users.manage') @Post() create(@Body() dto:UserDto,@CurrentActor() a:Actor){return this.users.create(dto,a);}
 @Permit('users.manage') @Patch(':id') patch(@Param('id',ParseUUIDPipe) id:string,@Body() dto:UserPatchDto,@CurrentActor() a:Actor){return this.users.patch(id,dto,a);}
}
@ApiTags('System') @Controller()
export class SystemController {
 constructor(private users:UsersService,private inbox:InboxService,private dashboardService:DashboardService) {}
 @Permit('users.manage') @Get('roles') roles(){return this.users.roles();}
 @Permit('customer','operations.read') @Get('dashboard') dashboard(@CurrentActor() a:Actor){return this.dashboardService.dashboard(a);}
 @Permit('customer','operations.read') @Get('search') search(@Query() q:ListDto,@CurrentActor() a:Actor){return this.dashboardService.search(q.search||'',a);}
 @Get('notifications') notifications(@Query() q:ListDto,@CurrentActor() a:Actor){return this.inbox.notifications(q,a);}
 @Get('notifications/unread') unread(@CurrentActor() a:Actor){return this.inbox.unread(a);}
 @Post('notifications/read-all') readAll(@CurrentActor() a:Actor){return this.inbox.read(a);}
 @Patch('notifications/:id/read') read(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.inbox.read(a,id);}
 @Permit('customer','operations.read') @Get('messages') messages(@Query() q:ListDto,@CurrentActor() a:Actor){return this.inbox.messages(q,a);}
 @Permit('customer','customers.write') @Post('messages') send(@Body() dto:MessageDto,@CurrentActor() a:Actor){return this.inbox.send(dto,a);}
 @Permit('settings.manage') @Get('settings') settings(){return this.inbox.settings();}
 @Permit('settings.manage') @Post('settings') setting(@Body() dto:SettingDto,@CurrentActor() a:Actor){return this.inbox.setting(dto,a);}
 @Permit('audit.read') @Get('audit-log') audit(@Query() q:ListDto){return this.inbox.audit(q);}
}

