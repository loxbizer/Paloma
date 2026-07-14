// XENOSTRIKE — point d'entrée : boot du moteur, chargement des assets,
// câblage de tous les systèmes, flux menu → sélection d'agent → match.
import { Engine } from './core/engine.js';
import { bus } from './core/events.js';
import { registry } from './core/registry.js';
import { AssetManager } from './core/assets.js';
import { loadProfile, saveProfile } from './core/save.js';
import {
  GAME_STATES, ALL_CHARACTER_IDS, WEAPON_IDS,
  modelPathForAgent, modelPathForWeapon, modelPathForMap
} from './game/constants.js';

// --- Mode smoketest -------------------------------------------------------
const params = new URLSearchParams(location.search);
const SMOKE = params.get('smoketest') === '1';
if (SMOKE) {
  window.__SMOKE = { errors: [], ready: false, state: {} };
  window.addEventListener('error', (e) => window.__SMOKE.errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => window.__SMOKE.errors.push('rejection: ' + String(e.reason && e.reason.stack || e.reason)));
}

const bootStatus = document.getElementById('boot-status');
const bootProgress = document.getElementById('boot-progress');
const setBoot = (pct, text) => {
  if (bootProgress) bootProgress.style.width = `${Math.round(pct * 100)}%`;
  if (bootStatus && text) bootStatus.textContent = text;
};

