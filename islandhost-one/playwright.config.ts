import { defineConfig,devices } from '@playwright/test';
import { config } from 'dotenv';
config({path:'.env',quiet:true});
export default defineConfig({
 testDir:'./tests/browser',globalSetup:'./tests/browser/setup.ts',timeout:120000,expect:{timeout:15000},workers:1,fullyParallel:false,
 outputDir:'.runtime/browser-results',reporter:[['list'],['html',{outputFolder:'.runtime/browser-report',open:'never'}]],
 use:{baseURL:process.env.APP_URL,trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'mobile',testIgnore:'**/workflow.spec.ts',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}]
});
