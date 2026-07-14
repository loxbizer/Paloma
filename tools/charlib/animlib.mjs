// Bibliothèque d'animation procédurale — échantillonne des fonctions de pose
// en pistes de keyframes (quaternions + positions), boucles parfaites garanties
// par construction (fonctions périodiques du temps).
import * as THREE from 'three';
import { restPositions } from './skeleton.mjs';

export const TAU = Math.PI * 2;
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const ease = (x) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
/** Rampe lissée : 0 avant a, 1 après b (u normalisé). */
export const seg = (u, a, b) => ease((u - a) / (b - a));
/** Enveloppe entrée/sortie douce d'un segment (0 → 1 → 0). */
export const env = (u) => ease(Math.min(u * 3.5, (1 - u) * 3.5));
/** Impulsion décroissante (recul, impact). */
export const pulse = (u, at, decay = 10) => (u < at ? 0 : Math.exp(-(u - at) * decay));

/** Accumulateur de pose : rotations euler additives + offsets de position. */
export class Pose {
  constructor() {
    this.r = new Map();
    this.p = new Map();
  }
  rot(name, x, y, z) {
    const e = this.r.get(name) || [0, 0, 0];
    e[0] += x; e[1] += y; e[2] += z;
    this.r.set(name, e);
  }
  pos(name, x, y, z) {
    const o = this.p.get(name) || [0, 0, 0];
    o[0] += x; o[1] += y; o[2] += z;
    this.p.set(name, o);
  }
}

// ————————— Aides de pose (conventions : face -Z, T-pose bras le long de ±X) —————————
const sideSign = (s) => (s === '_R' ? 1 : -1);

/** Abaisse un bras depuis la T-pose (down en rad), le balance vers l'avant (fwd), plie le coude. */
export function setArm(P, s, { down = 0, fwd = 0, elbow = 0, prefix = '' } = {}) {
  const k = sideSign(s);
  if (down) P.rot(prefix + 'UpperArm' + s, 0, 0, -k * down);
  if (fwd) P.rot(prefix + 'UpperArm' + s, fwd, 0, 0);
  if (elbow) P.rot(prefix + 'LowerArm' + s, 0, k * elbow, 0);
}
/** Lève un bras au-dessus de la T-pose (up en rad, vers le ciel). */
export function armUp(P, s, up, prefix = '') {
  P.rot(prefix + 'UpperArm' + s, 0, 0, sideSign(s) * up);
}
/** Pointe un bras vers l'avant (rotation d'épaule autour de Y). */
export function armFwd(P, s, amt, prefix = '') {
  P.rot(prefix + 'UpperArm' + s, 0, sideSign(s) * amt, 0);
}
export function legSwing(P, s, amt) { P.rot('UpperLeg' + s, amt, 0, 0); }
export function knee(P, s, amt) { P.rot('LowerLeg' + s, -amt, 0, 0); }
export function footRot(P, s, amt) { P.rot('Foot' + s, amt, 0, 0); }
/** Écarte une jambe latéralement (positif = vers l'extérieur). */
export function legSpread(P, s, amt) { P.rot('UpperLeg' + s, 0, 0, sideSign(s) * amt); }

/** Posture de repos commune — appliquée par TOUS les clips pour des fondus cohérents. */
export function stance(P, def, has) {
  const A = def.anim;
  const down = 1.22 - 0.28 * A.stance;
  for (const s of ['_L', '_R']) {
    setArm(P, s, { down, elbow: 0.28 });
    P.rot('Shoulder' + s, 0, 0, -sideSign(s) * 0.06);
    P.rot('Hand' + s, 0, 0, -sideSign(s) * 0.18);
    legSpread(P, s, 0.05 * A.stance);
    knee(P, s, 0.07);
    footRot(P, s, -0.03);
    if (has('ArmB_UpperArm' + s)) setArm(P, s, { down: down * 0.85, elbow: 0.45, prefix: 'ArmB_' });
  }
}

