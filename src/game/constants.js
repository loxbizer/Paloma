// Constantes de gameplay partagées — SOURCE DE VÉRITÉ pour tous les modules.
export const TEAM_XENOS = 'XENOS';         // attaquants — aliens (côté joueur)
export const TEAM_GUARDIANS = 'GUARDIANS'; // défenseurs — humains

export const GAME_STATES = {
  BOOT: 'boot',
  MENU: 'menu',
  AGENT_SELECT: 'agent-select',
  CINEMATIC: 'cinematic',
  BUY: 'buy',
  ACTION: 'action',
  POST_ROUND: 'post',
  SHOP: 'shop',
  VICTORY: 'victory'
};

export const ROUND = {
  MAX_ROUNDS: 24,
  ROUNDS_TO_WIN: 13,
  SWITCH_SIDES_AT: 12,
  BUY_TIME: 14,          // secondes de phase d'achat
  ACTION_TIME: 100,      // secondes de round
  POST_TIME: 6,
  SPIKE_TIMER: 45,       // le "Noyau de Singularité"
  DEFUSE_TIME: 7,
  DEFUSE_HALF: 3.5,
  PLANT_TIME: 4,
  REVIVE_WINDOW: 8,      // fenêtre de réanimation tactique (s)
  REVIVE_HOLD: 3.5,      // durée du maintien pour réanimer
  MAP_EVENT_AT: 50       // seconde du round où un événement de map se déclenche
};

export const ECONOMY = {
  START_CREDITS: 800,
  WIN_REWARD: 3000,
  LOSS_REWARD: 1900,
  LOSS_STREAK_BONUS: 500,   // par défaite consécutive (max +1000)
  LOSS_STREAK_MAX: 2,
  KILL_REWARD: 200,
  PLANT_BONUS: 300,
  DEFUSE_BONUS: 300,
  MAX_CREDITS: 9000,
  ARMOR_LIGHT: { id: 'armor_light', price: 400, value: 25 },
  ARMOR_HEAVY: { id: 'armor_heavy', price: 1000, value: 50 }
};

export const PLAYER = {
  MAX_HP: 100,
  EYE_HEIGHT: 1.62,
  CROUCH_EYE: 1.1,
  RADIUS: 0.38,
  HEIGHT: 1.8,
  WALK_SPEED: 5.2,
  RUN_SPEED: 6.8,
  CROUCH_SPEED: 2.6,
  JUMP_VELOCITY: 5.4,
  DASH_SPEED: 14,
  DASH_TIME: 0.22,
  DASH_COOLDOWN: 3.5,
  WALLRUN_TIME: 1.6,
  GRAVITY: 16.5,
  SLIDE_SPEED: 9.5,
  SLIDE_TIME: 0.7
};

// Évolution Xéno — points gagnés en jouant, paliers de choix d'amélioration.
export const EVOLUTION = {
  KILL_POINTS: 30,
  ASSIST_POINTS: 12,
  PLANT_POINTS: 25,
  ROUND_POINTS: 10,
  THRESHOLDS: [60, 150, 280],   // niveaux 1, 2, 3
  CHOICES: [
    { id: 'evo_damage', name: 'Frappe xéno', desc: '+12% de dégâts', apply: { damageMult: 1.12 } },
    { id: 'evo_speed', name: 'Membres véloces', desc: '+10% vitesse de déplacement', apply: { speedMult: 1.10 } },
    { id: 'evo_hp', name: 'Carapace dense', desc: '+25 PV max', apply: { hpBonus: 25 } },
    { id: 'evo_cd', name: 'Synapses rapides', desc: '-20% temps de recharge des capacités', apply: { cooldownMult: 0.8 } },
    { id: 'evo_armor', name: 'Exosquelette', desc: '+25 armure en début de round', apply: { armorBonus: 25 } },
    { id: 'evo_ult', name: 'Conduit psionique', desc: '+30% charge d’ultime', apply: { ultChargeMult: 1.3 } }
  ]
};

export const MOMENTUM = {
  TRIGGER_STREAK: 3,     // défaites consécutives pour déclencher l'Aura de Résurgence
  SHIELD_BONUS: 15,      // bouclier offert au round suivant
  CREDIT_AURA: 400       // crédits bonus d'aura
};

// Identifiants des 15 personnages (10 Xénos jouables + 5 Gardiens ennemis).
export const XENO_IDS = ['zephyr', 'krogoth', 'sylkis', 'vex9', 'umbra', 'thorne', 'pulsar', 'naia', 'ragnok', 'echo'];
export const GUARDIAN_IDS = ['steele', 'wraith', 'ferrai', 'bastion7', 'nyx'];
export const ALL_CHARACTER_IDS = [...XENO_IDS, ...GUARDIAN_IDS];

// Identifiants des armes.
export const WEAPON_IDS = ['blade', 'stinger_p', 'viper', 'nova_hand', 'wasp', 'hornet', 'maw', 'pulsar_r7', 'reaver', 'void_eye', 'devastator'];

export const MAP_ID = 'nova_bastion';

export function modelPathForAgent(id) { return `assets/models/agent_${id}.glb`; }
export function modelPathForWeapon(id) { return `assets/models/weapon_${id}.glb`; }
export function modelPathForMap() { return `assets/models/map_${MAP_ID}.glb`; }
