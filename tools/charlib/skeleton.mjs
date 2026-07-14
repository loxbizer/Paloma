// Squelette humanoïde paramétrique — noms d'os EXACTS du contrat.
// T-pose : bras tendus le long de ±X, personnage face à -Z, origine aux pieds.
import * as THREE from 'three';

/**
 * Construit le rig d'un personnage à partir de sa définition (roster.mjs).
 * Retourne { rootBone, bones, byName, boneIndex, dims, wpos }.
 * Les positions d'os sont locales (offsets parent→enfant), rotations identité
 * (les animations posent des rotations locales absolues).
 */
export function buildRig(def) {
  const H = def.height;
  const sh = def.shape;

  // — Dimensions dérivées —
  const hipY = H * 0.50 * sh.legLen;
  const ankleY = H * 0.045;
  const thigh = (hipY - ankleY) * 0.52;
  const shin = (hipY - ankleY) * 0.48;
  const torsoLen = (H - hipY) * 0.72;
  const neckLen = (H - hipY) * 0.11;
  const headH = H * sh.headSize * 1.55;
  const shoulderHalf = H * sh.shoulderW * 0.5;
  const hipHalf = H * sh.hipW * 0.5;
  const armUpper = H * 0.155 * sh.armLen;
  const armLower = H * 0.140 * sh.armLen;
  const handLen = H * 0.075;
  const footLen = H * 0.14;

  const bones = [];
  const byName = new Map();
  const bone = (name, parent, x, y, z) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    bones.push(b);
    byName.set(name, b);
    return b;
  };

  // — Colonne —
  const hips = bone('Hips', null, 0, hipY, 0);
  const spine = bone('Spine', hips, 0, torsoLen * 0.28, 0);
  const chest = bone('Chest', spine, 0, torsoLen * 0.34, 0);
  const neck = bone('Neck', chest, 0, torsoLen * 0.38, 0);
  const head = bone('Head', neck, 0, neckLen, 0);

  // — Bras (T-pose le long de ±X ; droite = +X) —
  const shY = torsoLen * 0.30;
  for (const [suf, sx] of [['_L', -1], ['_R', 1]]) {
    const sho = bone('Shoulder' + suf, chest, sx * shoulderHalf * 0.72, shY, 0);
    const up = bone('UpperArm' + suf, sho, sx * shoulderHalf * 0.38, 0, 0);
    const lo = bone('LowerArm' + suf, up, sx * armUpper, 0, 0);
    const hand = bone('Hand' + suf, lo, sx * armLower, 0, 0);
    if (suf === '_R') {
      // Nœud vide d'attache d'arme — l'arme (canon vers -Z) s'aligne sur l'axe +X de la main.
      const socket = new THREE.Object3D();
      socket.name = 'WeaponSocket_R';
      socket.position.set(handLen * 0.7, -0.015, 0);
      socket.rotation.y = -Math.PI / 2;
      hand.add(socket);
    }
  }

  // — Jambes —
  for (const [suf, sx] of [['_L', -1], ['_R', 1]]) {
    const up = bone('UpperLeg' + suf, hips, sx * hipHalf, -H * 0.02, 0);
    const lo = bone('LowerLeg' + suf, up, 0, -thigh, 0);
    bone('Foot' + suf, lo, 0, -shin, 0);
  }

  // — Extras selon gabarit —
  const ex = def.extras || {};
  if (ex.tail) {
    const seg = ex.tail.len / 3;
    const t1 = bone('Tail1', hips, 0, 0.01, hipHalf * 0.6 + 0.06);
    const t2 = bone('Tail2', t1, 0, -seg * 0.22, seg);
    bone('Tail3', t2, 0, -seg * 0.30, seg);
  }
  if (ex.antenna) {
    bone('Antenna_L', head, -headH * 0.22, headH * 0.78, -headH * 0.05);
    bone('Antenna_R', head, headH * 0.22, headH * 0.78, -headH * 0.05);
  }
  if (ex.crest) bone('Crest', head, 0, headH * 0.65, headH * 0.12);
  if (ex.jaw) bone('Jaw', head, 0, headH * 0.10, -headH * 0.28);
  if (ex.armB) {
    // 2e paire de bras (Sylkis) — plus basse et légèrement plus courte.
    const shY2 = torsoLen * 0.06;
    for (const [suf, sx] of [['_L', -1], ['_R', 1]]) {
      const up = bone('ArmB_UpperArm' + suf, chest, sx * shoulderHalf * 0.85, shY2, 0.01);
      const lo = bone('ArmB_LowerArm' + suf, up, sx * armUpper * 0.82, 0, 0);
      bone('ArmB_Hand' + suf, lo, sx * armLower * 0.82, 0, 0);
    }
  }

  hips.updateMatrixWorld(true);

  const boneIndex = new Map(bones.map((b, i) => [b.name, i]));
  const dims = {
    H, hipY, ankleY, thigh, shin, torsoLen, neckLen, headH,
    shoulderHalf, hipHalf, armUpper, armLower, handLen, footLen,
    bulk: sh.bulk, waist: sh.waist
  };

  /** Position monde (bind pose) d'un os. */
  const wpos = (name, target = new THREE.Vector3()) => {
    const b = byName.get(name);
    if (!b) throw new Error(`Os inconnu : ${name}`);
    return b.getWorldPosition(target);
  };

  return { rootBone: hips, bones, byName, boneIndex, dims, wpos };
}

/** Positions locales de repos (pour les pistes de position des clips). */
export function restPositions(rig) {
  const map = new Map();
  for (const b of rig.bones) map.set(b.name, b.position.clone());
  return map;
}