/**
 * Mouvements secondaires des os extras (queue, antennes, crête, mâchoire, 2e paire de bras).
 * Périodique en t/dur → boucle parfaite. energy ∈ [0..2].
 */
export function extrasSway(P, t, dur, def, has, energy = 0.6) {
  const ph = TAU * t / dur;
  if (has('Tail1')) {
    const a = 0.16 * energy;
    P.rot('Tail1', 0.05 * energy * Math.sin(ph * 2), a * Math.sin(ph), 0);
    P.rot('Tail2', 0.05 * energy * Math.sin(ph * 2 + 1.1), a * 1.3 * Math.sin(ph + 1.0), 0);
    P.rot('Tail3', 0.06 * energy * Math.sin(ph * 2 + 2.2), a * 1.6 * Math.sin(ph + 2.0), 0);
  }
  for (const s of ['_L', '_R']) {
    if (has('Antenna' + s)) {
      const k = sideSign(s);
      P.rot('Antenna' + s, 0.14 * energy * Math.sin(ph * 2 + k), 0, k * 0.1 * energy * Math.sin(ph + k * 0.7));
    }
  }
  if (has('Crest')) P.rot('Crest', 0.08 * energy * Math.sin(ph * 2 + 0.5), 0, 0.05 * energy * Math.sin(ph));
  if (has('Jaw')) P.rot('Jaw', -0.06 * energy * (0.5 + 0.5 * Math.sin(ph * 2 + 1)), 0, 0);
}

/**
 * Échantillonne fn(t, P) en AnimationClip.
 * Les os non touchés par fn restent en T-pose → toujours appeler stance() dans fn.
 */
