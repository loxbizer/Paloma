// Entité de combat — modèle commun joueur/bots, découplé du rendu.
import * as THREE from 'three';
import { bus } from '../core/events.js';
import { PLAYER } from './constants.js';

let NEXT_ID = 1;

export class CombatEntity {
  constructor({ name, team, agentDef, isPlayer = false, isBot = false }) {
    this.id = NEXT_ID++;
    this.name = name;
    this.team = team;
    this.agentDef = agentDef;
    this.isPlayer = isPlayer;
    this.isBot = isBot;

    this.maxHp = PLAYER.MAX_HP;
    this.hp = this.maxHp;
    this.armor = 0;
    this.shield = 0;             // bouclier temporaire (momentum / capacités)
    this.alive = true;
    this.downedAt = -1;          // horodatage de mort (fenêtre de réanimation)
    this.revivedThisRound = false;

    // Cinématique / physique
    this.object3D = new THREE.Group();
    this.object3D.name = `entity_${this.id}_${name}`;
    this.position = this.object3D.position;
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = PLAYER.RADIUS;
    this.height = PLAYER.HEIGHT;
    this.crouching = false;
    this.onGround = true;

    // Combat
    this.inventory = { primary: null, secondary: 'stinger_p', melee: 'blade' };
    this.currentSlot = 'secondary';
    this.ammo = {};              // weaponId -> { mag, reserve }
    this.credits = 0;

    // Capacités (rempli par agents/agent.js) : slot -> { def, cooldownLeft, charges }
    this.abilities = {};
    this.ultCharge = 0;
    this.ultReady = false;

    // Progression en match
    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;
    this.evolutionPoints = 0;
    this.evolutionLevel = 0;

    // Modificateurs (P2W boosters + évolution + aura) — multiplicatifs.
    this.statMods = {
      damageMult: 1,
      speedMult: 1,
      cooldownMult: 1,
      hpBonus: 0,
      armorBonus: 0,
      ultChargeMult: 1
    };
    this.lastDamageFrom = null;
  }

  get eyeHeight() {
    return this.crouching ? 1.1 : 1.62;
  }

  eyePosition(target = new THREE.Vector3()) {
    return target.copy(this.position).setY(this.position.y + this.eyeHeight);
  }

  forwardDir(target = new THREE.Vector3()) {
    // yaw=0 → regarde vers -Z (convention caméra three.js)
    const cp = Math.cos(this.pitch);
    return target.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
  }

  applyStatMods(mods) {
    for (const [k, v] of Object.entries(mods)) {
      if (k.endsWith('Mult')) this.statMods[k] *= v;
      else this.statMods[k] += v;
    }
    this.maxHp = PLAYER.MAX_HP + this.statMods.hpBonus;
  }

  takeDamage(amount, source, part = 'body') {
    if (!this.alive) return 0;
    let dmg = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
    }
    if (this.armor > 0 && dmg > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.5);
      this.armor -= absorbed;
      dmg -= absorbed;
    }
    this.hp -= dmg;
    this.lastDamageFrom = source || null;
    bus.emit('entity:damaged', { entity: this, amount: dmg, source, part });
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(source, part === 'head');
    }
    return dmg;
  }

  die(killer, headshot = false) {
    if (!this.alive) return;
    this.alive = false;
    this.deaths++;
    this.downedAt = performance.now() / 1000;
    if (killer && killer !== this) killer.kills++;
    const weapon = killer ? (killer.inventory[killer.currentSlot] || 'blade') : null;
    bus.emit('entity:died', { entity: this, killer, weapon, headshot });
  }

  revive(by) {
    if (this.alive) return;
    this.alive = true;
    this.hp = Math.round(this.maxHp * 0.4);
    this.revivedThisRound = true;
    bus.emit('entity:revived', { entity: this, by });
  }

  /** Réinitialisation en début de round (garde armes achetées, monnaies, évolution). */
  resetForRound() {
    this.maxHp = PLAYER.MAX_HP + this.statMods.hpBonus;
    this.hp = this.maxHp;
    this.alive = true;
    this.shield = 0;
    this.revivedThisRound = false;
    this.velocity.set(0, 0, 0);
    if (this.statMods.armorBonus > 0) {
      this.armor = Math.max(this.armor, this.statMods.armorBonus);
    }
    for (const ab of Object.values(this.abilities)) {
      if (ab) { ab.cooldownLeft = 0; ab.charges = ab.def ? (ab.def.charges ?? 1) : 1; }
    }
  }

  addUltCharge(points) {
    if (this.ultReady) return;
    this.ultCharge += points * this.statMods.ultChargeMult;
    if (this.ultCharge >= 100) {
      this.ultCharge = 100;
      this.ultReady = true;
      bus.emit('ult:charged', { entity: this });
    }
  }
}
