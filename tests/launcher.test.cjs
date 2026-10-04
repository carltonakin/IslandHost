const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const test = require('node:test');

const project = path.resolve(__dirname, '..');
const server = `const http = require('node:http');
http.createServer((req, res) => {
  if (req.url === '/stop') { res.end('stopped'); setTimeout(() => process.exit(0), 20); return; }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ port: process.env.PORT }));
}).listen(Number(process.env.PORT), '127.0.0.1');`;

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'islandhost-launcher-'));
  for (const folder of ['scripts', 'dist/server', '.next/standalone']) {
    fs.mkdirSync(path.join(directory, folder), { recursive: true });
  }
  fs.copyFileSync(path.join(project, 'scripts/run.cjs'), path.join(directory, 'scripts/run.cjs'));
  for (const file of ['dist/server/main.js', '.next/standalone/server.js']) {
    fs.writeFileSync(path.join(directory, file), server);
  }
  fs.writeFileSync(path.join(directory, '.env'), 'APP_URL=http://127.0.0.1:3000\nPORT=3000\n');
  t.after(() => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('islandhost-launcher-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const env = {
    ...process.env,
    APP_URL: 'http://127.0.0.1:3000',
    WEB_BIND_HOST: '127.0.0.1',
    NODE_PATH: [path.join(project, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
  };
  return { directory, env };
}

async function freePort() {
  const listener = http.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = String(listener.address().port);
  await new Promise(resolve => listener.close(resolve));
  return port;
}

async function waitForHttp(port, child, output) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) assert.fail('Launcher exited before readiness: ' + output());
    try {
      const response = await fetch('http://127.0.0.1:' + port, { signal: AbortSignal.timeout(500) });
      return await response.json();
    } catch { await delay(100); }
  }
  assert.fail('Listener did not become ready: ' + output());
}

async function liveLaunch(t, args, overrides, expected) {
  const { directory, env } = fixture(t);
  const child = spawn(process.execPath, ['scripts/run.cjs', ...args], {
    cwd: directory, env: { ...env, ...overrides }, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const closed = once(child, 'close');
  try {
    for (const port of expected.ports) assert.equal((await waitForHttp(port, child, () => output)).port, port);
    if (expected.message) assert.ok(output.includes(expected.message), output);
    await fetch('http://127.0.0.1:' + expected.ports[0] + '/stop');
    // Stopping one fixture deliberately terminates its sibling; Windows can
    // report that forced termination as a failure. Await cleanup, not success.
    await Promise.race([closed, delay(10000, undefined, { ref: false }).then(() => { throw Error('Launcher did not stop'); })]);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill('SIGTERM');
      await closed;
    }
  }
}

test('IIS assignment overrides an unresolved PORT and .env default; both real listeners respond', async t => {
  const web = await freePort();
  let api = await freePort();
  while (api === web) api = await freePort();
  await liveLaunch(t, ['start', '--iis-port', web], { PORT: '%HTTP_PLATFORM_PORT%', API_PORT: api }, {
    ports: [web, api], message: 'IslandHost ports: web=' + web + ' source=IIS api=' + api,
  });
});

test('ordinary start keeps inherited PORT ahead of .env and leaves the API on its own port', async t => {
  const web = await freePort();
  let api = await freePort();
  while (api === web) api = await freePort();
  await liveLaunch(t, ['start'], { PORT: web, API_PORT: api }, {
    ports: [web, api], message: 'IslandHost ports: web=' + web + ' source=PORT api=' + api,
  });
});

test('API-only start still accepts the inherited PORT', async t => {
  const api = await freePort();
  await liveLaunch(t, ['start', 'api'], { PORT: api, API_PORT: '4000' }, { ports: [api] });
});

for (const [label, args, overrides, message] of [
  ['missing IIS assignment', ['start', '--iis-port'], {}, 'IIS assigned port'],
  ['unexpanded IIS assignment', ['start', '--iis-port', '%HTTP_PLATFORM_PORT%'], {}, 'IIS assigned port'],
  ['zero IIS assignment', ['start', '--iis-port', '0'], {}, 'IIS assigned port'],
  ['out-of-range IIS assignment', ['start', '--iis-port', '65536'], {}, 'IIS assigned port'],
  ['invalid ordinary PORT', ['start'], { PORT: '%HTTP_PLATFORM_PORT%' }, 'Public web port'],
  ['same public and API port', ['start', '--iis-port', '4000'], { API_PORT: '04000' }, 'different ports'],
]) {
  test('rejects ' + label + ' before launching either service', t => {
    const { directory, env } = fixture(t);
    const result = spawnSync(process.execPath, ['scripts/run.cjs', ...args], {
      cwd: directory, env: { ...env, ...overrides }, windowsHide: true, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes(message), result.stderr);
    assert.ok(!result.stdout.includes('IslandHost web:'), result.stdout);
  });
}
