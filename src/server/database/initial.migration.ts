import { MigrationInterface, QueryRunner } from 'typeorm';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export class Initial1780000000000 implements MigrationInterface {
 async up(runner: QueryRunner) {
  const sql = await readFile(resolve(__dirname, '../../../database/migrations/001_initial.sql'), 'utf8');
  for (const batch of sql.split(/^GO\s*$/m)) if (batch.trim()) await runner.query(batch);
 }
 async down(): Promise<void> { throw new Error('Destructive rollback is disabled. Restore a verified backup or write a forward migration.'); }
}

