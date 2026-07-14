// ============================================================================
// XENOSTRIKE — Système de capacités 3D (AbilitySystem).
// Consomme le vocabulaire de params défini dans src/data/agents-data.js et
// implémente RÉELLEMENT chaque type en 3D : projectiles balistiques, zones à
// tick d'effet, murs solides, fumées opaques, dashes, téléportations, soins,
// révélations, clones, boucliers, pièges, buffs temporaires, transformation
// et effets globaux (révélation totale, éclipse, mimétisme d'ultime).
//
// Fonctionne à l'identique pour le joueur et les bots : tout est piloté par
// l'entité (position, yaw/pitch, forwardDir) — AUCUNE dépendance à l'input.
//
// Conventions temporelles :
//  - horloge interne this._now (accumulée par update(dt), suit engine.timeScale) ;
//  - les drapeaux posés SUR les entités (revealedUntil, cloakedUntil) sont en
//    secondes performance.now()/1000, comme entity.downedAt — ainsi les autres
//    systèmes peuvent les comparer sans dépendre de notre horloge interne.
// ============================================================================
import * as THREE from 'three';
import { bus } from '../core/events.js';
import { registry } from '../core/registry.js';
import { TEAM_XENOS, TEAM_GUARDIANS } from '../game/constants.js';
import { modelPathForAgent } from '../game/constants.js';

/** Secondes "monde réel" — pour les drapeaux posés sur les entités. */
function wallClock() {
  return performance.now() / 1000;
}

/** Clés numériques amplifiées par la fusion d'ultimes (× multiplicateur). */
const AMPLIFIED_KEYS = new Set([
  'damage', 'damagePerSec', 'healPerSec', 'healAmount', 'burstDamage', 'amount',
  'radius', 'explosionRadius', 'pullRadius', 'armorRadius', 'teamArmor',
  'hpBonus', 'droneDamage', 'contactDamage', 'touchDamage', 'knockback',
  'duration', 'width', 'height', 'shieldAmount', 'travel', 'visionRange'
]);

// Géométries partagées (jamais disposées : réutilisées toute la partie).
const GEO = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  sphereLow: new THREE.SphereGeometry(1, 10, 8),
  octa: new THREE.OctahedronGeometry(0.22, 0),
  ringDisc: new THREE.CylinderGeometry(1, 1, 0.08, 18)
};

export class AbilitySystem {
  constructor() {
    // Horloge interne (suit le timeScale du moteur via dt).
    this._now = 0;

    // Entités gérées (cooldowns) — remplies par setupEntity.
    this._entities = new Set();

    // Effets actifs.
    this._projectiles = [];   // grenades / dards / frappes
    this._pulls = [];         // phases d'aspiration (Supernova)
    this._zones = [];         // zones à tick : damage / heal / slow / reveal / smoke
    this._walls = [];         // murs solides temporaires
    this._waves = [];         // vagues déferlantes (Marée Vive)
    this._clones = [];        // doublures / Opéra des Lames
    this._traps = [];         // pièges de proximité
    this._drones = [];        // drones autonomes (Protocole Basilic)
    this._dashes = [];        // impulsions en cours (simple ou multiple)
    this._timedMods = [];     // buffs statMods à expiration propre
    this._shields = [];       // boucliers temporaires (retrait du reliquat)
    this._cloaks = [];        // invisibilités (échange de matériaux)
    this._transforms = [];    // Avatar de Rage (échelle + statMods)
    this._globalReveals = []; // révélation de toute une équipe
    this._darkness = null;    // Éclipse Totale (une seule à la fois)
    this._savedAtmosphere = null; // fog/fond de scène sauvegardés par l'éclipse
    this._slows = new Map();  // entity.id -> { entity, mult, until } (anti-cumul)

    // Mémoire du dernier ultime par équipe (pour la Réplique Parfaite d'Echo).
    this._lastUltByTeam = {};

    // Tampons vectoriels réutilisés (zéro allocation par frame).
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._v3 = new THREE.Vector3();
    this._v4 = new THREE.Vector3();
    this._q1 = new THREE.Quaternion();

    // Nettoyage entre les rounds / en fin de match.
    bus.on('round:prestart', () => this._clearTransient());
    bus.on('match:end', () => this._clearTransient());
  }

  // ==========================================================================
  // Accès services (lazy — récupérés via le registry au premier usage)
  // ==========================================================================
  _engine() { return registry.get('engine'); }
  _world() { return registry.get('world'); }
  _collision() { return registry.get('collision'); }
  _fx() { return registry.get('fx'); }
  _match() { return registry.get('match'); }
  _assets() { return registry.get('assets'); }

  /** Appel FX défensif : le système reste fonctionnel sans module fx. */
  _fxCall(method, ...args) {
    const fx = this._fx();
    if (fx && typeof fx[method] === 'function') {
      try { return fx[method](...args); } catch (err) { console.error('[abilities] fx:', err); }
    }
    return null;
  }

  _sfx(sfx, pos, volume) {
    bus.emit('audio:play', { sfx, pos: pos ? pos.clone() : undefined, volume });
  }

  _addToScene(obj) {
    const world = this._world();
    if (world && typeof world.addDynamic === 'function') world.addDynamic(obj);
    else if (this._engine()) this._engine().scene.add(obj);
  }

  _removeFromScene(obj) {
    const world = this._world();
    if (world && typeof world.removeDynamic === 'function') world.removeDynamic(obj);
    else if (obj.parent) obj.parent.remove(obj);
  }

  /** Toutes les entités du match (fallback : celles configurées ici). */
  _allEntities() {
    const match = this._match();
    if (match && match.entities && match.entities.length) return match.entities;
    return [...this._entities];
  }

  _enemiesOf(owner) {
    return this._allEntities().filter((e) => e.alive && e.team !== owner.team);
  }

  _alliesOf(owner) {
    return this._allEntities().filter((e) => e.alive && e.team === owner.team);
  }

  /** Direction du regard aplatie sur l'horizontale (déplacements/murs). */
  _forwardFlat(entity, target) {
    return target.set(-Math.sin(entity.yaw), 0, -Math.cos(entity.yaw)).normalize();
  }

  /** Altitude du sol sous un point (raycast collision, sinon y courant). */
  _groundYAt(pos, fallbackY = 0) {
    const col = this._collision();
    if (col && typeof col.raycast === 'function') {
      const hit = col.raycast(this._v4.copy(pos).setY(pos.y + 0.4), new THREE.Vector3(0, -1, 0), 30);
      if (hit) return hit.point.y;
    }
    return Math.max(0, fallbackY);
  }

  /** Point d'atterrissage d'un lancer : devant l'entité, borné par les murs. */
  _throwTarget(entity, range) {
    const origin = entity.eyePosition(this._v1.clone());
    const dir = entity.forwardDir(this._v2.clone());
    let dist = range;
    const col = this._collision();
    if (col && typeof col.raycast === 'function') {
      const hit = col.raycast(origin, dir, range);
      if (hit) dist = Math.max(0.5, hit.distance - 0.5);
    }
    const point = origin.clone().addScaledVector(dir, dist);
    point.y = this._groundYAt(point, entity.position.y);
    return point;
  }

  // ==========================================================================
  // API du contrat
  // ==========================================================================

  /** Remplit entity.abilities depuis entity.agentDef.abilities. */
  setupEntity(entity) {
    if (!entity || !entity.agentDef || !Array.isArray(entity.agentDef.abilities)) return;
    entity.abilities = {};
    entity.agentDef.abilities.forEach((def, slot) => {
      entity.abilities[slot] = {
        def,
        cooldownLeft: 0,
        charges: def.charges ?? 1
      };
    });
    // Drapeaux consommés par les autres systèmes (bots, HUD, combat).
    if (entity.revealedUntil === undefined) entity.revealedUntil = 0;
    if (entity.cloakedUntil === undefined) entity.cloakedUntil = 0;
    if (entity.meleeMult === undefined) entity.meleeMult = 1;
    this._entities.add(entity);
  }

