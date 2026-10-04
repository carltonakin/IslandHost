import { DataSource,QueryRunner } from 'typeorm';
import { createHash } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';

export class TransferError extends Error {}
export type SqlRow=Record<string,string|null>;
export type Column={name:string;type:string;length:number;precision:number;scale:number;nullable:boolean;identity:boolean;computed:boolean;collation:string|null;defaultValue:string|null;expression:string|null};
type ForeignKey={columns:string[];table:string;referencedColumns:string[];onDelete:string;onUpdate:string;disabled:boolean;untrusted:boolean};
type Index={columns:{name:string;descending:boolean;included:boolean}[];unique:boolean;primary:boolean;filter:string|null;disabled:boolean};
export type TableSnapshot={name:string;columns:Column[];primaryKey:string[];foreignKeys:ForeignKey[];indexes:Index[];checks:{expression:string;disabled:boolean;untrusted:boolean}[];identityValue:string|null;rows:SqlRow[]};
export type Snapshot={format:'islandhost-sql-v1';capturedAt:string;source:{server:string;database:string};migrations:SqlRow[];tables:TableSnapshot[]};
export type TableResult={table:string;source:number;before:number;inserted:number;unchanged:number;after:number};
type Recordset=Record<string,unknown>;
const id=(name:string)=>{if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw new TransferError('Unsupported SQL identifier');return `[${name}]`;};
const tableSql=(name:string)=>`[dbo].${id(name)}`;
const canonical=(value:unknown):string=>JSON.stringify(value);
const sorted=<T>(values:T[])=>[...values].sort((a,b)=>canonical(a).localeCompare(canonical(b)));
const text=(value:unknown)=>value==null?null:String(value);
const types=new Set(['uniqueidentifier','nvarchar','varchar','nchar','char','text','ntext','bit','int','bigint','smallint','tinyint','decimal','numeric','money','smallmoney','float','real','date','datetime','datetime2','smalldatetime','datetimeoffset','time','binary','varbinary','image']);
const binary=new Set(['binary','varbinary','image']);

