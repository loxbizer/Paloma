import * as THREE from 'three'
import { createEngine } from './engine/renderer.js'
import { Input } from './engine/input.js'
import { Audio } from './engine/audio.js'
import { buildMap } from './world/map.js'
import { Combatant } from './entities/combatant.js'
import { updateBot } from './entities/bot.js'
import { WeaponSystem } from './entities/weapons.js'
import { AbilitySystem } from './game/abilities.js'
import { Economy } from './game/economy.js'
import { UI } from './ui/hud.js'
import { Cinematic, BOOT_CINEMATIC } from './cinematic/intro.js'
import { XENO_SQUAD, HUMAN_SQUAD, WEAPONS } from './game/roster.js'

// ============================================================================
//  XENOCLASH — main orchestrator + state machine.
//  States: boot(cinematic) -> menu -> select -> [buy -> live -> roundend]* -> end
// ============================================================================
const canvas = document.getElementById('game')
const uiRoot = document.getElementById('ui-root')
const { renderer, scene, camera } = createEngine(canvas)
const input = new Input(canvas)
const audio = new Audio()
const ui = new UI(uiRoot, audio)
const map = buildMap(scene)
const weapons = new WeaponSystem(scene)
const abilities = new AbilitySystem(scene, map)
const economy = new Economy()
const cinematic = new Cinematic(camera, uiRoot)

// Collect solid world meshes for raycast occlusion/LOS.
const worldMeshes = []
map.group.traverse((o) => { if (o.isMesh && o.geometry?.type === 'BoxGeometry') worldMeshes.push(o) })
map._worldMeshes = worldMeshes

// ---- Build teams ----
let player, allies = [], enemies = []
let chosenAgent = XENO_SQUAD[0]

function buildTeams() {
  // Player Xeno
  player = new Combatant({ scene, agent: chosenAgent, team: 'XENO', color: chosenAgent.color, isPlayer: true, alien: true })
  // Ally Xenos = the other 4 squad members
  allies = XENO_SQUAD.filter((a) => a.id !== chosenAgent.id).map((a) =>
    new Combatant({ scene, agent: a, team: 'XENO', color: a.color, alien: true }))
  // Enemy Humans
  enemies = HUMAN_SQUAD.map((a) =>
    new Combatant({ scene, agent: { ...a, ability: a.ability }, team: 'HUMAN', color: a.color, alien: false }))
}

const xenoTeam = () => [player, ...allies]
const state = {
  phase: 'boot', round: 1, scoreX: 0, scoreH: 0, time: 0,
  buyTime: 12, roundTime: 100, objective: map.sites.A,
  spikePlanted: false, spikeTimer: 0, spikePos: null,
}

// ---------- Round lifecycle ----------
function spawnRound() {
  state.spikePlanted = false; state.spikeTimer = 0; state.spikePos = null
  state.objective = Math.random() < 0.5 ? map.sites.A : map.sites.B
  const xs = map.xenoSpawns, hs = map.humanSpawns
  const xt = xenoTeam()
  xt.forEach((c, i) => { c.spawn(xs[i % xs.length].clone()); c.yaw = 0 })
  enemies.forEach((c, i) => { c.spawn(hs[i % hs.length].clone()); c.yaw = Math.PI })
  // Apply premium over-shield if bought.
  const os = economy.consumeOvershield()
  if (os) { player.armor += os; ui.banner('SUR-BOUCLIER ACTIF ◈', '#ff8ad8', 1800) }
  // Give the player the previously-bought weapon if any.
  if (boughtWeapon) { player.weapon = { ...boughtWeapon, tint: player.color }; player.ammo = player.weapon.mag }
  player.pitch = 0
}

let boughtWeapon = null

