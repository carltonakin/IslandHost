import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { validateConfig } from './config';
async function main(){
 try { validateConfig(); }
 catch (error) {
  // validateConfig only emits controlled configuration messages, never secret values.
  const message=error instanceof Error?error.message:'Invalid runtime configuration';
  process.stderr.write(`IslandHost API configuration error: ${message}\n`);
  process.exitCode=1;return;
 }
 const app=await NestFactory.create(AppModule,{bufferLogs:true});
 configureApp(app);app.enableShutdownHooks();
 // Respect an IIS named pipe PORT as well as a numeric port.
 const port=process.env.PORT || process.env.API_PORT || '4000';
 await app.listen(/^\d+$/.test(port)?Number(port):port,process.env.API_BIND_HOST||'127.0.0.1');
}
main().catch((error:unknown)=>{
 const details=error as {name?:string;code?:string;number?:number;driverError?:{number?:number}}|null;
 process.stderr.write(JSON.stringify({event:'api_start_failed',type:details?.name,code:details?.code,sqlNumber:details?.number??details?.driverError?.number})+'\n');
 process.stderr.write('IslandHost API could not start. Verify runtime configuration and database access.\n');
 process.exitCode=1;
});

