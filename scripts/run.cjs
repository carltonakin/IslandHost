const path = require('node:path');
const { existsSync } = require('node:fs');
const { concurrently } = require('concurrently');
const { config } = require('dotenv');

const root = path.resolve(__dirname, '..');
config({ path: path.join(root, '.env'), quiet: true });
// Use this Node runtime for both child processes, including portable Windows installs.
process.env.PATH = path.dirname(process.execPath) + path.delimiter + (process.env.PATH || '');
const [mode, service] = process.argv.slice(2);
if (!['dev', 'start'].includes(mode) || (service && !['api', 'web'].includes(service))) {
  console.error('Usage: node scripts/run.cjs <dev|start> [api|web]');
  process.exit(1);
}
const includeApi = service !== 'web';
const includeWeb = service !== 'api';
const apiEntry = path.join(root, 'dist/server/main.js');
const webEntry = path.join(root, '.next/standalone/server.js');
if (mode === 'start' && ((includeApi && !existsSync(apiEntry)) || (includeWeb && !existsSync(webEntry)))) {
  console.error('Build output is missing. Run npm run build, then npm start. For development, use npm run dev.');
  process.exit(1);
}

// PORT belongs to the public web server when both services share a host.
// An API-only deployment can still use its platform-provided PORT or named pipe.
const apiPort = (service === 'api' && process.env.PORT) || process.env.API_PORT || '4000';
let webPort;
if (includeWeb) {
  if (!process.env.APP_URL) {
    console.error('APP_URL must be configured in .env or the environment.');
    process.exit(1);
  }
  webPort = process.env.PORT || process.env.WEB_PORT || new URL(process.env.APP_URL).port || '3000';
  if (!service && apiPort === webPort) {
    console.error('The web server and API need different ports. Set API_PORT to an unused port and update API_URL.');
    process.exit(1);
  }
}
const webHost = process.env.WEB_BIND_HOST || '0.0.0.0';
if (includeWeb && !/^[a-zA-Z0-9_.:-]+$/.test(webHost)) {
  console.error('WEB_BIND_HOST must be a hostname or IP address.');
  process.exit(1);
}
const commands = [];
if (includeApi) {
  commands.push({
    name: 'API', prefixColor: 'cyan',
    command: mode === 'dev'
      ? 'node -r ts-node/register/transpile-only src/server/main.ts'
      : 'node dist/server/main.js',
    env: {
      PORT: apiPort,
      NODE_ENV: process.env.NODE_ENV || (mode === 'dev' ? 'development' : 'production'),
      TS_NODE_PROJECT: path.join(root, 'tsconfig.server.json'),
    },
  });
}
if (includeWeb) {
  commands.push({
    name: 'WEB', prefixColor: 'green',
    command: mode === 'dev'
      ? 'node node_modules/next/dist/bin/next dev --hostname ' + webHost
      : 'node .next/standalone/server.js',
    env: {
      PORT: webPort,
      HOSTNAME: webHost,
      NODE_ENV: mode === 'dev' ? 'development' : 'production',
    },
  });
  console.log(`IslandHost web: ${process.env.APP_URL}`);
}
const { result } = concurrently(commands, {
  cwd: root, prefix: 'name', killOthersOn: ['failure', 'success'], killTimeout: 5000,
});
result.catch(() => { process.exitCode = 1; });
