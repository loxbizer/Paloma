// ============================================================================
// XENOSTRIKE — Génération des 11 modèles d'armes .glb (géométrie procédurale).
// Conventions (docs/CONTRACTS.md) :
//   - origine à la POIGNÉE, canon vers -Z, échelle réaliste (fusil ≈ 0.8 m) ;
//   - nœud vide « Muzzle » au bout du canon (flashs / tracers) ;
//   - nœud vide « Sight » au-dessus du corps (alignement de la visée ADS) ;
//   - MeshStandardMaterial uniquement, métal sombre + accents émissifs par arme,
//     AUCUNE texture image. Budget : 300 à 1500 triangles par arme.
// Usage : `node tools/gen-weapons.mjs [dossierSortie]` ou via generate-assets.mjs.
// ============================================================================
import * as THREE from 'three';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportGLB, validateGLB } from './export-glb.mjs';
import { WEAPON_IDS } from '../src/game/constants.js';

// ----------------------------------------------------------------- Matériaux
// Palette commune « métal sombre » ; chaque arme y ajoute SES accents émissifs.
const BASE = {
  metal: 0x1b1f27,   // carcasse principale
  metal2: 0x2a3140,  // pièces mobiles / carters
  steel: 0x424d63,   // acier clair (rails, canons)
  grip: 0x12151d,    // poignées / crosses
  bone: 0xcfc9b8     // os / chitine (armes bio)
};

function metal(color, roughness = 0.38, metalness = 0.88) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function matte(color, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.15 });
}
function glow(color, intensity = 2.6) {
  // Base presque noire : seule l'émission ressort (accent néon).
  return new THREE.MeshStandardMaterial({
    color: 0x05070a, emissive: color, emissiveIntensity: intensity,
    roughness: 0.4, metalness: 0.0
  });
}

// ----------------------------------------------------------------- Géométrie
/** Boîte chanfreinée : rectangle extrudé le long de Z avec biseau sur les arêtes. */
function chamferBoxGeo(w, h, d, c = 0.006) {
  c = Math.min(c, w * 0.24, h * 0.24, d * 0.24);
  const hw = w / 2 - c, hh = h / 2 - c;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(d - c * 2, 0.001),
    steps: 1, bevelEnabled: true,
    bevelThickness: c, bevelSize: c, bevelSegments: 1
  });
  geo.center();
  return geo;
}

