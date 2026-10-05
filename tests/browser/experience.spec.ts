import { test,expect } from '@playwright/test';
import { config } from 'dotenv';
import { login } from './login';
config({path:'.env',quiet:true});
test('customer overview, catalog, preferences and itinerary use the live API',async({page},info)=>{
 const pageErrors:string[]=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await login(page);
 await expect(page.getByText('Your Nassau experience',{exact:true})).toBeVisible();
 await page.screenshot({path:'.runtime/customer-'+info.project.name+'.png',fullPage:true});
 await page.getByRole('link',{name:'Find your next experience'}).click();
 await expect(page.getByRole('heading',{name:'Made for your kind of island time.'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
 await page.getByRole('link',{name:'View A day on the turquoise',exact:true}).click();
 await expect(page.getByRole('heading',{name:'A day on the turquoise',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Request this experience'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('combobox',{name:/^Trip/})).toBeVisible();
 await page.getByRole('button',{name:'Close dialog'}).click();
 await page.goto('/itinerary');
 await expect(page.getByRole('heading',{name:'Just follow your island time.'})).toBeVisible();
 await page.getByRole('combobox',{name:'Select itinerary trip'}).selectOption({label:'A little time in paradise · Morgan Ellis'});
 await expect(page.getByRole('heading',{name:'A day on the turquoise'})).toBeVisible();
 await page.goto('/preferences');
 await expect(page.getByRole('heading',{name:'The little things make it yours.'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Dietary requirements',exact:true})).toHaveValue('Pescatarian; no shellfish');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
 expect(pageErrors).toEqual([]);
});
test('team command center and request detail are usable',async({page},info)=>{
 await login(page,true);
 await expect(page.getByText("Today's arrivals",{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Open operations board'}).click();
 await expect(page.getByRole('heading',{name:'Every detail, in good hands.'})).toBeVisible();
 await expect(page.locator('.board-card').first()).toBeVisible();
 await page.screenshot({path:'.runtime/operations-'+info.project.name+'.png',fullPage:true});
 await page.locator('.board-card>a').first().click();
 await expect(page.getByRole('heading',{name:'Every detail, recorded'})).toBeVisible();
 await page.goto('/customers');
 await expect(page.getByRole('link',{name:/Morgan Ellis/})).toBeVisible();
 await page.goto('/users');
 await expect(page.getByRole('heading',{name:'The people behind the experience.'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
test('responsive navigation and account boundaries',async({page,isMobile})=>{
 await login(page);
 if(isMobile){
  await page.getByRole('button',{name:'Open navigation'}).click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Notifications',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Every detail, shared with you.'})).toBeVisible();
 }else{
  await page.getByRole('button',{name:'Collapse navigation'}).click();
  await expect(page.locator('.app-shell')).toHaveClass(/nav-collapsed/);
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveClass(/nav-collapsed/);
 }
 await page.goto('/users');
 await expect(page.getByRole('main').getByRole('alert')).toContainText('Your account does not have access');
});