export function makeClip(name, dur, fps, rig, fn) {
  const rest = restPositions(rig);
  const nk = Math.max(2, Math.round(dur * fps));
  const times = [];
  const samples = [];
  for (let k = 0; k <= nk; k++) {
    const t = (k / nk) * dur;
    times.push(t);
    const P = new Pose();
    fn(t, P);
    samples.push(P);
  }
  const rotBones = new Set(), posBones = new Set();
  for (const P of samples) {
    // On ignore les os absents du rig (ex : Echo imite Sylkis sans avoir ses 4 bras).
    for (const n of P.r.keys()) if (rig.byName.has(n)) rotBones.add(n);
    for (const n of P.p.keys()) if (rig.byName.has(n)) posBones.add(n);
  }
  const tracks = [];
  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  for (const bone of rotBones) {
    const values = new Float32Array((nk + 1) * 4);
    samples.forEach((P, i) => {
      const e = P.r.get(bone) || [0, 0, 0];
      euler.set(e[0], e[1], e[2], 'XYZ');
      quat.setFromEuler(euler);
      values.set([quat.x, quat.y, quat.z, quat.w], i * 4);
    });
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  for (const bone of posBones) {
    const base = rest.get(bone);
    const values = new Float32Array((nk + 1) * 3);
    samples.forEach((P, i) => {
      const o = P.p.get(bone) || [0, 0, 0];
      values.set([base.x + o[0], base.y + o[1], base.z + o[2]], i * 3);
    });
    tracks.push(new THREE.VectorKeyframeTrack(`${bone}.position`, times, values));
  }
  return new THREE.AnimationClip(name, dur, tracks);
}

// ————————————————————————— CLIPS PARTAGÉS (12) —————————————————————————

/** Construit les 12 clips communs, stylisés par def.anim (tempo, mass, swagger, stance). */
export function buildSharedClips(def, rig) {
  const has = (n) => rig.byName.has(n);
  const d = rig.dims;
  const A = def.anim;
  const clips = [];

  // ——— idle : respiration + micro-mouvements de tête + transfert de poids ———
  clips.push(makeClip('idle', 3.6, 20, rig, (t, P) => {
    stance(P, def, has);
    const ph = TAU * t / 3.6;
    const breath = Math.sin(ph * 3);
    P.rot('Chest', 0.028 * breath, 0, 0);
    P.rot('Spine', 0.012 * breath, 0, 0.02 * Math.sin(ph));
    P.pos('Hips', 0.008 * Math.sin(ph), 0.006 * breath - 0.004, 0);
    P.rot('Hips', 0, 0, 0.028 * Math.sin(ph));
    P.rot('Head', 0.03 * Math.sin(ph * 2 + 1.3), 0.09 * Math.sin(ph + 0.6), 0.02 * Math.sin(ph * 2));
    P.rot('Neck', 0.015 * breath, 0.03 * Math.sin(ph + 0.6), 0);
    for (const s of ['_L', '_R']) {
      setArm(P, s, { fwd: 0.035 * Math.sin(ph * 2 + sideSign(s)) });
      P.rot('Shoulder' + s, 0, 0, -sideSign(s) * 0.02 * breath);
    }
    extrasSway(P, t, 3.6, def, has, 0.55 + A.swagger * 0.2);
  }));

  // ——— run : cycle course complet (hanches, genoux, balancier, rebond) ———
  const runDur = 0.66 / Math.pow(A.tempo, 0.6);
  const runFn = (back) => (t, P) => {
    stance(P, def, has);
    const ph = TAU * t / runDur;
    const dir = back ? -0.72 : 1;
    const amp = (0.82 - A.mass * 0.18) * dir;
    for (const [s, o] of [['_L', 0], ['_R', Math.PI]]) {
      const swing = amp * Math.sin(ph + o);
      legSwing(P, s, swing);
      knee(P, s, (1.05 - A.mass * 0.2) * (0.5 - 0.5 * Math.cos(ph + o - 1.05)) * Math.abs(dir));
      footRot(P, s, 0.32 * Math.sin(ph + o - 1.6) * dir - 0.08);
      // Balancier des bras opposé aux jambes.
      setArm(P, s, { fwd: -swing * (0.78 + A.swagger * 0.15), elbow: 0.42 + 0.3 * Math.max(0, -Math.sin(ph + o)) });
    }
    const bob = 0.5 - 0.5 * Math.cos(ph * 2);
    P.pos('Hips', 0.012 * Math.sin(ph), -0.012 - (0.030 + A.mass * 0.02) * bob, 0);
    P.rot('Hips', 0, -0.13 * Math.sin(ph) * dir, (0.05 + A.mass * 0.04) * Math.sin(ph));
    P.rot('Spine', back ? 0.10 : -0.20 - A.mass * 0.08, 0.05 * Math.sin(ph) * dir, 0);
    P.rot('Chest', -0.03, 0.16 * Math.sin(ph) * dir, 0);
    P.rot('Head', back ? -0.06 : 0.14, -0.07 * Math.sin(ph) * dir, 0);
    extrasSway(P, t, runDur, def, has, 1.3);
  };
  clips.push(makeClip('run', runDur, 30, rig, runFn(false)));
  clips.push(makeClip('run_back', runDur, 30, rig, runFn(true)));

  // ——— strafe_l / strafe_r : pas chassés latéraux, buste incliné ———
  const strafeDur = 0.62 / Math.pow(A.tempo, 0.5);
  const strafeFn = (dir) => (t, P) => { // dir = +1 gauche (-X), -1 droite
    stance(P, def, has);
    const ph = TAU * t / strafeDur;
    for (const [s, o] of [['_L', 0], ['_R', Math.PI]]) {
      P.rot('UpperLeg' + s, 0.16 * Math.sin(ph + o), 0, -dir * (0.16 + 0.22 * Math.sin(ph + o)));
      knee(P, s, 0.4 + 0.3 * Math.sin(ph + o + 0.5));
      setArm(P, s, { fwd: 0.14 * Math.sin(ph + o), elbow: 0.5 });
    }
    const bob = 0.5 - 0.5 * Math.cos(ph * 2);
    P.pos('Hips', dir * 0.010 * Math.sin(ph), -0.02 - 0.022 * bob, 0);
    P.rot('Hips', 0, 0, dir * 0.06);
    P.rot('Spine', -0.08, dir * 0.06, dir * 0.09);
    P.rot('Head', 0.04, -dir * 0.14, -dir * 0.07);
    extrasSway(P, t, strafeDur, def, has, 1.0);
  };
  clips.push(makeClip('strafe_l', strafeDur, 30, rig, strafeFn(1)));
  clips.push(makeClip('strafe_r', strafeDur, 30, rig, strafeFn(-1)));

  // ——— crouch : accroupi, pieds ancrés (baisse des hanches calée sur les angles) ———
  const tA = 1.05, kA = 1.55; // flexion cuisse / genou
  const crouchDrop = -(d.thigh * (1 - Math.cos(tA)) + d.shin * (1 - Math.cos(kA - tA)));
  const crouchBase = (P) => {
    for (const s of ['_L', '_R']) {
      legSwing(P, s, tA);
      knee(P, s, kA);
      footRot(P, s, kA - tA);
      legSpread(P, s, 0.14);
      setArm(P, s, { down: 0.35, fwd: 0.55, elbow: 1.05 });
    }
    P.pos('Hips', 0, crouchDrop, -0.02);
    P.rot('Spine', -0.34, 0, 0);
    P.rot('Chest', -0.08, 0, 0);
    P.rot('Head', 0.34, 0, 0);
  };
  clips.push(makeClip('crouch_idle', 3.2, 20, rig, (t, P) => {
    stance(P, def, has);
    crouchBase(P);
    const ph = TAU * t / 3.2;
    P.rot('Chest', 0.03 * Math.sin(ph * 3), 0, 0);
    P.rot('Head', 0.02 * Math.sin(ph * 3 + 1), 0.10 * Math.sin(ph), 0);
    P.pos('Hips', 0, 0.008 * Math.sin(ph * 3), 0);
    extrasSway(P, t, 3.2, def, has, 0.4);
  }));
  clips.push(makeClip('crouch_walk', 1.05, 24, rig, (t, P) => {
    stance(P, def, has);
    crouchBase(P);
    const ph = TAU * t / 1.05;
    for (const [s, o] of [['_L', 0], ['_R', Math.PI]]) {
      legSwing(P, s, 0.34 * Math.sin(ph + o));
      knee(P, s, 0.18 * Math.sin(ph + o + 1.2));
      setArm(P, s, { fwd: -0.18 * Math.sin(ph + o) });
    }
    P.pos('Hips', 0, -0.015 * (0.5 - 0.5 * Math.cos(ph * 2)), 0);
    P.rot('Hips', 0, -0.07 * Math.sin(ph), 0.03 * Math.sin(ph));
    extrasSway(P, t, 1.05, def, has, 0.8);
  }));

  // ——— pose de visée deux mains (partagée par shoot / reload) ———
  const aimPose = (P, intensity = 1) => {
    setArm(P, '_R', { down: 0.18 });
    armFwd(P, '_R', 1.30 * intensity);
    P.rot('LowerArm_R', 0, 0.30 * intensity, 0);
    setArm(P, '_L', { down: 0.45 });
    armFwd(P, '_L', 1.05 * intensity);
    P.rot('LowerArm_L', 0, -1.0 * intensity, 0);
    P.rot('Chest', 0, -0.22 * intensity, 0);
    P.rot('Spine', -0.04, -0.08 * intensity, 0);
    P.rot('Head', 0.02, 0.16 * intensity, 0);
  };

  // ——— shoot : passe rapide de tir avec recul ———
  clips.push(makeClip('shoot', 0.45, 30, rig, (t, P) => {
    stance(P, def, has);
    const u = t / 0.45;
    const in_ = seg(u, 0, 0.18);
    aimPose(P, in_);
    const kick = pulse(u, 0.2, 14);
    P.rot('UpperArm_R', 0.16 * kick, 0, 0.06 * kick);
    P.rot('UpperArm_L', 0.10 * kick, 0, 0);
    P.rot('Chest', 0.06 * kick, 0, 0);
    P.rot('Head', 0.04 * kick, 0, 0);
    P.pos('Hips', 0, -0.008 * kick, 0.012 * kick);
    extrasSway(P, t, 0.45, def, has, 0.5);
  }));

  // ——— reload : chargeur éjecté, réinséré, culasse tirée ———
  clips.push(makeClip('reload', 1.7, 30, rig, (t, P) => {
    stance(P, def, has);
    const u = t / 1.7;
    const hold = seg(u, 0, 0.12) * (1 - seg(u, 0.9, 1));
    aimPose(P, 0.75 * hold);
    // Main gauche : lâche l'arme, tombe, remonte claquer le chargeur, tire la culasse.
    const drop = seg(u, 0.15, 0.3) * (1 - seg(u, 0.42, 0.58));
    const slam = seg(u, 0.58, 0.68) * (1 - seg(u, 0.82, 0.92));
    P.rot('UpperArm_L', 0.55 * drop, 0.5 * drop, -0.35 * drop);
    P.rot('LowerArm_L', 0, 0.7 * drop - 0.35 * slam, 0);
    P.rot('Hand_L', -0.5 * slam, 0, 0.3 * drop);
    // Regard sur l'arme, épaules actives.
    const look = seg(u, 0.1, 0.25) * (1 - seg(u, 0.8, 0.95));
    P.rot('Head', -0.30 * look, 0.1 * look, 0);
    P.rot('Chest', -0.06 * look, -0.05 * look, 0);
    P.rot('UpperArm_R', 0.08 * slam, 0, 0);
    extrasSway(P, t, 1.7, def, has, 0.4);
  }));

  // ——— plant : pose du Noyau de Singularité (agenouillé, pression des mains) ———
  clips.push(makeClip('plant', 2.6, 24, rig, (t, P) => {
    stance(P, def, has);
    const u = t / 2.6;
    const kneel = seg(u, 0, 0.22) * (1 - seg(u, 0.85, 1));
    const press = seg(u, 0.25, 0.4) * (1 - seg(u, 0.8, 0.95));
    // Genou droit au sol, jambe gauche en appui.
    legSwing(P, '_L', 1.05 * kneel); knee(P, '_L', 1.5 * kneel); footRot(P, '_L', 0.45 * kneel);
    legSwing(P, '_R', -0.35 * kneel); knee(P, '_R', 1.85 * kneel); footRot(P, '_R', -0.9 * kneel);
    P.pos('Hips', 0, -(d.thigh * 0.78 + d.shin * 0.1) * kneel, -0.05 * kneel);
    P.rot('Hips', -0.1 * kneel, 0, 0);
    P.rot('Spine', -0.42 * press, 0, 0);
    P.rot('Head', 0.28 * press - 0.1 * kneel, 0, 0);
    // Les deux mains pressent le noyau (2 impulsions).
    const pump = press * 0.08 * Math.sin(TAU * 2 * clamp01((u - 0.3) / 0.5));
    for (const s of ['_L', '_R']) {
      setArm(P, s, { down: 0.5 * press, fwd: (1.15 + pump * 4) * press, elbow: 0.4 * press });
      P.rot('Hand' + s, -0.4 * press, 0, 0);
    }
    extrasSway(P, t, 2.6, def, has, 0.7 + press);
  }));

  // ——— death : effondrement crédible, style selon la masse ———
  const style = A.mass > 0.7 ? 'avant' : (A.mass < 0.25 ? 'arriere' : 'cote');
  clips.push(makeClip('death', 2.2, 30, rig, (t, P) => {
    stance(P, def, has);
    const u = t / 2.2;
    const hit = pulse(u, 0.02, 8);           // impact initial
    const fall = seg(u, 0.12, 0.62);          // chute
    const settle = 1 + 0.06 * Math.sin(TAU * 2.5 * clamp01((u - 0.62) / 0.38)) * (1 - seg(u, 0.62, 1)); // léger rebond
    const f = fall * settle;
    P.rot('Chest', 0.22 * hit, 0.1 * hit, 0);
    P.rot('Head', 0.3 * hit, 0, 0.1 * hit);
    if (style === 'arriere') {
      P.rot('Hips', 1.42 * f, 0, 0.12 * f);
      P.pos('Hips', 0, -(d.hipY - 0.16) * f, 0.16 * f);
      legSwing(P, '_L', 0.75 * f); knee(P, '_L', 0.6 * f);
      legSwing(P, '_R', 0.45 * f); knee(P, '_R', 0.9 * f);
      P.rot('Spine', 0.18 * f, 0, 0);
      P.rot('Head', 0.35 * f * (1 - seg(u, 0.5, 0.8)), 0, 0.2 * f);
      armUp(P, '_L', 0.9 * f); setArm(P, '_R', { fwd: 0.5 * f });
    } else if (style === 'avant') {
      P.rot('Hips', -1.38 * f, 0, -0.1 * f);
      P.pos('Hips', 0.05 * f, -(d.hipY - 0.18) * f, -0.12 * f);
      legSwing(P, '_L', -0.5 * f); knee(P, '_L', 0.5 * f);
      legSwing(P, '_R', -0.65 * f); knee(P, '_R', 0.3 * f);
      P.rot('Spine', -0.15 * f, 0.1 * f, 0);
      P.rot('Head', -0.25 * f, 0.15 * f, 0);
      // Les bras tentent d'amortir puis glissent.
      for (const s of ['_L', '_R']) setArm(P, s, { fwd: 1.3 * f * (1 - seg(u, 0.55, 0.9) * 0.5), elbow: 0.3 * f });
    } else {
      P.rot('Hips', 0.15 * f, 0.2 * f, 1.35 * f);
      P.pos('Hips', -0.1 * f, -(d.hipY - 0.15) * f, 0.05 * f);
      legSwing(P, '_L', 0.55 * f); knee(P, '_L', 0.85 * f);
      legSwing(P, '_R', 0.2 * f); knee(P, '_R', 0.45 * f);
      P.rot('Spine', 0.1 * f, -0.25 * f, 0.2 * f);
      P.rot('Head', 0.1 * f, -0.3 * f, 0.25 * f);
      armUp(P, '_R', 0.7 * f); setArm(P, '_L', { fwd: 0.8 * f, elbow: 0.5 * f });
    }
    // Détente finale des extras.
    extrasSway(P, t, 2.2, def, has, Math.max(0.1, 1 - u * 1.4));
  }));

  // ——— ability : charge ramassée puis libération explosive ———
  clips.push(makeClip('ability', 1.1, 30, rig, (t, P) => {
    stance(P, def, has);
    const u = t / 1.1;
    const charge = seg(u, 0, 0.32) * (1 - seg(u, 0.36, 0.5));
    const burst = seg(u, 0.36, 0.5) * (1 - seg(u, 0.72, 1));
    P.pos('Hips', 0, -0.12 * charge + 0.05 * burst, 0);
    P.rot('Spine', -0.3 * charge + 0.14 * burst, -0.25 * charge, 0);
    P.rot('Chest', -0.1 * charge + 0.12 * burst, -0.15 * charge + 0.1 * burst, 0);
    P.rot('Head', 0.15 * charge + (-0.3) * burst * -1, 0, 0);
    for (const s of ['_L', '_R']) {
      const k = sideSign(s);
      setArm(P, s, { down: 0.75 * charge, elbow: (1.25 * charge) + 0.2 * burst });
      armUp(P, s, 0.55 * burst);
      armFwd(P, s, 0.35 * burst);
      P.rot('Hand' + s, -0.4 * charge + 0.5 * burst, 0, k * 0.2 * burst);
      knee(P, s, 0.5 * charge + 0.1 * burst);
      legSwing(P, s, 0.35 * charge);
    }
    extrasSway(P, t, 1.1, def, has, 0.5 + burst * 1.5);
  }));

  return clips;
}
