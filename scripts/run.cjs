const path = require('node:path');
const { existsSync } = require('node:fs');
const { concurrently } = require('concurrently');
const { config } = require('dotenv');

const root = path.resolve(__dirname, '..');
config({ path: path.join(root, '.env'), quiet: true });
// Use this Node runtime for both child processes, including portable Windows installs.
process.env.PATH = path.dirname(process.execPath) + path.delimiter + (process.env.PATH || '');
function startupError(message) {
  console.error('IslandHost startup error: ' + message);
  process.exit(1);
}
function tcpPort(value, label) {
  const port = String(value ?? '').trim();
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    startupError(label + ' must be a number from 1 to 65535. Check the hosted web.config port assignment.');
  }
  return String(Number(port));
}
const [mode, target, assignedPort, ...extra] = process.argv.slice(2);
const iisLaunch = target === '--iis-port';
const service = iisLaunch ? undefined : target;
if (!['dev', 'start'].includes(mode) || (service && !['api', 'web'].includes(service)) ||
    extra.length || (!iisLaunch && assignedPort !== undefined) || (iisLaunch && mode !== 'start')) {
  startupError('Usage: node scripts/run.cjs <dev|start> [api|web], or start --iis-port <assigned-port>');
}
// HttpPlatformHandler expands this argument before launching Node. Never allow
// an absent or unexpanded IIS assignment to become Next's silent 3000 fallback.
const iisPort = iisLaunch ? tcpPort(assignedPort, 'IIS assigned port') : undefined;
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
let apiPort = (service === 'api' && process.env.PORT) || process.env.API_PORT || '4000';
let webPort;
let webPortSource;
if (includeWeb) {
  if (!process.env.APP_URL) {
    console.error('APP_URL must be configured in .env or the environment.');
    process.exit(1);
  }
  if (iisLaunch) {
    webPort = iisPort;
    webPortSource = 'IIS';
  } else if (process.env.PORT) {
    webPort = process.env.PORT;
    webPortSource = 'PORT';
  } else if (process.env.WEB_PORT) {
    webPort = process.env.WEB_PORT;
    webPortSource = 'WEB_PORT';
  } else {
    const appPort = new URL(process.env.APP_URL).port;
    webPort = appPort || '3000';
    webPortSource = appPort ? 'APP_URL' : 'default';
  }
  webPort = tcpPort(webPort, 'Public web port');
  if (includeApi) apiPort = tcpPort(apiPort, 'API_PORT');
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
  console.log(`IslandHost ports: web=${webPort} source=${webPortSource} api=${includeApi ? apiPort : 'disabled'}`);
}
const { result } = concurrently(commands, {
  cwd: root, prefix: 'name', killOthersOn: ['failure', 'success'], killTimeout: 5000,
});
result.catch(() => { process.exitCode = 1; });
