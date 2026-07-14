// Moteur de rendu — boucle de jeu, scène, caméra, rendu three.js.
import * as THREE from 'three';
import { bus } from './events.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060f);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 500);
    this.camera.position.set(0, 1.7, 0);

    // timeScale : utilisé par les cinématiques pour les ralentis.
    this.timeScale = 1;
    this.elapsed = 0;
    this._running = false;
    this._updateListeners = new Set();
    this._clock = new THREE.Clock();
    this._activeCamera = this.camera;

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    if (this._activeCamera && this._activeCamera.isPerspectiveCamera) {
      this._activeCamera.aspect = w / h;
      this._activeCamera.updateProjectionMatrix();
    }
    bus.emit('engine:resize', { width: w, height: h });
  }

  /** Caméra active pour le rendu (les cinématiques la remplacent temporairement). */
  setCamera(cam) {
    this._activeCamera = cam || this.camera;
    this._onResize();
  }
  getCamera() {
    return this._activeCamera;
  }

  /** Enregistre un callback appelé chaque frame avec (dt, elapsed). Retourne un désabonnement. */
  onUpdate(fn) {
    this._updateListeners.add(fn);
    return () => this._updateListeners.delete(fn);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._clock.start();
    const loop = () => {
      if (!this._running) return;
      requestAnimationFrame(loop);
      const rawDt = Math.min(this._clock.getDelta(), 0.05);
      const dt = rawDt * this.timeScale;
      this.elapsed += dt;
      for (const fn of [...this._updateListeners]) {
        try {
          fn(dt, this.elapsed, rawDt);
        } catch (err) {
          console.error('[engine] erreur update:', err);
          if (window.__SMOKE) window.__SMOKE.errors.push(String(err && err.stack || err));
        }
      }
      this.renderer.render(this.scene, this._activeCamera);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
  }
}
