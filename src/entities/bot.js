import * as THREE from 'three'

// Bot AI: seek the objective, engage the nearest visible enemy, use cover-ish
// strafing, fire with human-like reaction delay, and occasionally cast their
// ability. Shared by allied and enemy bots — team just flips their goals.
export function updateBot(bot, ctx, dt) {
  const { map, enemies, allies, weapons, abilities, audio } = ctx
  if (!bot.alive) return

  bot.updateCommon(dt)
  if (bot.reloadT > 0) { bot.reloadT -= dt; if (bot.reloadT <= 0) { bot.ammo = bot.weapon.mag } }

  // Find nearest living, line-of-sight enemy.
  let target = null, tDist = Infinity
  for (const e of enemies) {
    if (!e.alive) continue
    const d = bot.position.distanceTo(e.position)
    if (d < tDist && d < 60 && hasLOS(bot, e, map, weapons)) { tDist = d; target = e }
  }

  let moving = false, speed = 5
  const dir = new THREE.Vector3()

  if (target) {
    // Aim at target.
    const aim = target.position.clone().sub(bot.position)
    bot.yaw = Math.atan2(aim.x, aim.z)
    // Keep preferred range: push in if far, back off if very close.
    if (tDist > 22) { dir.copy(aim).setY(0).normalize(); moving = true }
    else if (tDist < 8) { dir.copy(aim).setY(0).normalize().multiplyScalar(-1); moving = true }
    else {
      // Strafe.
      const side = new THREE.Vector3(-aim.z, 0, aim.x).normalize()
      dir.copy(side).multiplyScalar(bot._strafe || 1); moving = true
      if (Math.random() < 0.01) bot._strafe = -(bot._strafe || 1)
    }
    // Fire.
    if (bot.fireCooldown <= 0 && bot.ammo > 0) {
      const spread = new THREE.Vector3((Math.random() - 0.5) * bot.weapon.spread * 3, (Math.random() - 0.5) * bot.weapon.spread * 3, 0)
      const shotDir = aim.clone().normalize().add(spread).normalize()
      const origin = bot.position.clone().setY(1.5)
      const hit = weapons.fire({ origin, dir: shotDir, targets: [...enemies], worldMeshes: ctx.worldMeshes, weapon: bot.weapon })
      bot.fireCooldown = 60 / bot.weapon.rpm
      bot.ammo--
      bot.shootT = 1
      audio?.shot()
      if (hit?.combatant) {
        const dmg = Math.round(hit.dmg * bot.buffs.damageMult)
        const dead = hit.combatant.takeDamage(dmg, bot)
        if (dead) ctx.onKill?.(bot, hit.combatant)
      }
    } else if (bot.ammo <= 0) bot.reload()

    // Occasionally use ability.
    if (bot.abilityCd <= 0 && bot.abilityCharge >= 60 && Math.random() < 0.015) {
      const fwd = new THREE.Vector3(Math.sin(bot.yaw), 0, Math.cos(bot.yaw))
      abilities.cast(bot.agent.ability, bot, { forward: fwd, allCombatants: [...enemies, ...allies], audio, onReveal: ctx.onReveal })
      bot.abilityCd = 12
      bot.abilityCharge = 0
      audio?.ability()
    }
  } else {
    // No target: advance toward objective.
    const goal = ctx.objective || map.sites.A
    const toGoal = goal.clone().sub(bot.position)
    if (toGoal.length() > 3) { dir.copy(toGoal).setY(0).normalize(); bot.yaw = Math.atan2(dir.x, dir.z); moving = true }
    else { moving = false }
  }

  if (moving) bot.moveOnGround(map, dir, speed, dt)
  bot.updateModel(dt, moving, speed)
}

function hasLOS(a, b, map, weapons) {
  const origin = a.position.clone().setY(1.5)
  const to = b.position.clone().setY(1.5).sub(origin)
  const dist = to.length()
  weapons.ray.set(origin, to.normalize())
  weapons.ray.far = dist
  const hits = weapons.ray.intersectObjects(map._worldMeshes || [], false)
  return hits.length === 0 || hits[0].distance > dist - 0.5
}
