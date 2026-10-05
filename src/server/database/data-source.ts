import 'reflect-metadata';
import '../config';
import { DataSource } from 'typeorm';

import { Initial1780000000000 } from './initial.migration';
import { Phase21790690000000 } from './phase2.migration';
import { Marketplace1791158400000 } from './marketplace.migration';
import { createRequire } from 'node:module';
const localRequire = createRequire(__filename);
const odbc = (v:string) => '{'+v.replace(/}/g,'}}')+'}';
export function createDataSource(database?:string, environment:NodeJS.ProcessEnv=process.env) {
 const required=(name:string)=>{const value=environment[name];if(!value)throw new Error(`Missing environment variable: ${name}`);return value;};
 database=database||required('DB_DATABASE');
 const native=environment.DB_DRIVER==='native';
 if(native && environment.NODE_ENV==='production')throw new Error('Use the standard TCP SQL Server driver in production');
 return new DataSource({
  type: 'mssql', host: required('DB_HOST'), port: Number(environment.DB_PORT || 1433),
  username: required('DB_USERNAME'), password: required('DB_PASSWORD'), database,
  ...(native ? {driver:localRequire('mssql/msnodesqlv8'),extra:{connectionString:`Driver={ODBC Driver 17 for SQL Server};Server=${odbc(required('DB_HOST'))};Database=${odbc(database)};UID=${odbc(required('DB_USERNAME'))};PWD=${odbc(required('DB_PASSWORD'))};Encrypt=Yes;TrustServerCertificate=Yes;`}} : {}),
  synchronize: false, migrationsRun: false, logging: false,
  migrations: [Initial1780000000000,Phase21790690000000,Marketplace1791158400000], migrationsTableName: 'SchemaMigrations',
  options: { encrypt: environment.DB_ENCRYPT !== 'false', trustServerCertificate: environment.DB_TRUST_CERTIFICATE === 'true', useUTC: true, abortTransactionOnError: true },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }, requestTimeout: 15000
 });
}

