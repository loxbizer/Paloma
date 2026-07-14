import * as THREE from 'three'

// Procedural humanoid rig — a stand-in for a rigged GLB character. Builds a
// stylized "cartoon-realistic" body from primitives with named, poseable joints
// so we can hand-animate idle / run / shoot / dance cycles without mocap data.
// `alien=true` gives a xeno silhouette (elongated head, tail, glowing eyes).
export function buildCharacter({ color = 0x35ffb0, alien = true } = {}) {
  const root = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x10151f, roughness: 0.6, metalness: 0.4 })
  const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, roughness: 0.3 })

  const mk = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m }

  // ---- Hips (root of the rig) ----
  const hips = new THREE.Group(); hips.position.y = 1.0; root.add(hips)

  // ---- Torso ----
  const torso = new THREE.Group(); hips.add(torso)
  mk(new THREE.CapsuleGeometry(0.28, 0.5, 6, 12), skin, torso).position.y = 0.35
  mk(new THREE.BoxGeometry(0.5, 0.2, 0.3), dark, torso).position.set(0, 0.55, 0.12) // chest plate

  // ---- Head / neck ----
  const neck = new THREE.Group(); neck.position.y = 0.72; torso.add(neck)
  const headGeo = alien ? new THREE.CapsuleGeometry(0.16, 0.24, 6, 12) : new THREE.SphereGeometry(0.2, 16, 12)
  const head = mk(headGeo, skin, neck); head.position.y = 0.18
  if (alien) head.rotation.z = 0.15
  // Glowing eyes.
  const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8)
  const e1 = mk(eyeGeo, glow, neck); e1.position.set(-0.07, 0.2, 0.15)
  const e2 = mk(eyeGeo, glow, neck); e2.position.set(0.07, 0.2, 0.15)

  // ---- Arms (shoulder joints so we can swing them) ----
  function arm(side) {
    const shoulder = new THREE.Group()
    shoulder.position.set(0.34 * side, 0.55, 0)
    torso.add(shoulder)
    const upper = mk(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8), skin, shoulder)
    upper.position.y = -0.2
    const elbow = new THREE.Group(); elbow.position.y = -0.4; shoulder.add(elbow)
    const fore = mk(new THREE.CapsuleGeometry(0.08, 0.28, 4, 8), skin, elbow)
    fore.position.y = -0.18
    return { shoulder, elbow }
  }
  const armL = arm(-1), armR = arm(1)

  // ---- Legs ----
  function leg(side) {
    const hip = new THREE.Group()
    hip.position.set(0.13 * side, 0, 0)
    hips.add(hip)
    mk(new THREE.CapsuleGeometry(0.1, 0.34, 4, 8), skin, hip).position.y = -0.25
    const knee = new THREE.Group(); knee.position.y = -0.5; hip.add(knee)
    mk(new THREE.CapsuleGeometry(0.09, 0.32, 4, 8), skin, knee).position.y = -0.22
    mk(new THREE.BoxGeometry(0.14, 0.08, 0.28), dark, knee).position.set(0, -0.42, 0.05) // foot
    return { hip, knee }
  }
  const legL = leg(-1), legR = leg(1)

  // ---- Alien tail ----
  let tail = null
  if (alien) {
    tail = new THREE.Group(); tail.position.set(0, 0.05, -0.2); hips.add(tail)
    let seg = tail
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Group(); s.position.set(0, -0.08, -0.18)
      mk(new THREE.CapsuleGeometry(0.06 - i * 0.008, 0.12, 4, 6), skin, s).rotation.x = Math.PI / 2
      seg.add(s); seg = s
    }
  }

  // ---- Weapon held in right hand ----
  const gun = new THREE.Group()
  gun.position.set(0.34, 0.25, 0.25)
  const gunBody = mk(new THREE.BoxGeometry(0.08, 0.12, 0.5), dark, gun)
  mk(new THREE.BoxGeometry(0.05, 0.05, 0.2), glow, gun).position.set(0, 0.02, 0.35)
  torso.add(gun)

  root.userData.rig = { hips, torso, neck, armL, armR, legL, legR, tail, head }
  root.castShadow = true
  return root
}

// Drive the rig. `state` = { t, speed, moving, dancing, shootT }.
export function animateCharacter(char, state) {
  const r = char.userData.rig
  if (!r) return
  const { t, speed = 0, moving = false, dancing = false, shootT = 0 } = state

  if (dancing) {
    // Signature dance: hip sway + arms up + head bob (the emote).
    const b = t * 6
    r.hips.position.y = 1.0 + Math.sin(b) * 0.12
    r.hips.rotation.y = Math.sin(b * 0.5) * 0.4
    r.torso.rotation.z = Math.sin(b) * 0.25
    r.armL.shoulder.rotation.z = 1.4 + Math.sin(b) * 0.6
    r.armR.shoulder.rotation.z = -1.4 - Math.sin(b + 1) * 0.6
    r.armL.shoulder.rotation.x = Math.sin(b * 2) * 0.5
    r.armR.shoulder.rotation.x = Math.cos(b * 2) * 0.5
    r.neck.rotation.z = Math.sin(b * 2) * 0.3
    r.legL.knee.rotation.x = Math.abs(Math.sin(b)) * 0.6
    r.legR.knee.rotation.x = Math.abs(Math.cos(b)) * 0.6
    if (r.tail) r.tail.rotation.z = Math.sin(b * 1.5) * 0.6
    return
  }

  // Run / walk cycle.
  const stride = t * (6 + speed * 2)
  const amp = moving ? Math.min(0.9, 0.35 + speed * 0.12) : 0
  r.legL.hip.rotation.x = Math.sin(stride) * amp
  r.legR.hip.rotation.x = -Math.sin(stride) * amp
  r.legL.knee.rotation.x = Math.max(0, Math.sin(stride + 1)) * amp
  r.legR.knee.rotation.x = Math.max(0, -Math.sin(stride + 1)) * amp
  r.armL.shoulder.rotation.x = -Math.sin(stride) * amp * 0.7
  r.armR.shoulder.rotation.x = Math.sin(stride) * amp * 0.7 - shootT * 0.6 // recoil raise
  r.armL.shoulder.rotation.z = 0.1
  r.armR.shoulder.rotation.z = -0.1
  r.hips.position.y = 1.0 + Math.abs(Math.sin(stride)) * amp * 0.06
  r.torso.rotation.z = 0
  r.torso.rotation.y = Math.sin(stride) * amp * 0.08
  r.neck.rotation.z = 0
  // Idle breathing.
  if (!moving) r.torso.position.y = Math.sin(t * 2) * 0.02
  if (r.tail) { r.tail.rotation.z = Math.sin(t * 2 + stride) * 0.2; r.tail.rotation.x = 0.2 }
}