async function boot() {
  setBoot(0.02, 'Moteur…');

  // --- Noyau -------------------------------------------------------------
  const canvas = document.getElementById('game-canvas');
  const engine = registry.set('engine', new Engine(canvas));
  const profile = registry.set('profile', loadProfile());
  registry.set('save', { save: () => saveProfile(registry.get('profile')) });
  const assets = registry.set('assets', new AssetManager());

  // --- Préchargement des GLB ----------------------------------------------
  setBoot(0.05, 'Chargement des modèles 3D…');
  const paths = [
    modelPathForMap(),
    ...ALL_CHARACTER_IDS.map(modelPathForAgent),
    ...WEAPON_IDS.map(modelPathForWeapon)
  ];
  await assets.preload(paths, (p, file) => {
    setBoot(0.05 + p * 0.55, `Chargement : ${file.split('/').pop()}`);
  });

  // --- Systèmes (imports dynamiques : un module cassé n'empêche pas le boot) —
  setBoot(0.62, 'Systèmes…');
  const services = [
    ['audio', './core/audio.js', (m) => new m.AudioSystem()],
    ['fx', './fx/particles.js', (m) => new m.FXSystem(engine.scene)],
    ['tracers', './fx/tracers.js', (m) => new m.TracerSystem(engine.scene)],
    ['input', './core/input.js', (m) => new m.InputManager(canvas)],
    ['agentFactory', './agents/agent.js', (m) => new m.AgentFactory()],
    ['abilities', './agents/abilities.js', (m) => new m.AbilitySystem()],
    ['combat', './game/combat.js', (m) => new m.CombatSystem()],
    ['cinematics', './cinematics/director.js', (m) => new m.CinematicDirector()]
  ];
  for (const [key, path, make] of services) {
    try {
      const mod = await import(path);
      registry.set(key, make(mod));
    } catch (err) {
      console.error(`[boot] service "${key}" indisponible:`, err);
      if (window.__SMOKE) window.__SMOKE.errors.push(`service ${key}: ${err && err.stack || err}`);
    }
  }

  // --- Monde --------------------------------------------------------------
  setBoot(0.72, 'Construction de Nova Bastion…');
  try {
    const { GameWorld } = await import('./world/map.js');
    const world = await GameWorld.load();
    registry.set('world', world);
    engine.onUpdate((dt) => world.update && world.update(dt));
  } catch (err) {
    console.error('[boot] monde indisponible:', err);
    if (window.__SMOKE) window.__SMOKE.errors.push(`world: ${err && err.stack || err}`);
  }

  // --- Interface -----------------------------------------------------------
  setBoot(0.82, 'Interface…');
  const uiRoot = document.getElementById('ui');
  const uiModules = [
    ['hud', './ui/hud.js', 'HUD'],
    ['menus', './ui/menus.js', 'Menus'],
    ['shop', './ui/shop.js', 'Shop'],
    ['agentselect', './ui/agentselect.js', 'AgentSelect'],
    ['scoreboard', './ui/scoreboard.js', 'Scoreboard']
  ];
  for (const [key, path, className] of uiModules) {
    try {
      const mod = await import(path);
      const Cls = mod[className] || mod.default;
      const instance = new Cls();
      if (instance.mount) instance.mount(uiRoot);
      registry.set(key, instance);
    } catch (err) {
      console.error(`[boot] UI "${key}" indisponible:`, err);
      if (window.__SMOKE) window.__SMOKE.errors.push(`ui ${key}: ${err && err.stack || err}`);
    }
  }

  // --- Boucle de mise à jour des systèmes centraux -------------------------
  engine.onUpdate((dt) => {
    const match = registry.get('match');
    if (match && match.update) match.update(dt);
    for (const key of ['combat', 'abilities', 'fx', 'tracers']) {
      const s = registry.get(key);
      if (s && s.update) s.update(dt);
    }
    const player = registry.get('player');
    if (player && player.update) player.update(dt);
  });

  // --- Contrôleur joueur : créé quand le match désigne l'entité joueur -----
  bus.on('player:pov', async ({ entity }) => {
    try {
      const { PlayerController } = await import('./game/player.js');
      registry.set('player', new PlayerController(entity));
    } catch (err) {
      console.error('[boot] PlayerController indisponible:', err);
      if (window.__SMOKE) window.__SMOKE.errors.push(`player: ${err && err.stack || err}`);
    }
  });

  // --- Flux de jeu ----------------------------------------------------------
  let pendingLaunch = null;

  bus.on('menu:launch', (cfg) => {
    pendingLaunch = cfg || { difficulty: 'normal', mode: 'standard' };
    bus.emit('game:state', { state: GAME_STATES.AGENT_SELECT });
  });

  bus.on('agentselect:confirm', async ({ agentId }) => {
    try {
      const { MatchController } = await import('./game/match.js');
      const prof = registry.get('profile');
      const match = new MatchController({
        playerAgentId: agentId,
        difficulty: (pendingLaunch && pendingLaunch.difficulty) || 'normal',
        mode: (pendingLaunch && pendingLaunch.mode) || 'standard',
        boosters: (prof && prof.activeBoosters) || []
      });
      registry.set('match', match);
      // expose les sous-systèmes créés par le match, si présents
      for (const key of ['economy', 'mechanics', 'spike']) {
        if (match[key] && !registry.get(key)) registry.set(key, match[key]);
      }
      await match.start();
    } catch (err) {
      console.error('[boot] échec de lancement du match:', err);
      if (window.__SMOKE) window.__SMOKE.errors.push(`match: ${err && err.stack || err}`);
    }
  });

  bus.on('game:state', ({ state }) => {
    if (window.__SMOKE) window.__SMOKE.state.game = state;
    if (state === GAME_STATES.ACTION && window.__SMOKE) window.__SMOKE.ready = true;
  });

  // --- Démarrage ------------------------------------------------------------
  setBoot(1, 'Prêt.');
  engine.start();
  document.getElementById('boot-screen').classList.add('hidden');

  if (SMOKE) {
    // Enchaîne automatiquement : menu → sélection → match (cinématiques accélérées).
    bus.emit('game:state', { state: GAME_STATES.MENU });
    bus.emit('menu:launch', { difficulty: 'normal', mode: 'standard' });
    setTimeout(() => bus.emit('agentselect:confirm', { agentId: 'zephyr' }), 400);
  } else {
    bus.emit('game:state', { state: GAME_STATES.MENU });
    bus.emit('music:mood', { mood: 'menu' });
  }
}

boot().catch((err) => {
  console.error('[boot] échec fatal:', err);
  if (window.__SMOKE) window.__SMOKE.errors.push('boot: ' + String(err && err.stack || err));
  setBoot(1, 'Erreur au démarrage — voir la console.');
});
