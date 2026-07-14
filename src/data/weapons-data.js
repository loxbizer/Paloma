// ============================================================================
// XENOSTRIKE — Données d'équilibrage des armes (SOURCE DE VÉRITÉ gameplay).
// Structure conforme à docs/CONTRACTS.md. Aucune logique ici : données pures.
//
// Conventions :
//  - damage : dégâts par coup { head, body, legs } (avant statMods/variants).
//  - fireRate : coups par seconde. auto : maintien du tir possible.
//  - range : distance (m) où commence la perte de dégâts ; falloff : multiplicateur à 50 m
//    (interpolation linéaire entre `range` et 50 m, plancher = falloff).
//  - penetration : 0 = aucune, 1 = cloisons fines, 2 = murs épais.
//  - spread / adsSpread : dispersion de base en radians (hanche / visée ADS).
//  - recoil : pattern de 12 impulsions [dx, dy] en radians (dy > 0 = relève du canon,
//    dx = dérive latérale). Au-delà de 12 coups, boucler sur les 4 dernières entrées.
//  - Cas particuliers : `blade` (mêlée) a des munitions infinies — le combat ne doit
//    PAS consommer de chargeur pour la classe 'melee'. `maw` : les dégâts indiqués sont
//    les dégâts TOTAUX si toute la gerbe touche ; diviser par `pellets` pour un plomb.
//  - variants : skins achetables en Xenocoins. damageBonus > 1 = variante P2W assumée
//    (léger avantage statistique réel, cœur du modèle économique du jeu).
// ============================================================================
import { modelPathForWeapon } from '../game/constants.js';

