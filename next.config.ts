import type { NextConfig } from 'next';
import { config } from 'dotenv';
import path from 'node:path';
config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
const api = process.env.API_URL;
if (!api) throw new Error('API_URL must be configured in the root .env or environment.');
const nextConfig: NextConfig = {
  output: 'standalone', poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  images: { remotePatterns: (process.env.SERVICE_IMAGE_HOSTS || '').split(',').filter(Boolean).map(hostname => ({ protocol: 'https' as const, hostname })) },
  async rewrites() { return [{ source: '/api/:path*', destination: `${api}/api/:path*` }]; },
  async headers() { return [{ source: '/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'X-Frame-Options', value: 'DENY' }] }]; },
};
export default nextConfig;
