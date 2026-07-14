// Vérification de syntaxe de tous les fichiers JS/MJS du projet.
import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const ROOTS = ['src', 'tools', 'main.js', 'preload.cjs'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'assets']);

async function collect(path, out) {
  const { stat } = await import('node:fs/promises');
  const st = await stat(path).catch(() => null);
  if (!st) return;
  if (st.isFile()) {
    if (['.js', '.mjs', '.cjs'].includes(extname(path))) out.push(path);
    return;
  }
  for (const entry of await readdir(path)) {
    if (SKIP_DIRS.has(entry)) continue;
    await collect(join(path, entry), out);
  }
}

const files = [];
for (const root of ROOTS) await collect(root, files);

let failures = 0;
for (const f of files) {
  try {
    await exec('node', ['--check', f]);
  } catch (err) {
    failures++;
    console.error(`✗ ${f}\n${err.stderr || err.message}`);
  }
}
console.log(`${files.length - failures}/${files.length} fichiers OK`);
process.exit(failures > 0 ? 1 : 0);
