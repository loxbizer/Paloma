// ============================================================================
// XENOSTRIKE — SpikeSystem : le Noyau de Singularité.
// Objet central du mode de jeu : porté par un attaquant, lâché à sa mort,
// ramassable, posé sur un site (maintien 4 s), minuterie de 45 s avec bips
// accélérés et pulsation visuelle, désamorçage en 7 s (demi-jauge conservée),
// explosion cataclysmique. Mesh 3D créé directement en three.js (icosaèdre
// émissif + anneaux orbitaux + lumière), aucune texture.
//
// API (docs/CONTRACTS.md) : carrier, planted, plant(entity, site),
// startDefuse(entity), cancelDefuse(), update(dt).
// Les appels plant()/startDefuse() sont des « maintiens » : le contrôleur
// (joueur ou bot) les rappelle chaque frame tant que la touche est tenue ;
// sans rafraîchissement pendant HOLD_REFRESH s, l'action s'interrompt.
// ============================================================================
import * as THREE from 'three';
import { bus } from '../core/events.js';
import { registry } from '../core/registry.js';
import { ROUND } from './constants.js';

const PICKUP_RADIUS = 1.5;     // distance de ramassage au sol (m)
const DEFUSE_RANGE = 2.2;      // distance maximale au Noyau pour désamorcer (m)
const PLANT_DRIFT = 1.4;       // déplacement max pendant la pose avant annulation (m)
const HOLD_REFRESH = 0.3;      // fenêtre de rafraîchissement des maintiens (s)
const CORE_COLOR = 0x9b3dff;   // violet singularité
const RING_COLOR = 0x35f6ff;   // cyan xéno

export class SpikeSystem {
  constructor(match = null) {
    this._matchRef = match;

    // États : idle | carried | dropped | planting | planted | defused | exploded
    this._state = 'idle';
    this._carrier = null;
    this._site = null;
    this._timeLeft = 0;
    this._frozen = false;        // fin de round : plus aucune progression

    this._plantJob = null;       // { entity, site, progress, lastRefresh, origin }
    this._defuseJob = null;      // { entity, progress, lastRefresh }
    this._defuseSaved = 0;       // demi-jauge conservée après interruption

    this._clock = 0;             // horloge interne (suit engine.timeScale)
    this._beepIn = 0;            // temps avant le prochain bip
    this._basePos = new THREE.Vector3(); // position de repos (drop / plant)
    this._v = new THREE.Vector3();

    this._mesh = this._buildMesh();
    this._mesh.visible = false;

    this._offs = [
      bus.on('entity:died', (e) => this._onEntityDied(e))
    ];
  }

  // ------------------------------------------------------------ accesseurs --
  get carrier() { return this._carrier; }
  get planted() { return this._state === 'planted'; }
  get planting() { return this._state === 'planting'; }
  get defusing() { return this.planted && this._defuseJob !== null; }
  get state() { return this._state; }
  get site() { return this._site; }
  get timeLeft() { return this._timeLeft; }

  /** Position monde du Noyau (minimap, bots, effets). */
  get position() {
    return this._mesh.getWorldPosition(this._v.set(0, 0, 0)).clone();
  }

  _match() {
    return this._matchRef || registry.get('match');
  }