function startBuyPhase() {
  state.phase = 'buy'
  state.time = state.buyTime
  spawnRound()
  input.unlock()
  ui.showHUD()
  // Round-start mini cinematic sweep over the active site.
  const site = state.objective
  cinematic.play({
    duration: 3.5,
    keyframes: [
      { t: 0, pos: [site.x + 20, 14, site.z + 20], look: [site.x, 1, site.z] },
      { t: 1, pos: [site.x + 4, 3, site.z + 6], look: [site.x, 1.5, site.z] },
    ],
    cards: [{ t: 0.05, title: 'MANCHE ' + state.round, sub: 'Objectif: Site ' + (site === map.sites.A ? 'A' : 'B') }],
    onDone: () => { openShop() },
  })
}

function openShop() {
  refreshShop()
}
function refreshShop() {
  if (state.phase !== 'buy') return
  ui.shop({
    credits: economy.credits, premium: economy.premium, timeLeft: state.time,
    onBuy: (id) => { const w = economy.buyWeapon(id); if (w) { boughtWeapon = w; player.weapon = { ...w, tint: player.color }; player.ammo = w.mag; ui.banner('Acheté: ' + w.name, '#ffd254', 1200); refreshShop() } },
    onBuyPremium: (k) => { if (economy.buyPremium(k)) { ui.banner('Cristaux dépensés ◈', '#ff8ad8', 1200); refreshShop() } },
    onClose: () => startLive(),
  })
}

function startLive() {
  ui.closeShop()
  state.phase = 'live'
  state.time = state.roundTime
  canvas.requestPointerLock()
}

function endRound(xenoWon) {
  if (state.phase === 'roundend') return
  state.phase = 'roundend'
  input.unlock()
  if (xenoWon) { state.scoreX++; ui.banner('ESSAIM VICTORIEUX', '#35ffb0'); audio.kill() }
  else { state.scoreH++; ui.banner('MANCHE PERDUE', '#ff5a54') }
  economy.roundReward(xenoWon)
  economy.killReward.bind(economy)
  setTimeout(() => {
    if (state.scoreX >= 13 || state.scoreH >= 13) return endMatch()
    state.round++
    startBuyPhase()
  }, 3200)
}

function endMatch() {
  state.phase = 'menu'
  const won = state.scoreX > state.scoreH
  ui.hideHUD()
  ui.clear()
  const el = document.createElement('div')
  el.className = 'overlay'
  el.innerHTML = `<div class="title">${won ? 'VICTOIRE' : 'DÉFAITE'}</div>
    <div class="subtitle">${state.scoreX} — ${state.scoreH}</div>
    <button class="btn" id="again">Rejouer</button>`
  uiRoot.appendChild(el)
  el.querySelector('#again').onclick = () => { location.reload() }
}

function onKill(killer, victim) {
  audio.kill()
  const kName = killer === player ? 'TOI' : killer.agent.name
  const vName = victim === player ? 'TOI' : victim.agent.name
  ui.killfeed(`${kName}  ✦  ${vName}`, killer.team === 'XENO' ? '#35ffb0' : '#ff5a54')
  if (killer === player) { economy.killReward(); ui.hitmarker() }
  checkRoundOver()
}

function checkRoundOver() {
  if (state.phase !== 'live') return
  const xAlive = xenoTeam().some((c) => c.alive)
  const hAlive = enemies.some((c) => c.alive)
  if (!hAlive) endRound(true)
  else if (!xAlive) endRound(false)
}

