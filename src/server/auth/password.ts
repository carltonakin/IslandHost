import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
function derive(password: string, salt: string): Promise<Buffer> {
 return new Promise((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
}
export async function hashPassword(password: string) { const salt = randomBytes(32).toString('hex'); return 'scrypt$'+salt+'$'+(await derive(password,salt)).toString('hex'); }
export async function verifyPassword(password: string, encoded: string) {
 const [kind,salt,hash] = encoded.split('$'); if (kind !== 'scrypt' || !salt || !hash) return false;
 const actual = await derive(password,salt); const expected=Buffer.from(hash,'hex'); return actual.length===expected.length && timingSafeEqual(actual,expected);
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

