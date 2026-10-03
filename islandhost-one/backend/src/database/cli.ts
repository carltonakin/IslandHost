import { Db } from './db';
import { seed,ensureRoles,createAdmin } from './seed';
async function main(){
 const db=new Db();await db.onModuleInit();
 try{
  const command=process.argv[2];
  if(command==='migrate'){await db.source.runMigrations({transaction:'all'});await ensureRoles(db);console.log('Database migrations are current.');}
  else if(command==='seed'){await seed(db);console.log('Development seed is ready. Credentials come from your .env.');}
  else if(command==='admin'){await createAdmin(db);console.log('Administrator created.');}
  else throw new Error('Use migrate, seed or admin');
 }finally{await db.onModuleDestroy();}
}
main().catch((error:Error)=>{console.error(error.message.replace(/password[^\s]*/gi,'[redacted]'));process.exitCode=1;});

