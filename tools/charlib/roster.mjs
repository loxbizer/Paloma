// Roster XENOSTRIKE — définitions visuelles et stylistiques des 15 personnages.
// Source gameplay : docs/CONTRACTS.md (ids, gabarits, palettes, personnalités).
// Ce fichier ne décrit QUE ce qui sert à générer les modèles et animations.

/**
 * Champs :
 * - id / name / species : identité (voir contrat).
 * - bodyType : gabarit morphologique.
 * - height : taille en mètres (1.6 – 2.1).
 * - colors : { primary, secondary, emissive } — hex ints du contrat.
 * - shape : proportions du corps (fractions de la taille ou multiplicateurs).
 * - extras : os supplémentaires du squelette (queue, antennes, crête, mâchoire, 2e paire de bras).
 * - anim : style d'animation { tempo, mass (0 léger → 1 très lourd), swagger, stance }.
 */
export const ROSTER = [
  {
    id: 'zephyr', name: 'Zephyr', species: 'xeno', bodyType: 'insectoid',
    height: 1.75,
    colors: { primary: 0x1fc4de, secondary: 0x12151f, emissive: 0x7df6ff },
    shape: { bulk: 0.82, shoulderW: 0.24, hipW: 0.145, waist: 0.68, armLen: 1.05, legLen: 1.06, headSize: 0.105 },
    extras: { antenna: { len: 0.34 } },
    anim: { tempo: 1.25, mass: 0.12, swagger: 0.9, stance: 0.9 }
  },
  {
    id: 'krogoth', name: 'Krogoth', species: 'xeno', bodyType: 'heavy_reptile',
    height: 2.1,
    colors: { primary: 0x4d8040, secondary: 0x9a7231, emissive: 0xa8ff54 },
    shape: { bulk: 1.42, shoulderW: 0.31, hipW: 0.19, waist: 0.95, armLen: 1.0, legLen: 0.92, headSize: 0.115 },
    extras: { tail: { len: 0.95, r: 0.10 }, crest: { len: 0.30 }, jaw: true },
    anim: { tempo: 0.8, mass: 0.95, swagger: 0.3, stance: 1.25 }
  },
  {
    id: 'sylkis', name: 'Sylkis', species: 'xeno', bodyType: 'four_arms',
    height: 1.9,
    colors: { primary: 0x8340e8, secondary: 0xc6c9d4, emissive: 0xd9b3ff },
    shape: { bulk: 0.85, shoulderW: 0.25, hipW: 0.15, waist: 0.62, armLen: 1.08, legLen: 1.08, headSize: 0.10 },
    extras: { armB: true, crest: { len: 0.22 } },
    anim: { tempo: 1.0, mass: 0.2, swagger: 1.0, stance: 0.85 }
  },
  {
    id: 'vex9', name: 'Vex-9', species: 'xeno', bodyType: 'techno_symbiote',
    height: 1.8,
    colors: { primary: 0xe8641f, secondary: 0x565b63, emissive: 0xffa53d },
    shape: { bulk: 1.0, shoulderW: 0.27, hipW: 0.15, waist: 0.8, armLen: 1.0, legLen: 1.0, headSize: 0.105 },
    extras: { antenna: { len: 0.22 } },
    anim: { tempo: 1.0, mass: 0.45, swagger: 0.0, stance: 1.0 }
  },
  {
    id: 'umbra', name: 'Umbra', species: 'xeno', bodyType: 'shadow',
    height: 1.85,
    colors: { primary: 0x37327f, secondary: 0x0a0a14, emissive: 0x8f7bff },
    shape: { bulk: 0.78, shoulderW: 0.235, hipW: 0.14, waist: 0.6, armLen: 1.1, legLen: 1.1, headSize: 0.098 },
    extras: { tail: { len: 0.75, r: 0.06 } },
    anim: { tempo: 0.85, mass: 0.08, swagger: 0.7, stance: 0.8 }
  },
  {
    id: 'thorne', name: 'Thorne', species: 'xeno', bodyType: 'plant',
    height: 1.95,
    colors: { primary: 0x35803c, secondary: 0xdd7fae, emissive: 0xff9ed2 },
    shape: { bulk: 1.12, shoulderW: 0.26, hipW: 0.17, waist: 0.9, armLen: 1.04, legLen: 0.98, headSize: 0.105 },
    extras: { crest: { len: 0.34 } },
    anim: { tempo: 0.7, mass: 0.6, swagger: 0.2, stance: 1.1 }
  },
  {
    id: 'pulsar', name: 'Pulsar', species: 'xeno', bodyType: 'round_energy',
    height: 1.6,
    colors: { primary: 0xffd23f, secondary: 0x2f66e8, emissive: 0xffe86b },
    shape: { bulk: 1.35, shoulderW: 0.27, hipW: 0.19, waist: 1.1, armLen: 0.88, legLen: 0.85, headSize: 0.12 },
    extras: { antenna: { len: 0.2 } },
    anim: { tempo: 1.4, mass: 0.3, swagger: 1.0, stance: 1.05 }
  },
  {
    id: 'naia', name: 'Naia', species: 'xeno', bodyType: 'aquatic',
    height: 1.78,
    colors: { primary: 0x2fd4bd, secondary: 0xeffdfa, emissive: 0x83f7e6 },
    shape: { bulk: 0.88, shoulderW: 0.24, hipW: 0.155, waist: 0.7, armLen: 1.04, legLen: 1.02, headSize: 0.102 },
    extras: { crest: { len: 0.26 }, tail: { len: 0.5, r: 0.05 } },
    anim: { tempo: 0.9, mass: 0.15, swagger: 0.6, stance: 0.9 }
  },
  {
    id: 'ragnok', name: 'Ragnok', species: 'xeno', bodyType: 'horned_brute',
    height: 2.05,
    colors: { primary: 0xb92222, secondary: 0x1a1210, emissive: 0xff4b34 },
    shape: { bulk: 1.38, shoulderW: 0.33, hipW: 0.18, waist: 0.92, armLen: 1.06, legLen: 0.92, headSize: 0.11 },
    extras: { jaw: true },
    anim: { tempo: 1.05, mass: 0.85, swagger: 0.8, stance: 1.3 }
  },
  {
    id: 'echo', name: 'Echo', species: 'xeno', bodyType: 'pale_mimic',
    height: 1.7,
    colors: { primary: 0xece9f4, secondary: 0xb9c6ea, emissive: 0xcdb4ff },
    shape: { bulk: 0.8, shoulderW: 0.23, hipW: 0.145, waist: 0.72, armLen: 1.02, legLen: 1.02, headSize: 0.112 },
    extras: {},
    anim: { tempo: 1.0, mass: 0.1, swagger: 0.5, stance: 0.9 }
  },
  {
    id: 'steele', name: 'Cmdr Steele', species: 'guardian', bodyType: 'human_soldier',
    height: 1.85,
    colors: { primary: 0x707784, secondary: 0x2d4a80, emissive: 0x53a8ff },
    shape: { bulk: 1.08, shoulderW: 0.26, hipW: 0.16, waist: 0.85, armLen: 1.0, legLen: 1.0, headSize: 0.105 },
    extras: {},
    anim: { tempo: 0.95, mass: 0.5, swagger: 0.15, stance: 1.05 }
  },
  {
    id: 'wraith', name: 'Wraith', species: 'guardian', bodyType: 'human_recon',
    height: 1.8,
    colors: { primary: 0x415c3c, secondary: 0x15181c, emissive: 0x6fff8d },
    shape: { bulk: 0.88, shoulderW: 0.24, hipW: 0.15, waist: 0.72, armLen: 1.02, legLen: 1.04, headSize: 0.104 },
    extras: {},
    anim: { tempo: 0.85, mass: 0.25, swagger: 0.25, stance: 0.9 }
  },
  {
    id: 'ferrai', name: 'Doc Ferrai', species: 'guardian', bodyType: 'human_medic',
    height: 1.72,
    colors: { primary: 0xe9e9e5, secondary: 0xc22a35, emissive: 0xff5a64 },
    shape: { bulk: 0.92, shoulderW: 0.235, hipW: 0.16, waist: 0.7, armLen: 0.98, legLen: 1.0, headSize: 0.107 },
    extras: {},
    anim: { tempo: 1.05, mass: 0.2, swagger: 0.7, stance: 0.95 }
  },
  {
    id: 'bastion7', name: 'Bastion-7', species: 'guardian', bodyType: 'human_exo',
    height: 2.0,
    colors: { primary: 0x8d949e, secondary: 0xd97c20, emissive: 0xffb347 },
    shape: { bulk: 1.4, shoulderW: 0.32, hipW: 0.19, waist: 1.0, armLen: 1.02, legLen: 0.95, headSize: 0.10 },
    extras: {},
    anim: { tempo: 0.75, mass: 1.0, swagger: 0.0, stance: 1.2 }
  },
  {
    id: 'nyx', name: 'Nyx', species: 'guardian', bodyType: 'human_stealth',
    height: 1.75,
    colors: { primary: 0x1a1424, secondary: 0x6d28d9, emissive: 0xb35cff },
    shape: { bulk: 0.82, shoulderW: 0.23, hipW: 0.15, waist: 0.62, armLen: 1.03, legLen: 1.06, headSize: 0.102 },
    extras: {},
    anim: { tempo: 1.1, mass: 0.1, swagger: 1.0, stance: 0.85 }
  }
];

export function getDef(id) {
  const def = ROSTER.find((d) => d.id === id);
  if (!def) throw new Error(`Personnage inconnu : ${id}`);
  return def;
}
