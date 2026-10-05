import { expect,APIRequestContext,Page } from '@playwright/test';
// Real login throttling remains enabled. A larger suite must honor the server's retry window.
function retryDelay(headers:Record<string,string>){
 const seconds=Number(headers['retry-after']);
 if(!Number.isFinite(seconds)||seconds<0||seconds>60)throw new Error('Unexpected sign-in retry window');
 return (seconds+1)*1000;
}
export async function submitSignIn(page:Page){
 for(let attempt=0;attempt<2;attempt++){
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Step into your island'}).click();const response=await pending;
  if(response.status()===429&&attempt===0){await page.waitForTimeout(retryDelay(response.headers()));continue;}
  expect(response.status(),'Sign-in API response').toBe(200);return;
 }
}
export async function login(page:Page,staff=false){
 await page.goto('/login');
 await page.getByLabel('Email address',{exact:true}).fill((staff?process.env.SEED_ADMIN_EMAIL:process.env.SEED_CUSTOMER_EMAIL)!);
 await page.getByLabel('Password',{exact:true}).fill(process.env.SEED_PASSWORD!);
 await submitSignIn(page);
 await expect(page.getByRole('heading',{level:1})).toHaveText(staff?'A beautiful day to make it effortless.':/Welcome back/,{timeout:30000});
}
export async function loginRequest(client:APIRequestContext){
 for(let attempt=0;attempt<2;attempt++){
  const response=await client.post('/api/auth/login',{data:{email:process.env.SEED_ADMIN_EMAIL,password:process.env.SEED_PASSWORD}});
  if(response.status()===429&&attempt===0){await new Promise(resolve=>setTimeout(resolve,retryDelay(response.headers())));continue;}
  expect(response.status(),'Fixture sign-in API response').toBe(200);return;
 }
}