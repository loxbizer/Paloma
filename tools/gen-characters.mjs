// Générateur des 15 personnages 3D de XENOSTRIKE — rigs squelettés, corps
// stylisés à couleurs par sommet, 14 clips d'animation procéduraux par agent.
// Usage : node tools/gen-characters.mjs  (ou via tools/generate-assets.mjs)
import * as THREE from 'three';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportGLB, validateGLB } from './export-glb.mjs';
import { ROSTER } from './charlib/roster.mjs';
import { buildRig } from './charlib/skeleton.mjs';
import { buildBody } from './charlib/bodies.mjs';
import { buildSharedClips } from './charlib/animlib.mjs';
import { buildSignatureClips } from './charlib/signature.mjs';

/** Les 14 clips exigés par le contrat (noms exacts). */
export const REQUIRED_CLIPS = [
  'idle', 'run', 'run_back', 'strafe_l', 'strafe_r', 'crouch_idle', 'crouch_walk',
  'shoot', 'reload', 'plant', 'death', 'dance', 'intro', 'ability'
];

/** Assemble le personnage complet : { root, animations, triangles }. */
export function buildCharacter(def) {
  const rig = buildRig(def);
  const { geometry, triangles } = buildBody(def, rig);

  const bodyMat = new THREE.MeshStandardMaterial({
    name: `mat_${def.id}_corps`,
    vertexColors: true,
    roughness: 0.62,
    metalness: def.species === 'guardian' ? 0.35 : 0.12
  });
  const glowMat = new THREE.MeshStandardMaterial({
    name: `mat_${def.id}_lueur`,
    vertexColors: true,
    color: 0xffffff,
    emissive: new THREE.Color(def.colors.emissive),
    emissiveIntensity: 1.6,
    roughness: 0.35,
    metalness: 0.0
  });

  const mesh = new THREE.SkinnedMesh(geometry, [bodyMat, glowMat]);
  mesh.name = `corps_${def.id}`;
  mesh.add(rig.rootBone);
  mesh.bind(new THREE.Skeleton(rig.bones));

  const root = new THREE.Group();
  root.name = `agent_${def.id}`;
  root.add(mesh);

  const animations = [...buildSharedClips(def, rig), ...buildSignatureClips(def, rig)];
  return { root, animations, triangles };
}

/** Génère les 15 GLB dans outDir. Retourne la liste des chemins écrits. */
export async function generateCharacters(outDir) {
  const written = [];
  for (const def of ROSTER) {
    const { root, animations, triangles } = buildCharacter(def);
    const names = animations.map((a) => a.name);
    for (const req of REQUIRED_CLIPS) {
      if (!names.includes(req)) throw new Error(`${def.id} : clip manquant "${req}"`);
    }
    if (triangles < 3000 || triangles > 9000) {
      console.warn(`  ! ${def.id} : ${triangles} triangles (attendu 3000-9000)`);
    }
    const outPath = join(outDir, `agent_${def.id}.glb`);
    await exportGLB(root, animations, outPath);
    console.log(`  ✓ agent_${def.id}.glb — ${triangles} tris, ${animations.length} clips`);
    written.push(outPath);
  }
  return written;
}

/** Vérifie qu'un GLB de personnage respecte le contrat (squelette + 14 clips). */
export async function checkCharacterGLB(path) {
  const json = await validateGLB(path);
  const anims = (json.animations || []).map((a) => a.name);
  for (const req of REQUIRED_CLIPS) {
    if (!anims.includes(req)) throw new Error(`${path} : clip manquant "${req}"`);
  }
  if (!json.skins || !json.skins.length) throw new Error(`${path} : aucun squelette (skin)`);
  const nodeNames = new Set((json.nodes || []).map((n) => n.name));
  for (const bone of ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'Hand_R', 'WeaponSocket_R', 'Foot_L', 'Foot_R']) {
    if (!nodeNames.has(bone)) throw new Error(`${path} : nœud manquant "${bone}"`);
  }
  return { anims: anims.length, joints: json.skins[0].joints.length };
}

// Exécution directe : node tools/gen-characters.mjs
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const outDir = fileURLToPath(new URL('../assets/models', import.meta.url));
  console.log('Génération des 15 personnages…');
  const files = await generateCharacters(outDir);
  console.log('Validation…');
  for (const f of files) {
    const { anims, joints } = await checkCharacterGLB(f);
    console.log(`  ✓ ${f} — ${anims} clips, ${joints} os`);
  }
  console.log(`${files.length}/15 personnages générés et validés.`);
}
