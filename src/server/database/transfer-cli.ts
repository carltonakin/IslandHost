import { DataSource } from 'typeorm';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDataSource } from './data-source';
import { Snapshot,TransferError,expectedTables,snapshotDatabase,writeSnapshot,readSnapshot,importSnapshot,verifySnapshot,snapshotSummary } from './transfer';
import { ROLES } from '../common/types';

function targetEnvironment(rehearsal:boolean):NodeJS.ProcessEnv {
 const password=process.env.MIGRATION_DB_PASSWORD;
 if(!password)throw new TransferError('Set MIGRATION_DB_PASSWORD in the process environment or ignored root .env. No destination changes were made.');
 const host=process.env.MIGRATION_DB_HOST||'sql8011.site4now.net';
 const database=process.env.MIGRATION_DB_DATABASE||'db_9aa62b_islandhost';
 if(rehearsal&&(!/^(lpc:)?localhost$/i.test(host)||!/_Test$/.test(database)))throw new TransferError('Rehearsal requires localhost and a distinct database ending in _Test');
 return {
  NODE_ENV:rehearsal?'test':'production',DB_HOST:host,DB_PORT:process.env.MIGRATION_DB_PORT||'1433',
  DB_DATABASE:database,DB_USERNAME:process.env.MIGRATION_DB_USERNAME||'db_9aa62b_islandhost_admin',DB_PASSWORD:password,
  DB_DRIVER:rehearsal?'native':'tcp',DB_ENCRYPT:'true',DB_TRUST_CERTIFICATE:rehearsal?'true':'false',
 };
}
async function connect(database:DataSource,label:string){
 try {await database.initialize();}
 catch(error){const details=error as {code?:string;number?:number;driverError?:{number?:number}};throw new TransferError(`${label} connection failed (code ${details.code||'unknown'}, SQL ${details.number??details.driverError?.number??'unknown'}). Check host access, credentials and verified TLS; secret values were not logged.`);}
}
function checkSource(source:Snapshot,expected:string[]){
 if(JSON.stringify(source.tables.map(table=>table.name).sort())!==JSON.stringify(expected))throw new TransferError('Source schema does not match the migration files. Inventory and resolve it before transfer.');
 const roles=source.tables.find(table=>table.name==='Roles')!;
 if(ROLES.some(role=>!roles.rows.some(row=>row.Name===role)))throw new TransferError('Source is missing an application role; resolve source roles before transfer');
 const users=source.tables.find(table=>table.name==='Users')!;
 const assignments=source.tables.find(table=>table.name==='UserRoles')!;
 for(const name of ['SuperAdmin','Customer']){
  const role=roles.rows.find(row=>row.Name===name)!;
  if(!assignments.rows.some(row=>row.RoleId?.toLowerCase()===role.Id?.toLowerCase()&&users.rows.some(user=>user.Id?.toLowerCase()===row.UserId?.toLowerCase())))throw new TransferError(`Source has no existing ${name} identity to preserve`);
 }
}
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(!['export','transfer','verify'].includes(command||''))throw new TransferError('Use export, transfer [--snapshot path] [--rehearsal], or verify --snapshot path [--rehearsal]');
 for(let index=0;index<args.length;index++){
  if(args[index]==='--snapshot'){index++;continue;}
  if(args[index]!=='--rehearsal')throw new TransferError(`Unknown option: ${args[index]}. No database changes were made.`);
 }
 if(args.filter(arg=>arg==='--snapshot').length>1)throw new TransferError('Provide --snapshot only once');
 const snapshotIndex=args.indexOf('--snapshot');const input=snapshotIndex>=0?args[snapshotIndex+1]:undefined;
 if(snapshotIndex>=0&&(!input||input.startsWith('--')))throw new TransferError('--snapshot needs a file path');
 const rehearsal=args.includes('--rehearsal');
 if(command==='verify'&&!input)throw new TransferError('Verification requires --snapshot with the exported source file');
 const runDirectory=resolve('.runtime/database-transfer',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
 await mkdir(runDirectory,{recursive:true});
 let source:Snapshot;const sourceFile=input?resolve(input):resolve(runDirectory,'source.json');
 if(input){source=await readSnapshot(sourceFile);}
 else {
  const database=createDataSource();
  try {await connect(database,'Source');if(await database.showMigrations())throw new TransferError('Apply the source migrations explicitly before exporting');source=await snapshotDatabase(database);await writeSnapshot(sourceFile,source);}
  finally {if(database.isInitialized)await database.destroy();}
 }
 checkSource(source,await expectedTables());
 const summary=snapshotSummary(source);
 await writeFile(resolve(runDirectory,'source-inventory.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({sourceSnapshot:sourceFile,sourceDatabase:source.source.database,tables:source.tables.length,rows:summary.totalRows}));
 if(command==='export')return;
 const targetEnv=targetEnvironment(rehearsal);const destination=createDataSource(targetEnv.DB_DATABASE,targetEnv);
 try {
  await connect(destination,'Destination');
  const before=await snapshotDatabase(destination);
  if(before.source.server.toLowerCase()===source.source.server.toLowerCase()&&before.source.database.toLowerCase()===source.source.database.toLowerCase())throw new TransferError('Source and destination are the same database');
  if(command==='verify'){
   const result=await verifySnapshot(source,destination);
   await writeFile(resolve(runDirectory,'verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),source:source.source,destination:before.source,sourceFile,tables:result},null,2)+'\n',{mode:0o600});
   console.log(JSON.stringify({verifiedTables:result.length,matchedRows:result.reduce((count,table)=>count+table.matched,0),reportDirectory:runDirectory}));return;
  }
  await writeSnapshot(resolve(runDirectory,'destination-before.json'),before);
  if(before.tables.length&&before.migrations.length===0)throw new TransferError('Destination has existing tables without recognized TypeORM migration history. Its backup was saved; no schema or data was overwritten.');
  await destination.runMigrations({transaction:'all'});
  const result=await importSnapshot(source,destination);
  const verified=await verifySnapshot(source,destination);
  const after=await snapshotDatabase(destination);await writeSnapshot(resolve(runDirectory,'destination-after.json'),after);
  await writeFile(resolve(runDirectory,'reconciliation.json'),JSON.stringify({completedAt:new Date().toISOString(),source:source.source,destination:after.source,sourceFile,tables:result,verifiedTables:verified.length,roles:ROLES,identities:'Existing users, IDs, password hashes and role assignments preserved; no demo seed or password reset executed.'},null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({destination:after.source,tables:result.length,inserted:result.reduce((count,table)=>count+table.inserted,0),unchanged:result.reduce((count,table)=>count+table.unchanged,0),reportDirectory:runDirectory}));
 } finally {if(destination.isInitialized)await destination.destroy();}
}
main().catch((error:unknown)=>{
 if(error instanceof TransferError)console.error(error.message);
 else {const details=error as {name?:string;code?:string;number?:number;driverError?:{number?:number}};console.error(JSON.stringify({event:'database_transfer_failed',type:details?.name,code:details?.code,sqlNumber:details?.number??details?.driverError?.number}));}
 process.exitCode=1;
});
