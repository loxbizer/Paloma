import * as THREE from 'three'

// Procedural, modular map "ORBITAL-7" — a futuristic space-station arena built
// from a kit of panels, pillars, ramps and glowing trims (stand-in for a GLB
// modular kit). Returns the group, an array of AABB colliders, spawn points,
// and the spike/core plant site.
export function buildMap(scene) {
  const group = new THREE.Group()
  const colliders = [] // {min:THREE.Vector3, max:THREE.Vector3}

  const matFloor = new THREE.MeshStandardMaterial({ color: 0x141b26, roughness: 0.85, metalness: 0.2 })
  const matWall = new THREE.MeshStandardMaterial({ color: 0x1c2634, roughness: 0.7, metalness: 0.35 })
  const matAccent = new THREE.MeshStandardMaterial({ color: 0x35ffb0, emissive: 0x0aa070, emissiveIntensity: 1.4, roughness: 0.4 })
  const matCrate = new THREE.MeshStandardMaterial({ color: 0x2a3648, roughness: 0.6, metalness: 0.4 })

  // ---- Floor ----
  const floor = new THREE.Mesh(new THREE.BoxGeometry(120, 1, 120), matFloor)
  floor.position.y = -0.5
  floor.receiveShadow = true
  group.add(floor)

  // Glowing grid trim on the floor.
  const grid = new THREE.GridHelper(120, 40, 0x35ffb0, 0x1a3a30)
  grid.material.opacity = 0.25; grid.material.transparent = true
  grid.position.y = 0.02
  group.add(grid)

  // helper to spawn a box + register collider
  function box(w, h, d, x, y, z, mat = matWall, solid = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = true; m.receiveShadow = true
    group.add(m)
    if (solid) {
      colliders.push({
        min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
        max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
      })
    }
    return m
  }
  function trim(w, h, d, x, y, z) { box(w, h, d, x, y, z, matAccent, false) }

  // ---- Perimeter walls ----
  box(120, 8, 1, 0, 4, -60)
  box(120, 8, 1, 0, 4, 60)
  box(1, 8, 120, -60, 4, 0)
  box(1, 8, 120, 60, 4, 0)

  // ---- Central mid structure with cover ----
  box(10, 4, 10, 0, 2, 0)
  trim(10.2, 0.2, 10.2, 0, 4.1, 0)
  box(3, 2, 3, -14, 1, 6, matCrate)
  box(3, 2, 3, 14, 1, -6, matCrate)
  box(2.5, 2.5, 2.5, 8, 1.25, 10, matCrate)
  box(2.5, 2.5, 2.5, -8, 1.25, -10, matCrate)

  // ---- Lane pillars ----
  for (const x of [-30, -18, 18, 30]) {
    box(2, 8, 2, x, 4, -25)
    box(2, 8, 2, x, 4, 25)
    trim(2.2, 0.3, 2.2, x, 8.1, -25)
    trim(2.2, 0.3, 2.2, x, 8.1, 25)
  }

  // ---- Bombsite A (the "Core" plant zone) ----
  const siteA = new THREE.Vector3(-38, 0, 38)
  const siteMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 0.15, 48),
    new THREE.MeshStandardMaterial({ color: 0xff5ad2, emissive: 0xaa1a80, emissiveIntensity: 0.8, transparent: true, opacity: 0.5 })
  )
  siteMarker.position.set(siteA.x, 0.08, siteA.z)
  group.add(siteMarker)
  box(4, 2.5, 1, siteA.x - 6, 1.25, siteA.z, matCrate)
  box(1, 2.5, 4, siteA.x, 1.25, siteA.z - 6, matCrate)

  // ---- Bombsite B ----
  const siteB = new THREE.Vector3(38, 0, -38)
  const siteMarkerB = siteMarker.clone()
  siteMarkerB.position.set(siteB.x, 0.08, siteB.z)
  group.add(siteMarkerB)
  box(4, 2.5, 1, siteB.x + 6, 1.25, siteB.z, matCrate)
  box(1, 2.5, 4, siteB.x, 1.25, siteB.z + 6, matCrate)

  // ---- Elevated catwalks (ramps) for verticality ----
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 16), matWall)
  ramp.rotation.x = -0.35
  ramp.position.set(-25, 2, -8)
  ramp.castShadow = true; ramp.receiveShadow = true
  group.add(ramp)

  scene.add(group)

  return {
    group,
    colliders,
    // Xeno (attackers) spawn south, Humans (defenders) spawn near sites.
    xenoSpawns: [
      new THREE.Vector3(-4, 1.6, 50), new THREE.Vector3(0, 1.6, 52),
      new THREE.Vector3(4, 1.6, 50), new THREE.Vector3(-8, 1.6, 52),
      new THREE.Vector3(8, 1.6, 52),
    ],
    humanSpawns: [
      new THREE.Vector3(-38, 1.6, 30), new THREE.Vector3(-30, 1.6, 40),
      new THREE.Vector3(38, 1.6, -30), new THREE.Vector3(30, 1.6, -40),
      new THREE.Vector3(0, 1.6, -48),
    ],
    sites: { A: siteA, B: siteB },
    bounds: 58,
  }
}
