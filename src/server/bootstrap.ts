import { INestApplication,ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder,SwaggerModule } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Request,Response,NextFunction } from 'express';
import { required } from './config';
import { Envelope,Errors } from './common/http';
import { registerRequestSchemas } from './common/openapi';
export function configureApp(app:INestApplication){
 app.setGlobalPrefix('api');
 app.useWebSocketAdapter(new WsAdapter(app));
 (app as NestExpressApplication).set('trust proxy',process.env.TRUST_PROXY==='true'?1:false);
 app.use(helmet());
 app.use(cookieParser());
 app.use((req:Request,res:Response,next:NextFunction)=>{
  res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==new URL(required('APP_URL')).origin){
   res.status(403).json({error:{status:403,message:'Please reload the page and try again.'}});return;
  }
  next();
 });
 app.enableCors({origin:new URL(required('APP_URL')).origin,credentials:true,methods:['GET','POST','PATCH','OPTIONS']});
 app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
 app.useGlobalFilters(new Errors());app.useGlobalInterceptors(new Envelope());
 if(process.env.SWAGGER_ENABLED==='true'&&process.env.NODE_ENV!=='production'){
  registerRequestSchemas();
  const doc=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('IslandHost One').setDescription('Phase 1 concierge REST API. Same-origin HttpOnly cookie authentication; write requests require APP_URL Origin.').setVersion('1.0').addCookieAuth('ih_access',{type:'apiKey',in:'cookie'},'ih_access').addSecurityRequirements('ih_access').build());
  SwaggerModule.setup('api/docs',app,doc);
 }
}

