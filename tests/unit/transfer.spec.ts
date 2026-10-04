import { DataSource } from 'typeorm';
import { assertCompatible,orderTables,snapshotDatabase,Snapshot,TableSnapshot } from '../../src/server/database/transfer';
const table=(name:string,parents:string[]=[]):TableSnapshot=>({name,columns:[{name:'Id',type:'uniqueidentifier',length:16,precision:0,scale:0,nullable:false,identity:false,computed:false,collation:null,defaultValue:null,expression:null}],primaryKey:['Id'],foreignKeys:parents.map(parent=>({columns:['Id'],table:parent,referencedColumns:['Id'],onDelete:'NO_ACTION',onUpdate:'NO_ACTION',disabled:false,untrusted:false})),indexes:[],checks:[],identityValue:null,rows:[]});
const snapshot=(tables:TableSnapshot[]):Snapshot=>({format:'islandhost-sql-v1',capturedAt:'2026-10-03T00:00:00Z',source:{server:'test',database:'test'},migrations:[],tables});
describe('SQL transfer safeguards',()=>{
 it('preserves the original SQL failure when the server has already aborted the transaction',async()=>{
  const failure=Object.assign(new Error('SQL operation failed'),{number:544});
  const runner={connect:jest.fn(),startTransaction:jest.fn(),query:jest.fn().mockRejectedValue(failure),isTransactionActive:true,rollbackTransaction:jest.fn().mockRejectedValue(new Error('Transaction already aborted')),release:jest.fn()};
  const database={createQueryRunner:()=>runner} as unknown as DataSource;
  await expect(snapshotDatabase(database)).rejects.toBe(failure);
  expect(runner.release).toHaveBeenCalled();
 });
 it('orders parents before children regardless of input order',()=>{
  expect(orderTables([table('Child',['Parent']),table('Parent')]).map(item=>item.name)).toEqual(['Parent','Child']);
 });
 it('rejects cyclic dependencies without disabling foreign keys',()=>{
  expect(()=>orderTables([table('First',['Second']),table('Second',['First'])])).toThrow('Cyclic');
 });
 it('rejects destination column semantics that differ from the source',()=>{
  const source=snapshot([table('Users')]);const target=structuredClone(source);target.tables[0].columns[0].nullable=true;
  expect(()=>assertCompatible(source,target)).toThrow('Schema mismatch in Users');
 });
 it('rejects untrusted constraints even when both schema definitions agree',()=>{
  const source=snapshot([table('Users')]);source.tables[0].checks=[{expression:'([Active]=(1))',disabled:false,untrusted:true}];
  expect(()=>assertCompatible(source,structuredClone(source))).toThrow('Disabled or untrusted');
 });
});
