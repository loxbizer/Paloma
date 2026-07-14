// Orchestrateur de génération d'assets — produit tous les .glb + données de map.
// Usage : npm run assets
import { generateCharacters } from './gen-characters.mjs';
import { generateWeapons } from './gen-weapons.mjs';
import { generateMap } from './gen-map.mjs';
import { validateGLB } from './export-glb.mjs';
import { readdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_MODELS = 'assets/models';

console.log('— XENOSTRIKE : génération des assets 3D —');

console.log('\n[1/3] Personnages (15 rigs squelettés + animations)…');
await generateCharacters(OUT_MODELS);

console.log('\n[2/3] Armes…');
await generateWeapons(OUT_MODELS);

console.log('\n[3/3] Map « Nova Bastion »…');
await generateMap(OUT_MODELS, 'assets/data');

// Validation de tous les GLB produits
console.log('\nValidation…');
const manifest = { models: [], generatedAt: null };
const files = (await readdir(OUT_MODELS)).filter((f) => f.endsWith('.glb')).sort();
let ok = 0;
for (const f of files) {
  const path = join(OUT_MODELS, f);
  try {
    const json = await validateGLB(path);
    const size = (await stat(path)).size;
    manifest.models.push({
      file: `assets/models/${f}`,
      sizeKB: Math.round(size / 1024),
      meshes: json.meshes?.length || 0,
      animations: (json.animations || []).map((a) => a.name)
    });
    ok++;
    console.log(`  ✓ ${f} (${Math.round(size / 1024)} Ko, ${json.animations?.length || 0} anims)`);
  } catch (err) {
    console.error(`  ✗ ${f}: ${err.message}`);
  }
}
await writeFile('assets/data/manifest.json', JSON.stringify(manifest, null, 2));
console.log(`\n${ok}/${files.length} GLB valides. Manifest écrit dans assets/data/manifest.json`);
if (ok !== files.length) process.exit(1);
