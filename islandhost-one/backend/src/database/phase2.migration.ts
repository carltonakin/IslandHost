import { MigrationInterface,QueryRunner } from 'typeorm';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export class Phase21790690000000 implements MigrationInterface {
 async up(runner:QueryRunner){const sql=await readFile(resolve(__dirname,'../../../database/migrations/002_phase2.sql'),'utf8');for(const batch of sql.split(/^GO\s*$/m))if(batch.trim())await runner.query(batch);}
 async down():Promise<void>{throw new Error('Phase 2 rollback is forward-only. Restore a verified backup or write a forward migration.');}
}