// ---------- Player controller ----------
const tmpDir = new THREE.Vector3()
function updatePlayer(dt) {
  if (!player.alive) {
    // Spectate: follow an ally.
    const spec = xenoTeam().find((c) => c.alive)
    if (spec) { camera.position.copy(spec.position).setY(1.6); camera.lookAt(spec.position.clone().add(new THREE.Vector3(Math.sin(spec.yaw), 0, Math.cos(spec.yaw)))) }
    return
  }
  player.updateCommon(dt)
  if (player.reloadT > 0) { player.reloadT -= dt; if (player.reloadT <= 0) { const need = player.weapon.mag - player.ammo; const take = Math.min(need, player.reserve); player.ammo += take; player.reserve -= take } }

  // Mouse look.
  const look = input.consumeLook()
  player.yaw -= look.dx
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch - look.dy))

  // Movement.
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw))
  const right = new THREE.Vector3(forward.z, 0, -forward.x)
  tmpDir.set(0, 0, 0)
  if (input.down('KeyW')) tmpDir.add(forward)
  if (input.down('KeyS')) tmpDir.sub(forward)
  if (input.down('KeyD')) tmpDir.add(right)
  if (input.down('KeyA')) tmpDir.sub(right)
  const sprint = input.down('ShiftLeft') ? 1.4 : 1
  const dancing = input.down('KeyF')
  player.dancing = dancing
  let moving = false
  if (tmpDir.lengthSq() > 0 && !dancing) { tmpDir.normalize(); player.moveOnGround(map, tmpDir, 6 * sprint, dt); moving = true }

  // Camera at player eye.
  camera.position.copy(player.position).setY(1.6)
  const dir = new THREE.Vector3(Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), Math.cos(player.yaw) * Math.cos(player.pitch))
  camera.lookAt(camera.position.clone().add(dir))
  // subtle weapon-bob via camera roll while moving
  camera.rotation.z = moving ? Math.sin(performance.now() * 0.01) * 0.006 : 0

  // Shooting.
  if (input.mouseDown && !dancing && player.fireCooldown <= 0 && player.ammo > 0 && player.reloadT <= 0) {
    const origin = camera.position.clone()
    const spread = player.weapon.spread * (moving ? 1.8 : 1)
    const shotDir = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, 0)).normalize()
    const hit = weapons.fire({ origin, dir: shotDir, targets: enemies, worldMeshes, weapon: player.weapon })
    player.fireCooldown = 60 / player.weapon.rpm
    player.ammo--
    player.shootT = 1
    audio.shot()
    if (hit?.combatant) {
      const dmg = Math.round(hit.dmg * player.buffs.damageMult)
      ui.hitmarker(); audio.hit()
      const dead = hit.combatant.takeDamage(dmg, player)
      if (dead) onKill(player, hit.combatant)
    }
  }

  // Reload.
  if (input.pressed('KeyR')) { if (player.reload()) audio.reload() }

  // Ability.
  if (input.pressed('KeyE') && player.abilityCd <= 0 && player.abilityCharge >= (chosenAgent.abilityCost > 0 ? 40 : 20)) {
    abilities.cast(chosenAgent.ability, player, { forward: dir, allCombatants: [...enemies, ...xenoTeam()], audio, onReveal })
    player.abilityCd = 10
    player.abilityCharge = 0
    audio.ability()
    ui.banner('◇ ' + chosenAgent.abilityName, '#' + chosenAgent.color.toString(16).padStart(6, '0'), 1000)
  }

  // Spike plant (press G on active site).
  if (input.pressed('KeyG') && !state.spikePlanted) {
    const d = new THREE.Vector2(player.position.x - state.objective.x, player.position.z - state.objective.z).length()
    if (d < 6) plantSpike()
  }
}

function onReveal() { /* handled by abilities.isRevealed each frame */ }

function plantSpike() {
  state.spikePlanted = true
  state.spikeTimer = 40
  state.spikePos = state.objective.clone()
  const spike = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshStandardMaterial({ color: 0xff5ad2, emissive: 0xff5ad2, emissiveIntensity: 2 }))
  spike.position.set(state.spikePos.x, 0.6, state.spikePos.z)
  spike.userData.spike = true
  scene.add(spike)
  state._spikeMesh = spike
  ui.banner('NOYAU AMORCÉ', '#ff5ad2', 1600)
}

