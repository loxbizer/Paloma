// Système d'avatars — mesh 3D + AnimationMixer d'une entité de combat.
// Le joueur (vue FPS) a un avatar complet mais invisible par défaut ; les
// cinématiques et la danse le rendent visibles. Les bots sont toujours visibles.
import * as THREE from 'three';
import { bus } from '../core/events.js';
import { registry } from '../core/registry.js';
import { modelPathForAgent, modelPathForWeapon } from '../game/constants.js';

/** Clips pilotés par updateLocomotion (les autres sont des overrides). */
const LOCOMOTION_CLIPS = new Set(['idle', 'run', 'run_back', 'strafe_l', 'strafe_r', 'crouch_idle', 'crouch_walk']);
/** Priorités d'override : la mort écrase tout, un one-shot écrase une boucle manuelle. */
const PRIORITY = { death: 3, oneshot: 2, manual: 1, locomotion: 0 };
const DEFAULT_FADE = 0.16;

export class AgentAvatar {
  constructor(entity) {
    this.entity = entity;
    this.root = null;
    this.mixer = null;
    this.actions = new Map();       // nom de clip -> AnimationAction
    this.weaponSocket = null;
    this.currentWeaponId = null;
    this._current = null;           // action en cours
    this._currentName = null;
    this._overridePriority = PRIORITY.locomotion;
    this._locomotionEnabled = true;
    this._disposed = false;
    this._offUpdate = null;
    this._busOffs = [];
    this._weaponToken = 0;          // anti-course sur attachWeapon (async)
    this._v = new THREE.Vector3();  // tampon
  }

  /** Charge le GLB de l'agent, attache le mesh à entity.object3D, câble le bus. */
  static async create(entity) {
    const avatar = new AgentAvatar(entity);
    await avatar._init();
    return avatar;
  }

  async _init() {
    const assets = registry.require('assets');
    const path = modelPathForAgent(this.entity.agentDef.id);
    const { root, animations } = await assets.instantiate(path);
    this.root = root;
    this.root.name = `avatar_${this.entity.agentDef.id}_${this.entity.id}`;
    this.entity.object3D.add(this.root);

    this.mixer = new THREE.AnimationMixer(this.root);
    for (const clip of animations) {
      const action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);
    }
    this.mixer.addEventListener('finished', (e) => this._onActionFinished(e.action));

    this.weaponSocket = this.root.getObjectByName('WeaponSocket_R') || null;

    // Le joueur est en vue FPS : avatar caché par défaut (cinématiques/danse le montrent).
    if (this.entity.isPlayer) this.root.visible = false;

    // Écouteurs du bus, filtrés sur NOTRE entité.
    const forMe = (fn) => (payload) => {
      if (this._disposed || !payload || payload.entity !== this.entity) return;
      fn(payload);
    };
    this._busOffs.push(
      bus.on('entity:died', forMe(() => this.setRagdollDeath())),
      bus.on('entity:revived', forMe(() => this._onRevived())),
      bus.on('entity:spawned', forMe(() => this._onSpawned())),
      bus.on('weapon:fired', forMe(() => this._playOverlay('shoot', 0.06))),
      bus.on('weapon:reload', forMe(() => this._playOverlay('reload'))),
      bus.on('weapon:switched', forMe(({ weaponId }) => { this.attachWeapon(weaponId); })),
      bus.on('ability:cast', forMe(() => this._playOverlay('ability'))),
      bus.on('spike:planted', forMe(() => this._playOverlay('plant')))
    );

    // Auto-enregistrement sur la boucle du moteur (dispose() désinscrit).
    const engine = registry.require('engine');
    this._offUpdate = engine.onUpdate((dt) => {
      if (this._disposed) return;
      this.update(dt);
      this.updateLocomotion(dt);
    });

    // Arme déjà en main au moment de la création ?
    const held = this.entity.inventory[this.entity.currentSlot];
    if (held) this.attachWeapon(held);

