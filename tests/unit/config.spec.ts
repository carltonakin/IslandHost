import { validateConfig } from '../../src/server/config';

describe('SQL driver configuration for hosting',()=>{
 const original=process.env;
 beforeEach(()=>{
  process.env={
   ...original,
   NODE_ENV:'production',APP_URL:'https://islandhost.example',API_URL:'http://127.0.0.1:4000',
   DB_HOST:'sql.example',DB_DATABASE:'IslandHost',DB_USERNAME:'test-user',DB_PASSWORD:'test-password',
   JWT_SECRET:'a'.repeat(48),JWT_REFRESH_SECRET:'b'.repeat(48),
   COOKIE_SECURE:'true',DB_ENCRYPT:'true',DB_TRUST_CERTIFICATE:'false',
   MAIL_MODE:'smtp',SMTP_HOST:'smtp.example',SMTP_FROM:'test@islandhost.example',
  };
  delete process.env.DB_DRIVER;
 });
 afterEach(()=>{process.env=original;});
 it('accepts production settings with the default TCP driver',()=>{
  expect(()=>validateConfig()).not.toThrow();
 });
 it('rejects the local native driver before trying to connect',()=>{
  process.env.DB_DRIVER='native';
  expect(()=>validateConfig()).toThrow('Production requires the TCP SQL Server driver. Remove DB_DRIVER=native.');
 });
 it('continues to allow the native driver in development',()=>{
  process.env.NODE_ENV='development';process.env.DB_DRIVER='native';
  expect(()=>validateConfig()).not.toThrow();
 });
});