  /**
   * Tente de lancer la capacité du slot (0..2 capacités, 3 = ultime).
   * Vérifie vie / cooldown / charges / jauge d'ultime, exécute l'effet,
   * émet ability:cast. Retourne true si le lancer a eu lieu.
   */
  tryCast(entity, slot) {
    if (!entity || !entity.alive) return false;
    const ab = entity.abilities && entity.abilities[slot];
    if (!ab || !ab.def) return false;

    if (slot === 3) return this._castUltimate(entity, 1);

    if (ab.cooldownLeft > 0) return false;
    if (ab.charges <= 0) {
      this._sfx('dry_fire', entity.position, 0.5);
      return false;
    }
    if (!this._execute(entity, ab.def, 1)) return false;

    ab.charges -= 1;
    ab.cooldownLeft = (ab.def.cooldown || 0) * (entity.statMods.cooldownMult || 1);
    bus.emit('ability:cast', { entity, ability: ab.def, slot });
    this._sfx(this._castSfx(ab.def.type), entity.position);
    return true;
  }

  /**
   * Lancer d'ultime FUSIONNÉ (appelé par mechanics quand 2 alliés castent en
   * synchronisation) : tous les paramètres chiffrés sont amplifiés × multiplier.
   */
  castUltimateFused(entity, multiplier = 1.6) {
    return this._castUltimate(entity, multiplier);
  }

  /** Lancer d'ultime (slot 3). Consomme la jauge, mémorise pour Echo. */
  _castUltimate(entity, multiplier) {
    const ab = entity.abilities && entity.abilities[3];
    if (!ab || !ab.def || !entity.alive || !entity.ultReady) return false;
    if (!this._execute(entity, ab.def, multiplier)) return false;

    entity.ultCharge = 0;
    entity.ultReady = false;
    // Mémoire pour la Réplique Parfaite d'Echo (dernier ultime par équipe).
    this._lastUltByTeam[entity.team] = { def: ab.def, casterId: entity.id };
    bus.emit('ability:cast', { entity, ability: ab.def, slot: 3 });
    this._sfx('ult_cast', entity.position);
    return true;
  }

  /** Avance tous les effets actifs : cooldowns, projectiles, zones, expirations. */
  update(dt) {
    if (dt <= 0) return;
    this._now += dt;

    this._updateCooldowns(dt);
    this._updateDashes(dt);
    this._updateProjectiles(dt);
    this._updatePulls(dt);
    this._updateZones(dt);
    this._updateWalls(dt);
    this._updateWaves(dt);
    this._updateClones(dt);
    this._updateTraps(dt);
    this._updateDrones(dt);
    this._updateTimedMods();
    this._updateShields();
    this._updateCloaks();
    this._updateTransforms();
    this._updateGlobalReveals();
    this._updateDarkness();
    this._updateSlows();
  }

  /**
   * Zones affectant une position (soin / dégâts / ralenti) — consulté par le
   * contrôleur joueur et les bots pour réagir au terrain.
   */
  activeZonesAt(pos) {
    const out = [];
    for (const z of this._zones) {
      if (z.effect !== 'damage' && z.effect !== 'heal' && z.effect !== 'slow') continue;
      if (pos.distanceTo(z.center) <= z.radius) {
        out.push({
          type: z.effect, owner: z.owner, center: z.center, radius: z.radius,
          damagePerSec: z.damagePerSec || 0, healPerSec: z.healPerSec || 0,
          slowMult: z.slowMult || 1
        });
      }
    }
    return out;
  }

  /**
   * Vision bloquée entre a et b ? (fumées + murs de capacité + éclipse).
   * Accepte des Vector3 ou des entités (dans ce cas : position des yeux).
   */
  visionBlockedThrough(a, b) {
    const pa = a && a.isVector3 ? a : (a && a.eyePosition ? a.eyePosition(this._v1) : null);
    const pb = b && b.isVector3 ? b : (b && b.eyePosition ? b.eyePosition(this._v2) : null);
    if (!pa || !pb) return false;

    // Fumées : sphères opaques.
    for (const z of this._zones) {
      if (z.effect !== 'smoke') continue;
      if (this._segmentHitsSphere(pa, pb, z.center, z.radius * 0.92)) return true;
    }
    // Murs de capacité : boîtes orientées.
    for (const w of this._walls) {
      if (this._segmentHitsWall(pa, pb, w)) return true;
    }
    // Éclipse Totale : au-delà de la portée résiduelle, la station est noire.
    if (this._darkness && this._now < this._darkness.until) {
      if (pa.distanceTo(pb) > this._darkness.visionRange) return true;
    }
    return false;
  }

  /** Clones actifs (cibles-leurres pour l'IA). */
  activeClones() {
    return this._clones.map((c) => ({
      position: c.group.position, team: c.owner.team, owner: c.owner,
      hp: c.hp, takeDamage: (dmg) => this._damageClone(c, dmg)
    }));
  }

  // ==========================================================================
  // Dispatch d'exécution
  // ==========================================================================
  _castSfx(type) {
    switch (type) {
      case 'dash': return 'dash';
      case 'teleport': return 'teleport';
      case 'projectile': return 'ability_throw';
      case 'trap': return 'ability_throw';
      default: return 'ability_zone';
    }
  }

  _execute(entity, def, multiplier) {
    const p = this._scaledParams(def.params || {}, multiplier);
    switch (def.type) {
      case 'dash': return this._castDash(entity, p);
      case 'projectile': return this._castProjectile(entity, def, p);
      case 'zone': return this._castZone(entity, p);
      case 'wall': return this._castWall(entity, p);
      case 'heal': return this._castHeal(entity, p);
      case 'vision': return this._castVision(entity, p);
      case 'clone': return this._castClone(entity, p);
      case 'teleport': return this._castTeleport(entity, p);
      case 'shield': return this._castShield(entity, p);
      case 'trap': return this._castTrap(entity, p);
      case 'buff': return this._castBuff(entity, p);
      case 'transform': return this._castTransform(entity, p);
      case 'global': return this._castGlobal(entity, def, p, multiplier);
      default:
        console.warn(`[abilities] type inconnu: ${def.type}`);
        return false;
    }
  }

