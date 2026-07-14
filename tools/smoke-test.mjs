// Test de fumée automatisé : lance le jeu dans Chromium headless,
// vérifie le boot, le lancement d'un match et l'absence d'erreurs console.
// Usage : node tools/smoke-test.mjs [--shots]
import { createGameServer } from './dev-server.mjs';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const { server, port } = await createGameServer(root, 0);
console.log(`Serveur de test : http://127.0.0.1:${port}`);

const { chromium } = await import('playwright-core');

const executablePath = process.env.CHROMIUM_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage'
  ]
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

await page.goto(`http://127.0.0.1:${port}/index.html?smoketest=1`, { waitUntil: 'domcontentloaded' });

// Attend que le match atteigne la phase d'action (ou 90 s max)
let ready = false;
const deadline = Date.now() + 90_000;
while (Date.now() < deadline) {
  const smoke = await page.evaluate(() => window.__SMOKE || null).catch(() => null);
  if (smoke && smoke.ready) { ready = true; break; }
  await new Promise((r) => setTimeout(r, 1500));
}

// Laisse le gameplay tourner un peu (bots, tirs, fx…)
if (ready) await new Promise((r) => setTimeout(r, 12_000));

const smoke = await page.evaluate(() => window.__SMOKE || { errors: ['__SMOKE absent'] });

if (process.argv.includes('--shots')) {
  await mkdir('screenshots', { recursive: true });
  await page.screenshot({ path: 'screenshots/smoke-action.png' });
  console.log('Capture : screenshots/smoke-action.png');
}

console.log('\n=== RÉSULTAT DU SMOKE TEST ===');
console.log('Phase action atteinte :', ready ? 'OUI' : 'NON');
console.log('État :', JSON.stringify(smoke.state || {}));
const allErrors = [...new Set([...(smoke.errors || []), ...consoleErrors])];
if (allErrors.length) {
  console.log(`\n${allErrors.length} erreur(s) :`);
  for (const e of allErrors.slice(0, 40)) console.log('  ✗', e.split('\n').slice(0, 4).join('\n    '));
} else {
  console.log('Aucune erreur console. ✓');
}

await browser.close();
server.close();
process.exit(ready && allErrors.length === 0 ? 0 : 1);
