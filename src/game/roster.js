// ============================================================================
//  ROSTER — the playable Alien squad + the enemy Human squad.
//  Each agent has a personality, a signature color, and a unique ability.
//  Abilities marked `novel:true` do NOT exist in Valorant — they are the
//  mechanics that "statistically improve" the game (see docs/DESIGN.md).
// ============================================================================

export const FACTIONS = {
  XENO: { id: 'XENO', name: 'Xénomorphes', tint: 0x35ffb0, side: 'attack' },
  HUMAN: { id: 'HUMAN', name: 'Coalition Humaine', tint: 0xff5a54, side: 'defense' },
}

// Ability kinds the engine knows how to execute.
export const ABILITY = {
  GRAVITY_WELL: 'GRAVITY_WELL',   // novel: pulls enemies + slows bullets in a zone
  TIME_REWIND: 'TIME_REWIND',     // novel: rewind YOUR position+hp 2s back
  HIVE_VISION: 'HIVE_VISION',     // novel: wallhack ping shared to whole team
  OVERCHARGE: 'OVERCHARGE',       // novel: overheat weapon -> +dmg but self-burn
  PHASE_DASH: 'PHASE_DASH',       // blink dash through the world
  DEPLOY_WALL: 'DEPLOY_WALL',     // classic energy wall
}

export const XENO_SQUAD = [
  {
    id: 'vex', name: 'VEX', role: 'Duelliste',
    color: 0x35ffb0,
    personality: 'Arrogante, adrénaline pure. Rentre en premier, réfléchit jamais.',
    ability: ABILITY.PHASE_DASH,
    abilityName: 'Saut de Phase', abilityCost: 0, novel: false,
    voice: ['On y va.', 'Trop lents.', 'Je te vois.'],
  },
  {
    id: 'null', name: 'NULL', role: 'Contrôleur',
    color: 0x8a5cff,
    personality: 'Calme, calculatrice. Plie l\'espace-temps sans lever un tentacule.',
    ability: ABILITY.GRAVITY_WELL,
    abilityName: 'Puits de Gravité', abilityCost: 200, novel: true,
    voice: ['Position verrouillée.', 'La gravité vous appartient plus.', 'Restez.'],
  },
  {
    id: 'echo', name: 'ECHO', role: 'Traqueur',
    color: 0x35c8ff,
    personality: 'Nerveuse, paranoïaque. Voit tout, partage tout à la ruche.',
    ability: ABILITY.HIVE_VISION,
    abilityName: 'Vision de Ruche', abilityCost: 150, novel: true,
    voice: ['Ils sont trois. À droite.', 'Ruche synchronisée.', 'Bougez pas.'],
  },
  {
    id: 'krag', name: 'KRAG', role: 'Sentinelle',
    color: 0xffc23b,
    personality: 'Lourd, protecteur, bourru. Aime son mur plus que son équipe.',
    ability: ABILITY.DEPLOY_WALL,
    abilityName: 'Mur de Chitine', abilityCost: 100, novel: false,
    voice: ['Mur en place.', 'Vous passez pas.', 'Tenez la ligne.'],
  },
  {
    id: 'rift', name: 'RIFT', role: 'Initiateur',
    color: 0xff5ad2,
    personality: 'Instable, imprévisible. Rembobine le temps pour "corriger ses erreurs".',
    ability: ABILITY.TIME_REWIND,
    abilityName: 'Rembobinage', abilityCost: 250, novel: true,
    voice: ['On recommence.', 'Ça compte pas, ça.', 'Retour arrière.'],
  },
]

export const HUMAN_SQUAD = [
  { id: 'h1', name: 'SGT. HALE', color: 0xff5a54, ability: ABILITY.DEPLOY_WALL },
  { id: 'h2', name: 'RONIN', color: 0xff8a54, ability: ABILITY.PHASE_DASH },
  { id: 'h3', name: 'MEDIC', color: 0xffd254, ability: ABILITY.OVERCHARGE },
  { id: 'h4', name: 'GHOST', color: 0xc0c8d0, ability: ABILITY.HIVE_VISION },
  { id: 'h5', name: 'BREAKER', color: 0xff5478, ability: ABILITY.GRAVITY_WELL },
]

// Weapons: futuristic energy sidearms & rifles. Stats drive real gameplay.
export const WEAPONS = {
  sidearm: { id: 'sidearm', name: 'Pulse-9', dmg: 26, rpm: 300, mag: 12, spread: 0.02, cost: 0 },
  smg:     { id: 'smg', name: 'Vipère',  dmg: 22, rpm: 780, mag: 30, spread: 0.05, cost: 1600 },
  rifle:   { id: 'rifle', name: 'Fléau-X', dmg: 40, rpm: 620, mag: 25, spread: 0.03, cost: 2900 },
  sniper:  { id: 'sniper', name: 'Faucheur', dmg: 160, rpm: 45, mag: 5, spread: 0.0, cost: 4700 },
}
