const { cpSync, existsSync, readdirSync, unlinkSync } = require('node:fs');
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
// Next may trace the build machine's .env into standalone output. Runtime
// configuration comes from the deployment environment, never a copied local file.
for (const entry of readdirSync(standalone, { withFileTypes: true })) {
  if ((entry.isFile() || entry.isSymbolicLink()) && /^\.env(?:\.|$)/.test(entry.name)) {
    unlinkSync(path.join(standalone, entry.name));
  }
}