    this.playClip('idle');
  }

  /** Joue un clip avec fondu enchaîné. opts: { loop, fade, once }. */
  playClip(name, { loop = true, fade = DEFAULT_FADE, once = false } = {}) {
    const action = this.actions.get(name);
    if (!action || this._disposed) return null;
    if (once) loop = false;

    // Priorité de l'appel : les clips de locomotion ne coupent pas un override.
    const isLocomotion = LOCOMOTION_CLIPS.has(name);
    const priority = name === 'death' ? PRIORITY.death
      : isLocomotion ? PRIORITY.locomotion
        : loop ? PRIORITY.manual : PRIORITY.oneshot;
    if (priority < this._overridePriority) return null;
    if (this._currentName === name && loop && priority === this._overridePriority) return action;

    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    if (this._current && this._current !== action) {
      action.crossFadeFrom(this._current, fade, false);
    } else {
      action.fadeIn(fade);
    }
    action.play();
    this._current = action;
    this._currentName = name;
    this._overridePriority = priority;
    return action;
  }

  /** Overlay gameplay (tir, rechargement, capacité, plant) : one-shot puis retour locomotion. */
  _playOverlay(name, fade = DEFAULT_FADE) {
    if (!this.entity.alive) return;
    this.playClip(name, { once: true, fade });
  }

  _onActionFinished(action) {
    if (this._disposed || action !== this._current) return;
    if (this._currentName === 'death') return; // reste effondré (clamp)
    // Fin d'un one-shot : on redonne la main à la locomotion.
    this._overridePriority = PRIORITY.locomotion;
    if (this._locomotionEnabled && this.entity.alive) {
      this._currentName = null; // force la re-sélection
      this.updateLocomotion(0);
    }
  }

  /** Sélectionne idle/run/run_back/strafe/crouch selon la vélocité projetée sur le yaw. */
  updateLocomotion(dt) {
    if (this._disposed || !this._locomotionEnabled || !this.entity.alive) return;
    // Une boucle manuelle (danse, intro) reste tant que l'entité ne bouge pas.
    const vel = this.entity.velocity;
    const speed = Math.hypot(vel.x, vel.z);
    if (this._overridePriority === PRIORITY.oneshot || this._overridePriority === PRIORITY.death) return;
    if (this._overridePriority === PRIORITY.manual) {
      if (speed < 0.8) return;
      this._overridePriority = PRIORITY.locomotion; // le mouvement interrompt la danse
    }

    const yaw = this.entity.yaw;
    // Avant (yaw=0 → -Z) et droite (+X) dans le plan horizontal.
    const fwd = -vel.x * Math.sin(yaw) - vel.z * Math.cos(yaw);
    const right = vel.x * Math.cos(yaw) - vel.z * Math.sin(yaw);

    let target;
    if (this.entity.crouching) {
      target = speed > 0.4 ? 'crouch_walk' : 'crouch_idle';
    } else if (speed < 0.4) {
      target = 'idle';
    } else if (Math.abs(fwd) >= Math.abs(right)) {
      target = fwd > 0 ? 'run' : 'run_back';
    } else {
      target = right > 0 ? 'strafe_r' : 'strafe_l';
    }

    if (target !== this._currentName) this.playClip(target, { fade: 0.22 });

    // Cadence du cycle asservie à la vitesse réelle (référence course ≈ 6.8 m/s).
    if (this._current && LOCOMOTION_CLIPS.has(this._currentName) && this._currentName !== 'idle' && this._currentName !== 'crouch_idle') {
      const nominal = this._currentName.startsWith('crouch') ? 2.6 : 6.2;
      this._current.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / nominal, 0.55, 1.6));
    }
  }

  /** Instancie le GLB d'une arme sur le nœud WeaponSocket_R du rig. */
  async attachWeapon(weaponId) {
    if (this._disposed || !this.weaponSocket) return;
    const token = ++this._weaponToken;
    // Retire l'arme précédente.
    for (const child of [...this.weaponSocket.children]) this.weaponSocket.remove(child);
    this.currentWeaponId = weaponId || null;
    if (!weaponId) return;
    try {
      const assets = registry.require('assets');
      const { root } = await assets.instantiate(modelPathForWeapon(weaponId));
      // Une autre attache (ou un dispose) est passée entre-temps ?
      if (this._disposed || token !== this._weaponToken) return;
      root.name = `arme_${weaponId}`;
      this.weaponSocket.add(root);
    } catch (err) {
      console.error(`[avatar] échec d'attache de l'arme ${weaponId}:`, err);
      if (typeof window !== 'undefined' && window.__SMOKE) {
        window.__SMOKE.errors.push(`avatar arme ${weaponId}: ${err}`);
      }
    }
  }

  /** Mort : joue le clip d'effondrement et fige la locomotion. */
  setRagdollDeath() {
    if (this._disposed) return;
    this._locomotionEnabled = false;
    this._overridePriority = PRIORITY.locomotion; // autorise le clip death à passer
    this.playClip('death', { once: true, fade: 0.1 });
  }

  _onRevived() {
    this._locomotionEnabled = true;
    this._overridePriority = PRIORITY.locomotion;
    this._currentName = null;
    this.playClip('idle', { fade: 0.25 });
  }

  _onSpawned() {
    // Nouveau round : on repart proprement sur l'idle.
    this._locomotionEnabled = true;
    this._overridePriority = PRIORITY.locomotion;
    this._currentName = null;
    this._current = null;
    if (this.mixer) this.mixer.stopAllAction();
    this.playClip('idle', { fade: 0.01 });
  }

  /** Avance le mixer (appelé automatiquement via engine.onUpdate). */
  update(dt) {
    if (this.mixer && dt > 0) this.mixer.update(dt);
  }

  /** Désinscrit tout (boucle moteur, bus) et détache le mesh. */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._weaponToken++;
    if (this._offUpdate) { this._offUpdate(); this._offUpdate = null; }
    for (const off of this._busOffs) off();
    this._busOffs.length = 0;
    if (this.mixer) this.mixer.stopAllAction();
    if (this.root && this.root.parent) this.root.parent.remove(this.root);
    // Géométries/matériaux partagés avec le cache d'assets : on ne les dispose pas.
    this.actions.clear();
    this._current = null;
  }
}

/** Fabrique d'avatars — enregistrée sous la clé registry 'agentFactory'. */
export class AgentFactory {
  constructor() {
    this._avatars = new Map(); // entity.id -> AgentAvatar
  }

  /** Crée (et mémorise) l'avatar 3D d'une entité. */
  async createAvatarFor(entity) {
    // Remplace proprement un avatar existant (changement d'agent, re-création).
    const previous = this._avatars.get(entity.id);
    if (previous) previous.dispose();
    const avatar = await AgentAvatar.create(entity);
    this._avatars.set(entity.id, avatar);
    entity.avatar = avatar; // accès pratique pour bots/cinématiques
    return avatar;
  }

  avatarOf(entity) {
    return this._avatars.get(entity.id) || null;
  }

  disposeAll() {
    for (const avatar of this._avatars.values()) avatar.dispose();
    this._avatars.clear();
  }
}