  /** Copie des params, amplifiée pour la fusion d'ultimes (× multiplier). */
  _scaledParams(params, m) {
    if (m === 1) return params;
    const scale = (obj) => {
      const out = Array.isArray(obj) ? [] : {};
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'mods' && v && typeof v === 'object') {
          // statMods : on amplifie l'écart à 1 (1.25 → 1 + 0.25×m), pas la valeur brute.
          const mods = {};
          for (const [mk, mv] of Object.entries(v)) {
            mods[mk] = mk.endsWith('Mult') ? 1 + (mv - 1) * m : mv * m;
          }
          out[k] = mods;
        } else if (v && typeof v === 'object') {
          out[k] = scale(v);
        } else if (typeof v === 'number' && AMPLIFIED_KEYS.has(k)) {
          out[k] = v * m;
        } else {
          out[k] = v;
        }
      }
      return out;
    };
    return scale(params);
  }

  // ==========================================================================
  // DASH — impulsion de vélocité + traînée fx (simple ou multiple + cape)
  // ==========================================================================
  _castDash(entity, p) {
    const dashes = Math.max(1, Math.round(p.dashes || 1));
    const duration = p.duration || (p.distance && p.speed ? p.distance / p.speed : 0.22);
    const stopTrail = this._fxCall('trail', entity.object3D, entity.agentDef.colors.emissive);
    this._dashes.push({
      entity,
      speed: p.speed || 20,
      dashDuration: duration,
      dashLeft: duration,
      remaining: dashes - 1,
      interval: p.interval || 0.35,
      waitLeft: 0,
      damage: p.damage || 0,
      hitRadius: p.hitRadius || 0,
      hitSet: new Set(),
      dir: this._forwardFlat(entity, new THREE.Vector3()),
      stopTrail: typeof stopTrail === 'function' ? stopTrail : null
    });
    if (p.cloakDuration) this._applyCloak(entity, p.cloakDuration);
    return true;
  }

  _updateDashes(dt) {
    for (let i = this._dashes.length - 1; i >= 0; i--) {
      const d = this._dashes[i];
      const e = d.entity;
      if (!e.alive) { this._endDash(d, i); continue; }

      if (d.waitLeft > 0) {
        // Entre deux piqués de l'Essaim Fantôme : on laisse respirer.
        d.waitLeft -= dt;
        if (d.waitLeft <= 0) {
          d.dashLeft = d.dashDuration;
          d.dir = this._forwardFlat(e, d.dir); // re-visée : on peut zigzaguer
          this._sfx('dash', e.position, 0.8);
        }
        continue;
      }

      // Impulsion : on impose la vélocité horizontale, on adoucit la chute.
      e.velocity.x = d.dir.x * d.speed;
      e.velocity.z = d.dir.z * d.speed;
      if (e.velocity.y < 0) e.velocity.y *= 0.35;

      // Ruée Cornue : dégâts de contact (une fois par ennemi et par charge).
      if (d.damage > 0 && d.hitRadius > 0) {
        for (const foe of this._enemiesOf(e)) {
          if (d.hitSet.has(foe.id)) continue;
          if (foe.position.distanceTo(e.position) <= d.hitRadius + foe.radius) {
            d.hitSet.add(foe.id);
            foe.takeDamage(d.damage * (e.statMods.damageMult || 1), e, 'body');
            this._fxCall('impact', foe.eyePosition(this._v1).clone(), new THREE.Vector3(0, 1, 0), e.agentDef.colors.emissive);
            this._sfx('hit_body', foe.position);
          }
        }
      }

      d.dashLeft -= dt;
      if (d.dashLeft <= 0) {
        if (d.remaining > 0) {
          d.remaining -= 1;
          d.waitLeft = d.interval;
          d.hitSet.clear();
          e.velocity.multiplyScalar(0.3);
        } else {
          e.velocity.x *= 0.4;
          e.velocity.z *= 0.4;
          this._endDash(d, i);
        }
      }
    }
  }

  _endDash(d, index) {
    if (d.stopTrail) d.stopTrail();
    this._dashes.splice(index, 1);
  }

  // ==========================================================================
  // PROJECTILE — balistique, gravité paramétrable, rebonds, explosion → zone
  // ==========================================================================
  _castProjectile(entity, def, p) {
    const color = entity.agentDef.colors.emissive;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111318, emissive: color, emissiveIntensity: 2.2, roughness: 0.4
    });
    const mesh = new THREE.Mesh(GEO.sphereLow, mat);
    mesh.scale.setScalar(0.16);

    const origin = entity.eyePosition(this._v1).clone();
    const dir = entity.forwardDir(this._v2).clone();
    origin.addScaledVector(dir, 0.5);
    mesh.position.copy(origin);
    this._addToScene(mesh);

    this._projectiles.push({
      owner: entity, def, p, mesh, color,
      pos: origin.clone(),
      vel: dir.multiplyScalar(p.speed || 20),
      gravity: p.gravity ?? 10,
      bounces: p.bounces || 0,
      fuse: p.fuse ?? 3,
      radius: 0.16
    });
    return true;
  }

  _updateProjectiles(dt) {
    const col = this._collision();
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const pr = this._projectiles[i];
      pr.fuse -= dt;
      if (pr.fuse <= 0) { this._detonate(pr, i); continue; }

      pr.vel.y -= pr.gravity * dt;
      const move = this._v1.copy(pr.vel).multiplyScalar(dt);
      const dist = move.length();

      // Collision murs (raycast le long du déplacement de la frame).
      let blocked = null;
      if (dist > 1e-6 && col && typeof col.raycast === 'function') {
        blocked = col.raycast(pr.pos, this._v2.copy(move).normalize(), dist + pr.radius);
      }
      if (blocked) {
        if (pr.bounces > 0) {
          // Rebond : réflexion amortie sur la normale du mur.
          pr.bounces -= 1;
          pr.pos.copy(blocked.point).addScaledVector(blocked.normal, pr.radius + 0.02);
          const n = blocked.normal;
          const d = pr.vel.dot(n);
          pr.vel.addScaledVector(n, -2 * d).multiplyScalar(0.55);
          this._sfx('ability_throw', pr.pos, 0.4);
        } else {
          pr.pos.copy(blocked.point);
          this._detonate(pr, i);
          continue;
        }
      } else {
        pr.pos.add(move);
        // Filet de sécurité : sol de la station à y=0 si pas de service collision.
        if (pr.pos.y < 0.05) {
          pr.pos.y = 0.05;
          if (pr.bounces > 0) { pr.bounces -= 1; pr.vel.y = Math.abs(pr.vel.y) * 0.5; pr.vel.x *= 0.7; pr.vel.z *= 0.7; }
          else { this._detonate(pr, i); continue; }
        }
      }

      // Impact direct sur un ennemi (sphère vs cylindre du gabarit).
      let hitEntity = false;
      for (const foe of this._enemiesOf(pr.owner)) {
        const dx = foe.position.x - pr.pos.x;
        const dz = foe.position.z - pr.pos.z;
        const withinY = pr.pos.y > foe.position.y - 0.1 && pr.pos.y < foe.position.y + foe.height + 0.1;
        if (withinY && Math.hypot(dx, dz) < foe.radius + 0.3) {
          this._detonate(pr, i);
          hitEntity = true;
          break;
        }
      }
      if (hitEntity) continue;

      pr.mesh.position.copy(pr.pos);
      pr.mesh.rotation.x += dt * 9;
      pr.mesh.rotation.y += dt * 7;
    }
  }

  /** Détonation : phase d'aspiration éventuelle (Supernova) puis explosion. */
  _detonate(pr, index) {
    this._removeFromScene(pr.mesh);
    pr.mesh.material.dispose();
    this._projectiles.splice(index, 1);

    if (pr.p.pullRadius && pr.p.pullDuration) {
      // Supernova : le vortex aspire d'abord, l'explosion vient ensuite.
      const mat = new THREE.MeshStandardMaterial({
        color: 0x050508, emissive: pr.color, emissiveIntensity: 1.6,
        transparent: true, opacity: 0.45, depthWrite: false
      });
      const mesh = new THREE.Mesh(GEO.sphere, mat);
      mesh.scale.setScalar(pr.p.pullRadius);
      mesh.position.copy(pr.pos);
      this._addToScene(mesh);
      this._pulls.push({
        owner: pr.owner, center: pr.pos.clone(), mesh,
        radius: pr.p.pullRadius, force: pr.p.pullForce || 8,
        timeLeft: pr.p.pullDuration, p: pr.p, color: pr.color
      });
      this._sfx('storm', pr.pos, 0.8);
      return;
    }
    this._explode(pr.owner, pr.pos, pr.p, pr.color);
  }

  _updatePulls(dt) {
    for (let i = this._pulls.length - 1; i >= 0; i--) {
      const pull = this._pulls[i];
      pull.timeLeft -= dt;
      // Aspiration : les ennemis sont tirés vers le cœur du vortex.
      for (const foe of this._enemiesOf(pull.owner)) {
        const toCenter = this._v1.copy(pull.center).sub(foe.position);
        const dist = toCenter.length();
        if (dist < pull.radius && dist > 0.3) {
          toCenter.normalize();
          foe.velocity.addScaledVector(toCenter, pull.force * dt * (1.4 - dist / pull.radius));
          foe.velocity.y += 2.2 * dt; // léger soulèvement, très désagréable
        }
      }
      // Le vortex palpite en se contractant.
      const t = Math.max(0.15, pull.timeLeft / (pull.p.pullDuration || 1));
      pull.mesh.scale.setScalar(pull.radius * (0.4 + 0.6 * t) * (1 + Math.sin(this._now * 18) * 0.05));
      if (pull.timeLeft <= 0) {
        this._removeFromScene(pull.mesh);
        pull.mesh.material.dispose();
        this._pulls.splice(i, 1);
        this._explode(pull.owner, pull.center, pull.p, pull.color);
      }
    }
  }

  /** Explosion radiale : dégâts avec atténuation + zone résiduelle éventuelle. */
  _explode(owner, point, p, color) {
    const radius = p.explosionRadius || 2;
    this._fxCall('explosion', point.clone(), radius, color);
    this._sfx('ability_zone', point);
    if (p.damage > 0) {
      for (const foe of this._enemiesOf(owner)) {
        const d = this._v1.copy(foe.position).setY(foe.position.y + 0.9).distanceTo(point);
        if (d <= radius) {
          const falloff = 1 - (d / radius) * 0.7;
          foe.takeDamage(p.damage * falloff * (owner.statMods.damageMult || 1), owner, 'body');
          // Souffle : petite poussée radiale.
          const push = this._v2.copy(foe.position).sub(point).setY(0.4).normalize();
          foe.velocity.addScaledVector(push, 3.5 * falloff);
        }
      }
    }
    if (p.zone) this._spawnZone(owner, point.clone(), p.zone);
  }

  // ==========================================================================
  // ZONE — sphère translucide pulsante + tick d'effet (dégâts/soin/ralenti/…)
  // ==========================================================================
  _castZone(entity, p) {
    // Vague déferlante (Marée Vive) : traitée comme un front mobile.
    if (p.effect === 'wave' && p.wave) return this._castWave(entity, p);
    const center = p.range
      ? this._throwTarget(entity, p.range)                       // lancé devant soi
      : entity.position.clone();                                 // centré sur soi
    this._spawnZone(entity, center, p);
    return true;
  }

  _spawnZone(owner, center, p) {
    const color = owner.agentDef.colors.emissive;
    const smoke = p.effect === 'smoke';
    const mat = new THREE.MeshStandardMaterial({
      color: smoke ? 0x14161c : 0x0a0c12,
      emissive: smoke ? owner.agentDef.colors.primary : color,
      emissiveIntensity: smoke ? 0.25 : 0.6,
      transparent: true,
      opacity: smoke ? 0.94 : 0.22,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(GEO.sphere, mat);
    mesh.scale.setScalar(0.2);
    mesh.position.copy(center).setY(center.y + (smoke ? p.radius * 0.55 : 0.4));
    this._addToScene(mesh);
    if (smoke) this._fxCall('smokePuff', center.clone());

    const zone = {
      owner, center: mesh.position.clone(), mesh,
      radius: p.radius || 3, duration: p.duration || 4, life: 0,
      effect: p.effect || 'damage',
      damagePerSec: p.damagePerSec || 0,
      healPerSec: p.healPerSec || 0,
      slowMult: p.slowMult || 1,
      tickAccum: 0
    };
    this._zones.push(zone);

    // Dégâts d'éclatement immédiats (Brise-Sol, déflagration psychique d'Echo).
    if (p.burstDamage) {
      this._fxCall('explosion', center.clone(), zone.radius, color);
      for (const foe of this._enemiesOf(owner)) {
        if (foe.position.distanceTo(center) <= zone.radius) {
          foe.takeDamage(p.burstDamage * (owner.statMods.damageMult || 1), owner, 'body');
        }
      }
    }
    return zone;
  }

  _updateZones(dt) {
    const TICK = 0.5; // fréquence des effets périodiques
    for (let i = this._zones.length - 1; i >= 0; i--) {
      const z = this._zones[i];
      z.life += dt;

      // Déploiement + pulsation du dôme.
      const grow = Math.min(1, z.life / 0.35);
      const pulse = 1 + Math.sin(this._now * 4 + i) * 0.04;
      z.mesh.scale.setScalar(Math.max(0.2, z.radius * grow * pulse));
      // Fin de vie : le dôme s'efface.
      const fade = Math.min(1, (z.duration - z.life) / 0.6);
      z.mesh.material.opacity = (z.effect === 'smoke' ? 0.94 : 0.22) * Math.max(0, fade);

      if (z.life >= z.duration) {
        this._removeFromScene(z.mesh);
        z.mesh.material.dispose();
        this._zones.splice(i, 1);
        continue;
      }
      if (z.effect === 'smoke') continue; // la fumée n'a pas de tick, elle aveugle

      z.tickAccum += dt;
      if (z.tickAccum < TICK) continue;
      z.tickAccum -= TICK;

      const nowWall = wallClock();
      for (const e of this._allEntities()) {
        if (!e.alive || e.position.distanceTo(z.center) > z.radius) continue;
        const ally = e.team === z.owner.team;
        if (ally && z.healPerSec > 0 && e.hp < e.maxHp) {
          e.hp = Math.min(e.maxHp, e.hp + z.healPerSec * TICK);
          this._fxCall('impact', e.eyePosition(this._v1).clone(), new THREE.Vector3(0, 1, 0), 0x7dffb0);
        }
        if (!ally) {
          if (z.damagePerSec > 0) {
            e.takeDamage(z.damagePerSec * TICK * (z.owner.statMods.damageMult || 1), z.owner, 'body');
          }
          if (z.slowMult < 1) this._applySlow(e, z.slowMult, TICK + 0.25);
          if (z.effect === 'reveal') e.revealedUntil = Math.max(e.revealedUntil || 0, nowWall + TICK + 0.3);
        }
      }
    }
  }

  // ==========================================================================
  // WALL — boîte solide temporaire (collision si l'API le permet) + vision
  // ==========================================================================
  _castWall(entity, p) {
    const fwd = this._forwardFlat(entity, this._v1);
    const center = entity.position.clone().addScaledVector(fwd, p.distance || 3);
    center.y = this._groundYAt(center, entity.position.y);

    const color = entity.agentDef.colors;
    const mat = new THREE.MeshStandardMaterial({
      color: color.secondary, emissive: color.emissive, emissiveIntensity: 0.5,
      roughness: 0.65, metalness: 0.2
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.width, p.height, p.thickness), mat);
    mesh.position.copy(center).setY(center.y + p.height / 2);
    mesh.rotation.y = entity.yaw; // face au lanceur
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.scale.y = 0.05; // jaillit du sol
    this._addToScene(mesh);
    this._sfx('door', center, 0.8);

    const wall = {
      owner: entity, mesh, timeLeft: p.duration || 8, riseLeft: 0.35,
      half: new THREE.Vector3(p.width / 2, p.height / 2, p.thickness / 2),
      center: mesh.position.clone(),
      quatInv: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, entity.yaw, 0)).invert(),
      touchDamage: p.touchDamage || 0, touchAccum: 0,
      colliderHandle: null
    };

    // Collision physique si le monde de collision expose une API dynamique.
    const col = this._collision();
    if (col) {
      const box = new THREE.Box3().setFromObject(mesh);
      const desc = { min: box.min.toArray(), max: box.max.toArray() };
      for (const fn of ['addCollider', 'addDynamicCollider', 'addBoxCollider']) {
        if (typeof col[fn] === 'function') {
          try { wall.colliderHandle = { remove: col[fn](desc), via: fn }; } catch { /* API incompatible */ }
          break;
        }
      }
    }

    // Rempart Vivant : blindage offert aux alliés proches.
    if (p.teamArmor) {
      for (const ally of this._alliesOf(entity)) {
        if (ally.position.distanceTo(entity.position) <= (p.armorRadius || 8)) {
          ally.armor = Math.min(100, ally.armor + p.teamArmor);
          this._fxCall('shieldBreak', ally.eyePosition(this._v1).clone());
        }
      }
      bus.emit('ui:notification', { text: 'REMPART VIVANT — blindage d\'équipe !', type: 'info', duration: 2.5 });
    }

    this._walls.push(wall);
    return true;
  }

  _updateWalls(dt) {
    for (let i = this._walls.length - 1; i >= 0; i--) {
      const w = this._walls[i];
      w.timeLeft -= dt;
      if (w.riseLeft > 0) {
        w.riseLeft -= dt;
        w.mesh.scale.y = THREE.MathUtils.clamp(1 - w.riseLeft / 0.35, 0.05, 1);
      }
      // Haie d'Épines : lacère qui la frôle.
      if (w.touchDamage > 0) {
        w.touchAccum += dt;
        if (w.touchAccum >= 0.5) {
          w.touchAccum -= 0.5;
          for (const foe of this._enemiesOf(w.owner)) {
            const local = this._v1.copy(foe.position).setY(foe.position.y + 0.9).sub(w.center).applyQuaternion(w.quatInv);
            if (Math.abs(local.x) < w.half.x + 0.6 && Math.abs(local.y) < w.half.y + 0.6 && Math.abs(local.z) < w.half.z + 0.6) {
              foe.takeDamage(w.touchDamage * 0.5 * (w.owner.statMods.damageMult || 1), w.owner, 'legs');
              this._fxCall('impact', foe.position.clone().setY(foe.position.y + 0.7), new THREE.Vector3(0, 1, 0), w.owner.agentDef.colors.emissive);
            }
          }
        }
      }
      if (w.timeLeft <= 0) {
        if (w.colliderHandle && typeof w.colliderHandle.remove === 'function') {
          try { w.colliderHandle.remove(); } catch { /* déjà retiré */ }
        }
        this._removeFromScene(w.mesh);
        w.mesh.geometry.dispose();
        w.mesh.material.dispose();
        this._walls.splice(i, 1);
      }
    }
  }

  // ==========================================================================
  // WAVE — Marée Vive : front d'eau qui soigne les alliés, balaie les ennemis
  // ==========================================================================
  _castWave(entity, p) {
    const w = p.wave;
    const dir = this._forwardFlat(entity, this._v1).clone();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a3038, emissive: entity.agentDef.colors.emissive, emissiveIntensity: 1.2,
      transparent: true, opacity: 0.55, depthWrite: false
    });
    const mesh = new THREE.Mesh(GEO.sphere, mat);
    mesh.scale.set(p.radius, p.radius * 0.45, 1.1);
    mesh.rotation.y = entity.yaw;
    const start = entity.position.clone().addScaledVector(dir, 1.2);
    start.y = this._groundYAt(start, entity.position.y) + p.radius * 0.3;
    mesh.position.copy(start);
    this._addToScene(mesh);
    this._sfx('storm', entity.position, 0.9);

    this._waves.push({
      owner: entity, mesh, dir,
      speed: w.speed || 9, travel: w.travel || 25, traveled: 0,
      radius: p.radius || 5, healAmount: w.healAmount || 40, knockback: w.knockback || 8,
      healed: new Set(), hit: new Set()
    });
    return true;
  }

  _updateWaves(dt) {
    for (let i = this._waves.length - 1; i >= 0; i--) {
      const wv = this._waves[i];
      const step = wv.speed * dt;
      wv.traveled += step;
      wv.mesh.position.addScaledVector(wv.dir, step);
      wv.mesh.position.y += Math.sin(this._now * 6) * 0.02; // houle
      wv.mesh.material.opacity = 0.55 * Math.max(0.2, 1 - wv.traveled / wv.travel);

      for (const e of this._allEntities()) {
        if (!e.alive || e.position.distanceTo(wv.mesh.position) > wv.radius) continue;
        if (e.team === wv.owner.team) {
          if (!wv.healed.has(e.id)) {
            wv.healed.add(e.id);
            e.hp = Math.min(e.maxHp, e.hp + wv.healAmount);
            this._fxCall('impact', e.eyePosition(this._v1).clone(), new THREE.Vector3(0, 1, 0), 0x7dfff2);
            this._sfx('revive', e.position, 0.5);
          }
        } else if (!wv.hit.has(e.id)) {
          wv.hit.add(e.id);
          // Balayé par la marée : projeté dans le sens de la vague.
          e.velocity.addScaledVector(wv.dir, wv.knockback);
          e.velocity.y += wv.knockback * 0.45;
          e.takeDamage(10 * (wv.owner.statMods.damageMult || 1), wv.owner, 'body');
        }
      }

      // La vague se brise sur un mur ou en bout de course.
      const col = this._collision();
      let broken = wv.traveled >= wv.travel;
      if (!broken && col && typeof col.raycast === 'function') {
        broken = !!col.raycast(wv.mesh.position, wv.dir, wv.speed * dt + 0.4);
      }
      if (broken) {
        this._fxCall('smokePuff', wv.mesh.position.clone());
        this._removeFromScene(wv.mesh);
        wv.mesh.material.dispose();
        this._waves.splice(i, 1);
      }
    }
  }

  // ==========================================================================
  // HEAL — instantané (soi / allié blessé le plus proche) ou zone de soin
  // ==========================================================================
  _castHeal(entity, p) {
    if (p.amount) {
      // Injection : soi-même, ou l'allié blessé le plus proche (< 8 m).
      let target = entity;
      if (entity.hp >= entity.maxHp) {
        let best = null, bestD = 8;
        for (const ally of this._alliesOf(entity)) {
          if (ally === entity || ally.hp >= ally.maxHp) continue;
          const d = ally.position.distanceTo(entity.position);
          if (d < bestD) { bestD = d; best = ally; }
        }
        if (best) target = best;
      }
      target.hp = Math.min(target.maxHp, target.hp + p.amount);
      this._fxCall('impact', target.eyePosition(this._v1).clone(), new THREE.Vector3(0, 1, 0), 0x8effb0);
      this._sfx('revive', target.position, 0.6);
      return true;
    }
    // Nuage de soin persistant.
    this._spawnZone(entity, entity.position.clone(), {
      radius: p.radius || 4.5, duration: p.duration || 5,
      effect: 'heal', healPerSec: p.healPerSec || 8
    });
    return true;
  }

  // ==========================================================================
  // VISION — zone de révélation (pose entity.revealedUntil sur les ennemis)
  // ==========================================================================
  _castVision(entity, p) {
    const center = p.forward
      ? this._throwTarget(entity, p.forward)
      : entity.position.clone();
    const zone = this._spawnZone(entity, center, {
      radius: p.radius || 12, duration: p.duration || 4, effect: 'reveal'
    });
    // Apparence de scan : quasi invisible, juste un voile technologique.
    zone.mesh.material.opacity = 0.06;
    zone.mesh.material.emissiveIntensity = 1.4;
    // Révélation immédiate au lancer (le tick prend le relais ensuite).
    const nowWall = wallClock();
    for (const foe of this._enemiesOf(entity)) {
      if (foe.position.distanceTo(center) <= (p.radius || 12)) {
        foe.revealedUntil = Math.max(foe.revealedUntil || 0, nowWall + (p.duration || 4));
      }
    }
    return true;
  }

  // ==========================================================================
  // CLONE — doublures qui avancent et attirent les tirs (± convergence)
  // ==========================================================================
  _castClone(entity, p) {
    const count = Math.max(1, Math.round(p.count || 1));
    const fwd = this._forwardFlat(entity, this._v1).clone();

    // Point de convergence : l'ennemi vivant le plus proche, sinon droit devant.
    let target = entity.position.clone().addScaledVector(fwd, 9);
    if (p.converge) {
      let best = null, bestD = Infinity;
      for (const foe of this._enemiesOf(entity)) {
        const d = foe.position.distanceTo(entity.position);
        if (d < bestD) { bestD = d; best = foe; }
      }
      if (best) target = best.position.clone();
    }

    for (let k = 0; k < count; k++) {
      const group = new THREE.Group();
      let start;
      if (p.converge && count > 1) {
        // Opéra des Lames : en cercle autour de la cible, convergence dansante.
        const angle = (k / count) * Math.PI * 2 + entity.yaw;
        start = target.clone().add(new THREE.Vector3(Math.cos(angle) * (p.spread || 6), 0, Math.sin(angle) * (p.spread || 6)));
      } else {
        start = entity.position.clone()
          .addScaledVector(fwd, 0.8)
          .add(new THREE.Vector3(Math.cos(entity.yaw) * (k - (count - 1) / 2) * 1.2, 0, -Math.sin(entity.yaw) * (k - (count - 1) / 2) * 1.2));
      }
      start.y = this._groundYAt(start, entity.position.y);
      group.position.copy(start);
      this._addToScene(group);
      this._fxCall('teleportFlash', start.clone());

      const clone = {
        owner: entity, group, mixer: null,
        target: target.clone(), converge: !!p.converge,
        dir: p.converge ? target.clone().sub(start).setY(0).normalize() : fwd.clone(),
        speed: p.speed || 3.2, timeLeft: p.duration || 6,
        contactDamage: p.contactDamage || 0, hitCooldown: new Map(),
        hp: 60, dead: false
      };
      this._clones.push(clone);
      this._buildCloneVisual(clone);
    }
    return true;
  }

  /** Charge le vrai modèle de l'agent (translucide) ; capsule stylisée sinon. */
  _buildCloneVisual(clone) {
    const colors = clone.owner.agentDef.colors;
    const makeFallback = () => {
      if (clone.dead) return;
      const mat = new THREE.MeshStandardMaterial({
        color: colors.primary, emissive: colors.emissive, emissiveIntensity: 0.9,
        transparent: true, opacity: 0.55
      });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.0, 4, 10), mat);
      body.position.y = 0.9;
      clone.group.add(body);
    };
    const assets = this._assets();
    if (!assets) { makeFallback(); return; }
    assets.instantiate(modelPathForAgent(clone.owner.agentDef.id)).then(({ root, animations }) => {
      if (clone.dead) return;
      root.traverse((o) => {
        if (o.isMesh && o.material && !Array.isArray(o.material)) {
          const m = o.material.clone();
          m.transparent = true;
          m.opacity = 0.55;
          m.emissive = new THREE.Color(colors.emissive);
          m.emissiveIntensity = 0.6;
          o.material = m;
        }
      });
      clone.group.add(root);
      const runClip = animations.find((c) => c.name === 'run') || animations[0];
      if (runClip) {
        clone.mixer = new THREE.AnimationMixer(root);
        clone.mixer.clipAction(runClip).play();
      }
    }).catch(() => makeFallback());
  }

  _updateClones(dt) {
    for (let i = this._clones.length - 1; i >= 0; i--) {
      const c = this._clones[i];
      c.timeLeft -= dt;
      if (c.timeLeft <= 0 || c.hp <= 0) { this._removeClone(c, i); continue; }

      // Déplacement : convergence vers la cible ou marche en ligne.
      if (c.converge) {
        const to = this._v1.copy(c.target).sub(c.group.position).setY(0);
        if (to.lengthSq() > 0.5) c.dir.copy(to.normalize());
      }
      const col = this._collision();
      if (col && typeof col.moveCapsule === 'function') {
        const vel = this._v2.set(c.dir.x * c.speed, -4, c.dir.z * c.speed);
        const res = col.moveCapsule(c.group.position, vel, dt, 0.35, 1.7, {});
        if (res && res.position) c.group.position.copy(res.position);
      } else {
        c.group.position.addScaledVector(c.dir, c.speed * dt);
      }
      c.group.rotation.y = Math.atan2(-c.dir.x, -c.dir.z);
      if (c.mixer) c.mixer.update(dt);

      // Lames dansantes : lacèrent les ennemis frôlés (1 coup / 0.8 s / cible).
      if (c.contactDamage > 0) {
        for (const foe of this._enemiesOf(c.owner)) {
          if (foe.position.distanceTo(c.group.position) > 1.3) continue;
          const last = c.hitCooldown.get(foe.id) || -Infinity;
          if (this._now - last < 0.8) continue;
          c.hitCooldown.set(foe.id, this._now);
          foe.takeDamage(c.contactDamage * (c.owner.statMods.damageMult || 1), c.owner, 'body');
          this._fxCall('impact', foe.eyePosition(this._v1).clone(), new THREE.Vector3(0, 1, 0), c.owner.agentDef.colors.emissive);
          this._sfx('hit_body', foe.position);
        }
      }
    }
  }

  _damageClone(clone, dmg) {
    clone.hp -= dmg;
    if (clone.hp <= 0) {
      const idx = this._clones.indexOf(clone);
      if (idx >= 0) this._removeClone(clone, idx);
    }
  }

  _removeClone(c, index) {
    c.dead = true;
    this._fxCall('teleportFlash', c.group.position.clone());
    this._removeFromScene(c.group);
    this._clones.splice(index, 1);
  }

  // ==========================================================================
  // TELEPORT — flash + déplacement validé par la collision
  // ==========================================================================
  _castTeleport(entity, p) {
    const origin = entity.eyePosition(this._v1).clone();
    const dir = this._forwardFlat(entity, this._v2).clone();
    let dist = p.distance || 8;

    const col = this._collision();
    if (col && typeof col.raycast === 'function') {
      const hit = col.raycast(origin, dir, dist + entity.radius);
      if (hit) dist = Math.max(0.6, hit.distance - entity.radius - 0.2);
    }
    const target = entity.position.clone().addScaledVector(dir, dist);
    target.y = this._groundYAt(this._v3.copy(target).setY(target.y + 1.2), entity.position.y);

    this._fxCall('teleportFlash', entity.position.clone().setY(entity.position.y + 0.9));
    entity.position.copy(target);
    entity.velocity.set(0, 0, 0);
    this._fxCall('teleportFlash', target.clone().setY(target.y + 0.9));
    this._sfx('teleport', target);
    return true;
  }

  // ==========================================================================
  // SHIELD — bouclier temporaire (soi ± alliés proches), reliquat retiré
  // ==========================================================================
  _castShield(entity, p) {
    const targets = p.radius
      ? this._alliesOf(entity).filter((a) => a.position.distanceTo(entity.position) <= p.radius)
      : [entity];
    for (const t of targets) {
      t.shield += p.amount;
      this._shields.push({ entity: t, amount: p.amount, until: this._now + (p.duration || 6) });
      this._fxCall('shieldBreak', t.eyePosition(this._v1).clone());
    }
    return targets.length > 0;
  }

  _updateShields() {
    for (let i = this._shields.length - 1; i >= 0; i--) {
      const s = this._shields[i];
      if (this._now < s.until) continue;
      // On retire ce qu'il reste du bouclier accordé (les dégâts ont pu l'entamer).
      s.entity.shield = Math.max(0, s.entity.shield - s.amount);
      this._shields.splice(i, 1);
    }
  }

  // ==========================================================================
  // TRAP — déclencheur de proximité (armement, dégâts + entrave)
  // ==========================================================================
  _castTrap(entity, p) {
    const fwd = this._forwardFlat(entity, this._v1);
    const pos = entity.position.clone().addScaledVector(fwd, 1.6);
    pos.y = this._groundYAt(pos, entity.position.y) + 0.05;

    const colors = entity.agentDef.colors;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x101216, emissive: colors.emissive, emissiveIntensity: 0.4,
      transparent: true, opacity: 0.85
    });
    const mesh = new THREE.Mesh(GEO.ringDisc, mat);
    mesh.scale.set(p.radius * 0.5, 1, p.radius * 0.5);
    mesh.position.copy(pos);
    this._addToScene(mesh);

    this._traps.push({
      owner: entity, mesh, pos,
      radius: p.radius || 2.5, armLeft: p.armTime || 1,
      damage: p.damage || 25, slowMult: p.slowMult || 0.4, slowDuration: p.slowDuration || 3,
      lifeLeft: p.lifetime || 45
    });
    return true;
  }

  _updateTraps(dt) {
    for (let i = this._traps.length - 1; i >= 0; i--) {
      const t = this._traps[i];
      t.lifeLeft -= dt;
      if (t.lifeLeft <= 0) { this._removeTrap(t, i); continue; }

      if (t.armLeft > 0) {
        t.armLeft -= dt;
        t.mesh.material.emissiveIntensity = 0.3; // encore inerte
        continue;
      }
      // Armé : lueur battante, à peine visible pour un œil pressé.
      t.mesh.material.emissiveIntensity = 0.7 + Math.sin(this._now * 6) * 0.5;

      for (const foe of this._enemiesOf(t.owner)) {
        if (foe.position.distanceTo(t.pos) > t.radius) continue;
        // Déclenchement !
        foe.takeDamage(t.damage * (t.owner.statMods.damageMult || 1), t.owner, 'legs');
        this._applySlow(foe, t.slowMult, t.slowDuration);
        this._fxCall('explosion', t.pos.clone(), t.radius, t.owner.agentDef.colors.emissive);
        this._sfx('ability_zone', t.pos);
        this._removeTrap(t, i);
        break;
      }
    }
  }

  _removeTrap(t, index) {
    this._removeFromScene(t.mesh);
    t.mesh.material.dispose();
    this._traps.splice(index, 1);
  }

  // ==========================================================================
  // BUFF — statMods temporaires (± rayon d'équipe, cape, bouclier bonus)
  // ==========================================================================
  _castBuff(entity, p) {
    const targets = p.radius
      ? this._alliesOf(entity).filter((a) => a.position.distanceTo(entity.position) <= p.radius)
      : [entity];
    for (const t of targets) {
      if (p.mods) this._applyTimedMods(t, p.mods, p.duration || 5);
      if (p.shieldAmount) {
        t.shield += p.shieldAmount;
        this._shields.push({ entity: t, amount: p.shieldAmount, until: this._now + (p.duration || 5) });
      }
      if (p.cloak) this._applyCloak(t, p.duration || 5);
      this._fxCall('evolutionBurst', t);
    }
    return targets.length > 0;
  }

  /** Applique des statMods avec expiration propre (revert exact). */
  _applyTimedMods(entity, mods, duration) {
    entity.applyStatMods(mods);
    this._timedMods.push({ entity, mods, until: this._now + duration });
  }

  _revertMods(entity, mods) {
    const inverse = {};
    for (const [k, v] of Object.entries(mods)) {
      inverse[k] = k.endsWith('Mult') ? (v !== 0 ? 1 / v : 1) : -v;
    }
    entity.applyStatMods(inverse);
    if (entity.hp > entity.maxHp) entity.hp = entity.maxHp;
  }

  _updateTimedMods() {
    for (let i = this._timedMods.length - 1; i >= 0; i--) {
      const b = this._timedMods[i];
      if (this._now < b.until) continue;
      this._revertMods(b.entity, b.mods);
      this._timedMods.splice(i, 1);
    }
  }

  // --- Ralentissements (anti-cumul : le plus fort gagne, durée prolongée) ---
  _applySlow(entity, mult, duration) {
    const existing = this._slows.get(entity.id);
    if (existing) {
      if (mult < existing.mult) {
        // Nouveau ralenti plus fort : on remplace proprement.
        this._revertMods(entity, { speedMult: existing.mult });
        entity.applyStatMods({ speedMult: mult });
        existing.mult = mult;
      }
      existing.until = Math.max(existing.until, this._now + duration);
      return;
    }
    entity.applyStatMods({ speedMult: mult });
    this._slows.set(entity.id, { entity, mult, until: this._now + duration });
  }

  _updateSlows() {
    for (const [id, s] of this._slows) {
      if (this._now < s.until && s.entity.alive) continue;
      this._revertMods(s.entity, { speedMult: s.mult });
      this._slows.delete(id);
    }
  }

  // --- Invisibilité (échange de matériaux, restaurés à l'expiration) ---
  _applyCloak(entity, duration) {
    // Déjà invisible : on prolonge simplement.
    const existing = this._cloaks.find((c) => c.entity === entity);
    if (existing) { existing.until = Math.max(existing.until, this._now + duration); return; }

    const saved = [];
    entity.object3D.traverse((o) => {
      if (o.isMesh && o.material && !Array.isArray(o.material)) {
        saved.push({ mesh: o, material: o.material });
        const ghost = o.material.clone();
        ghost.transparent = true;
        ghost.opacity = 0.14;
        ghost.depthWrite = false;
        o.material = ghost;
      }
    });
    entity.cloakedUntil = wallClock() + duration;
    this._cloaks.push({ entity, until: this._now + duration, saved });
    this._fxCall('teleportFlash', entity.position.clone().setY(entity.position.y + 0.9));
  }

  _updateCloaks() {
    for (let i = this._cloaks.length - 1; i >= 0; i--) {
      const c = this._cloaks[i];
      if (this._now < c.until && c.entity.alive) continue;
      for (const { mesh, material } of c.saved) {
        if (mesh.material && mesh.material !== material) mesh.material.dispose();
        mesh.material = material;
      }
      c.entity.cloakedUntil = 0;
      this._cloaks.splice(i, 1);
    }
  }

  // ==========================================================================
  // TRANSFORM — Avatar de Rage : échelle du rig + statMods + mêlée boostée
  // ==========================================================================
  _castTransform(entity, p) {
    // Une seule transformation à la fois.
    if (this._transforms.some((t) => t.entity === entity)) return false;

    const mods = { damageMult: p.damageMult || 1.3, speedMult: p.speedMult || 1.1, hpBonus: p.hpBonus || 0 };
    entity.applyStatMods(mods);
    entity.hp = Math.min(entity.maxHp, entity.hp + (p.hpBonus || 0)); // le colosse gagne sa nouvelle chair
    entity.meleeMult = p.meleeMult || 2;
    entity.object3D.scale.multiplyScalar(p.scale || 1.3);

    this._transforms.push({ entity, mods, scale: p.scale || 1.3, until: this._now + (p.duration || 10) });
    this._fxCall('evolutionBurst', entity);
    this._fxCall('explosion', entity.position.clone().setY(entity.position.y + 1), 3, entity.agentDef.colors.emissive);
    this._sfx('storm', entity.position, 0.9);
    bus.emit('ui:notification', { text: `${entity.name} se TRANSFORME !`, type: 'warn', duration: 2.5 });
    return true;
  }

  _updateTransforms() {
    for (let i = this._transforms.length - 1; i >= 0; i--) {
      const t = this._transforms[i];
      if (this._now < t.until && t.entity.alive) continue;
      // Réversion : échelle, statMods, mêlée.
      t.entity.object3D.scale.multiplyScalar(1 / t.scale);
      this._revertMods(t.entity, t.mods);
      t.entity.meleeMult = 1;
      this._fxCall('teleportFlash', t.entity.position.clone().setY(t.entity.position.y + 0.9));
      this._transforms.splice(i, 1);
    }
  }

  // ==========================================================================
  // GLOBAL — effets à l'échelle de la station (révélation, éclipse, mimique)
  // ==========================================================================
  _castGlobal(entity, def, p, multiplier) {
    switch (p.effect) {
      case 'reveal': return this._castGlobalReveal(entity, p);
      case 'darkness': return this._castDarkness(entity, p);
      case 'mimic': return this._castMimic(entity, p, multiplier);
      default: return false;
    }
  }

  /** Protocole Basilic : marque tous les ennemis + drones de chasse autonomes. */
  _castGlobalReveal(entity, p) {
    this._globalReveals.push({ owner: entity, until: this._now + (p.duration || 8) });
    bus.emit('ui:notification', { text: 'PROTOCOLE BASILIC — vous êtes marqués.', type: 'warn', duration: 3 });
    this._sfx('notification', undefined, 0.8);

    const count = Math.max(0, Math.round(p.droneCount || 0));
    for (let k = 0; k < count; k++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x15171c, emissive: entity.agentDef.colors.emissive, emissiveIntensity: 2, roughness: 0.3
      });
      const mesh = new THREE.Mesh(GEO.octa, mat);
      const angle = (k / count) * Math.PI * 2;
      mesh.position.copy(entity.position)
        .add(new THREE.Vector3(Math.cos(angle) * 1.2, 1.8 + k * 0.3, Math.sin(angle) * 1.2));
      this._addToScene(mesh);
      this._drones.push({
        owner: entity, mesh, target: null, retargetIn: 0,
        speed: p.droneSpeed || 9, damage: p.droneDamage || 9,
        zapCooldown: 0, timeLeft: p.droneDuration || 12, bobPhase: k * 2.1
      });
    }
    return true;
  }

  _updateGlobalReveals() {
    const nowWall = wallClock();
    for (let i = this._globalReveals.length - 1; i >= 0; i--) {
      const r = this._globalReveals[i];
      if (this._now >= r.until) { this._globalReveals.splice(i, 1); continue; }
      for (const foe of this._enemiesOf(r.owner)) {
        foe.revealedUntil = Math.max(foe.revealedUntil || 0, nowWall + 0.6);
      }
    }
  }

  _updateDrones(dt) {
    for (let i = this._drones.length - 1; i >= 0; i--) {
      const d = this._drones[i];
      d.timeLeft -= dt;
      if (d.timeLeft <= 0 || !d.owner.alive) {
        this._fxCall('teleportFlash', d.mesh.position.clone());
        this._removeFromScene(d.mesh);
        d.mesh.material.dispose();
        this._drones.splice(i, 1);
        continue;
      }
      // Re-ciblage périodique : l'ennemi vivant le plus proche du drone.
      d.retargetIn -= dt;
      if (d.retargetIn <= 0 || !d.target || !d.target.alive) {
        d.retargetIn = 0.6;
        let best = null, bestD = Infinity;
        for (const foe of this._enemiesOf(d.owner)) {
          const dist = foe.position.distanceTo(d.mesh.position);
          if (dist < bestD) { bestD = dist; best = foe; }
        }
        d.target = best;
      }
      if (d.target) {
        const goal = d.target.eyePosition(this._v1);
        const to = this._v2.copy(goal).sub(d.mesh.position);
        const dist = to.length();
        if (dist > 1.1) {
          d.mesh.position.addScaledVector(to.normalize(), Math.min(d.speed * dt, dist - 1));
        } else {
          // À portée : décharge électrique périodique.
          d.zapCooldown -= dt;
          if (d.zapCooldown <= 0) {
            d.zapCooldown = 0.8;
            d.target.takeDamage(d.damage * (d.owner.statMods.damageMult || 1), d.owner, 'body');
            this._fxCall('impact', goal.clone(), new THREE.Vector3(0, 1, 0), d.owner.agentDef.colors.emissive);
            this._sfx('hit_body', d.target.position, 0.6);
          }
        }
      }
      // Vol nerveux de machine de chasse.
      d.mesh.position.y += Math.sin(this._now * 5 + d.bobPhase) * 0.01;
      d.mesh.rotation.y += dt * 4;
      d.mesh.rotation.x = Math.sin(this._now * 3 + d.bobPhase) * 0.3;
    }
  }

  /** Éclipse Totale : la station s'éteint, seule l'équipe d'Umbra voit encore. */
  _castDarkness(entity, p) {
    if (this._darkness) this._restoreAtmosphere(); // une éclipse remplace l'autre
    this._darkness = {
      team: entity.team,
      until: this._now + (p.duration || 9),
      visionRange: p.visionRange || 8
    };
    const engine = this._engine();
    if (engine) {
      const scene = engine.scene;
      this._savedAtmosphere = { fog: scene.fog, background: scene.background };
      // Le joueur allié de l'éclipse garde une pénombre lisible ; l'ennemi est aveugle.
      const player = registry.get('player');
      const playerTeam = player && player.entity ? player.entity.team
        : (this._match() && this._match().playerEntity ? this._match().playerEntity.team : TEAM_XENOS);
      const allied = playerTeam === entity.team;
      scene.fog = new THREE.FogExp2(0x020208, allied ? 0.035 : 0.16);
      scene.background = new THREE.Color(0x010104);
    }
    // Les alliés d'Umbra voient les silhouettes ennemies à travers la nuit.
    const nowWall = wallClock();
    for (const foe of this._enemiesOf(entity)) {
      foe.revealedUntil = Math.max(foe.revealedUntil || 0, nowWall + (p.duration || 9));
    }
    bus.emit('ui:notification', { text: 'ÉCLIPSE TOTALE — la station s\'éteint.', type: 'warn', duration: 3 });
    this._sfx('storm', undefined, 1);
    return true;
  }

  _updateDarkness() {
    if (!this._darkness) return;
    if (this._now >= this._darkness.until) {
      this._restoreAtmosphere();
      this._darkness = null;
      bus.emit('ui:notification', { text: 'La lumière revient sur Nova Bastion.', type: 'info', duration: 2 });
    }
  }

  _restoreAtmosphere() {
    const engine = this._engine();
    if (engine && this._savedAtmosphere) {
      engine.scene.fog = this._savedAtmosphere.fog;
      engine.scene.background = this._savedAtmosphere.background;
    }
    this._savedAtmosphere = null;
  }

  /** Réplique Parfaite : rejoue le dernier ultime ennemi ; sinon déflagration. */
  _castMimic(entity, p, multiplier) {
    const enemyTeam = entity.team === TEAM_XENOS ? TEAM_GUARDIANS : TEAM_XENOS;
    let memory = this._lastUltByTeam[enemyTeam];
    // À défaut d'ultime ennemi, Echo imite le dernier ultime allié qui n'est pas le sien.
    if (!memory) {
      const own = this._lastUltByTeam[entity.team];
      if (own && own.casterId !== entity.id) memory = own;
    }
    if (memory && memory.def && memory.def.params && memory.def.params.effect !== 'mimic') {
      bus.emit('ui:notification', { text: `Echo réplique « ${memory.def.name} » !`, type: 'info', duration: 2.5 });
      return this._execute(entity, memory.def, multiplier);
    }
    // Rien à copier : déflagration psychique de repli.
    if (p.fallback) {
      this._spawnZone(entity, entity.position.clone(), p.fallback);
      bus.emit('ui:notification', { text: 'Echo libère une déflagration psychique !', type: 'info', duration: 2.5 });
      return true;
    }
    return false;
  }

  // ==========================================================================
  // Cooldowns & maintenance
  // ==========================================================================
  _updateCooldowns(dt) {
    for (const entity of this._entities) {
      if (!entity.abilities) continue;
      for (const [slot, ab] of Object.entries(entity.abilities)) {
        if (!ab || Number(slot) === 3 || ab.cooldownLeft <= 0) continue;
        ab.cooldownLeft -= dt;
        if (ab.cooldownLeft <= 0) {
          ab.cooldownLeft = 0;
          if (ab.charges > 0) bus.emit('ability:ready', { entity, slot: Number(slot) });
        }
      }
    }
  }

  /** Purge tous les effets transitoires (fin de round / de match). */
  _clearTransient() {
    for (const pr of this._projectiles) { this._removeFromScene(pr.mesh); pr.mesh.material.dispose(); }
    this._projectiles.length = 0;
    for (const pu of this._pulls) { this._removeFromScene(pu.mesh); pu.mesh.material.dispose(); }
    this._pulls.length = 0;
    for (const z of this._zones) { this._removeFromScene(z.mesh); z.mesh.material.dispose(); }
    this._zones.length = 0;
    for (const w of this._walls) {
      if (w.colliderHandle && typeof w.colliderHandle.remove === 'function') {
        try { w.colliderHandle.remove(); } catch { /* déjà retiré */ }
      }
      this._removeFromScene(w.mesh);
      w.mesh.geometry.dispose();
      w.mesh.material.dispose();
    }
    this._walls.length = 0;
    for (const wv of this._waves) { this._removeFromScene(wv.mesh); wv.mesh.material.dispose(); }
    this._waves.length = 0;
    for (const c of this._clones) { c.dead = true; this._removeFromScene(c.group); }
    this._clones.length = 0;
    for (const t of this._traps) { this._removeFromScene(t.mesh); t.mesh.material.dispose(); }
    this._traps.length = 0;
    for (const d of this._drones) { this._removeFromScene(d.mesh); d.mesh.material.dispose(); }
    this._drones.length = 0;
    for (const d of this._dashes) { if (d.stopTrail) d.stopTrail(); }
    this._dashes.length = 0;

    // Réversion propre de tous les modificateurs temporaires.
    for (const b of this._timedMods) this._revertMods(b.entity, b.mods);
    this._timedMods.length = 0;
    for (const [, s] of this._slows) this._revertMods(s.entity, { speedMult: s.mult });
    this._slows.clear();
    for (const s of this._shields) s.entity.shield = Math.max(0, s.entity.shield - s.amount);
    this._shields.length = 0;
    for (const c of this._cloaks) {
      for (const { mesh, material } of c.saved) {
        if (mesh.material && mesh.material !== material) mesh.material.dispose();
        mesh.material = material;
      }
      c.entity.cloakedUntil = 0;
    }
    this._cloaks.length = 0;
    for (const t of this._transforms) {
      t.entity.object3D.scale.multiplyScalar(1 / t.scale);
      this._revertMods(t.entity, t.mods);
      t.entity.meleeMult = 1;
    }
    this._transforms.length = 0;
    this._globalReveals.length = 0;
    if (this._darkness) { this._restoreAtmosphere(); this._darkness = null; }
  }

  // ==========================================================================
  // Géométrie : intersections segment / sphère et segment / boîte orientée
  // ==========================================================================
  _segmentHitsSphere(a, b, center, radius) {
    const ab = this._v3.copy(b).sub(a);
    const len2 = ab.lengthSq();
    let t = 0;
    if (len2 > 1e-8) {
      t = THREE.MathUtils.clamp(this._v4.copy(center).sub(a).dot(ab) / len2, 0, 1);
    }
    const closest = this._v4.copy(a).addScaledVector(ab, t);
    return closest.distanceToSquared(center) <= radius * radius;
  }

  _segmentHitsWall(a, b, wall) {
    // Passage dans le repère local du mur (rotation yaw uniquement).
    const la = this._v3.copy(a).sub(wall.center).applyQuaternion(wall.quatInv);
    const lb = this._v4.copy(b).sub(wall.center).applyQuaternion(wall.quatInv);
    return this._segmentHitsAABB(la, lb, wall.half);
  }

  /** Test segment vs AABB centrée à l'origine (méthode des slabs). */
  _segmentHitsAABB(la, lb, half) {
    let tmin = 0, tmax = 1;
    const d = { x: lb.x - la.x, y: lb.y - la.y, z: lb.z - la.z };
    for (const axis of ['x', 'y', 'z']) {
      const o = la[axis], dd = d[axis], h = half[axis];
      if (Math.abs(dd) < 1e-8) {
        if (o < -h || o > h) return false;
      } else {
        let t1 = (-h - o) / dd;
        let t2 = (h - o) / dd;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return false;
      }
    }
    return true;
  }
}
