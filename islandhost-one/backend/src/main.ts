import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { validateConfig } from './config';
async function main(){
 validateConfig();
 const app=await NestFactory.create(AppModule,{bufferLogs:true});
 configureApp(app);app.enableShutdownHooks();
 // Respect an IIS named pipe PORT as well as a numeric port.
 const port=process.env.PORT || process.env.API_PORT || '4000';
 await app.listen(/^\d+$/.test(port)?Number(port):port,process.env.API_BIND_HOST||'127.0.0.1');
}
main().catch(()=>{process.stderr.write('IslandHost API could not start. Verify runtime configuration and database access.\n');process.exitCode=1;});

