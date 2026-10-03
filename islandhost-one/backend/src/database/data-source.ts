import 'reflect-metadata';
import '../config';
import { DataSource } from 'typeorm';
import { required } from '../config';
import { Initial1780000000000 } from './initial.migration';
import { Phase21790690000000 } from './phase2.migration';
import { createRequire } from 'node:module';
const localRequire = createRequire(__filename);
const odbc = (v:string) => '{'+v.replace(/}/g,'}}')+'}';
export function createDataSource(database = required('DB_DATABASE')) {
 const native=process.env.DB_DRIVER==='native';
 if(native && process.env.NODE_ENV==='production')throw new Error('Use the standard TCP SQL Server driver in production');
 return new DataSource({
  type: 'mssql', host: required('DB_HOST'), port: Number(process.env.DB_PORT || 1433),
  username: required('DB_USERNAME'), password: required('DB_PASSWORD'), database,
  ...(native ? {driver:localRequire('mssql/msnodesqlv8'),extra:{connectionString:`Driver={ODBC Driver 17 for SQL Server};Server=${odbc(required('DB_HOST'))};Database=${odbc(database)};UID=${odbc(required('DB_USERNAME'))};PWD=${odbc(required('DB_PASSWORD'))};Encrypt=Yes;TrustServerCertificate=Yes;`}} : {}),
  synchronize: false, migrationsRun: false, logging: false,
  migrations: [Initial1780000000000,Phase21790690000000], migrationsTableName: 'SchemaMigrations',
  options: { encrypt: process.env.DB_ENCRYPT !== 'false', trustServerCertificate: process.env.DB_TRUST_CERTIFICATE === 'true', useUTC: true, abortTransactionOnError: true },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }, requestTimeout: 15000
 });
}

