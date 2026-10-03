import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../.env'), quiet: true });
export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
export function validateConfig() {
  ['NODE_ENV','APP_URL','API_URL','DB_HOST','DB_DATABASE','DB_USERNAME','DB_PASSWORD','JWT_SECRET','JWT_REFRESH_SECRET'].forEach(required);
  for (const key of ['APP_URL','API_URL']) new URL(required(key));
  for (const key of ['JWT_SECRET','JWT_REFRESH_SECRET']) if (required(key).length < 48) throw new Error(`${key} must contain at least 48 characters`);
  if (required('JWT_SECRET') === required('JWT_REFRESH_SECRET')) throw new Error('JWT secrets must differ');
  if (process.env.NODE_ENV === 'production') {
    if (!required('APP_URL').startsWith('https:') || process.env.COOKIE_SECURE !== 'true') throw new Error('Production requires HTTPS and secure cookies');
    if (process.env.DB_ENCRYPT !== 'true' || process.env.DB_TRUST_CERTIFICATE === 'true') throw new Error('Production requires verified SQL Server TLS');
    if (process.env.MAIL_MODE !== 'smtp') throw new Error('Production password recovery requires SMTP');
    ['SMTP_HOST','SMTP_FROM'].forEach(required);
  }
}

