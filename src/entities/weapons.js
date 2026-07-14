import * as THREE from 'three'

// Hitscan firing + visual tracers/impacts. Weapons raycast against enemy
// hitboxes and world colliders; damage falls off past 45m.
export class WeaponSystem {
  constructor(scene) {
    this.scene = scene
    this.tracers = [] // {mesh, ttl}
    this.ray = new THREE.Raycaster()
  }

  // origin: Vector3, dir: normalized Vector3, targets: [{mesh, combatant}]
  // Returns the hit combatant (or null) + point.
  fire({ origin, dir, targets, worldMeshes, weapon }) {
    this.ray.set(origin, dir)
    this.ray.far = 200

    let best = null, bestDist = Infinity, hitPoint = null

    // Enemy hits (sphere-ish via bounding boxes on their hit meshes).
    for (const tgt of targets) {
      if (!tgt.alive) continue
      const box = new THREE.Box3().setFromObject(tgt.hitProxy || tgt.model)
      const p = this.ray.ray.intersectBox(box, new THREE.Vector3())
      if (p) {
        const d = origin.distanceTo(p)
        if (d < bestDist) { bestDist = d; best = tgt; hitPoint = p }
      }
    }

    // World occlusion — if a wall is closer than the enemy, block the shot.
    let wallDist = Infinity, wallPoint = null
    const hits = this.ray.intersectObjects(worldMeshes, false)
    if (hits.length) { wallDist = hits[0].distance; wallPoint = hits[0].point }

    let result = null
    if (best && bestDist < wallDist) {
      const falloff = bestDist > 45 ? 0.6 : 1
      // Headshot bonus if hit point is in upper body region.
      const headY = (best.model.position.y || 0) + 1.6
      const headshot = hitPoint.y > headY
      const dmg = Math.round(weapon.dmg * falloff * (headshot ? 2.4 : 1))
      result = { combatant: best, dmg, headshot, point: hitPoint }
      this._tracer(origin, hitPoint, weapon.tint || 0x35ffb0)
      this._impact(hitPoint, 0xff4444)
    } else if (wallPoint) {
      this._tracer(origin, wallPoint, weapon.tint || 0x35ffb0)
      this._impact(wallPoint, 0x88aaff)
    } else {
      this._tracer(origin, origin.clone().add(dir.clone().multiplyScalar(120)), weapon.tint || 0x35ffb0)
    }
    return result
  }

  _tracer(a, b, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b])
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
    const line = new THREE.Line(geo, mat)
    this.scene.add(line)
    this.tracers.push({ mesh: line, ttl: 0.08 })
  }
  _impact(p, color) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    )
    s.position.copy(p)
    this.scene.add(s)
    this.tracers.push({ mesh: s, ttl: 0.15, shrink: true })
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i]
      tr.ttl -= dt
      if (tr.shrink) tr.mesh.scale.multiplyScalar(0.8)
      tr.mesh.material.opacity *= 0.8
      if (tr.ttl <= 0) { this.scene.remove(tr.mesh); tr.mesh.geometry.dispose(); tr.mesh.material.dispose(); this.tracers.splice(i, 1) }
    }
  }
}
