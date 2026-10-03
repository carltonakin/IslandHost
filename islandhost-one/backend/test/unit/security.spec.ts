import { hashPassword,verifyPassword } from '../../src/auth/password';
import { canTransition,PERMISSIONS } from '../../src/common/types';
describe('Credential and workflow invariants',()=>{
 it('salts every password and rejects the wrong password',async()=>{
  const first=await hashPassword('A long test password 87!');
  const second=await hashPassword('A long test password 87!');
  expect(first).not.toBe(second);
  expect(await verifyPassword('A long test password 87!',first)).toBe(true);
  expect(await verifyPassword('Someone else’s password',first)).toBe(false);
 });
 it('prevents skipping from a new request directly to a completed or refunded experience',()=>{
  expect(canTransition('Requested','Completed')).toBe(false);
  expect(canTransition('Requested','Refunded')).toBe(false);
  expect(canTransition('Confirmed','In Progress')).toBe(true);
  expect(canTransition('Completed','Refunded')).toBe(true);
  expect(canTransition('Refunded','Confirmed')).toBe(false);
 });
 it('keeps financial, vendor, driver and customer roles out of administrative writes',()=>{
  for(const name of ['Finance','Vendor','Driver','Customer']){
   expect(PERMISSIONS[name]).not.toContain('requests.write');
   expect(PERMISSIONS[name]).not.toContain('users.manage');
   expect(PERMISSIONS[name]).not.toContain('*');
  }
 });
});

