const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const rootDir = path.join(__dirname, '..');

const requiredRuntimeDeps = ['xlsx', 'handlebars', 'puppeteer', 'electron-updater'];

let hasErrors = false;

for (const dep of requiredRuntimeDeps) {
  if (!pkg.dependencies || !pkg.dependencies[dep]) {
    console.error(`[build] ERROR: "${dep}" debe estar en "dependencies", no en "devDependencies".`);
    hasErrors = true;
    continue;
  }

  const depPath = path.join(rootDir, 'node_modules', dep);
  if (!fs.existsSync(depPath)) {
    console.error(`[build] ERROR: "${dep}" no esta instalado. Ejecuta "npm install" antes del build.`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('[build] Corrige las dependencias antes de generar el instalador.');
  process.exit(1);
}

console.log('[build] Dependencias de produccion verificadas correctamente.');
