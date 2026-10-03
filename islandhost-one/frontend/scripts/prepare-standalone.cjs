const { cpSync, existsSync } = require('node:fs');
const path = require('node:path');

const frontend = path.resolve(__dirname, '..');
const standalone = path.join(frontend, '.next', 'standalone', 'frontend');

if (!existsSync(path.join(standalone, 'server.js'))) {
  throw new Error('Next.js standalone server is missing. Run the frontend build first.');
}

// Next.js traces server dependencies but does not include public or static assets.
for (const directory of ['public', '.next/static']) {
  cpSync(path.join(frontend, directory), path.join(standalone, directory), { recursive: true });
}
