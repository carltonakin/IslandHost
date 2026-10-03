import { Body,Controller,Get,HttpCode,Post,Req,Res } from '@nestjs/common';
import { ApiTags,ApiCookieAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request,Response } from 'express';
import { AuthService } from './auth.service';
import { Public,CurrentActor } from './access';
import { Actor } from '../common/types';
import { LoginDto,ForgotDto,ResetDto,ChangePasswordDto } from './auth.dto';
@ApiTags('Authentication') @ApiCookieAuth('ih_access') @Controller('auth')
export class AuthController {
 constructor(private auth:AuthService) {}
 private cookies(res:Response,tokens:{access:string;refresh:string}) {
  const secure=process.env.COOKIE_SECURE==='true';
  res.cookie('ih_access',tokens.access,{httpOnly:true,secure,sameSite:'lax',path:'/',maxAge:15*60000});
  res.cookie('ih_refresh',tokens.refresh,{httpOnly:true,secure,sameSite:'lax',path:'/api/auth',maxAge:7*86400000});
 }
 private clear(res:Response) { res.clearCookie('ih_access',{path:'/'});res.clearCookie('ih_refresh',{path:'/api/auth'}); }
 @Public() @Throttle({default:{limit:8,ttl:60000}}) @Post('login') @HttpCode(200)
 async login(@Body() dto:LoginDto,@Res({passthrough:true}) res:Response) { const result=await this.auth.login(dto.email,dto.password);this.cookies(res,result.tokens);return result.actor; }
 @Public() @Post('refresh') @HttpCode(200)
 async refresh(@Req() req:Request,@Res({passthrough:true}) res:Response) { const tokens=await this.auth.refresh(req.cookies?.ih_refresh);this.cookies(res,tokens);return {message:'Session renewed.'}; }
 @Get('me') me(@CurrentActor() actor:Actor) { return actor; }
 @Post('logout') @HttpCode(200)
 async logout(@CurrentActor() actor:Actor,@Res({passthrough:true}) res:Response) { const result=await this.auth.logout(actor);this.clear(res);return result; }
 @Post('change-password') @HttpCode(200)
 async change(@Body() dto:ChangePasswordDto,@CurrentActor() actor:Actor,@Res({passthrough:true}) res:Response) {const result=await this.auth.change(actor,dto.currentPassword,dto.password);this.clear(res);return result;}
 @Public() @Throttle({default:{limit:3,ttl:60000}}) @Post('forgot-password') @HttpCode(200) forgot(@Body() dto:ForgotDto) {return this.auth.forgot(dto.email);}
 @Public() @Throttle({default:{limit:5,ttl:60000}}) @Post('reset-password') @HttpCode(200) reset(@Body() dto:ResetDto) {return this.auth.reset(dto.token,dto.password);}
}

