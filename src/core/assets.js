// Gestionnaire d'assets — chargement et cache des modèles GLB.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export class AssetManager {
  constructor() {
    this._loader = new GLTFLoader();
    this._cache = new Map(); // path -> gltf
  }

  /** Charge (avec cache) un GLB. Retourne le gltf brut { scene, animations }. */
  async load(path) {
    if (this._cache.has(path)) return this._cache.get(path);
    const gltf = await this._loader.loadAsync(path);
    this._cache.set(path, gltf);
    return gltf;
  }

  /**
   * Retourne une instance clonée prête à ajouter à la scène :
   * { root, animations } — clone profond compatible SkinnedMesh.
   */
  async instantiate(path) {
    const gltf = await this.load(path);
    const root = SkeletonUtils.clone(gltf.scene);
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });
    return { root, animations: gltf.animations };
  }

  /** Précharge une liste de chemins, avec callback de progression (0..1). */
  async preload(paths, onProgress) {
    let done = 0;
    for (const p of paths) {
      try {
        await this.load(p);
      } catch (err) {
        console.error(`[assets] échec de chargement: ${p}`, err);
        if (window.__SMOKE) window.__SMOKE.errors.push(`asset ${p}: ${err}`);
      }
      done++;
      if (onProgress) onProgress(done / paths.length, p);
    }
  }
}