export async function expectedTables(){
 const files=['001_initial.sql','002_phase2.sql'];const names:string[]=[];
 for(const file of files){const sql=await readFile(resolve(__dirname,'../../../database/migrations',file),'utf8');for(const match of sql.matchAll(/CREATE TABLE dbo\.([A-Za-z0-9_]+)/g))names.push(match[1]);}
 return names.sort();
}
function projection(column:Column){
 if(!types.has(column.type))throw new TransferError(`Unsupported column type ${column.type} in ${column.name}; no data discarded`);
 const style=binary.has(column.type)?2:['float','real'].includes(column.type)?3:['money','smallmoney'].includes(column.type)?2:126;
 return `CONVERT(nvarchar(max),${id(column.name)},${style}) AS ${id(column.name)}`;
}
async function rows(runner:QueryRunner,table:Pick<TableSnapshot,'name'|'columns'|'primaryKey'>){
 return runner.query(`SELECT ${table.columns.map(projection).join(',')} FROM ${tableSql(table.name)}${table.primaryKey.length?' ORDER BY '+table.primaryKey.map(id).join(','):''}`) as Promise<SqlRow[]>;
}
export function rowKey(table:TableSnapshot,row:SqlRow){
 return canonical(table.primaryKey.map(key=>row[key]?.toLowerCase()));
}
function rowValue(table:TableSnapshot,row:SqlRow){
 return canonical(table.columns.map(column=>column.type==='uniqueidentifier'?row[column.name]?.toLowerCase()??null:row[column.name]));
}
export function orderTables(tables:TableSnapshot[]){
 const remaining=new Map(tables.map(table=>[table.name,table]));const ordered:TableSnapshot[]=[];
 while(remaining.size){
  const ready=[...remaining.values()].filter(table=>table.foreignKeys.every(key=>!remaining.has(key.table))).sort((a,b)=>a.name.localeCompare(b.name));
  if(!ready.length)throw new TransferError('Cyclic or self-referencing foreign keys require an explicit transfer plan; constraints were not disabled');
  for(const table of ready){ordered.push(table);remaining.delete(table.name);}
 }
 return ordered;
}
async function capture(runner:QueryRunner):Promise<Snapshot>{
 const [source]=await runner.query('SELECT CONVERT(nvarchar(256),SERVERPROPERTY(\'ServerName\')) AS server,DB_NAME() AS [database]') as Snapshot['source'][];
 const names=await runner.query("SELECT t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name='dbo' AND t.is_ms_shipped=0 ORDER BY t.name") as {name:string}[];
 const tables:TableSnapshot[]=[];
 for(const {name} of names.filter(table=>table.name!=='SchemaMigrations')){
  const columnsRaw=await runner.query(`SELECT c.name,ty.name AS type,c.max_length AS length,c.precision,c.scale,c.is_nullable AS nullable,c.is_identity AS [identity],c.is_computed AS computed,c.collation_name AS collation,dc.definition AS defaultValue,cc.definition AS expression FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id LEFT JOIN sys.computed_columns cc ON cc.object_id=c.object_id AND cc.column_id=c.column_id WHERE c.object_id=OBJECT_ID(@0) ORDER BY c.column_id`,[`dbo.${name}`]) as Column[];
  const columns=columnsRaw.map(column=>({...column,nullable:Boolean(column.nullable),identity:Boolean(column.identity),computed:Boolean(column.computed)}));
  const indexesRaw=await runner.query(`SELECT i.name,c.name AS [column],ic.key_ordinal,ic.index_column_id,ic.is_descending_key,ic.is_included_column,i.is_unique,i.is_primary_key,i.filter_definition,i.is_disabled FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE i.object_id=OBJECT_ID(@0) AND i.index_id>0 AND i.is_hypothetical=0 ORDER BY i.name,ic.index_column_id`,[`dbo.${name}`]) as Recordset[];
  const indexGroups=new Map<string,Recordset[]>();for(const index of indexesRaw){const key=String(index.name);indexGroups.set(key,[...(indexGroups.get(key)||[]),index]);}
  const indexes=[...indexGroups.values()].map(group=>({columns:group.map(index=>({name:String(index.column),descending:Boolean(index.is_descending_key),included:Boolean(index.is_included_column)})),unique:Boolean(group[0].is_unique),primary:Boolean(group[0].is_primary_key),filter:text(group[0].filter_definition),disabled:Boolean(group[0].is_disabled)}));
  const primaryKey=indexesRaw.filter(index=>index.is_primary_key).sort((a,b)=>Number(a.key_ordinal)-Number(b.key_ordinal)).map(index=>String(index.column));
  const fkRaw=await runner.query(`SELECT fk.name,pc.name AS [column],rt.name AS [table],rs.name AS [schema],rc.name AS referencedColumn,fk.delete_referential_action_desc AS onDelete,fk.update_referential_action_desc AS onUpdate,fk.is_disabled AS disabled,fk.is_not_trusted AS untrusted FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id=fk.object_id JOIN sys.columns pc ON pc.object_id=fkc.parent_object_id AND pc.column_id=fkc.parent_column_id JOIN sys.tables rt ON rt.object_id=fkc.referenced_object_id JOIN sys.schemas rs ON rs.schema_id=rt.schema_id JOIN sys.columns rc ON rc.object_id=fkc.referenced_object_id AND rc.column_id=fkc.referenced_column_id WHERE fk.parent_object_id=OBJECT_ID(@0) ORDER BY fk.name,fkc.constraint_column_id`,[`dbo.${name}`]) as Recordset[];
  const fkGroups=new Map<string,Recordset[]>();for(const key of fkRaw){if(key.schema!=='dbo')throw new TransferError('Cross-schema foreign keys require an explicit transfer plan');const name=String(key.name);fkGroups.set(name,[...(fkGroups.get(name)||[]),key]);}
  const foreignKeys=[...fkGroups.values()].map(group=>({columns:group.map(key=>String(key.column)),table:String(group[0].table),referencedColumns:group.map(key=>String(key.referencedColumn)),onDelete:String(group[0].onDelete),onUpdate:String(group[0].onUpdate),disabled:Boolean(group[0].disabled),untrusted:Boolean(group[0].untrusted)}));
  const checksRaw=await runner.query('SELECT definition AS expression,is_disabled AS disabled,is_not_trusted AS untrusted FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(@0)',[`dbo.${name}`]) as TableSnapshot['checks'];
  const checks=checksRaw.map(check=>({...check,disabled:Boolean(check.disabled),untrusted:Boolean(check.untrusted)}));
  const identity=await runner.query('SELECT CONVERT(nvarchar(100),last_value) AS value FROM sys.identity_columns WHERE object_id=OBJECT_ID(@0)',[`dbo.${name}`]) as {value:string|null}[];
  const table:TableSnapshot={name,columns,primaryKey,foreignKeys,indexes,checks,identityValue:identity[0]?.value??null,rows:[]};
  table.rows=await rows(runner,table);tables.push(table);
 }
 const migrations=names.some(table=>table.name==='SchemaMigrations')?await runner.query('SELECT CONVERT(nvarchar(100),[timestamp]) AS [timestamp],name FROM dbo.SchemaMigrations ORDER BY [timestamp]') as SqlRow[]:[];
 return {format:'islandhost-sql-v1',capturedAt:new Date().toISOString(),source,migrations,tables};
}
export async function snapshotDatabase(database:DataSource){
 const runner=database.createQueryRunner();await runner.connect();
 try {await runner.startTransaction('SERIALIZABLE');const result=await capture(runner);await runner.commitTransaction();return result;}
 catch(error){if(runner.isTransactionActive)await runner.rollbackTransaction().catch(()=>undefined);throw error;}
 finally {await runner.release();}
}
export async function writeSnapshot(file:string,snapshot:Snapshot){
 await mkdir(dirname(file),{recursive:true});const serialized=JSON.stringify(snapshot);
 await writeFile(file,serialized,{encoding:'utf8',flag:'wx',mode:0o600});
 const sha256=createHash('sha256').update(serialized).digest('hex');
 await writeFile(file+'.sha256',sha256+'\n',{encoding:'utf8',flag:'wx',mode:0o600});return sha256;
}
export async function readSnapshot(file:string){
 const serialized=await readFile(file,'utf8');const hash=(await readFile(file+'.sha256','utf8')).trim();
 if(createHash('sha256').update(serialized).digest('hex')!==hash)throw new TransferError('Snapshot checksum failed');
 const snapshot=JSON.parse(serialized) as Snapshot;
 if(snapshot.format!=='islandhost-sql-v1'||!Array.isArray(snapshot.tables))throw new TransferError('Unsupported snapshot format');
 return snapshot;
}
function schema(table:TableSnapshot){
 return {columns:table.columns,primaryKey:table.primaryKey,foreignKeys:sorted(table.foreignKeys),indexes:sorted(table.indexes),checks:sorted(table.checks)};
}
export function assertCompatible(source:Snapshot,target:Snapshot){
 for(const table of source.tables){
  if(!table.primaryKey.length)throw new TransferError(`Missing primary key in ${table.name}`);
  const destination=target.tables.find(candidate=>candidate.name===table.name);
  if(!destination||canonical(schema(table))!==canonical(schema(destination)))throw new TransferError(`Schema mismatch in ${table.name}; no records were imported`);
  if(table.foreignKeys.some(key=>key.disabled||key.untrusted)||table.checks.some(check=>check.disabled||check.untrusted)||table.indexes.some(index=>index.disabled))throw new TransferError(`Disabled or untrusted constraints/indexes in ${table.name}`);
 }
 for(const migration of source.migrations)if(!target.migrations.some(other=>other.name===migration.name&&other.timestamp===migration.timestamp))throw new TransferError('Destination is missing source migration history');
}
async function integrity(runner:QueryRunner){
 const violations=(await runner.query('DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS, ALL_ERRORMSGS, NO_INFOMSGS') as unknown[]|undefined)||[];
 if(violations.length)throw new TransferError(`Constraint validation failed (${violations.length} reported violations); inspect private database records`);
}
export async function importSnapshot(source:Snapshot,database:DataSource){
 const expected=await expectedTables();
 if(canonical(source.tables.map(table=>table.name).sort())!==canonical(expected))throw new TransferError('Snapshot tables do not match the application migrations; no data discarded');
 const runner=database.createQueryRunner();await runner.connect();let currentTable='schema';let currentRow=0;
 try {
  await runner.startTransaction('SERIALIZABLE');
  const before=await capture(runner);
  if(source.source.server.toLowerCase()===before.source.server.toLowerCase()&&source.source.database.toLowerCase()===before.source.database.toLowerCase())throw new TransferError('Source and destination are the same database');
  assertCompatible(source,before);await integrity(runner);
  const results:TableResult[]=[];
  for(const table of orderTables(source.tables)){
   currentTable=table.name;currentRow=0;
   const destination=before.tables.find(candidate=>candidate.name===table.name)!;
   const existing=new Map(destination.rows.map(row=>[rowKey(table,row),row]));
   const insertable=table.columns.filter(column=>!column.computed);
   const hasIdentity=insertable.some(column=>column.identity);
   let inserted=0;let unchanged=0;

    for(const row of table.rows){
     currentRow++;
     const found=existing.get(rowKey(table,row));
     if(found){if(rowValue(table,found)!==rowValue(table,row))throw new TransferError(`Conflicting existing record in ${table.name} at source row ${currentRow}; destination was not overwritten`);unchanged++;continue;}
     const values=insertable.map(column=>row[column.name]);
     const expressions=insertable.map((column,index)=>binary.has(column.type)?`CONVERT(varbinary(max),@${index},2)`:`@${index}`);
     const insert=`INSERT INTO ${tableSql(table.name)} (${insertable.map(column=>id(column.name)).join(',')}) VALUES (${expressions.join(',')});`;
     // The TCP driver executes a query through sp_executesql. Keep IDENTITY_INSERT
     // in the same SQL scope as its INSERT; a separate request loses the setting.
     const statement=hasIdentity?`SET IDENTITY_INSERT ${tableSql(table.name)} ON; ${insert} SET IDENTITY_INSERT ${tableSql(table.name)} OFF;`:insert;
     await runner.query(statement,values);
     existing.set(rowKey(table,row),row);inserted++;
    }

   if(hasIdentity&&table.identityValue!==null){
    if(!/^-?\d+$/.test(table.identityValue))throw new TransferError('Invalid identity counter in snapshot');
    const current=await runner.query('SELECT CONVERT(nvarchar(100),last_value) AS value FROM sys.identity_columns WHERE object_id=OBJECT_ID(@0)',[`dbo.${table.name}`]) as {value:string|null}[];
    if(current[0]?.value==null||BigInt(current[0].value)<BigInt(table.identityValue))await runner.query(`DBCC CHECKIDENT ('dbo.${table.name}',RESEED,${table.identityValue}) WITH NO_INFOMSGS`);
   }
   const actual=await rows(runner,table);const byKey=new Map(actual.map(row=>[rowKey(table,row),row]));
   if(actual.length!==destination.rows.length+inserted)throw new TransferError(`Row count mismatch in ${table.name}`);
   for(const row of table.rows){const found=byKey.get(rowKey(table,row));if(!found||rowValue(table,found)!==rowValue(table,row))throw new TransferError(`Record reconciliation failed in ${table.name}`);}
   results.push({table:table.name,source:table.rows.length,before:destination.rows.length,inserted,unchanged,after:actual.length});
  }
  await integrity(runner);await runner.commitTransaction();return results;
 } catch(error){
  if(runner.isTransactionActive)await runner.rollbackTransaction().catch(()=>undefined);
  if(error instanceof TransferError)throw error;
  const sql=error as {number?:number;driverError?:{number?:number}};
  throw new TransferError(`Import failed in ${currentTable} at source row ${currentRow} (SQL ${sql.number??sql.driverError?.number??'unknown'}). All record changes rolled back; inspect the private snapshots for conflicts.`);
 } finally {await runner.release();}
}
export async function verifySnapshot(source:Snapshot,database:DataSource){
 const target=await snapshotDatabase(database);assertCompatible(source,target);
 const report=source.tables.map(table=>{
  const actual=target.tables.find(candidate=>candidate.name===table.name)!;
  const byKey=new Map(actual.rows.map(row=>[rowKey(table,row),row]));
  for(const row of table.rows){const found=byKey.get(rowKey(table,row));if(!found||rowValue(table,found)!==rowValue(table,row))throw new TransferError(`Record reconciliation failed in ${table.name}`);}
  return {table:table.name,source:table.rows.length,destination:actual.rows.length,matched:table.rows.length};
 });
 const runner=database.createQueryRunner();try{await runner.connect();await integrity(runner);}finally{await runner.release();}
 return report;
}
export function snapshotSummary(snapshot:Snapshot){
 return {capturedAt:snapshot.capturedAt,source:snapshot.source,migrations:snapshot.migrations,tables:snapshot.tables.map(table=>({table:table.name,rows:table.rows.length,columns:table.columns.length,foreignKeys:table.foreignKeys.length,indexes:table.indexes.length,checks:table.checks.length})),totalRows:snapshot.tables.reduce((total,table)=>total+table.rows.length,0)};
}