export const WEAPONS = {
  // --------------------------------------------------------------- MÊLÉE ---
  blade: {
    id: 'blade',
    name: 'Croc du Vide',
    class: 'melee',
    price: 0,
    damage: { head: 100, body: 75, legs: 65 },
    fireRate: 1.6,
    auto: false,
    magSize: Infinity,   // arme blanche : jamais de rechargement
    reserve: Infinity,
    reloadTime: 0,
    range: 2.4,          // portée de la lame (m)
    falloff: 1.0,
    penetration: 0,
    spread: 0,
    adsSpread: 0,
    recoil: [
      [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],
      [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]
    ],
    moveSpeedMult: 1.0,
    equipTime: 0.35,
    sfx: 'shot_plasma',
    tracerColor: 0x35ffe0,
    description: 'Lame d’énergie condensée arrachée au cœur d’une singularité. Silencieuse, élégante, définitive — le dernier argument des Xénos à court de munitions.',
    variants: [
      { id: 'blade_spectre', name: 'Croc Spectre', priceXenocoins: 600, tint: 0x9be9ff, damageBonus: 1.0 },
      { id: 'blade_sanguine', name: 'Croc Sanguin', priceXenocoins: 1200, tint: 0xff2e5f, damageBonus: 1.03 }
    ]
  },

  // ------------------------------------------------------- ARMES DE POING ---
  stinger_p: {
    id: 'stinger_p',
    name: 'Stinger-P',
    class: 'sidearm',
    price: 0,
    damage: { head: 78, body: 26, legs: 22 },
    fireRate: 6.75,
    auto: false,
    magSize: 12,
    reserve: 36,
    reloadTime: 1.6,
    range: 18,
    falloff: 0.75,
    penetration: 0,
    spread: 0.012,
    adsSpread: 0.006,
    recoil: [
      [0.000, 0.011], [0.001, 0.012], [-0.001, 0.012], [0.002, 0.013],
      [-0.002, 0.013], [0.002, 0.012], [-0.003, 0.012], [0.003, 0.011],
      [-0.003, 0.011], [0.004, 0.010], [-0.004, 0.010], [0.004, 0.010]
    ],
    moveSpeedMult: 0.98,
    equipTime: 0.55,
    sfx: 'shot_kinetic',
    tracerColor: 0x3ce0c8,
    description: 'Pistolet de dotation xéno à aiguilles cinétiques. Gratuit, fiable, et deux piqûres en pleine tête suffisent à calmer n’importe quel Gardien.',
    variants: [
      { id: 'stinger_p_chrome', name: 'Stinger-P Chrome', priceXenocoins: 350, tint: 0xdfe8f2, damageBonus: 1.0 },
      { id: 'stinger_p_venin', name: 'Stinger-P Venin', priceXenocoins: 900, tint: 0x7dff4d, damageBonus: 1.03 }
    ]
  },

  viper: {
    id: 'viper',
    name: 'Vipère',
    class: 'sidearm',
    price: 400,
    damage: { head: 74, body: 25, legs: 21 },
    fireRate: 10,
    auto: true,
    magSize: 15,
    reserve: 45,
    reloadTime: 1.5,
    range: 12,
    falloff: 0.6,
    penetration: 0,
    spread: 0.02,
    adsSpread: 0.012,
    recoil: [
      [0.000, 0.009], [0.001, 0.012], [-0.001, 0.015], [0.002, 0.017],
      [-0.003, 0.018], [0.004, 0.016], [-0.006, 0.013], [0.007, 0.010],
      [0.009, 0.008], [0.010, 0.006], [0.011, 0.005], [0.012, 0.005]
    ],
    moveSpeedMult: 0.97,
    equipTime: 0.6,
    sfx: 'shot_kinetic',
    tracerColor: 0xa8ff3c,
    description: 'Pistolet-mitrailleur de poche au venin d’acide. Il crache vite, mord fort à bout portant — mais au-delà de dix mètres, la Vipère ne fait que siffler.',
    variants: [
      { id: 'viper_obsidienne', name: 'Vipère Obsidienne', priceXenocoins: 400, tint: 0x2b2f3a, damageBonus: 1.0 },
      { id: 'viper_toxine', name: 'Vipère Toxine', priceXenocoins: 1000, tint: 0xc8ff3c, damageBonus: 1.04 }
    ]
  },

  nova_hand: {
    id: 'nova_hand',
    name: 'Main de Nova',
    class: 'sidearm',
    price: 800,
    damage: { head: 160, body: 55, legs: 47 },
    fireRate: 4,
    auto: false,
    magSize: 6,
    reserve: 24,
    reloadTime: 2.2,
    range: 27,
    falloff: 0.8,
    penetration: 1,
    spread: 0.011,
    adsSpread: 0.005,
    recoil: [
      [0.000, 0.022], [0.002, 0.024], [-0.002, 0.025], [0.003, 0.026],
      [-0.003, 0.026], [0.004, 0.025], [-0.004, 0.025], [0.005, 0.024],
      [-0.005, 0.024], [0.005, 0.023], [-0.005, 0.023], [0.006, 0.022]
    ],
    moveSpeedMult: 0.95,
    equipTime: 0.75,
    sfx: 'shot_plasma',
    tracerColor: 0x7fb4ff,
    description: 'Canon de poing à bobine stellaire : six décharges de plasma comprimé. Une seule en pleine tête, et le Gardien rejoint les étoiles qu’il prétendait défendre.',
    variants: [
      { id: 'nova_hand_eclipse', name: 'Main de Nova Éclipse', priceXenocoins: 700, tint: 0x8f7bff, damageBonus: 1.0 },
      { id: 'nova_hand_supernova', name: 'Main de Nova Supernova', priceXenocoins: 1500, tint: 0xffd257, damageBonus: 1.05 }
    ]
  },

  // -------------------------------------------------------- MITRAILLETTES ---
  wasp: {
    id: 'wasp',
    name: 'Guêpe',
    class: 'smg',
    price: 1000,
    damage: { head: 67, body: 26, legs: 22 },
    fireRate: 15,
    auto: true,
    magSize: 25,
    reserve: 75,
    reloadTime: 1.9,
    range: 12,
    falloff: 0.6,
    penetration: 0,
    spread: 0.022,
    adsSpread: 0.013,
    recoil: [
      [0.000, 0.006], [0.001, 0.008], [-0.001, 0.010], [0.002, 0.011],
      [-0.003, 0.011], [-0.005, 0.009], [-0.007, 0.008], [-0.008, 0.006],
      [-0.009, 0.005], [-0.010, 0.004], [-0.010, 0.004], [-0.011, 0.003]
    ],
    moveSpeedMult: 0.94,
    equipTime: 0.7,
    sfx: 'shot_kinetic',
    tracerColor: 0xffc832,
    description: 'Mitraillette d’éco-round au bourdonnement furieux. Quinze dards par seconde : la Guêpe ne pique pas une fois, elle pique en essaim.',
    variants: [
      { id: 'wasp_nuit', name: 'Guêpe Nocturne', priceXenocoins: 400, tint: 0x39415a, damageBonus: 1.0 },
      { id: 'wasp_essaim', name: 'Guêpe Reine d’Essaim', priceXenocoins: 850, tint: 0xffe08a, damageBonus: 1.03 }
    ]
  },

  hornet: {
    id: 'hornet',
    name: 'Frelon',
    class: 'smg',
    price: 1600,
    damage: { head: 76, body: 28, legs: 24 },
    fireRate: 12.5,
    auto: true,
    magSize: 30,
    reserve: 90,
    reloadTime: 2.1,
    range: 18,
    falloff: 0.72,
    penetration: 1,
    spread: 0.017,
    adsSpread: 0.009,
    recoil: [
      [0.000, 0.007], [0.001, 0.009], [-0.001, 0.011], [0.002, 0.012],
      [-0.002, 0.013], [0.004, 0.011], [0.006, 0.009], [0.007, 0.007],
      [-0.006, 0.006], [-0.008, 0.005], [0.008, 0.004], [0.009, 0.004]
    ],
    moveSpeedMult: 0.92,
    equipTime: 0.75,
    sfx: 'shot_kinetic',
    tracerColor: 0xff8a2a,
    description: 'Le grand frère blindé de la Guêpe : crosse pleine, canon caréné, dards perforants. Le Frelon tient la cadence même quand la cible se cache derrière une cloison.',
    variants: [
      { id: 'hornet_titane', name: 'Frelon Titane', priceXenocoins: 500, tint: 0xaebacd, damageBonus: 1.0 },
      { id: 'hornet_incendie', name: 'Frelon Incendiaire', priceXenocoins: 1100, tint: 0xff5a2a, damageBonus: 1.04 }
    ]
  },

  // ------------------------------------------------------- FUSIL À POMPE ---
  maw: {
    id: 'maw',
    name: 'Gueule',
    class: 'shotgun',
    price: 950,
    // Dégâts TOTAUX si toute la gerbe touche (8 plombs → diviser par `pellets`).
    damage: { head: 200, body: 160, legs: 136 },
    pellets: 8,
    fireRate: 3.3,
    auto: false,
    magSize: 2,
    reserve: 20,
    reloadTime: 2.6,
    range: 8,
    falloff: 0.25,
    penetration: 0,
    spread: 0.065,
    adsSpread: 0.05,
    recoil: [
      [0.000, 0.045], [0.005, 0.048], [-0.005, 0.050], [0.006, 0.050],
      [-0.006, 0.050], [0.006, 0.048], [-0.006, 0.048], [0.007, 0.046],
      [-0.007, 0.046], [0.007, 0.045], [-0.007, 0.045], [0.008, 0.044]
    ],
    moveSpeedMult: 0.9,
    equipTime: 0.9,
    sfx: 'shot_heavy',
    tracerColor: 0xff4433,
    description: 'Double canon massif taillé dans une mâchoire de léviathan orbital. Deux coups, pas un de plus — mais à bout portant, la Gueule ne laisse que des regrets.',
    variants: [
      { id: 'maw_chitine', name: 'Gueule Chitineuse', priceXenocoins: 450, tint: 0x5a6b4a, damageBonus: 1.0 },
      { id: 'maw_magma', name: 'Gueule Magmatique', priceXenocoins: 1300, tint: 0xff6a1f, damageBonus: 1.05 }
    ]
  },

  // -------------------------------------------------------------- FUSILS ---
  pulsar_r7: {
    id: 'pulsar_r7',
    name: 'Pulsar R-7',
    class: 'rifle',
    price: 2900,
    damage: { head: 160, body: 40, legs: 34 },
    fireRate: 9.75,
    auto: true,
    magSize: 25,
    reserve: 75,
    reloadTime: 2.5,
    range: 50,
    falloff: 1.0,        // aucune perte : arme de précision à toute distance
    penetration: 1,
    spread: 0.01,
    adsSpread: 0.004,
    recoil: [
      [0.000, 0.010], [0.001, 0.013], [-0.001, 0.016], [0.002, 0.018],
      [-0.002, 0.019], [0.003, 0.018], [-0.004, 0.016], [0.006, 0.012],
      [0.008, 0.009], [-0.009, 0.007], [-0.010, 0.006], [0.010, 0.005]
    ],
    moveSpeedMult: 0.9,
    equipTime: 1.0,
    sfx: 'shot_plasma',
    tracerColor: 0x35d9ff,
    description: 'Le fusil d’induction plasma des lignées xénos. Sept anneaux d’accélération, zéro perte à distance : une décharge en pleine tête, et le round est déjà gagné.',
    variants: [
      { id: 'pulsar_r7_glacier', name: 'Pulsar R-7 Glacier', priceXenocoins: 800, tint: 0x9fe8ff, damageBonus: 1.0 },
      { id: 'pulsar_r7_ionique', name: 'Pulsar R-7 Ionique', priceXenocoins: 1200, tint: 0x66f0ff, damageBonus: 1.03 },
      { id: 'pulsar_r7_aurum', name: 'Pulsar R-7 Aurum', priceXenocoins: 1800, tint: 0xffc84d, damageBonus: 1.05 }
    ]
  },

  reaver: {
    id: 'reaver',
    name: 'Reaver',
    class: 'rifle',
    price: 2900,
    damage: { head: 156, body: 39, legs: 33 },
    fireRate: 11,
    auto: true,
    magSize: 30,
    reserve: 90,
    reloadTime: 2.4,
    range: 26,
    falloff: 0.85,
    penetration: 1,
    spread: 0.011,
    adsSpread: 0.005,
    recoil: [
      [0.000, 0.008], [0.001, 0.010], [-0.001, 0.013], [0.002, 0.015],
      [-0.002, 0.016], [0.003, 0.014], [-0.004, 0.012], [0.005, 0.010],
      [-0.007, 0.008], [0.008, 0.006], [0.008, 0.005], [-0.009, 0.005]
    ],
    moveSpeedMult: 0.9,
    equipTime: 1.0,
    sfx: 'shot_plasma',
    tracerColor: 0x4dff6a,
    description: 'Fusil symbiotique vivant, veiné de sève luminescente. Plus docile que le Pulsar, plus rapide, plus discret — le Reaver digère ses proies en rafales courtes.',
    variants: [
      { id: 'reaver_os', name: 'Reaver Ossuaire', priceXenocoins: 700, tint: 0xe8e2d0, damageBonus: 1.0 },
      { id: 'reaver_necrose', name: 'Reaver Nécrose', priceXenocoins: 1200, tint: 0xb44dff, damageBonus: 1.03 },
      { id: 'reaver_symbiose', name: 'Reaver Symbiose Parfaite', priceXenocoins: 1800, tint: 0x8aff7a, damageBonus: 1.05 }
    ]
  },

  // ----------------------------------------------------------- PRÉCISION ---
  void_eye: {
    id: 'void_eye',
    name: 'Œil du Vide',
    class: 'sniper',
    price: 4500,
    damage: { head: 255, body: 150, legs: 120 },
    fireRate: 0.75,
    auto: false,
    magSize: 5,
    reserve: 15,
    reloadTime: 3.7,
    range: 100,
    falloff: 1.0,
    penetration: 2,
    spread: 0.06,        // quasi inutilisable sans viser
    adsSpread: 0.0008,
    recoil: [
      [0.000, 0.060], [0.003, 0.058], [-0.003, 0.058], [0.004, 0.056],
      [-0.004, 0.056], [0.004, 0.055], [-0.004, 0.055], [0.005, 0.054],
      [-0.005, 0.054], [0.005, 0.053], [-0.005, 0.053], [0.005, 0.052]
    ],
    moveSpeedMult: 0.76,
    equipTime: 1.25,
    sfx: 'shot_sniper',
    tracerColor: 0xb04dff,
    description: 'Fusil de précision à lentille gravitationnelle. Là où l’Œil se pose, une ligne violette traverse la station — et quelqu’un, quelque part, cesse d’exister.',
    variants: [
      { id: 'void_eye_comete', name: 'Œil du Vide Comète', priceXenocoins: 1000, tint: 0x9fd4ff, damageBonus: 1.0 },
      { id: 'void_eye_singularite', name: 'Œil de la Singularité', priceXenocoins: 2400, tint: 0x7a2eff, damageBonus: 1.05 }
    ]
  },

  // --------------------------------------------------------------- LOURD ---
  devastator: {
    id: 'devastator',
    name: 'Dévastateur',
    class: 'heavy',
    price: 5200,
    damage: { head: 95, body: 38, legs: 32 },
    fireRate: 12.5,
    auto: true,
    magSize: 100,
    reserve: 200,
    reloadTime: 5.0,
    range: 32,
    falloff: 0.82,
    penetration: 2,
    spread: 0.021,
    adsSpread: 0.012,
    recoil: [
      [0.000, 0.012], [0.002, 0.014], [-0.002, 0.016], [0.003, 0.018],
      [-0.004, 0.019], [0.006, 0.017], [-0.007, 0.015], [0.009, 0.012],
      [-0.010, 0.010], [0.011, 0.008], [-0.012, 0.007], [0.012, 0.006]
    ],
    moveSpeedMult: 0.8,
    equipTime: 1.25,
    sfx: 'shot_heavy',
    tracerColor: 0xff2e5f,
    description: 'Mitrailleuse à tambour de siège : cent projectiles à fission qui rongent les murs comme le beurre. Lent à porter, ruineux à acheter, impossible à ignorer.',
    variants: [
      { id: 'devastator_forteresse', name: 'Dévastateur Forteresse', priceXenocoins: 900, tint: 0x8a93a6, damageBonus: 1.0 },
      { id: 'devastator_apocalypse', name: 'Dévastateur Apocalypse', priceXenocoins: 2600, tint: 0xff3050, damageBonus: 1.05 }
    ]
  }
};

/** Chemin du modèle 3D d'une arme — délègue à la convention centrale. */
export function weaponModelPath(id) {
  return modelPathForWeapon(id);
}

// Disposition du menu d'achat (phase buy). `category` = classe d'arme,
// `label` = titre affiché, `items` = ids dans l'ordre d'affichage (prix croissant).
export const BUY_MENU_LAYOUT = [
  { category: 'sidearm', label: 'Armes de poing', items: ['stinger_p', 'viper', 'nova_hand'] },
  { category: 'smg', label: 'Mitraillettes', items: ['wasp', 'hornet'] },
  { category: 'shotgun', label: 'Fusil à pompe', items: ['maw'] },
  { category: 'rifle', label: 'Fusils d’assaut', items: ['pulsar_r7', 'reaver'] },
  { category: 'sniper', label: 'Précision', items: ['void_eye'] },
  { category: 'heavy', label: 'Armement lourd', items: ['devastator'] }
];
