const { cpSync, existsSync } = require('node:fs');
const path = require('node:path');
const project = path.resolve(__dirname, '..');
const standalone = path.join(project, '.next', 'standalone');
if (!existsSync(path.join(standalone, 'server.js'))) {
  throw new Error('Next.js standalone server is missing. Run npm run build:web first.');
}
// Next.js traces server dependencies but does not include public or static assets.
for (const directory of ['public', '.next/static']) {
  cpSync(path.join(project, directory), path.join(standalone, directory), { recursive: true });
}