/** Ajoute un mesh positionné/orienté au groupe et le retourne. */
function P(group, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  group.add(m);
  return m;
}
function cbox(g, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, c = 0.006) {
  return P(g, chamferBoxGeo(w, h, d, c), mat, x, y, z, rx, ry, rz);
}
function box(g, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  return P(g, new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
}
/** Cylindre orienté le long de Z (axe du canon). rAvant = rayon côté -Z. */
function cylZ(g, mat, rAvant, rArriere, len, seg, x, y, z) {
  const geo = new THREE.CylinderGeometry(rArriere, rAvant, len, seg);
  geo.rotateX(Math.PI / 2); // +Y -> +Z : le rayon « bottom » (rAvant) pointe vers -Z
  return P(g, geo, mat, x, y, z);
}
/** Cylindre le long de X (tambours latéraux). */
function cylX(g, mat, r, len, seg, x, y, z) {
  const geo = new THREE.CylinderGeometry(r, r, len, seg);
  geo.rotateZ(Math.PI / 2);
  return P(g, geo, mat, x, y, z);
}
/** Anneau autour de l'axe Z (bagues de canon, bobines). */
function ring(g, mat, r, tube, x, y, z) {
  return P(g, new THREE.TorusGeometry(r, tube, 5, 12), mat, x, y, z);
}
/** Cône pointant vers -Z (pointes, cache-flammes). */
function coneZ(g, mat, r, len, seg, x, y, z, sx = 1, sy = 1) {
  const geo = new THREE.ConeGeometry(r, len, seg);
  geo.rotateX(-Math.PI / 2); // pointe vers -Z
  const m = P(g, geo, mat, x, y, z);
  m.scale.set(sx, sy, 1);
  return m;
}
/** Sphère (formes organiques), éventuellement aplatie. */
function sph(g, mat, r, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = P(g, new THREE.SphereGeometry(r, 8, 6), mat, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}
/** Poignée inclinée (haut vers l'avant) — commune à presque toutes les armes. */
function grip(g, mat, w, h, d, x, y, z, lean = -0.24) {
  return cbox(g, mat, w, h, d, x, y, z, lean, 0, 0);
}
/** Pontet (protège-détente) simple : trois barrettes fines. */
function triggerGuard(g, mat, y, z, size = 0.05) {
  box(g, mat, 0.008, 0.006, size, 0, y - 0.028, z);            // barre basse
  box(g, mat, 0.008, 0.03, 0.006, 0, y - 0.014, z - size / 2); // montant avant
  box(g, mat, 0.006, 0.024, 0.008, 0, y - 0.012, z + size / 2 - 0.004); // détente
}
/** Nœuds vides Muzzle (bout du canon) et Sight (visée ADS) — noms EXACTS. */
function sockets(g, muzzle, sight) {
  const m = new THREE.Object3D();
  m.name = 'Muzzle';
  m.position.set(muzzle[0], muzzle[1], muzzle[2]);
  g.add(m);
  const s = new THREE.Object3D();
  s.name = 'Sight';
  s.position.set(sight[0], sight[1], sight[2]);
  g.add(s);
}
/** Compte les triangles d'un groupe (contrôle du budget 300–1500). */
function triCount(group) {
  let tris = 0;
  group.traverse((o) => {
    if (o.isMesh) {
      const geo = o.geometry;
      tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    }
  });
  return Math.round(tris);
}

// ============================================================================
// LES 11 ARMES — silhouettes distinctes, accents émissifs signés.
// ============================================================================

/** blade — « Croc du Vide » : lame énergétique cyan sur garde xéno (~0.72 m). */
function buildBlade() {
  const g = new THREE.Group();
  const mMetal = metal(BASE.metal);
  const mGrip = matte(BASE.grip);
  const mSteel = metal(BASE.steel, 0.3);
  const mBlade = glow(0x35ffe0, 2.2);
  const mCore = glow(0xd8fff8, 4.0);

  // Poignée (origine) enroulée de segments, pommeau lumineux à l'arrière.
  cbox(g, mGrip, 0.042, 0.05, 0.15, 0, 0, 0.045);
  box(g, mMetal, 0.046, 0.054, 0.012, 0, 0, 0.005);
  box(g, mMetal, 0.046, 0.054, 0.012, 0, 0, 0.05);
  box(g, mMetal, 0.046, 0.054, 0.012, 0, 0, 0.095);
  cbox(g, mMetal, 0.05, 0.058, 0.03, 0, 0, 0.13);
  sph(g, glow(0x35ffe0, 3.2), 0.014, 0, 0, 0.148);

  // Garde asymétrique : plaque + deux griffes inclinées vers l'avant.
  cbox(g, mSteel, 0.12, 0.07, 0.045, 0, 0, -0.045);
  cbox(g, mMetal, 0.02, 0.03, 0.11, 0.062, 0.01, -0.09, 0.25, 0.28, 0);
  cbox(g, mMetal, 0.02, 0.03, 0.11, -0.062, 0.01, -0.09, 0.25, -0.28, 0);

  // Émetteur du champ : bague + col conique.
  cylZ(g, mSteel, 0.016, 0.024, 0.05, 10, 0, 0, -0.09);
  ring(g, glow(0x35ffe0, 3.0), 0.022, 0.005, 0, 0, -0.105);

  // Lame : voile d'énergie plat + cœur sur-brillant + pointe effilée.
  box(g, mBlade, 0.012, 0.085, 0.46, 0, 0.004, -0.345);
  box(g, mCore, 0.005, 0.04, 0.5, 0, 0.004, -0.35);
  coneZ(g, mBlade, 0.048, 0.13, 4, 0, 0.004, -0.63, 0.25, 0.9);

  // Barbelures dorsales (style xéno) le long du dos de la lame.
  box(g, mMetal, 0.008, 0.03, 0.05, 0, 0.055, -0.2, -0.5, 0, 0);
  box(g, mMetal, 0.008, 0.026, 0.045, 0, 0.05, -0.32, -0.5, 0, 0);
  box(g, mMetal, 0.008, 0.02, 0.04, 0, 0.042, -0.43, -0.5, 0, 0);

  sockets(g, [0, 0.004, -0.7], [0, 0.09, -0.05]);
  return g;
}

/** stinger_p — pistolet compact de dotation, accents sarcelle (~0.28 m). */
function buildStingerP() {
  const g = new THREE.Group();
  const mMetal = metal(BASE.metal);
  const mSlide = metal(BASE.metal2, 0.32);
  const mGrip = matte(BASE.grip);
  const mGlow = glow(0x3ce0c8, 2.4);

  // Poignée à l'origine + chargeur affleurant.
  grip(g, mGrip, 0.036, 0.125, 0.055, 0, -0.058, 0.012);
  box(g, mMetal, 0.03, 0.02, 0.046, 0, -0.122, 0.024, -0.24, 0, 0);
  // Carcasse et glissière crantée.
  cbox(g, mMetal, 0.042, 0.05, 0.2, 0, 0.018, -0.045);
  cbox(g, mSlide, 0.046, 0.032, 0.21, 0, 0.058, -0.05);
  box(g, mSlide, 0.048, 0.012, 0.05, 0, 0.052, 0.03); // stries arrière
  // Canon + bague de bouche.
  cylZ(g, mSlide, 0.011, 0.011, 0.05, 10, 0, 0.052, -0.175);
  ring(g, mGlow, 0.014, 0.0035, 0, 0.052, -0.198);
  // Pontet + accents lumineux latéraux + voyant de culasse.
  triggerGuard(g, mMetal, 0.0, -0.03, 0.05);
  box(g, mGlow, 0.002, 0.01, 0.12, 0.0235, 0.045, -0.05);
  box(g, mGlow, 0.002, 0.01, 0.12, -0.0235, 0.045, -0.05);
  box(g, mGlow, 0.02, 0.004, 0.02, 0, 0.076, 0.02);
  // Organes de visée (créneaux avant/arrière).
  box(g, mMetal, 0.006, 0.012, 0.008, 0, 0.08, -0.145);
  box(g, mMetal, 0.02, 0.01, 0.008, 0, 0.079, 0.045);

  sockets(g, [0, 0.052, -0.2], [0, 0.092, -0.03]);
  return g;
}

/** viper — pistolet-mitrailleur de poche agressif, accents acide (~0.27 m). */
function buildViper() {
  const g = new THREE.Group();
  const mMetal = metal(0x20242e);
  const mDark = metal(0x14171f, 0.5);
  const mGrip = matte(BASE.grip);
  const mGlow = glow(0xa8ff3c, 2.6);

  // Poignée + LONG chargeur incliné qui dépasse (silhouette machine-pistol).
  grip(g, mGrip, 0.038, 0.12, 0.058, 0, -0.055, 0.012);
  cbox(g, mDark, 0.03, 0.11, 0.05, 0, -0.145, 0.032, -0.32, 0, 0);
  box(g, mGlow, 0.032, 0.008, 0.045, 0, -0.196, 0.048, -0.32, 0, 0); // fond de chargeur néon
  // Carcasse trapue, carter supérieur biseauté.
  cbox(g, mMetal, 0.046, 0.055, 0.19, 0, 0.016, -0.04);
  cbox(g, mDark, 0.05, 0.03, 0.14, 0, 0.06, -0.02);
  cbox(g, mDark, 0.05, 0.028, 0.05, 0, 0.055, -0.115, 0.35, 0, 0); // bec avant plongeant
  // Compensateur à fentes + canon court.
  cylZ(g, mDark, 0.012, 0.012, 0.04, 10, 0, 0.045, -0.15);
  cbox(g, mMetal, 0.034, 0.034, 0.045, 0, 0.045, -0.185);
  box(g, mGlow, 0.036, 0.006, 0.01, 0, 0.045, -0.185); // fente latérale néon
  box(g, mGlow, 0.006, 0.036, 0.01, 0, 0.045, -0.175);
  // Évents « venin » sur les flancs + pontet.
  box(g, mGlow, 0.002, 0.014, 0.05, 0.024, 0.02, -0.08, 0, 0, 0.3);
  box(g, mGlow, 0.002, 0.014, 0.05, -0.024, 0.02, -0.08, 0, 0, -0.3);
  triggerGuard(g, mMetal, 0.0, -0.025, 0.048);
  // Crochet de crosse replié (moignon arrière).
  cbox(g, mDark, 0.024, 0.02, 0.05, 0, 0.03, 0.075, 0.5, 0, 0);

  sockets(g, [0, 0.045, -0.208], [0, 0.085, -0.02]);
  return g;
}

/** nova_hand — canon de poing à bobine stellaire, halo bleu (~0.34 m). */
function buildNovaHand() {
  const g = new THREE.Group();
  const mMetal = metal(0x232936);
  const mSteel = metal(BASE.steel, 0.28);
  const mGrip = matte(BASE.grip);
  const mGlow = glow(0x7fb4ff, 2.8);
  const mCore = glow(0xd6e8ff, 4.2);

  // Grosse poignée revolver + chien arrière.
  grip(g, mGrip, 0.042, 0.13, 0.062, 0, -0.06, 0.02, -0.3);
  cbox(g, mMetal, 0.02, 0.035, 0.03, 0, 0.055, 0.055, 0.5, 0, 0);
  // Carcasse + BOBINE centrale (le « barillet » plasma) cerclée de trois anneaux.
  cbox(g, mMetal, 0.05, 0.06, 0.24, 0, 0.02, -0.06);
  cylZ(g, mSteel, 0.034, 0.034, 0.095, 12, 0, 0.032, -0.075);
  ring(g, mGlow, 0.036, 0.005, 0, 0.032, -0.045);
  ring(g, mGlow, 0.036, 0.005, 0, 0.032, -0.075);
  ring(g, mGlow, 0.036, 0.005, 0, 0.032, -0.105);
  sph(g, mCore, 0.012, 0.041, 0.032, -0.075); // cœur visible côté droit
  sph(g, mCore, 0.012, -0.041, 0.032, -0.075); // et côté gauche
  // Canon massif à méplat + frein de bouche annulaire.
  cylZ(g, mSteel, 0.017, 0.02, 0.13, 10, 0, 0.04, -0.185);
  box(g, mMetal, 0.014, 0.014, 0.11, 0, 0.062, -0.18);
  cylZ(g, mMetal, 0.024, 0.024, 0.03, 10, 0, 0.04, -0.245);
  ring(g, mCore, 0.017, 0.004, 0, 0.04, -0.262);
  // Pontet renforcé + rail ventral court.
  triggerGuard(g, mMetal, 0.0, -0.03, 0.055);
  box(g, mMetal, 0.03, 0.014, 0.08, 0, -0.014, -0.15);
  // Guidon / cran de mire.
  box(g, mSteel, 0.007, 0.016, 0.008, 0, 0.078, -0.23);
  box(g, mSteel, 0.022, 0.012, 0.008, 0, 0.076, 0.05);

  sockets(g, [0, 0.04, -0.264], [0, 0.095, -0.04]);
  return g;
}

/** wasp — SMG anguleuse d'éco-round, crosse squelette, accents ambre (~0.6 m). */
function buildWasp() {
  const g = new THREE.Group();
  const mMetal = metal(0x1d222c);
  const mDark = metal(0x141821, 0.5);
  const mGrip = matte(BASE.grip);
  const mGlow = glow(0xffc832, 2.5);

  // Poignée (origine) + corps compact très anguleux (carters superposés).
  grip(g, mGrip, 0.038, 0.12, 0.058, 0, -0.055, 0.01);
  cbox(g, mMetal, 0.05, 0.07, 0.3, 0, 0.03, -0.05);
  cbox(g, mDark, 0.054, 0.03, 0.2, 0, 0.075, -0.09, -0.06, 0, 0); // capot plongeant
  cbox(g, mDark, 0.04, 0.03, 0.08, 0, 0.02, -0.22, 0.3, 0, 0);    // bec avant
  // Chargeur long incliné vers l'avant.
  cbox(g, mDark, 0.034, 0.15, 0.05, 0, -0.09, -0.075, 0.3, 0, 0);
  box(g, mGlow, 0.036, 0.01, 0.044, 0, -0.158, -0.096, 0.3, 0, 0); // témoin de munitions
  // Crosse squelette : deux barres + plaque d'épaule.
  box(g, mMetal, 0.016, 0.012, 0.17, 0, 0.05, 0.19, -0.12, 0, 0);
  box(g, mMetal, 0.016, 0.012, 0.15, 0, -0.01, 0.185, 0.28, 0, 0);
  cbox(g, mGrip, 0.02, 0.09, 0.024, 0, 0.02, 0.27);
  // Carénage de canon fendu + canon + bouche crantée.
  cbox(g, mMetal, 0.036, 0.046, 0.13, 0, 0.045, -0.265);
  box(g, mGlow, 0.002, 0.012, 0.1, 0.019, 0.045, -0.265); // fentes néon
  box(g, mGlow, 0.002, 0.012, 0.1, -0.019, 0.045, -0.265);
  cylZ(g, mDark, 0.009, 0.009, 0.08, 8, 0, 0.045, -0.36);
  ring(g, mGlow, 0.012, 0.003, 0, 0.045, -0.398);
  // Poignée avant courte + viseur crénelé.
  grip(g, mGrip, 0.03, 0.06, 0.036, 0, -0.015, -0.19, 0.35);
  box(g, mMetal, 0.006, 0.014, 0.01, 0, 0.098, -0.16);
  box(g, mMetal, 0.02, 0.012, 0.01, 0, 0.097, 0.02);

  sockets(g, [0, 0.045, -0.4], [0, 0.112, -0.05]);
  return g;
}

/** hornet — SMG blindée à canon caréné intégral, accents braise (~0.64 m). */
function buildHornet() {
  const g = new THREE.Group();
  const mMetal = metal(0x232833);
  const mDark = metal(0x161a22, 0.45);
  const mSteel = metal(BASE.steel, 0.3);
  const mGrip = matte(BASE.grip);
  const mGlow = glow(0xff8a2a, 2.6);

  // Poignée + corps prismatique massif.
  grip(g, mGrip, 0.04, 0.125, 0.06, 0, -0.058, 0.008);
  cbox(g, mMetal, 0.054, 0.08, 0.32, 0, 0.032, -0.04);
  cbox(g, mDark, 0.058, 0.024, 0.26, 0, 0.084, -0.05);
  // Rail supérieur cranté (5 créneaux) + viseur holo (cadre + point braise).
  for (let i = 0; i < 5; i++) {
    box(g, mSteel, 0.03, 0.008, 0.02, 0, 0.1, -0.14 + i * 0.045);
  }
  box(g, mDark, 0.032, 0.03, 0.008, 0, 0.125, -0.01);
  box(g, mDark, 0.032, 0.03, 0.008, 0, 0.125, 0.03);
  box(g, mDark, 0.032, 0.008, 0.046, 0, 0.142, 0.01);
  sph(g, mGlow, 0.007, 0, 0.124, 0.01);
  // Chargeur droit + puits renforcé.
  cbox(g, mMetal, 0.04, 0.05, 0.06, 0, -0.03, -0.1);
  cbox(g, mDark, 0.034, 0.13, 0.052, 0, -0.115, -0.105, 0.12, 0, 0);
  // Crosse pleine trapézoïdale + appui-joue.
  cbox(g, mGrip, 0.04, 0.095, 0.14, 0, 0.005, 0.19, 0.1, 0, 0);
  cbox(g, mDark, 0.042, 0.024, 0.1, 0, 0.065, 0.17);
  // Canon caréné intégral (suppresseur) + évents braise.
  cylZ(g, mSteel, 0.017, 0.017, 0.17, 12, 0, 0.05, -0.28);
  ring(g, mGlow, 0.019, 0.004, 0, 0.05, -0.225);
  ring(g, mGlow, 0.019, 0.004, 0, 0.05, -0.3);
  cylZ(g, mDark, 0.011, 0.014, 0.05, 8, 0, 0.05, -0.385);
  // Bandes latérales néon + pontet.
  box(g, mGlow, 0.002, 0.014, 0.2, 0.028, 0.03, -0.05);
  box(g, mGlow, 0.002, 0.014, 0.2, -0.028, 0.03, -0.05);
  triggerGuard(g, mMetal, 0.0, -0.028, 0.052);

  sockets(g, [0, 0.05, -0.41], [0, 0.124, 0.01]);
  return g;
}

/** maw — fusil à pompe MASSIF à double canon, évents rouges (~0.8 m). */
function buildMaw() {
  const g = new THREE.Group();
  const mMetal = metal(0x252a33);
  const mDark = metal(0x15181f, 0.5);
  const mSteel = metal(0x4a5468, 0.3);
  const mGrip = matte(BASE.grip);
  const mGlow = glow(0xff4433, 2.8);

  // Poignée pistolet + ÉNORME boîtier de culasse.
  grip(g, mGrip, 0.044, 0.13, 0.065, 0, -0.06, 0.015);
  cbox(g, mMetal, 0.078, 0.095, 0.24, 0, 0.035, -0.03);
  // Évents « braise » sur les deux flancs du boîtier.
  for (let i = 0; i < 3; i++) {
    box(g, mGlow, 0.002, 0.02, 0.03, 0.04, 0.045, -0.1 + i * 0.055);
    box(g, mGlow, 0.002, 0.02, 0.03, -0.04, 0.045, -0.1 + i * 0.055);
  }
  // DOUBLE canon côte à côte + gueules cerclées + rainure néon centrale.
  cylZ(g, mSteel, 0.021, 0.021, 0.36, 12, 0.026, 0.055, -0.3);
  cylZ(g, mSteel, 0.021, 0.021, 0.36, 12, -0.026, 0.055, -0.3);
  ring(g, mDark, 0.024, 0.005, 0.026, 0.055, -0.475);
  ring(g, mDark, 0.024, 0.005, -0.026, 0.055, -0.475);
  box(g, mGlow, 0.008, 0.008, 0.3, 0, 0.055, -0.28); // gorge lumineuse entre les canons
  box(g, mDark, 0.075, 0.02, 0.05, 0, 0.055, -0.15); // frette avant
  // Garde-main pompe strié sous les canons.
  cbox(g, mGrip, 0.06, 0.05, 0.13, 0, -0.005, -0.3);
  box(g, mDark, 0.064, 0.01, 0.11, 0, -0.03, -0.3);
  // Crosse épaisse inclinée + sabot amortisseur.
  cbox(g, mGrip, 0.05, 0.08, 0.2, 0, 0.02, 0.19, 0.14, 0, 0);
  cbox(g, mDark, 0.054, 0.09, 0.03, 0, 0.008, 0.29, 0.14, 0, 0);
  // Hausse rustique + pontet large.
  box(g, mSteel, 0.03, 0.012, 0.01, 0, 0.105, -0.02);
  box(g, mSteel, 0.008, 0.016, 0.01, 0, 0.083, -0.45);
  triggerGuard(g, mMetal, 0.0, -0.03, 0.06);

  // Muzzle unique entre les deux gueules.
  sockets(g, [0, 0.055, -0.48], [0, 0.125, -0.02]);
  return g;
}

/** pulsar_r7 — fusil plasma précis : rails, dissipateurs, bobines cyan (~0.86 m). */
function buildPulsarR7() {
  const g = new THREE.Group();
  const mMetal = metal(0x1e2430);
  const mDark = metal(0x141821, 0.45);
  const mSteel = metal(BASE.steel, 0.28);
  const mGrip = matte(BASE.grip);
  const mGlow = glow(0x35d9ff, 2.8);
  const mCore = glow(0xbdf3ff, 4.0);

  // Poignée + corps long et tendu.
  grip(g, mGrip, 0.04, 0.13, 0.06, 0, -0.06, 0.01);
  cbox(g, mMetal, 0.05, 0.075, 0.36, 0, 0.035, -0.08);
  cbox(g, mDark, 0.044, 0.04, 0.14, 0, 0.03, -0.29, 0.04, 0, 0); // fût avant fuselé
  // Rail supérieur cranté (6 créneaux) + guidon fin.
  box(g, mSteel, 0.024, 0.01, 0.34, 0, 0.082, -0.08);
  for (let i = 0; i < 6; i++) {
    box(g, mDark, 0.028, 0.008, 0.018, 0, 0.09, -0.21 + i * 0.05);
  }
  box(g, mSteel, 0.006, 0.018, 0.008, 0, 0.098, -0.3);
  // Conduit plasma latéral (ligne de vie cyan) des deux côtés.
  box(g, mGlow, 0.003, 0.016, 0.3, 0.0265, 0.035, -0.08);
  box(g, mGlow, 0.003, 0.016, 0.3, -0.0265, 0.035, -0.08);
  // Dissipateurs thermiques : 3 ailettes de chaque côté du fût.
  for (let i = 0; i < 3; i++) {
    box(g, mSteel, 0.07, 0.006, 0.03, 0, 0.062, -0.245 - i * 0.038);
  }
  // Canon accélérateur + 3 bobines toroïdales cyan + bouche focalisatrice.
  cylZ(g, mSteel, 0.012, 0.014, 0.24, 10, 0, 0.05, -0.43);
  ring(g, mGlow, 0.02, 0.005, 0, 0.05, -0.38);
  ring(g, mGlow, 0.02, 0.005, 0, 0.05, -0.44);
  ring(g, mGlow, 0.02, 0.005, 0, 0.05, -0.5);
  cylZ(g, mDark, 0.017, 0.013, 0.045, 10, 0, 0.05, -0.555);
  sph(g, mCore, 0.009, 0, 0.05, -0.572); // lueur de bouche résiduelle
  // Chargeur-cellule incliné + hublot d'énergie.
  cbox(g, mDark, 0.036, 0.12, 0.055, 0, -0.08, -0.11, 0.22, 0, 0);
  box(g, mCore, 0.038, 0.02, 0.04, 0, -0.075, -0.113, 0.22, 0, 0);
  // Crosse ajourée + plaque d'épaule.
  cbox(g, mMetal, 0.036, 0.07, 0.18, 0, 0.02, 0.2, 0.08, 0, 0);
  box(g, mGlow, 0.038, 0.012, 0.06, 0, 0.032, 0.19);
  cbox(g, mGrip, 0.04, 0.1, 0.03, 0, 0.005, 0.29);
  triggerGuard(g, mMetal, 0.0, -0.03, 0.055);

  sockets(g, [0, 0.05, -0.578], [0, 0.104, -0.06]);
  return g;
}

/** reaver — fusil bio-symbiotique : nacres d'os, veines vertes (~0.84 m). */
function buildReaver() {
  const g = new THREE.Group();
  const mChitin = metal(0x222b26, 0.55, 0.4); // chitine sombre
  const mBone = matte(BASE.bone, 0.7);
  const mDark = metal(0x11161a, 0.5);
  const mVein = glow(0x4dff6a, 2.8);
  const mSac = glow(0x2fae4a, 1.6);

  // Poignée organique + échine centrale bombée.
  grip(g, matte(0x18201b), 0.042, 0.125, 0.06, 0, -0.058, 0.012, -0.28);
  cbox(g, mChitin, 0.052, 0.075, 0.34, 0, 0.032, -0.07, 0, 0, 0, 0.012);
  // Trois nodules dorsaux (glandes) + côtes d'os latérales.
  sph(g, mSac, 0.026, 0, 0.085, -0.02, 1, 0.75, 1.15);
  sph(g, mSac, 0.023, 0, 0.082, -0.11, 1, 0.75, 1.15);
  sph(g, mSac, 0.02, 0, 0.078, -0.19, 1, 0.75, 1.15);
  for (let i = 0; i < 4; i++) {
    box(g, mBone, 0.006, 0.05, 0.014, 0.028, 0.03, -0.2 + i * 0.07, 0, 0, 0.25);
    box(g, mBone, 0.006, 0.05, 0.014, -0.028, 0.03, -0.2 + i * 0.07, 0, 0, -0.25);
  }
  // Veines luminescentes serpentant sur les flancs (segments brisés).
  box(g, mVein, 0.003, 0.008, 0.12, 0.027, 0.05, -0.05, 0, 0.12, 0);
  box(g, mVein, 0.003, 0.008, 0.1, 0.027, 0.024, -0.17, 0, -0.15, 0);
  box(g, mVein, 0.003, 0.008, 0.12, -0.027, 0.05, -0.05, 0, -0.12, 0);
  box(g, mVein, 0.003, 0.008, 0.1, -0.027, 0.024, -0.17, 0, 0.15, 0);
  // Sac-chargeur ventral (poche vivante) + sphincter lumineux.
  sph(g, mSac, 0.042, 0, -0.075, -0.09, 0.8, 1.25, 1);
  ring(g, mVein, 0.02, 0.004, 0, -0.028, -0.09);
  // Canon-trompe évasé + mandibules de bouche (3 crocs).
  cylZ(g, mChitin, 0.02, 0.013, 0.26, 10, 0, 0.045, -0.4);
  ring(g, mVein, 0.017, 0.004, 0, 0.045, -0.35);
  ring(g, mVein, 0.02, 0.004, 0, 0.045, -0.46);
  coneZ(g, mBone, 0.012, 0.06, 4, 0, 0.075, -0.52, 0.6, 1);
  coneZ(g, mBone, 0.012, 0.06, 4, 0.026, 0.03, -0.52, 0.6, 1);
  coneZ(g, mBone, 0.012, 0.06, 4, -0.026, 0.03, -0.52, 0.6, 1);
  // Crosse vertébrale : trois segments décroissants + pointe d'os.
  cbox(g, mChitin, 0.04, 0.06, 0.08, 0, 0.02, 0.16, 0.1, 0, 0, 0.01);
  cbox(g, mChitin, 0.034, 0.05, 0.07, 0, 0.012, 0.235, 0.16, 0, 0, 0.01);
  coneZ(g, mBone, 0.018, 0.07, 6, 0, 0.002, 0.305).rotation.x = Math.PI; // pointe retournée vers +Z
  triggerGuard(g, mDark, 0.0, -0.028, 0.05);

  sockets(g, [0, 0.045, -0.54], [0, 0.108, -0.02]);
  return g;
}

/** void_eye — sniper long à lunette gravitationnelle violette (~1.16 m). */
function buildVoidEye() {
  const g = new THREE.Group();
  const mMetal = metal(0x1c2029);
  const mDark = metal(0x12151c, 0.45);
  const mSteel = metal(0x3c4557, 0.3);
  const mGrip = matte(BASE.grip);
  const mGlow = glow(0xb04dff, 2.8);
  const mLens = glow(0xe4c8ff, 4.2);

  // Poignée + boîtier de culasse long.
  grip(g, mGrip, 0.04, 0.13, 0.06, 0, -0.06, 0.01);
  cbox(g, mMetal, 0.05, 0.08, 0.34, 0, 0.035, -0.06);
  // Levier de verrou latéral + fenêtre d'éjection lumineuse.
  cylX(g, mSteel, 0.007, 0.05, 8, 0.045, 0.05, 0.03);
  sph(g, mSteel, 0.012, 0.07, 0.05, 0.03);
  box(g, mGlow, 0.002, 0.014, 0.06, 0.0255, 0.045, -0.06);
  // LONGUE ligne de canon : fût, canon fin, frein de bouche à ailettes.
  cbox(g, mDark, 0.04, 0.05, 0.22, 0, 0.04, -0.32);
  cylZ(g, mSteel, 0.014, 0.014, 0.5, 12, 0, 0.05, -0.55);
  ring(g, mGlow, 0.017, 0.004, 0, 0.05, -0.34);
  ring(g, mGlow, 0.017, 0.004, 0, 0.05, -0.62);
  cbox(g, mDark, 0.036, 0.036, 0.08, 0, 0.05, -0.83);
  box(g, mGlow, 0.04, 0.006, 0.05, 0, 0.05, -0.83);  // fentes latérales du frein
  box(g, mGlow, 0.006, 0.04, 0.05, 0, 0.05, -0.845);
  // LUNETTE : long tube surélevé, deux montants, lentilles émissives.
  box(g, mSteel, 0.014, 0.03, 0.02, 0, 0.095, -0.1);
  box(g, mSteel, 0.014, 0.03, 0.02, 0, 0.095, 0.04);
  cylZ(g, mDark, 0.026, 0.024, 0.22, 12, 0, 0.125, -0.03);
  cylZ(g, mDark, 0.03, 0.026, 0.03, 12, 0, 0.125, -0.15);  // pare-soleil avant
  cylZ(g, mDark, 0.028, 0.024, 0.025, 12, 0, 0.125, 0.09); // œilleton arrière
  P(g, new THREE.CylinderGeometry(0.021, 0.021, 0.004, 12).rotateX(Math.PI / 2), mLens, 0, 0.125, -0.163);
  P(g, new THREE.CylinderGeometry(0.019, 0.019, 0.004, 12).rotateX(Math.PI / 2), mLens, 0, 0.125, 0.101);
  box(g, mGlow, 0.002, 0.008, 0.16, 0.027, 0.125, -0.03); // liseré du tube
  // Bipied replié sous le fût (deux tiges vers l'arrière).
  box(g, mSteel, 0.008, 0.008, 0.16, 0.02, 0.005, -0.32, -0.18, 0, 0);
  box(g, mSteel, 0.008, 0.008, 0.16, -0.02, 0.005, -0.32, -0.18, 0, 0);
  // Crosse squelette longue + appui-joue + sabot.
  box(g, mMetal, 0.016, 0.014, 0.22, 0, 0.055, 0.22, -0.08, 0, 0);
  box(g, mMetal, 0.016, 0.014, 0.2, 0, -0.02, 0.21, 0.22, 0, 0);
  cbox(g, mDark, 0.036, 0.03, 0.12, 0, 0.075, 0.2);
  cbox(g, mGrip, 0.024, 0.11, 0.03, 0, 0.015, 0.32);
  triggerGuard(g, mMetal, 0.0, -0.03, 0.055);

  sockets(g, [0, 0.05, -0.87], [0, 0.125, 0.101]);
  return g;
}

/** devastator — mitrailleuse lourde à tambour, cœur à fission carmin (~0.98 m). */
function buildDevastator() {
  const g = new THREE.Group();
  const mMetal = metal(0x262b34);
  const mDark = metal(0x14171e, 0.45);
  const mSteel = metal(0x48526a, 0.3);
  const mGrip = matte(BASE.grip);
  const mGlow = glow(0xff2e5f, 2.8);
  const mCore = glow(0xffb3c4, 4.0);

  // Poignée arrière + poignée avant (port à deux mains).
  grip(g, mGrip, 0.044, 0.13, 0.062, 0, -0.06, 0.01);
  grip(g, mGrip, 0.038, 0.09, 0.05, 0, -0.055, -0.28, 0.3);
  // Corps MASSIF : double caisson superposé + plaques boulonnées.
  cbox(g, mMetal, 0.07, 0.1, 0.36, 0, 0.04, -0.06);
  cbox(g, mDark, 0.076, 0.04, 0.3, 0, 0.105, -0.05);
  box(g, mSteel, 0.078, 0.014, 0.05, 0, 0.04, -0.06);   // frette centrale
  box(g, mSteel, 0.078, 0.014, 0.05, 0, 0.04, 0.06);
  // TAMBOUR latéral (axe X) + moyeu lumineux à fission.
  cylX(g, mDark, 0.075, 0.06, 14, 0, -0.035, 0.04);
  P(g, new THREE.CylinderGeometry(0.05, 0.05, 0.064, 14).rotateZ(Math.PI / 2), mMetal, 0, -0.035, 0.04);
  P(g, new THREE.CylinderGeometry(0.018, 0.018, 0.068, 10).rotateZ(Math.PI / 2), mCore, 0, -0.035, 0.04);
  ring(g, mGlow, 0.06, 0.005, 0.034, -0.035, 0.04).rotation.y = Math.PI / 2;
  ring(g, mGlow, 0.06, 0.005, -0.034, -0.035, 0.04).rotation.y = Math.PI / 2;
  // Ligne d'alimentation lumineuse tambour → culasse.
  box(g, mGlow, 0.01, 0.03, 0.008, 0, 0.0, 0.04, 0.3, 0, 0);
  // Canon lourd caréné : manchon percé + trois bagues + canon interne.
  cylZ(g, mSteel, 0.024, 0.026, 0.3, 12, 0, 0.05, -0.4);
  ring(g, mDark, 0.028, 0.006, 0, 0.05, -0.31);
  ring(g, mDark, 0.028, 0.006, 0, 0.05, -0.41);
  ring(g, mDark, 0.028, 0.006, 0, 0.05, -0.51);
  box(g, mGlow, 0.002, 0.014, 0.24, 0.027, 0.05, -0.4);  // évents surchauffe
  box(g, mGlow, 0.002, 0.014, 0.24, -0.027, 0.05, -0.4);
  cylZ(g, mDark, 0.014, 0.014, 0.1, 10, 0, 0.05, -0.58);
  ring(g, mGlow, 0.018, 0.004, 0, 0.05, -0.628);
  // Poignée de transport arquée au-dessus du corps.
  box(g, mSteel, 0.016, 0.05, 0.014, 0, 0.15, -0.12);
  box(g, mSteel, 0.016, 0.05, 0.014, 0, 0.15, 0.02);
  cbox(g, mSteel, 0.018, 0.016, 0.16, 0, 0.178, -0.05);
  // Crosse-bloc courte + sabot épais (l'arme se porte, ne s'épaule guère).
  cbox(g, mGrip, 0.05, 0.09, 0.12, 0, 0.02, 0.2, 0.1, 0, 0);
  cbox(g, mDark, 0.056, 0.1, 0.03, 0, 0.012, 0.27, 0.1, 0, 0);
  triggerGuard(g, mMetal, 0.0, -0.03, 0.06);
  // Hausse et guidon sommaires.
  box(g, mSteel, 0.024, 0.012, 0.01, 0, 0.132, 0.1);
  box(g, mSteel, 0.007, 0.018, 0.008, 0, 0.07, -0.56);

  sockets(g, [0, 0.05, -0.632], [0, 0.132, 0.02]);
  return g;
}

// ============================================================================
// Génération + validation.
// ============================================================================
const BUILDERS = {
  blade: buildBlade,
  stinger_p: buildStingerP,
  viper: buildViper,
  nova_hand: buildNovaHand,
  wasp: buildWasp,
  hornet: buildHornet,
  maw: buildMaw,
  pulsar_r7: buildPulsarR7,
  reaver: buildReaver,
  void_eye: buildVoidEye,
  devastator: buildDevastator
};

/**
 * Génère les 11 GLB d'armes dans `outDir` puis les valide (en-tête GLB,
 * présence des nœuds Muzzle et Sight, budget de triangles).
 */
export async function generateWeapons(outDir) {
  for (const id of WEAPON_IDS) {
    const builder = BUILDERS[id];
    if (!builder) throw new Error(`Aucun builder pour l'arme « ${id} »`);
    const group = builder();
    group.name = `weapon_${id}`;
    const tris = triCount(group);
    const path = join(outDir, `weapon_${id}.glb`);
    await exportGLB(group, [], path);

    // Validation stricte : GLB lisible + nœuds obligatoires + budget de tris.
    const json = await validateGLB(path);
    const nodeNames = (json.nodes || []).map((n) => n.name);
    for (const requis of ['Muzzle', 'Sight']) {
      if (!nodeNames.includes(requis)) {
        throw new Error(`weapon_${id}.glb : nœud « ${requis} » manquant`);
      }
    }
    if (tris < 300 || tris > 1500) {
      console.warn(`  ⚠ weapon_${id}.glb : ${tris} tris (budget 300–1500)`);
    }
    console.log(`  ✓ weapon_${id}.glb — ${tris} tris, ${(json.meshes || []).length} meshes`);
  }
  return WEAPON_IDS.length;
}

// Lancement direct : `node tools/gen-weapons.mjs [dossierSortie]`
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const outDir = process.argv[2] || fileURLToPath(new URL('../assets/models', import.meta.url));
  console.log(`Génération des ${WEAPON_IDS.length} armes → ${outDir}`);
  const n = await generateWeapons(outDir);
  console.log(`${n} armes générées.`);
}