  // ------------------------------------------------------------------ mesh --
  /** Icosaèdre émissif pulsant + cœur incandescent + deux anneaux orbitaux. */
  _buildMesh() {
    const group = new THREE.Group();
    group.name = 'noyau_singularite';

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.17, 1),
      new THREE.MeshStandardMaterial({
        color: 0x120722, emissive: CORE_COLOR, emissiveIntensity: 1.6,
        roughness: 0.35, metalness: 0.55, flatShading: true
      })
    );
    core.name = 'noyau_coeur';
    group.add(core);

    const heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0x000000, emissive: 0xf2ccff, emissiveIntensity: 3.2,
        roughness: 0.2, metalness: 0
      })
    );
    heart.name = 'noyau_singularite_interne';
    group.add(heart);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x0a1016, emissive: RING_COLOR, emissiveIntensity: 1.4,
      roughness: 0.4, metalness: 0.7
    });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 8, 40), ringMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.name = 'noyau_anneau_1';
    group.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.013, 8, 44), ringMat.clone());
    ring2.rotation.x = Math.PI / 3;
    ring2.rotation.y = Math.PI / 4;
    ring2.name = 'noyau_anneau_2';
    group.add(ring2);

    const light = new THREE.PointLight(CORE_COLOR, 3.5, 7);
    light.name = 'noyau_lumiere';
    group.add(light);

    this._core = core;
    this._heart = heart;
    this._rings = [ring1, ring2];
    this._light = light;
    return group;
  }

  _scene() {
    const engine = registry.get('engine');
    return engine ? engine.scene : null;
  }

  /** Attache le Noyau dans le dos du porteur. */
  _attachTo(entity) {
    if (this._mesh.parent) this._mesh.parent.remove(this._mesh);
    entity.object3D.add(this._mesh);
    this._mesh.position.set(0, 1.12, 0.34);
    this._mesh.rotation.set(0, 0, 0);
    this._mesh.scale.setScalar(0.62);
    this._mesh.visible = true;
  }

  /** Détache le Noyau dans la scène, à une position monde donnée. */
  _detachAt(worldPos) {
    const scene = this._scene();
    if (this._mesh.parent) this._mesh.parent.remove(this._mesh);
    if (scene) scene.add(this._mesh);
    this._mesh.position.copy(worldPos);
    this._mesh.scale.setScalar(1);
    this._mesh.visible = true;
    this._basePos.copy(worldPos);
  }

  // ------------------------------------------------------------ cycle round --
  /** Nouveau round : remise à zéro complète et remise du Noyau à un attaquant. */
  reset() {
    const match = this._match();
    this._state = 'idle';
    this._carrier = null;
    this._site = null;
    this._timeLeft = 0;
    this._plantJob = null;
    this._defuseJob = null;
    this._defuseSaved = 0;
    this._frozen = false;
    this._beepIn = 0;
    if (this._core) {
      this._core.material.emissiveIntensity = 1.6;
      this._core.material.emissive.setHex(CORE_COLOR);
    }
    if (this._light) {
      this._light.intensity = 3.5;
      this._light.color.setHex(CORE_COLOR);
    }

    if (!match) { this._mesh.visible = false; return; }
    const attackers = match.entitiesOfTeam(match.attackTeam);
    if (attackers.length === 0) { this._mesh.visible = false; return; }
    const pick = attackers[Math.floor(Math.random() * attackers.length)];
    this.giveTo(pick);
  }

  /** Confie le Noyau à une entité (nouveau porteur). */
  giveTo(entity) {
    if (!entity) return;
    const wasDropped = this._state === 'dropped';
    this._carrier = entity;
    this._state = 'carried';
    this._attachTo(entity);
    if (wasDropped) {
      bus.emit('spike:pickup', { entity });
      bus.emit('audio:play', { sfx: 'ui_click', pos: entity.position.clone(), volume: 0.6 });
    }
    if (entity.isPlayer) {
      bus.emit('ui:notification', {
        text: wasDropped ? 'Noyau de Singularité récupéré.' : 'Vous portez le Noyau de Singularité.',
        type: 'info', duration: 3.5
      });
    }
  }

  /** Le porteur meurt : le Noyau tombe au sol, ramassable par les attaquants. */
  _onEntityDied({ entity }) {
    if (!entity || entity !== this._carrier) return;
    if (this._state !== 'carried' && this._state !== 'planting') return;
    this._plantJob = null;
    const dropPos = entity.position.clone();
    dropPos.y += 0.35;
    this._carrier = null;
    this._state = 'dropped';
    this._detachAt(dropPos);
    bus.emit('spike:dropped', { position: dropPos.clone() });
    const match = this._match();
    if (match && match.playerEntity && match.playerEntity.team === match.attackTeam) {
      bus.emit('ui:notification', { text: 'Le Noyau de Singularité est au sol !', type: 'warn', duration: 3 });
    }
  }

  /** Fin de round : gèle toute progression (bips, minuterie, maintiens). */
  endRound() {
    this._frozen = true;
    this._plantJob = null;
    this._defuseJob = null;
  }

  // ------------------------------------------------------------------ pose --
  /**
   * Maintien de pose (4 s) : à rappeler chaque frame tant que la touche est
   * tenue. Conditions : porteur vivant, camp attaquant, dans un site.
   * Retourne true tant que la pose progresse.
   */
  plant(entity, site = null) {
    if (this._frozen) return false;
    if (this._state !== 'carried' && this._state !== 'planting') return false;
    if (!entity || !entity.alive || entity !== this._carrier) return false;

    const match = this._match();
    if (match && entity.team !== match.attackTeam) return false;

    // Site : fourni par l'appelant ou déduit de la position via le monde.
    const world = registry.get('world');
    let where = site;
    if (!where && world && world.siteAt) where = world.siteAt(entity.position);
    if (!where && world) return false; // hors site
    where = where || 'A';              // monde absent : on reste jouable

    if (!this._plantJob) {
      this._plantJob = {
        entity, site: where, progress: 0,
        lastRefresh: this._clock,
        origin: entity.position.clone()
      };
      this._state = 'planting';
      bus.emit('audio:play', { sfx: 'spike_plant', pos: entity.position.clone(), volume: 0.5 });
    } else {
      this._plantJob.lastRefresh = this._clock;
      this._plantJob.site = where;
    }
    return true;
  }

  /** Interrompt la pose en cours (le Noyau reste porté). */
  cancelPlant() {
    if (this._state !== 'planting') return;
    this._plantJob = null;
    this._state = 'carried';
    bus.emit('spike:planting', { entity: this._carrier, progress: 0 });
  }

  _finishPlant() {
    const job = this._plantJob;
    if (!job) return;
    const entity = job.entity;

    // Le Noyau se fiche dans le sol devant le poseur.
    const pos = entity.position.clone();
    entity.forwardDir(this._v);
    pos.x += this._v.x * 0.5;
    pos.z += this._v.z * 0.5;
    pos.y += 0.28;

    this._plantJob = null;
    this._carrier = null;
    this._site = job.site;
    this._state = 'planted';
    this._timeLeft = ROUND.SPIKE_TIMER;
    this._defuseSaved = 0;
    this._beepIn = 0;
    this._detachAt(pos);

    bus.emit('spike:planted', { site: this._site, entity, timeLeft: this._timeLeft });
    bus.emit('audio:play', { sfx: 'spike_plant', pos: pos.clone(), volume: 1 });
    bus.emit('ui:notification', {
      text: `NOYAU DE SINGULARITÉ AMORCÉ — SITE ${this._site} — ${Math.round(ROUND.SPIKE_TIMER)} s`,
      type: 'warn', duration: 4
    });

    const fx = registry.get('fx');
    if (fx && fx.teleportFlash) {
      try { fx.teleportFlash(pos.clone()); } catch { /* fx optionnel */ }
    }
  }

  // ------------------------------------------------------------- désamorce --
  /**
   * Maintien de désamorçage (7 s, demi-jauge conservée) : à rappeler chaque
   * frame. Conditions : défenseur vivant à moins de 2,2 m du Noyau posé.
   */
  startDefuse(entity) {
    if (this._frozen || !this.planted) return false;
    if (!entity || !entity.alive) return false;

    const match = this._match();
    if (match && entity.team === match.attackTeam) return false;
    if (entity.position.distanceTo(this._basePos) > DEFUSE_RANGE) return false;

    if (!this._defuseJob || this._defuseJob.entity !== entity) {
      this._defuseJob = {
        entity,
        progress: this._defuseSaved, // reprise à la demi-jauge conservée
        lastRefresh: this._clock
      };
      bus.emit('audio:play', { sfx: 'spike_defuse', pos: this._basePos.clone(), volume: 0.45 });
    } else {
      this._defuseJob.lastRefresh = this._clock;
    }
    return true;
  }

  /** Interrompt le désamorçage (la demi-jauge atteinte reste acquise). */
  cancelDefuse() {
    if (!this._defuseJob) return;
    if (this._defuseJob.progress >= ROUND.DEFUSE_HALF) this._defuseSaved = ROUND.DEFUSE_HALF;
    this._defuseJob = null;
  }

  _finishDefuse(entity) {
    this._defuseJob = null;
    this._state = 'defused';
    this._frozen = true;

    // Le Noyau s'éteint : teinte froide, lumière douce.
    if (this._core) {
      this._core.material.emissive.setHex(0x2a6fb0);
      this._core.material.emissiveIntensity = 0.7;
    }
    if (this._light) { this._light.color.setHex(0x2a6fb0); this._light.intensity = 1.2; }
    this._mesh.scale.setScalar(1);

    bus.emit('spike:defused', { entity });
    bus.emit('audio:play', { sfx: 'spike_defuse', pos: this._basePos.clone(), volume: 1 });
    bus.emit('ui:notification', { text: 'NOYAU DÉSAMORCÉ !', type: 'info', duration: 3.5 });
  }

  // ------------------------------------------------------------- explosion --
  _explode() {
    this._state = 'exploded';
    this._frozen = true;
    this._defuseJob = null;
    const pos = this._basePos.clone();

    // Déflagration géante + ondes secondaires.
    const fx = registry.get('fx');
    if (fx) {
      try {
        if (fx.explosion) {
          fx.explosion(pos.clone(), 14, CORE_COLOR);
          fx.explosion(pos.clone(), 8, 0xf2ccff);
          fx.explosion(pos.clone().setY(pos.y + 1.5), 5, RING_COLOR);
        }
        if (fx.shieldBreak) fx.shieldBreak(pos.clone());
      } catch { /* fx optionnel */ }
    }
    bus.emit('audio:play', { sfx: 'spike_explode', pos: pos.clone(), volume: 1 });

    // Dégâts massifs décroissants dans un rayon de 12 m.
    const match = this._match();
    if (match) {
      for (const e of match.entities) {
        if (!e.alive) continue;
        const d = e.position.distanceTo(pos);
        if (d > 12) continue;
        const dmg = Math.round(320 * (1 - d / 12));
        if (dmg > 0) e.takeDamage(dmg, null, 'body');
      }
    }

    this._mesh.visible = false;
    bus.emit('spike:exploded', {});
  }

  // ---------------------------------------------------------------- update --
  update(dt) {
    if (dt <= 0) return;
    this._clock += dt;

    // Animation permanente : anneaux orbitaux + respiration du cœur.
    if (this._mesh.visible) {
      this._rings[0].rotation.z += dt * 1.6;
      this._rings[1].rotation.y += dt * 2.3;
      this._rings[1].rotation.x += dt * 0.7;
    }

    if (this._frozen) return;

    switch (this._state) {
      case 'carried': {
        // Pulsation discrète sur le dos du porteur.
        const s = 1 + Math.sin(this._clock * 3) * 0.05;
        this._core.scale.setScalar(s);
        this._core.material.emissiveIntensity = 1.3 + Math.sin(this._clock * 3) * 0.4;
        break;
      }
      case 'dropped': {
        // Flottement + rotation, puis ramassage automatique par un attaquant.
        this._mesh.position.y = this._basePos.y + 0.15 + Math.sin(this._clock * 2.4) * 0.12;
        this._mesh.rotation.y += dt * 1.2;
        const match = this._match();
        if (match) {
          for (const e of match.aliveOf(match.attackTeam)) {
            if (e.position.distanceTo(this._basePos) <= PICKUP_RADIUS) {
              this._mesh.rotation.set(0, 0, 0);
              this.giveTo(e);
              break;
            }
          }
        }
        break;
      }
      case 'planting': {
        const job = this._plantJob;
        if (!job) { this._state = 'carried'; break; }
        const stale = this._clock - job.lastRefresh > HOLD_REFRESH;
        const moved = job.entity.position.distanceTo(job.origin) > PLANT_DRIFT;
        if (stale || moved || !job.entity.alive) {
          this.cancelPlant();
          break;
        }
        job.progress += dt;
        bus.emit('spike:planting', {
          entity: job.entity,
          progress: Math.min(1, job.progress / ROUND.PLANT_TIME)
        });
        if (job.progress >= ROUND.PLANT_TIME) this._finishPlant();
        break;
      }
      case 'planted': {
        this._updatePlanted(dt);
        break;
      }
      default:
        break;
    }
  }

  /** Minuterie 45 s : bips accélérés, pulsation croissante, désamorçage. */
  _updatePlanted(dt) {
    this._timeLeft -= dt;
    const urgency = 1 - Math.max(0, this._timeLeft) / ROUND.SPIKE_TIMER; // 0 → 1

    // Pulsation visuelle : plus rapide et plus violente vers la fin.
    const freq = 2.5 + urgency * 11;
    const throb = Math.abs(Math.sin(this._clock * freq));
    this._core.material.emissiveIntensity = 1.4 + throb * (1.2 + urgency * 2.6);
    this._core.scale.setScalar(1 + throb * (0.08 + urgency * 0.22));
    if (this._light) this._light.intensity = 2.5 + throb * (2 + urgency * 5);

    // Bips accélérés (intervalle : 1 s → 0,12 s).
    this._beepIn -= dt;
    if (this._beepIn <= 0) {
      bus.emit('audio:play', {
        sfx: 'spike_beep',
        pos: this._basePos.clone(),
        volume: 0.55 + urgency * 0.45
      });
      this._beepIn = 0.12 + 0.88 * (1 - urgency);
    }

    if (this._timeLeft <= 0) {
      this._explode();
      return;
    }

    // Progression du désamorçage.
    const job = this._defuseJob;
    if (job) {
      const stale = this._clock - job.lastRefresh > HOLD_REFRESH;
      const far = job.entity.position.distanceTo(this._basePos) > DEFUSE_RANGE + 0.3;
      if (stale || far || !job.entity.alive) {
        this.cancelDefuse();
      } else {
        job.progress += dt;
        if (job.progress >= ROUND.DEFUSE_HALF) this._defuseSaved = ROUND.DEFUSE_HALF;
        bus.emit('spike:defusing', {
          entity: job.entity,
          progress: Math.min(1, job.progress / ROUND.DEFUSE_TIME)
        });
        if (job.progress >= ROUND.DEFUSE_TIME) this._finishDefuse(job.entity);
      }
    }
  }

  // -------------------------------------------------------------- nettoyage --
  dispose() {
    for (const off of this._offs) { try { off(); } catch { /* déjà détaché */ } }
    this._offs = [];
    if (this._mesh.parent) this._mesh.parent.remove(this._mesh);
    this._carrier = null;
    this._state = 'idle';
  }
}