// ---------- Reveal / outline update ----------
function updateReveals() {
  const humansRevealed = abilities.isRevealed('XENO') // my team's hive vision reveals enemies
  for (const e of enemies) if (e.outline) e.outline.material.opacity = (humansRevealed && e.alive) ? 0.9 : 0
  const xenoRevealed = abilities.isRevealed('HUMAN')
  for (const a of allies) if (a.outline) a.outline.material.opacity = (xenoRevealed && a.alive) ? 0.9 : 0
}

// ---------- HUD sync ----------
function syncHUD() {
  ui.updateHUD({
    scoreX: state.scoreX, scoreH: state.scoreH, round: state.round,
    time: state.spikePlanted ? state.spikeTimer : state.time,
    hp: player.hp, armor: player.armor,
    abilityName: chosenAgent.abilityName, abilityReady: player.abilityCd <= 0, abilityCd: player.abilityCd,
    weaponName: player.weapon.name, ammo: player.ammo, reserve: player.reserve, reloading: player.reloadT > 0,
    credits: economy.credits,
  })
}

// ---------- Main loop ----------
const clock = new THREE.Clock()
function tick() {
  const dt = Math.min(0.05, clock.getDelta())

  cinematic.update(dt)

  if (state.phase === 'buy') {
    state.time -= dt
    // Keep the shop timer fresh.
    if (Math.floor(state.time) !== state._lastBuyTick) { state._lastBuyTick = Math.floor(state.time); if (!cinematic.active) ui.shopTimer(economy.credits, economy.premium, state.time) }
    if (state.time <= 0) startLive()
    // idle-animate everyone
    for (const c of [...xenoTeam(), ...enemies]) c.updateModel?.(dt, false, 0)
  }

  if (state.phase === 'live') {
    state.time -= dt
    updatePlayer(dt)
    // Ally bots
    for (const a of allies) updateBot(a, {
      map, enemies, allies: xenoTeam(), weapons, abilities, audio, worldMeshes,
      objective: state.spikePlanted ? state.spikePos : state.objective, onKill, onReveal,
    }, dt)
    // Enemy bots
    for (const e of enemies) updateBot(e, {
      map, enemies: xenoTeam(), allies: enemies, weapons, abilities, audio, worldMeshes,
      objective: state.spikePlanted ? state.spikePos : (player.position), onKill, onReveal,
    }, dt)

    abilities.update(dt, [...xenoTeam(), ...enemies])
    updateReveals()

    // Spike detonation / timeouts.
    if (state.spikePlanted) {
      state.spikeTimer -= dt
      if (state._spikeMesh) state._spikeMesh.rotation.y += dt * 3
      if (state.spikeTimer <= 0) { if (state._spikeMesh) { scene.remove(state._spikeMesh); state._spikeMesh = null } endRound(true) }
    } else if (state.time <= 0) {
      endRound(false) // attackers failed to plant/eliminate -> defenders win
    }
    syncHUD()
  }

  weapons.update(dt)
  input.endFrame()
  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}

// ---------- Boot flow ----------
function boot() {
  state.phase = 'boot'
  // Idle camera path over the empty arena for the boot trailer.
  cinematic.play({
    ...BOOT_CINEMATIC,
    onDone: () => showMenu(),
  })
  // Allow skipping the intro with a click / space.
  const skip = (e) => { if (state.phase === 'boot' && (e.type === 'click' || e.code === 'Space')) cinematic.skip() }
  window.addEventListener('click', skip)
  window.addEventListener('keydown', skip)
}

function showMenu() {
  state.phase = 'menu'
  audio.resume()
  ui.mainMenu({
    onPlay: () => selectScreen(),
    onReplayIntro: () => { cinematic.play({ ...BOOT_CINEMATIC, onDone: () => showMenu() }) },
  })
}

function selectScreen() {
  state.phase = 'select'
  ui.agentSelect({
    onConfirm: (agent) => {
      chosenAgent = agent
      buildTeams()
      ui.clear()
      ui.buildHUD()
      startBuyPhase()
    },
  })
}

boot()
tick()
