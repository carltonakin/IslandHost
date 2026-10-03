import { expect,request,FullConfig } from '@playwright/test';
import { config } from 'dotenv';
config({path:'.env',quiet:true});
export default async function setup(configuration:FullConfig){
 if(!['development','test'].includes(process.env.NODE_ENV||''))throw new Error('Browser acceptance requires development/test mode and seeded development accounts.');
 const client=await request.newContext({baseURL:configuration.projects[0].use.baseURL});
 try{
  await expect(async()=>{
   expect((await client.get('/login',{timeout:5000})).status()).toBe(200);
   const health=await client.get('/api/health',{timeout:5000});
   expect(health.status()).toBe(200);
   expect((await health.json()).data.status).toBe('ok');
  }).toPass({timeout:30000,intervals:[250,500,1000]});
 }finally{await client.dispose();}
}
