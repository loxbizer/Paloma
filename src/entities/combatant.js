import * as THREE from 'three'
import { buildCharacter, animateCharacter } from '../world/character.js'
import { WEAPONS } from '../game/roster.js'

// A Combatant = anyone with a body, health, and a weapon: the player, allied
// bots, and enemy bots all share this. Handles collision, health/armor,
// position history (for the rewind ability), and drives its animation rig.
export class Combatant {
  constructor({ scene, agent, team, color, isPlayer = false, alien = true }) {
    this.scene = scene
    this.agent = agent
    this.team = team
    this.color = color
    this.isPlayer = isPlayer
    this.maxHp = 100
    this.hp = 100
    this.armor = 50
    this.alive = true
    this.position = new THREE.Vector3()
    this.velocity = new THREE.Vector3()
    this.yaw = 0
    this.pitch = 0
    this.weapon = { ...WEAPONS.rifle, tint: color }
    this.ammo = this.weapon.mag
    this.reserve = this.weapon.mag * 3
    this.fireCooldown = 0
    this.reloadT = 0
    this.buffs = { damageMult: 1, overchargeT: 0, slowed: 0 }
    this.history = [] // [{pos, hp}] snapshots ~2s back
    this._histT = 0
    this.abilityCd = 0
    this.abilityCharge = 100 // ability energy
    this.shootT = 0
    this.dancing = false
    this.animT = Math.random() * 10

    if (!isPlayer) {
      this.model = buildCharacter({ color, alien })
      scene.add(this.model)
      // A simple hit proxy for raycasting (torso+head volume).
      this.hitProxy = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.9, 0.5),
        new THREE.MeshBasicMaterial({ visible: false })
      )
      this.model.add(this.hitProxy)
      this.hitProxy.position.y = 1
      // Reveal outline (for hive vision).
      this.outline = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 2.1, 0.7),
        new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0, wireframe: true })
      )
      this.outline.position.y = 1
      this.model.add(this.outline)
    } else {
      this.model = new THREE.Group() // player body is invisible (first person)
      this.hitProxy = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.5), new THREE.MeshBasicMaterial({ visible: false }))
      this.hitProxy.position.y = 1
      this.model.add(this.hitProxy)
      scene.add(this.model)
    }
  }

  spawn(pos) {
    this.position.copy(pos)
    this.hp = this.maxHp
    this.armor = 50
    this.alive = true
    this.ammo = this.weapon.mag
    this.abilityCharge = 100
    this.buffs = { damageMult: 1, overchargeT: 0, slowed: 0 }
    this.history.length = 0
    this.dancing = false
    if (this.model) this.model.visible = true
  }

  takeDamage(dmg, from) {
    if (!this.alive) return false
    let d = dmg
    if (this.armor > 0) { const absorbed = Math.min(this.armor, d * 0.5); this.armor -= absorbed; d -= absorbed }
    this.hp -= d
    if (this.hp <= 0) { this.hp = 0; this.alive = false; if (this.model) this.model.visible = false; return true }
    return false
  }

  // Collide-and-slide against map AABBs on the XZ plane.
  _collide(map, next) {
    const r = 0.4
    for (const c of map.colliders) {
      if (next.x + r > c.min.x && next.x - r < c.max.x &&
          next.z + r > c.min.z && next.z - r < c.max.z &&
          next.y > c.min.y && next.y - 1.6 < c.max.y) {
        const penX = Math.min(next.x + r - c.min.x, c.max.x - (next.x - r))
        const penZ = Math.min(next.z + r - c.min.z, c.max.z - (next.z - r))
        if (penX < penZ) next.x = (this.position.x < (c.min.x + c.max.x) / 2) ? c.min.x - r : c.max.x + r
        else next.z = (this.position.z < (c.min.z + c.max.z) / 2) ? c.min.z - r : c.max.z + r
      }
    }
    const b = map.bounds
    next.x = Math.max(-b, Math.min(b, next.x))
    next.z = Math.max(-b, Math.min(b, next.z))
    return next
  }

  moveOnGround(map, dir, speed, dt) {
    const mult = this.buffs.slowed ? this.buffs.slowed : 1
    const next = this.position.clone().add(dir.clone().multiplyScalar(speed * mult * dt))
    next.y = 1.6
    this._collide(map, next)
    this.position.copy(next)
  }

  updateCommon(dt) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt
    if (this.abilityCd > 0) this.abilityCd -= dt
    if (this.shootT > 0) this.shootT -= dt * 4
    if (this.buffs.overchargeT > 0) {
      this.buffs.overchargeT -= dt
      this.hp = Math.max(1, this.hp - 2 * dt)
      if (this.buffs.overchargeT <= 0) this.buffs.damageMult = 1
    }
    this.buffs.slowed = 0 // reset each frame; gravity well re-applies
    // Snapshot history for rewind (keep ~2s).
    this._histT += dt
    if (this._histT > 0.2) {
      this._histT = 0
      this.history.push({ pos: this.position.clone(), hp: this.hp })
      if (this.history.length > 10) this.history.shift()
    }
    // Regen ability charge slowly.
    if (this.abilityCharge < 100) this.abilityCharge = Math.min(100, this.abilityCharge + dt * 8)
  }

  reload() {
    if (this.reloadT > 0 || this.ammo === this.weapon.mag || this.reserve <= 0) return false
    this.reloadT = 1.5
    return true
  }

  updateModel(dt, moving, speed) {
    if (this.isPlayer) return
    this.model.position.copy(this.position).setY(0)
    this.model.rotation.y = this.yaw + Math.PI
    this.animT += dt
    animateCharacter(this.model, {
      t: this.animT, speed, moving, dancing: this.dancing, shootT: this.shootT,
    })
  }
}
