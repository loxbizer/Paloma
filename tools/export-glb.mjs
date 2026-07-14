// Exporte une scène three.js (avec animations) en fichier .glb binaire, sous Node.
import { installShims } from './node-shims.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

installShims();

const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

/**
 * @param {THREE.Object3D} root - racine à exporter
 * @param {THREE.AnimationClip[]} animations - clips à embarquer
 * @param {string} outPath - chemin du .glb de sortie
 */
export async function exportGLB(root, animations, outPath) {
  const exporter = new GLTFExporter();
  const arrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      root,
      (result) => resolve(result),
      (error) => reject(error),
      { binary: true, animations: animations || [], includeCustomExtensions: true }
    );
  });
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(arrayBuffer));
  return outPath;
}

/** Vérifie l'en-tête GLB et la validité du chunk JSON. Retourne le JSON glTF. */
export async function validateGLB(path) {
  const { readFile } = await import('node:fs/promises');
  const buf = await readFile(path);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error(`${path}: mauvais magic GLB`);
  const version = buf.readUInt32LE(4);
  if (version !== 2) throw new Error(`${path}: version glTF ${version} != 2`);
  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.subarray(20, 20 + jsonLen).toString('utf8');
  return JSON.parse(jsonStr);
}
