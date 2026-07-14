import * as THREE from 'three'
import { ABILITY } from './roster.js'

// The ability engine — including the NOVEL mechanics that don't exist in
// Valorant. Each cast either applies an instant effect or spawns a timed field
// the system updates every frame (gravity wells, walls, reveals, buffs).
export class AbilitySystem {
  constructor(scene, map) {
    this.scene = scene
    this.map = map
    this.zones = []   // active gravity wells / walls
    this.reveals = [] // {team, ttl}
  }

  // caster: combatant, ctx: { forward:Vector3, allCombatants, audio, onReveal }
  cast(kind, caster, ctx) {
    switch (kind) {
      case ABILITY.PHASE_DASH: return this._phaseDash(caster, ctx)
      case ABILITY.GRAVITY_WELL: return this._gravityWell(caster, ctx)
      case ABILITY.HIVE_VISION: return this._hiveVision(caster, ctx)
      case ABILITY.OVERCHARGE: return this._overcharge(caster, ctx)
      case ABILITY.DEPLOY_WALL: return this._wall(caster, ctx)
      case ABILITY.TIME_REWIND: return this._rewind(caster, ctx)
    }
  }

  // --- PHASE DASH: blink forward, ignoring soft cover ---
  _phaseDash(caster, { forward }) {
    const target = caster.position.clone().add(forward.clone().setY(0).normalize().multiplyScalar(8))
    target.y = caster.position.y
    caster.position.copy(target)
    this._flash(caster.position, caster.color)
    return { ok: true }
  }

  // --- NOVEL: GRAVITY WELL — pulls enemies in + slows any bullet passing through ---
  _gravityWell(caster, { forward }) {
    const center = caster.position.clone().add(forward.clone().setY(0).normalize().multiplyScalar(12))
    center.y = 0.1
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.3, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0x8a5cff, emissive: 0x8a5cff, emissiveIntensity: 2, transparent: true, opacity: 0.8 })
    )
    ring.rotation.x = Math.PI / 2
    ring.position.copy(center)
    this.scene.add(ring)
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x8a5cff, transparent: true, opacity: 0.5 })
    )
    core.position.copy(center); core.position.y = 1
    this.scene.add(core)
    this.zones.push({ type: 'gravity', center, radius: 5, ttl: 6, team: caster.team, meshes: [ring, core], strength: 6 })
    return { ok: true }
  }

  // --- NOVEL: HIVE VISION — team-wide wallhack ping for a few seconds ---
  _hiveVision(caster, { onReveal }) {
    this.reveals.push({ team: caster.team, ttl: 4 })
    onReveal?.(caster.team, 4)
    this._flash(caster.position, 0x35c8ff, 3)
    return { ok: true }
  }

  // --- OVERCHARGE — self-buff: +50% damage for 5s, but lose 2hp/s ---
  _overcharge(caster) {
    caster.buffs.damageMult = 1.5
    caster.buffs.overchargeT = 5
    this._flash(caster.position, 0xff8a54, 2)
    return { ok: true }
  }

  // --- DEPLOY WALL — timed energy barrier that blocks movement + bullets ---
  _wall(caster, { forward }) {
    const pos = caster.position.clone().add(forward.clone().setY(0).normalize().multiplyScalar(5))
    const yaw = Math.atan2(forward.x, forward.z)
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(8, 3.5, 0.4),
      new THREE.MeshStandardMaterial({ color: caster.color, emissive: caster.color, emissiveIntensity: 0.8, transparent: true, opacity: 0.55 })
    )
    wall.position.set(pos.x, 1.75, pos.z)
    wall.rotation.y = yaw
    this.scene.add(wall)
    const collider = { min: new THREE.Vector3(), max: new THREE.Vector3() }
    const box = new THREE.Box3().setFromObject(wall)
    collider.min.copy(box.min); collider.max.copy(box.max)
    this.map.colliders.push(collider)
    this.zones.push({ type: 'wall', ttl: 10, meshes: [wall], collider })
    return { ok: true }
  }

  // --- NOVEL: TIME REWIND — restore caster to position+hp from 2s ago ---
  _rewind(caster) {
    const snap = caster.history?.[0]
    if (snap) {
      caster.position.copy(snap.pos)
      caster.hp = Math.min(caster.maxHp, snap.hp + 30)
    }
    this._flash(caster.position, 0xff5ad2, 3)
    return { ok: true }
  }

  _flash(pos, color, size = 1.5) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(size, 16, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })
    )
    m.position.copy(pos); m.position.y += 1
    this.scene.add(m)
    this.zones.push({ type: 'fx', ttl: 0.4, meshes: [m], grow: true })
  }

  isRevealed(team) {
    // Enemy team is revealed if MY team has an active hive-vision.
    return this.reveals.some((r) => r.team === team)
  }

  update(dt, combatants) {
    // Reveals
    for (let i = this.reveals.length - 1; i >= 0; i--) {
      this.reveals[i].ttl -= dt
      if (this.reveals[i].ttl <= 0) this.reveals.splice(i, 1)
    }
    // Zones
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]
      z.ttl -= dt
      if (z.type === 'gravity') {
        z.meshes[0].rotation.z += dt * 2
        z.meshes[1].scale.setScalar(1 + Math.sin(z.ttl * 6) * 0.2)
        for (const c of combatants) {
          if (!c.alive || c.team === z.team) continue
          const d = c.position.distanceTo(z.center)
          if (d < z.radius && d > 0.4) {
            const pull = z.center.clone().sub(c.position).setY(0).normalize().multiplyScalar(z.strength * dt)
            c.position.add(pull)
            c.buffs.slowed = 0.4 // engine reads this for movement
          }
        }
      } else if (z.type === 'fx') {
        if (z.grow) z.meshes[0].scale.multiplyScalar(1 + dt * 6)
        z.meshes[0].material.opacity *= 0.9
      }
      if (z.ttl <= 0) {
        for (const m of z.meshes) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose() }
        if (z.collider) {
          const idx = this.map.colliders.indexOf(z.collider)
          if (idx >= 0) this.map.colliders.splice(idx, 1)
        }
        this.zones.splice(i, 1)
      }
    }
  }
}
