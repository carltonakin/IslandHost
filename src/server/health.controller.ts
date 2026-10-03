import { Controller,Get,ServiceUnavailableException } from '@nestjs/common';
import { Public } from './auth/access';
import { Db } from './database/db';
@Controller('health')
export class HealthController {
 constructor(private db:Db) {}
 @Public() @Get() async health(){try{await this.db.query('SELECT 1 Healthy');return {status:'ok'};}catch{throw new ServiceUnavailableException('The service is temporarily unavailable.');}}
}

