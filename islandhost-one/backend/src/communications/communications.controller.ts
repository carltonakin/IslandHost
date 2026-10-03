import { Body,Controller,Get,Param,ParseUUIDPipe,Post,Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentActor,Permit } from '../auth/access';
import { Actor } from '../common/types';
import { ListDto } from '../common/dto';
import { ConversationDto,ConversationMessageDto,ConversationReadDto } from './communications.dto';
import { ConversationsService } from './conversations.service';
@ApiTags('Conversations') @Permit('customer','conversations.manage','driver','vendor') @Controller('conversations')
export class ConversationsController {
 constructor(private conversations:ConversationsService){}
 @Get('realtime') realtime(){return {enabled:process.env.REALTIME_ENABLED==='true',path:'/api/realtime',pollInterval:15000};}
 @Get('unread') unread(@CurrentActor() a:Actor){return this.conversations.unread(a);}
 @Permit('conversations.manage') @Get('contacts') contacts(@Query() q:ListDto){return this.conversations.contacts(q);}
 @Get() list(@Query() q:ListDto,@CurrentActor() a:Actor){return this.conversations.list(q,a);}
 @Permit('customer','conversations.manage') @Post() create(@Body() dto:ConversationDto,@CurrentActor() a:Actor){return this.conversations.create(dto,a);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string,@CurrentActor() a:Actor){return this.conversations.detail(id,a);}
 @Get(':id/messages') messages(@Param('id',ParseUUIDPipe) id:string,@Query() q:ListDto,@CurrentActor() a:Actor){return this.conversations.messages(id,q,a);}
 @Throttle({default:{limit:40,ttl:60000}}) @Post(':id/messages') send(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ConversationMessageDto,@CurrentActor() a:Actor){return this.conversations.send(id,dto,a);}
 @Post(':id/read') read(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ConversationReadDto,@CurrentActor() a:Actor){return this.conversations.read(id,dto,a);}
}
