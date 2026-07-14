// Construction des corps par gabarit — segments organiques, têtes sculptées,
// accents émissifs. Style : stylisé/cartoon soigné, épaules larges, taille marquée.
import * as THREE from 'three';
import { BodyBuilder, GROUP_BODY, GROUP_GLOW, rgb, mix, shade, hash3 } from './geometry.mjs';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Contexte de construction partagé entre les sous-fonctions. */
function makeCtx(def, rig) {
  const d = rig.dims;
  return {
    B: new BodyBuilder(),
    def, rig, d,
    bi: (name) => {
      const i = rig.boneIndex.get(name);
      if (i === undefined) throw new Error(`${def.id} : os absent du rig : ${name}`);
      return i;
    },
    w: (name) => rig.wpos(name),
    pri: rgb(def.colors.primary),
    sec: rgb(def.colors.secondary),
    emi: rgb(def.colors.emissive)
  };
}

// ————————————————————————————————— TORSE —————————————————————————————————

function buildTorso(ctx, { colorFn = null } = {}) {
  const { B, d, bi, w } = ctx;
  const bulk = d.bulk;
  const spineY = w('Spine').y, chestY = w('Chest').y, neckY = w('Neck').y;
  const hipY = d.hipY;
  const defaultColor = (v) => (a, dir) => {
    // Dégradé secondaire (bassin) → primaire (poitrine), ventre éclairci, dos assombri.
    let c = mix(ctx.sec, ctx.pri, Math.min(1, v * 1.3));
    const front = -dir.z; // -Z = face
    c = shade(c, 1 + front * 0.10 - 0.04 * hash3(v * 7, a * 3, 1));
    return c;
  };
  const cf = (v) => (colorFn ? (a, dir) => colorFn(v, a, dir) : defaultColor(v));
  const rings = [
    { p: [0, hipY - d.H * 0.055, 0], r: d.hipHalf * 1.05 * bulk, sz: 0.78, bones: [[bi('Hips'), 1]], colorFn: cf(0) },
    { p: [0, hipY + 0.01, 0], r: d.hipHalf * 1.22 * bulk, sz: 0.82, bones: [[bi('Hips'), 1]], colorFn: cf(0.12) },
    { p: [0, (hipY + spineY) / 2, 0], r: d.hipHalf * 1.1 * bulk * (0.5 + d.waist * 0.5), sz: 0.8, bones: [[bi('Hips'), 0.7], [bi('Spine'), 0.3]], colorFn: cf(0.26) },
    { p: [0, spineY, 0], r: d.hipHalf * 1.02 * bulk * d.waist, sz: 0.8, bones: [[bi('Hips'), 0.35], [bi('Spine'), 0.65]], colorFn: cf(0.4) },
    { p: [0, (spineY + chestY) / 2, 0], r: (d.hipHalf * d.waist + d.shoulderHalf * 0.8) * 0.5 * bulk, sz: 0.75, bones: [[bi('Spine'), 1]], colorFn: cf(0.52) },
    { p: [0, chestY - 0.02, 0], r: d.shoulderHalf * 0.80 * bulk, sz: 0.7, bones: [[bi('Spine'), 0.4], [bi('Chest'), 0.6]], colorFn: cf(0.65) },
    { p: [0, chestY + (neckY - chestY) * 0.55, 0], r: d.shoulderHalf * 0.94 * bulk, sz: 0.64, bones: [[bi('Chest'), 1]], colorFn: cf(0.85) },
    { p: [0, neckY - 0.01, 0], r: d.shoulderHalf * 0.55 * bulk, sz: 0.62, bones: [[bi('Chest'), 1]], colorFn: cf(1) }
  ];
  B.addTube(rings, { radial: 20, caps: 'both' });
  // Bassin — lobe pelvien qui arrondit la jonction torse/jambes.
  B.addBlob({
    p: [0, hipY - d.H * 0.03, 0], r: d.hipHalf * 1.12 * bulk, scale: [1.0, 0.72, 0.8],
    ws: 14, hs: 9, bones: [[bi('Hips'), 1]],
    colorFn: (dir) => shade(ctx.sec, 0.82 + Math.max(0, -dir.z) * 0.1)
  });
}

// ————————————————————————————————— MEMBRES —————————————————————————————————

function limbTube(ctx, joints, radii, boneNames, colorFn, { radial = 13 } = {}) {
  // joints : [haut, coude/genou, bas] — 7 anneaux blendés sur 2 os (transitions douces).
  const { B, bi } = ctx;
  const [a, b, c] = joints; // épaule/hanche, coude/genou, poignet/cheville
  const [bnA, bnB, bnC] = boneNames.map((n) => bi(n));
  const [rA, rMid, rB, rEnd] = radii;
  B.addTube([
    { p: a, r: rA, bones: [[bnA, 0.65], [bnB, 0.35]], colorFn: colorFn(0) },
    { p: a.clone().lerp(b, 0.3), r: rMid * 1.06, bones: [[bnB, 1]], colorFn: colorFn(0.15) },
    { p: a.clone().lerp(b, 0.65), r: rMid * 0.9, bones: [[bnB, 1]], colorFn: colorFn(0.33) },
    { p: b, r: rB, bones: [[bnB, 0.5], [bnC, 0.5]], colorFn: colorFn(0.5) },
    { p: b.clone().lerp(c, 0.35), r: rB * 0.98, bones: [[bnC, 1]], colorFn: colorFn(0.67) },
    { p: b.clone().lerp(c, 0.7), r: rB * 0.82, bones: [[bnC, 1]], colorFn: colorFn(0.85) },
    { p: c, r: rEnd, bones: [[bnC, 1]], colorFn: colorFn(1) }
  ], { radial, caps: 'both' });
}

function buildLegs(ctx) {
  const { B, d, bi, w } = ctx;
  const bulk = d.bulk;
  const thighR = d.hipHalf * 0.66 * bulk;
  const colorFn = (v) => (a, dir) => shade(mix(ctx.pri, ctx.sec, 0.35 + v * 0.45), 1 - v * 0.12 + 0.05 * Math.cos(a));
  for (const s of ['_L', '_R']) {
    limbTube(ctx,
      [w('UpperLeg' + s), w('LowerLeg' + s), w('Foot' + s)],
      [thighR, thighR * 0.88, thighR * 0.6, thighR * 0.42],
      ['Hips', 'UpperLeg' + s, 'LowerLeg' + s].map((n, i) => (i === 0 ? 'Hips' : n)),
      colorFn);
    // Pied — blob allongé vers -Z (l'avant), skinné sur Foot.
    const ankle = w('Foot' + s);
    B.addBlob({
      p: [ankle.x, d.ankleY * 0.6, ankle.z - d.footLen * 0.28],
      r: d.footLen * 0.5, scale: [0.55 * bulk, 0.42, 1.0], ws: 12, hs: 8,
      bones: [[bi('Foot' + s), 1]],
      colorFn: (dir) => shade(ctx.sec, 0.72 + Math.max(0, dir.y) * 0.25)
    });
  }
}

function buildArms(ctx, prefix = '', scale = 1) {
  const { B, d, bi, w } = ctx;
  const bulk = d.bulk;
  const upR = d.H * 0.042 * bulk * scale;
  const colorFn = (v) => (a) => shade(mix(ctx.pri, ctx.sec, v * 0.75), 1 - 0.06 * hash3(v * 5, a, 2));
  for (const s of ['_L', '_R']) {
    const names = [prefix + 'UpperArm' + s, prefix + 'LowerArm' + s, prefix + 'Hand' + s];
    limbTube(ctx, names.map((n) => w(n)),
      [upR * 1.15, upR, upR * 0.7, upR * 0.5],
      [prefix ? prefix + 'UpperArm' + s : 'Shoulder' + s, names[0], names[1]],
      colorFn, { radial: 11 });
    // Main — mitaine à 2 lobes.
    const wrist = w(names[2]);
    const sx = s === '_R' ? 1 : -1;
    B.addBlob({
      p: [wrist.x + sx * d.handLen * 0.45 * scale, wrist.y - 0.005, wrist.z],
      r: d.handLen * 0.55 * scale, scale: [1.05, 0.55, 0.75], ws: 12, hs: 7,
      bones: [[bi(names[2]), 1]], color: shade(ctx.sec, 0.85)
    });
    // Pouce.
    B.addBlob({
      p: [wrist.x + sx * d.handLen * 0.3 * scale, wrist.y, wrist.z - d.handLen * 0.42 * scale],
      r: d.handLen * 0.22 * scale, scale: [1.3, 0.8, 1.0], ws: 7, hs: 5,
      bones: [[bi(names[2]), 1]], color: shade(ctx.sec, 0.8)
    });
    // Épaule (deltoïde / épaulière) seulement pour la paire principale.
    if (!prefix) {
      const sh = w('UpperArm' + s);
      const sxd = s === '_R' ? 1 : -1;
      B.addBlob({
        p: [sh.x - sxd * upR * 0.3, sh.y + upR * 0.15, sh.z], r: upR * 1.38, scale: [1.2, 0.95, 1.0],
        ws: 12, hs: 8, bones: [[bi('Shoulder' + s), 0.75], [bi('Chest'), 0.25]],
        colorFn: (dir, v) => shade(ctx.pri, 0.75 + v * 0.4)
      });
    }
  }
}

function buildNeck(ctx, r = null) {
  const { B, d, bi, w } = ctx;
  const neck = w('Neck'), head = w('Head');
  const nr = r ?? d.H * 0.035 * d.bulk;
  B.addTube([
    { p: neck, r: nr * 1.25, bones: [[bi('Chest'), 0.5], [bi('Neck'), 0.5]], color: shade(ctx.sec, 0.9) },
    { p: head.clone().setY(head.y + 0.01), r: nr, bones: [[bi('Neck'), 0.5], [bi('Head'), 0.5]], color: shade(ctx.sec, 1.0) }
  ], { radial: 10, caps: 'none' });
}

// ——————————————————————————— AIDES DÉCORATIVES ———————————————————————————

/** Petit tube d'accent (veine bio, néon d'armure, câble). */
function accent(ctx, pts, r, boneW, color, { group = GROUP_GLOW, radial = 6, taper = 0.55 } = {}) {
  const { B } = ctx;
  const n = pts.length;
  B.addTube(pts.map((p, i) => ({
    p, r: r * (1 - (i / (n - 1)) * (1 - taper)),
    bones: Array.isArray(boneW[0]) ? boneW : [boneW],
    color
  })), { radial, caps: 'both', group });
}

/** Paire d'yeux (blobs émissifs) sur le devant de la tête. */
function eyes(ctx, headC, headH, { dx = 0.32, dy = 0.05, dz = -0.44, rx = 0.16, ry = 0.11, tilt = 0.35, color = null } = {}) {
  const { B, bi } = ctx;
  for (const sx of [-1, 1]) {
    B.addBlob({
      p: [headC.x + sx * headH * dx, headC.y + headH * dy, headC.z + headH * dz],
      r: headH, scale: [rx, ry, 0.06], ws: 10, hs: 6,
      rot: new THREE.Euler(0, 0, sx * tilt),
      bones: [[bi('Head'), 1]], color: color || ctx.emi, group: GROUP_GLOW
    });
  }
}

/** Corne / antenne : tube conique le long des os donnés ou de points libres. */
function horn(ctx, pts, r0, boneW, color, radial = 7) {
  accent(ctx, pts, r0, boneW, color, { group: GROUP_BODY, radial, taper: 0.18 });
}

/** Queue skinnée sur Tail1..3 (si présents). */
function buildTail(ctx, r0, colorFn) {
  const { B, d, bi, w, def } = ctx;
  if (!ctx.rig.byName.has('Tail1')) return;
  const t0 = w('Hips').clone().add(V3(0, 0, d.hipHalf * 0.5));
  const t1 = w('Tail1'), t2 = w('Tail2'), t3 = w('Tail3');
  const tip = t3.clone().add(t3.clone().sub(t2).multiplyScalar(0.9));
  B.addTube([
    { p: t0, r: r0, bones: [[bi('Hips'), 1]], colorFn: colorFn(0) },
    { p: t1, r: r0 * 0.85, bones: [[bi('Tail1'), 1]], colorFn: colorFn(0.25) },
    { p: t2, r: r0 * 0.6, bones: [[bi('Tail2'), 1]], colorFn: colorFn(0.5) },
    { p: t3, r: r0 * 0.38, bones: [[bi('Tail3'), 1]], colorFn: colorFn(0.75) },
    { p: tip, r: r0 * 0.16, bones: [[bi('Tail3'), 1]], colorFn: colorFn(1) }
  ], { radial: 9, caps: 'end' });
}

/** Antennes fines sur Antenna_L/R avec pointe émissive. */
function buildAntennas(ctx, len, { glowTip = true } = {}) {
  const { B, bi, w } = ctx;
  for (const s of ['_L', '_R']) {
    if (!ctx.rig.byName.has('Antenna' + s)) continue;
    const base = w('Antenna' + s);
    const sx = s === '_R' ? 1 : -1;
    const p1 = base.clone().add(V3(sx * len * 0.18, len * 0.55, -len * 0.10));
    const p2 = base.clone().add(V3(sx * len * 0.3, len * 0.95, -len * 0.35));
    horn(ctx, [base, p1, p2], len * 0.09, [bi('Antenna' + s), 1], shade(ctx.sec, 1.1), 6);
    if (glowTip) {
      B.addBlob({
        p: p2, r: len * 0.11, ws: 7, hs: 5,
        bones: [[bi('Antenna' + s), 1]], color: ctx.emi, group: GROUP_GLOW
      });
    }
  }
}

// ————————————————————————————— TÊTES PAR GABARIT —————————————————————————————

const HEADS = {
  insectoid(ctx) {
    const { B, d, bi, w } = ctx;
    const hc = w('Head').clone().add(V3(0, d.headH * 0.42, 0));
    // Crâne allongé vers l'arrière-haut, menton effilé.
    B.addBlob({
      p: hc, r: d.headH * 0.5, scale: [0.78, 1.0, 1.1], ws: 18, hs: 13,
      bones: [[bi('Head'), 1]],
      deform: (dir) => 1 + Math.max(0, dir.z) * Math.max(0, dir.y) * 0.85 - Math.max(0, -dir.y) * Math.max(0, -dir.z) * 0.25,
      colorFn: (dir) => shade(mix(ctx.sec, ctx.pri, 0.5 + dir.y * 0.5), 1 + Math.max(0, -dir.z) * 0.12)
    });
    eyes(ctx, hc, d.headH, { dx: 0.34, dy: 0.02, rx: 0.22, ry: 0.14, tilt: 0.5 });
    // Mandibules fines.
    for (const sx of [-1, 1]) {
      horn(ctx, [
        hc.clone().add(V3(sx * d.headH * 0.22, -d.headH * 0.32, -d.headH * 0.3)),
        hc.clone().add(V3(sx * d.headH * 0.12, -d.headH * 0.48, -d.headH * 0.52))
      ], d.headH * 0.06, [bi('Head'), 1], shade(ctx.sec, 0.7), 5);
    }
    buildAntennas(ctx, ctx.def.extras.antenna.len);
  },

  heavy_reptile(ctx) {
    const { B, d, bi, w } = ctx;
    const hc = w('Head').clone().add(V3(0, d.headH * 0.40, 0));
    B.addBlob({ // crâne massif
      p: hc, r: d.headH * 0.55, scale: [1.05, 0.85, 1.0], ws: 16, hs: 12,
      bones: [[bi('Head'), 1]],
      deform: (dir) => 1 + Math.max(0, -dir.z) * 0.25 * Math.max(0, -dir.y + 0.4),
      colorFn: (dir) => mix(ctx.pri, ctx.sec, Math.max(0, -dir.y) * 0.6)
    });
    // Mâchoire inférieure sur l'os Jaw.
    const jc = w('Jaw');
    B.addBlob({
      p: [jc.x, jc.y - d.headH * 0.08, jc.z - d.headH * 0.12],
      r: d.headH * 0.34, scale: [0.9, 0.5, 1.15], ws: 12, hs: 7,
      bones: [[bi('Jaw'), 1]], color: shade(ctx.sec, 1.05)
    });
    eyes(ctx, hc, d.headH, { dx: 0.4, dy: 0.12, dz: -0.6, rx: 0.13, ry: 0.09 });
    // Crête dorsale sur l'os Crest.
    const cb = w('Crest');
    const base = [], crest = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      base.push(cb.clone().add(V3(0, -d.headH * 0.1 + t * d.headH * 0.05, -d.headH * 0.35 + t * d.headH * 0.9)));
      crest.push(base[i].clone().add(V3(0, ctx.def.extras.crest.len * (0.45 + 0.55 * Math.sin(t * Math.PI)), d.headH * 0.06)));
    }
    B.addFin(base, crest, [[bi('Crest'), 1]], shade(ctx.pri, 0.8), ctx.emi, { thickness: 0.014 });
  },

  four_arms(ctx) {
    const { B, d, bi, w } = ctx;
    const hc = w('Head').clone().add(V3(0, d.headH * 0.45, 0));
    B.addBlob({ // tête fine et haute, port altier
      p: hc, r: d.headH * 0.5, scale: [0.72, 1.15, 0.85], ws: 16, hs: 12,
      bones: [[bi('Head'), 1]],
      deform: (dir) => 1 - Math.max(0, -dir.y) * Math.max(0, -dir.z) * 0.3,
      colorFn: (dir) => mix(ctx.sec, ctx.pri, 0.35 + 0.35 * dir.y)
    });
    // Deux paires d'yeux.
    eyes(ctx, hc, d.headH, { dx: 0.3, dy: 0.1, rx: 0.14, ry: 0.1 });
    eyes(ctx, hc, d.headH, { dx: 0.42, dy: -0.08, rx: 0.10, ry: 0.07 });
    // Plume de crête arquée vers l'arrière.
    const cb = w('Crest');
    const base = [], crest = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      base.push(cb.clone().add(V3(0, t * d.headH * 0.1, t * d.headH * 0.5)));
      crest.push(base[i].clone().add(V3(0, ctx.def.extras.crest.len * (1 - t * 0.5), ctx.def.extras.crest.len * t * 0.7)));
    }
    B.addFin(base, crest, [[bi('Crest'), 1]], ctx.pri, ctx.emi, { thickness: 0.01 });
  },

  techno_symbiote(ctx) {
    const { B, d, bi, w } = ctx;
    const hc = w('Head').clone().add(V3(0, d.headH * 0.42, 0));
    B.addBlob({ // casque anguleux
      p: hc, r: d.headH * 0.52, scale: [0.9, 0.95, 0.95], ws: 14, hs: 10,
      bones: [[bi('Head'), 1]],
      deform: (dir, th) => 1 + 0.06 * Math.abs(Math.sin(th * 3)),
      colorFn: (dir) => shade(ctx.sec, 0.9 + Math.max(0, dir.y) * 0.3)
    });
    // Visière techno pleine largeur.
    B.addBlob({
      p: [hc.x, hc.y + d.headH * 0.05, hc.z - d.headH * 0.42],
      r: d.headH, scale: [0.42, 0.16, 0.10], ws: 12, hs: 5,
      bones: [[bi('Head'), 1]], color: ctx.emi, group: GROUP_GLOW
    });
    // Câbles nuque → poitrine (skinnés Head/Chest pour suivre les anims).
    const chest = w('Chest');
    for (const sx of [-1, 1]) {
      const a = hc.clone().add(V3(sx * d.headH * 0.25, -d.headH * 0.05, d.headH * 0.42));
      const b = new THREE.Vector3(chest.x + sx * d.shoulderHalf * 0.4, chest.y + 0.05, chest.z + d.shoulderHalf * 0.55);
      const m = a.clone().lerp(b, 0.5).add(V3(sx * 0.03, -0.05, 0.06));
      B.addTube([
        { p: a, r: 0.016, bones: [[bi('Head'), 1]], color: shade(ctx.pri, 0.9) },
        { p: m, r: 0.015, bones: [[bi('Head'), 0.5], [bi('Chest'), 0.5]], color: ctx.pri },
        { p: b, r: 0.016, bones: [[bi('Chest'), 1]], color: shade(ctx.pri, 0.9) }
      ], { radial: 6, caps: 'both' });
    }
    buildAntennas(ctx, ctx.def.extras.antenna.len);
  },

  shadow(ctx) {
    const { B, d, bi, w } = ctx;
    const hc = w('Head').clone().add(V3(0, d.headH * 0.45, 0));
    B.addBlob({ // silhouette encapuchonnée, pointe vers l'arrière-haut
      p: hc, r: d.headH * 0.5, scale: [0.75, 1.1, 1.0], ws: 16, hs: 12,
      bones: [[bi('Head'), 1]],
      deform: (dir) => 1 + Math.max(0, dir.y) * Math.max(0, dir.z + 0.3) * 0.7,
      colorFn: (dir) => mix(ctx.sec, ctx.pri, Math.max(0, -dir.z) * 0.5)
    });
    // Yeux en fentes obliques, seule source de lumière du visage.
    eyes(ctx, hc, d.headH, { dx: 0.28, dy: 0.05, rx: 0.2, ry: 0.05, tilt: -0.45 });
  },

  plant(ctx) {
    const { B, d, bi, w } = ctx;
    const hc = w('Head').clone().add(V3(0, d.headH * 0.4, 0));
    B.addBlob({ // bulbe végétal
      p: hc, r: d.headH * 0.52, scale: [0.92, 1.0, 0.95], ws: 16, hs: 11,
      bones: [[bi('Head'), 1]],
      deform: (dir, th, ph) => 1 + 0.05 * Math.sin(ph * 5),
      colorFn: (dir, v) => mix(shade(ctx.pri, 0.7), ctx.pri, v)
    });
    eyes(ctx, hc, d.headH, { dx: 0.3, dy: 0.04, rx: 0.15, ry: 0.11 });
    // Crête feuillue : éventail de 5 feuilles sur l'os Crest.
    const cb = w('Crest');
    const L = ctx.def.extras.crest.len;
    for (let k = -2; k <= 2; k++) {
      const ang = k * 0.5;
      const dir = V3(Math.sin(ang), Math.cos(Math.abs(ang) * 0.7), 0.25 + Math.abs(k) * 0.1).normalize();
      const base = [], crest = [];
      for (let i = 0; i <= 3; i++) {
        const t = i / 3;
        base.push(cb.clone().addScaledVector(dir, t * L).add(V3(0, 0, t * t * L * 0.4)));
        crest.push(base[i].clone().add(V3(0, L * 0.22 * Math.sin(t * Math.PI), 0)));
      }
      B.addFin(base, crest, [[bi('Crest'), 1]], shade(ctx.pri, 0.85), mix(ctx.sec, ctx.emi, 0.5), { thickness: 0.008 });
    }
  },

  round_energy(ctx) {
    const { B, d, bi, w } = ctx;
    const hc = w('Head').clone().add(V3(0, d.headH * 0.38, 0));
    B.addBlob({ // grosse tête ronde rieuse
      p: hc, r: d.headH * 0.55, scale: [1.0, 0.95, 0.95], ws: 16, hs: 12,
      bones: [[bi('Head'), 1]],
      colorFn: (dir) => mix(ctx.pri, ctx.sec, Math.max(0, dir.z) * 0.5)
    });
    eyes(ctx, hc, d.headH, { dx: 0.3, dy: 0.08, rx: 0.2, ry: 0.2, tilt: 0 });
    // Bouche-sourire émissive.
    B.addBlob({
      p: [hc.x, hc.y - d.headH * 0.22, hc.z - d.headH * 0.45],
      r: d.headH, scale: [0.28, 0.07, 0.06], ws: 10, hs: 4,
      bones: [[bi('Head'), 1]], color: ctx.emi, group: GROUP_GLOW
    });
    buildAntennas(ctx, ctx.def.extras.antenna.len);
  },

  aquatic(ctx) {
    const { B, d, bi, w } = ctx;
    const hc = w('Head').clone().add(V3(0, d.headH * 0.42, 0));
    B.addBlob({ // tête hydrodynamique
      p: hc, r: d.headH * 0.5, scale: [0.8, 1.0, 1.15], ws: 16, hs: 12,
      bones: [[bi('Head'), 1]],
      colorFn: (dir) => mix(ctx.sec, ctx.pri, 0.4 + dir.y * 0.4)
    });
    eyes(ctx, hc, d.headH, { dx: 0.33, dy: 0.03, rx: 0.18, ry: 0.16, tilt: 0.2 });
    // Crête-nageoire dorsale.
    const cb = w('Crest');
    const L = ctx.def.extras.crest.len;
    const base = [], crest = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      base.push(cb.clone().add(V3(0, -d.headH * 0.15 + t * 0.02, -d.headH * 0.3 + t * d.headH * 0.95)));
      crest.push(base[i].clone().add(V3(0, L * Math.sin(Math.min(1, t * 1.2) * Math.PI) * 0.9, L * t * 0.3)));
    }
    B.addFin(base, crest, [[bi('Crest'), 1]], ctx.pri, mix(ctx.emi, ctx.sec, 0.3), { thickness: 0.008 });
    // Branchies lumineuses.
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const y = hc.y - d.headH * (0.1 + k * 0.12);
        accent(ctx, [
          V3(hc.x + sx * d.headH * 0.42, y, hc.z - d.headH * 0.1),
          V3(hc.x + sx * d.headH * 0.35, y - 0.01, hc.z + d.headH * 0.18)
        ], 0.008, [bi('Head'), 1], ctx.emi);
      }
    }
  },

  horned_brute(ctx) {
    const { B, d, bi, w } = ctx;
    const hc = w('Head').clone().add(V3(0, d.headH * 0.38, 0));
    B.addBlob({ // crâne carré, arcade lourde
      p: hc, r: d.headH * 0.55, scale: [1.05, 0.9, 0.95], ws: 16, hs: 11,
      bones: [[bi('Head'), 1]],
      deform: (dir) => 1 + Math.max(0, -dir.z) * Math.max(0, dir.y - 0.2) * 0.3,
      colorFn: (dir) => mix(ctx.sec, ctx.pri, Math.max(0, dir.y) * 0.7)
    });
    // Mâchoire proéminente (underbite).
    const jc = w('Jaw');
    B.addBlob({
      p: [jc.x, jc.y - d.headH * 0.1, jc.z - d.headH * 0.1],
      r: d.headH * 0.36, scale: [1.0, 0.5, 1.0], ws: 12, hs: 7,
      bones: [[bi('Jaw'), 1]], color: shade(ctx.sec, 1.2)
    });
    eyes(ctx, hc, d.headH, { dx: 0.32, dy: 0.14, rx: 0.13, ry: 0.07, tilt: -0.5 });
    // Cornes recourbées.
    for (const sx of [-1, 1]) {
      const b0 = hc.clone().add(V3(sx * d.headH * 0.42, d.headH * 0.3, 0));
      horn(ctx, [
        b0,
        b0.clone().add(V3(sx * d.headH * 0.35, d.headH * 0.3, d.headH * 0.1)),
        b0.clone().add(V3(sx * d.headH * 0.5, d.headH * 0.75, -d.headH * 0.15)),
        b0.clone().add(V3(sx * d.headH * 0.45, d.headH * 1.05, -d.headH * 0.5))
      ], d.headH * 0.14, [bi('Head'), 1], mix(ctx.pri, [0.9, 0.85, 0.75], 0.55), 8);
    }
  },

  pale_mimic(ctx) {
    const { B, d, bi, w } = ctx;
    const hc = w('Head').clone().add(V3(0, d.headH * 0.45, 0));
    B.addBlob({ // ovoïde lisse, sans bouche — iridescence par la normale
      p: hc, r: d.headH * 0.53, scale: [0.85, 1.1, 0.9], ws: 18, hs: 13,
      bones: [[bi('Head'), 1]],
      colorFn: (dir) => {
        const t = 0.5 + 0.5 * Math.sin(dir.x * 4 + dir.y * 3);
        return mix(mix(ctx.pri, ctx.sec, t), ctx.emi, 0.15 * (1 - Math.abs(dir.z)));
      }
    });
    eyes(ctx, hc, d.headH, { dx: 0.26, dy: 0.06, rx: 0.2, ry: 0.24, tilt: 0 });
  },

  human_soldier(ctx) { humanHead(ctx, { helmet: 'full', visor: [0.4, 0.1] }); },
  human_recon(ctx) { humanHead(ctx, { helmet: 'hood', visor: [0.16, 0.1], twinGoggles: true }); },
  human_medic(ctx) { humanHead(ctx, { helmet: 'cap', visor: [0.44, 0.07] }); },
  human_exo(ctx) { humanHead(ctx, { helmet: 'full', visor: [0.34, 0.06], heavyJaw: true }); },
  human_stealth(ctx) { humanHead(ctx, { helmet: 'sleek', visor: [0.42, 0.05], ponytail: true }); }
};

/** Tête humaine casquée, déclinable (casque intégral, capuche, casquette, furtif). */
function humanHead(ctx, { helmet, visor, twinGoggles = false, heavyJaw = false, ponytail = false }) {
  const { B, d, bi, w } = ctx;
  const hc = w('Head').clone().add(V3(0, d.headH * 0.42, 0));
  const skin = [0.85, 0.66, 0.55];
  // Visage.
  B.addBlob({
    p: hc, r: d.headH * 0.46, scale: [0.82, 1.0, 0.9], ws: 14, hs: 10,
    bones: [[bi('Head'), 1]],
    deform: (dir) => 1 - Math.max(0, -dir.y) * Math.max(0, -dir.z) * (heavyJaw ? -0.1 : 0.15),
    colorFn: (dir) => (dir.z < -0.15 && dir.y < 0.35 ? skin : shade(ctx.sec, 0.8))
  });
  // Casque.
  const helmetScale = {
    full: [1.0, 1.05, 1.05], hood: [1.1, 1.15, 1.15], cap: [1.0, 0.95, 1.0], sleek: [0.95, 1.02, 1.0]
  }[helmet];
  B.addBlob({
    p: hc.clone().add(V3(0, d.headH * 0.06, helmet === 'cap' ? d.headH * 0.05 : 0.01)),
    r: d.headH * 0.48, scale: helmetScale, ws: 14, hs: 9,
    bones: [[bi('Head'), 1]],
    // Le casque s'ouvre sur le visage (rayon réduit devant-bas → rentre dans la tête).
    deform: (dir) => (dir.z < -0.3 && dir.y < (helmet === 'hood' ? 0.45 : 0.2) ? 0.82 : 1),
    colorFn: (dir) => shade(helmet === 'hood' ? ctx.pri : mix(ctx.pri, ctx.sec, 0.3), 0.9 + Math.max(0, dir.y) * 0.25)
  });
  if (twinGoggles) {
    eyes(ctx, hc, d.headH, { dx: 0.22, dy: 0.1, rx: 0.12, ry: 0.12, tilt: 0 });
  } else if (visor) {
    B.addBlob({
      p: [hc.x, hc.y + d.headH * 0.08, hc.z - d.headH * 0.42],
      r: d.headH, scale: [visor[0], visor[1], 0.08], ws: 10, hs: 4,
      bones: [[bi('Head'), 1]], color: ctx.emi, group: GROUP_GLOW
    });
  }
  if (ponytail) {
    horn(ctx, [
      hc.clone().add(V3(0, d.headH * 0.35, d.headH * 0.35)),
      hc.clone().add(V3(0, d.headH * 0.05, d.headH * 0.7)),
      hc.clone().add(V3(0, -d.headH * 0.45, d.headH * 0.8))
    ], d.headH * 0.12, [bi('Head'), 1], shade(ctx.sec, 0.5), 6);
  }
}

// ——————————————————————————— ACCENTS PAR GABARIT ———————————————————————————

function veins(ctx, boneA, boneB, count, r = 0.01) {
  // Veines bio émissives serpentant le long d'un membre.
  const { bi, w } = ctx;
  const a = w(boneA), b = w(boneB);
  for (let k = 0; k < count; k++) {
    const off = 0.03 + k * 0.012;
    const side = k % 2 ? 1 : -1;
    accent(ctx, [
      a.clone().add(V3(0, off * side, off)),
      a.clone().lerp(b, 0.5).add(V3(0, -off * side, off * 1.3)),
      b.clone().add(V3(0, off * side * 0.5, off))
    ], r, [[bi(boneA), 0.6], [bi(boneB), 0.4]], ctx.emi);
  }
}

const ACCENTS = {
  insectoid(ctx) {
    const { d, w, bi } = ctx;
    veins(ctx, 'UpperArm_L', 'LowerArm_L', 2);
    veins(ctx, 'UpperArm_R', 'LowerArm_R', 2);
    veins(ctx, 'UpperLeg_L', 'LowerLeg_L', 1, 0.012);
    veins(ctx, 'UpperLeg_R', 'LowerLeg_R', 1, 0.012);
    // Plaques dorsales luisantes.
    const chest = w('Chest');
    for (let k = 0; k < 3; k++) {
      ctx.B.addBlob({
        p: [chest.x, chest.y + 0.06 - k * 0.09, chest.z + d.shoulderHalf * 0.6],
        r: 0.05 - k * 0.008, scale: [1.4, 0.8, 0.5], ws: 8, hs: 5,
        bones: [[bi('Chest'), k === 0 ? 1 : 0.6], [bi('Spine'), k === 0 ? 0 : 0.4]],
        color: shade(ctx.pri, 0.7)
      });
    }
  },
  heavy_reptile(ctx) {
    const { d, w, bi, B } = ctx;
    buildTail(ctx, ctx.def.extras.tail.r, (v) => () => mix(ctx.pri, ctx.sec, v));
    // Plastron bronze + pointes d'épaules.
    const chest = w('Chest');
    B.addBlob({
      p: [chest.x, chest.y + 0.05, chest.z - d.shoulderHalf * 0.55],
      r: d.shoulderHalf * 0.62, scale: [1.15, 0.9, 0.45], ws: 12, hs: 8,
      bones: [[bi('Chest'), 1]], colorFn: (dir, v) => shade(ctx.sec, 0.8 + v * 0.5)
    });
    for (const s of ['_L', '_R']) {
      const sh = w('UpperArm' + s);
      const sx = s === '_R' ? 1 : -1;
      horn(ctx, [
        sh.clone().add(V3(0, 0.07, 0)),
        sh.clone().add(V3(sx * 0.09, 0.16, 0))
      ], 0.045, [bi('Shoulder' + s), 1], shade(ctx.sec, 1.1), 6);
    }
  },
  four_arms(ctx) {
    buildArms(ctx, 'ArmB_', 0.8); // la 2e paire de bras
    veins(ctx, 'Spine', 'Chest', 2, 0.008);
    // Jupe d'apparat évasée sous les hanches.
    const { d, w, bi, B } = ctx;
    const hip = w('Hips');
    B.addTube([
      { p: [hip.x, hip.y - 0.02, hip.z], r: d.hipHalf * 1.2, sz: 0.85, bones: [[bi('Hips'), 1]], color: shade(ctx.sec, 0.9) },
      { p: [hip.x, hip.y - d.H * 0.14, hip.z], r: d.hipHalf * 1.55, sz: 0.9, bones: [[bi('Hips'), 1]], colorFn: (a) => mix(ctx.sec, ctx.pri, 0.5 + 0.5 * Math.sin(a * 4)) }
    ], { radial: 14, caps: 'none' });
  },
  techno_symbiote(ctx) {
    const { d, w, bi, B } = ctx;
    // Néons d'armure sur les avant-bras et les tibias.
    for (const s of ['_L', '_R']) {
      accent(ctx, [w('LowerArm' + s), w('Hand' + s)], 0.014, [bi('LowerArm' + s), 1], ctx.emi, { taper: 1 });
      accent(ctx, [w('LowerLeg' + s), w('Foot' + s)], 0.016, [bi('LowerLeg' + s), 1], ctx.emi, { taper: 1 });
    }
    // Cœur-réacteur.
    const chest = w('Chest');
    B.addBlob({
      p: [chest.x, chest.y + 0.02, chest.z - d.shoulderHalf * 0.62],
      r: 0.055, ws: 10, hs: 7, bones: [[bi('Chest'), 1]], color: ctx.emi, group: GROUP_GLOW
    });
    // Épaulières anguleuses.
    for (const s of ['_L', '_R']) {
      const sh = w('UpperArm' + s);
      B.addBlob({
        p: [sh.x, sh.y + 0.06, sh.z], r: 0.09, scale: [1.2, 0.6, 1.0], ws: 8, hs: 5,
        bones: [[bi('Shoulder' + s), 1]], deform: (dir, th) => 1 + 0.15 * Math.abs(Math.sin(th * 2)),
        color: shade(ctx.sec, 1.15)
      });
    }
  },
  shadow(ctx) {
    buildTail(ctx, ctx.def.extras.tail.r, (v) => () => mix(ctx.pri, ctx.sec, v * 0.9));
    veins(ctx, 'Spine', 'Chest', 1, 0.008);
    // Volutes d'épaules (fumée figée).
    const { w, bi } = ctx;
    for (const s of ['_L', '_R']) {
      const sh = w('UpperArm' + s);
      const sx = s === '_R' ? 1 : -1;
      horn(ctx, [
        sh.clone().add(V3(0, 0.05, 0.02)),
        sh.clone().add(V3(sx * 0.05, 0.17, 0.06)),
        sh.clone().add(V3(sx * 0.01, 0.26, 0.12))
      ], 0.035, [bi('Shoulder' + s), 1], shade(ctx.pri, 0.7), 6);
    }
  },
  plant(ctx) {
    const { d, w, bi, B } = ctx;
    // Lianes lumineuses enroulées sur les bras, mousse aux épaules.
    for (const s of ['_L', '_R']) {
      const a = w('UpperArm' + s), b = w('Hand' + s);
      const pts = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const p = a.clone().lerp(b, t);
        pts.push(p.add(V3(0, Math.sin(t * Math.PI * 2) * 0.035, Math.cos(t * Math.PI * 2) * 0.035)));
      }
      accent(ctx, pts, 0.011, [[bi('UpperArm' + s), 0.5], [bi('LowerArm' + s), 0.5]], mix(ctx.emi, ctx.sec, 0.4), { taper: 0.8 });
      B.addBlob({
        p: w('UpperArm' + s).clone().add(V3(0, 0.06, 0)), r: 0.085, scale: [1.1, 0.7, 1.0],
        ws: 9, hs: 6, bones: [[bi('Shoulder' + s), 1]],
        colorFn: (dir, v) => shade(ctx.pri, 0.55 + 0.3 * hash3(dir.x * 9, dir.y * 9, v))
      });
    }
    // Fleur-cœur.
    const chest = w('Chest');
    B.addBlob({
      p: [chest.x, chest.y, chest.z - d.shoulderHalf * 0.6], r: 0.05,
      ws: 8, hs: 6, bones: [[bi('Chest'), 1]], color: ctx.emi, group: GROUP_GLOW
    });
  },
  round_energy(ctx) {
    const { d, w, bi, B } = ctx;
    // Gros cœur d'énergie ventral + arcs sur les flancs.
    const spine = w('Spine');
    B.addBlob({
      p: [spine.x, spine.y + 0.05, spine.z - d.hipHalf * 1.1],
      r: d.hipHalf * 0.5, ws: 12, hs: 8, bones: [[bi('Spine'), 1]],
      color: ctx.emi, group: GROUP_GLOW
    });
    for (const s of ['_L', '_R']) {
      accent(ctx, [w('UpperLeg' + s), w('LowerLeg' + s)], 0.016, [bi('UpperLeg' + s), 1], ctx.emi, { taper: 0.9 });
      accent(ctx, [w('UpperArm' + s), w('LowerArm' + s)], 0.014, [bi('UpperArm' + s), 1], ctx.emi, { taper: 0.9 });
    }
  },
  aquatic(ctx) {
    const { w, bi, B } = ctx;
    buildTail(ctx, ctx.def.extras.tail.r, (v) => () => mix(ctx.pri, ctx.emi, v * 0.6));
    // Nageoires d'avant-bras.
    for (const s of ['_L', '_R']) {
      const a = w('LowerArm' + s), b = w('Hand' + s);
      const base = [], crest = [];
      for (let i = 0; i <= 3; i++) {
        const t = i / 3;
        base.push(a.clone().lerp(b, t).add(V3(0, 0.01, 0.02)));
        crest.push(base[i].clone().add(V3(0, 0.02 + 0.09 * Math.sin(t * Math.PI), 0.06)));
      }
      B.addFin(base, crest, [[bi('LowerArm' + s), 1]], ctx.pri, mix(ctx.emi, ctx.sec, 0.4), { thickness: 0.006 });
    }
  },
  horned_brute(ctx) {
    const { d, w, bi, B } = ctx;
    // Pointes dorsales + jointures incandescentes.
    const chest = w('Chest'), spine = w('Spine');
    for (const [p, bn] of [[chest, 'Chest'], [spine, 'Spine']]) {
      horn(ctx, [
        p.clone().add(V3(0, 0.04, d.shoulderHalf * 0.6)),
        p.clone().add(V3(0, 0.16, d.shoulderHalf * 0.85))
      ], 0.05, [bi(bn), 1], shade(ctx.sec, 1.4), 6);
    }
    veins(ctx, 'UpperArm_L', 'LowerArm_L', 2, 0.013);
    veins(ctx, 'UpperArm_R', 'LowerArm_R', 2, 0.013);
    // Poings surdimensionnés (déjà mitaines) : jointures émissives.
    for (const s of ['_L', '_R']) {
      const h = w('Hand' + s);
      const sx = s === '_R' ? 1 : -1;
      B.addBlob({
        p: [h.x + sx * d.handLen * 0.7, h.y + 0.02, h.z - 0.02], r: 0.028,
        ws: 7, hs: 5, bones: [[bi('Hand' + s), 1]], color: ctx.emi, group: GROUP_GLOW
      });
    }
  },
  pale_mimic(ctx) {
    // Filaments irisés discrets le long du corps.
    veins(ctx, 'Spine', 'Chest', 2, 0.007);
    veins(ctx, 'UpperArm_L', 'LowerArm_L', 1, 0.007);
    veins(ctx, 'UpperArm_R', 'LowerArm_R', 1, 0.007);
  },
  human_soldier(ctx) {
    const { d, w, bi, B } = ctx;
    // Plastron + ceinture + galons lumineux.
    const chest = w('Chest');
    B.addBlob({
      p: [chest.x, chest.y + 0.03, chest.z - d.shoulderHalf * 0.5],
      r: d.shoulderHalf * 0.68, scale: [1.1, 1.0, 0.4], ws: 12, hs: 8,
      bones: [[bi('Chest'), 1]], colorFn: (dir, v) => shade(ctx.sec, 0.85 + v * 0.3)
    });
    const hip = w('Hips');
    B.addTube([
      { p: [hip.x, hip.y + 0.02, hip.z], r: d.hipHalf * 1.28, sz: 0.85, bones: [[bi('Hips'), 1]], color: shade(ctx.sec, 0.5) },
      { p: [hip.x, hip.y - 0.03, hip.z], r: d.hipHalf * 1.3, sz: 0.85, bones: [[bi('Hips'), 1]], color: shade(ctx.sec, 0.5) }
    ], { radial: 12, caps: 'none' });
    for (const s of ['_L', '_R']) {
      accent(ctx, [w('UpperArm' + s).clone().add(V3(0, 0.04, 0)), w('UpperArm' + s).clone().add(V3(0, -0.05, 0))],
        0.012, [bi('UpperArm' + s), 1], ctx.emi, { taper: 1 });
    }
  },
  human_recon(ctx) {
    const { d, w, bi, B } = ctx;
    // Écharpe + sacoches de cuisses.
    const neck = w('Neck');
    B.addTube([
      { p: [neck.x, neck.y + 0.01, neck.z], r: d.H * 0.052, sz: 0.9, bones: [[bi('Neck'), 1]], color: shade(ctx.pri, 0.7) },
      { p: [neck.x, neck.y - 0.05, neck.z + 0.02], r: d.H * 0.062, sz: 0.95, bones: [[bi('Chest'), 1]], color: shade(ctx.pri, 0.55) }
    ], { radial: 10, caps: 'none' });
    for (const s of ['_L', '_R']) {
      const t = w('UpperLeg' + s).clone().lerp(w('LowerLeg' + s), 0.4);
      const sx = s === '_R' ? 1 : -1;
      B.addBlob({
        p: [t.x + sx * 0.06, t.y, t.z], r: 0.06, scale: [0.7, 1.1, 0.9], ws: 8, hs: 5,
        bones: [[bi('UpperLeg' + s), 1]], color: shade(ctx.sec, 1.3)
      });
    }
  },
  human_medic(ctx) {
    const { d, w, bi, B } = ctx;
    // Sac à dos médical + croix lumineuse pectorale.
    const chest = w('Chest');
    B.addBlob({
      p: [chest.x, chest.y - 0.02, chest.z + d.shoulderHalf * 0.72],
      r: d.shoulderHalf * 0.6, scale: [0.9, 1.15, 0.55], ws: 10, hs: 7,
      bones: [[bi('Chest'), 1]], color: shade(ctx.pri, 0.95)
    });
    const cz = chest.z - d.shoulderHalf * 0.62;
    accent(ctx, [V3(chest.x, chest.y + 0.08, cz), V3(chest.x, chest.y - 0.06, cz)], 0.018, [bi('Chest'), 1], ctx.emi, { taper: 1 });
    accent(ctx, [V3(chest.x - 0.07, chest.y + 0.01, cz), V3(chest.x + 0.07, chest.y + 0.01, cz)], 0.018, [bi('Chest'), 1], ctx.emi, { taper: 1 });
  },
  human_exo(ctx) {
    const { d, w, bi, B } = ctx;
    // Exosquelette : vérins externes le long des membres + réacteur dorsal.
    for (const s of ['_L', '_R']) {
      const sx = s === '_R' ? 1 : -1;
      for (const [a, b, bn] of [
        [w('UpperArm' + s), w('LowerArm' + s), 'UpperArm' + s],
        [w('UpperLeg' + s), w('LowerLeg' + s), 'UpperLeg' + s],
        [w('LowerLeg' + s), w('Foot' + s), 'LowerLeg' + s]
      ]) {
        accent(ctx, [a.clone().add(V3(sx * 0.05, 0, 0.03)), b.clone().add(V3(sx * 0.04, 0, 0.03))],
          0.02, [bi(bn), 1], shade(ctx.sec, 1.1), { group: GROUP_BODY, radial: 6, taper: 0.85 });
      }
      const sh = w('UpperArm' + s);
      B.addBlob({
        p: [sh.x + sx * 0.02, sh.y + 0.09, sh.z], r: 0.13, scale: [1.25, 0.75, 1.1], ws: 10, hs: 6,
        bones: [[bi('Shoulder' + s), 1]], colorFn: (dir, v) => shade(mix(ctx.pri, ctx.sec, 0.25), 0.8 + v * 0.4)
      });
    }
    const chest = w('Chest');
    B.addBlob({
      p: [chest.x, chest.y, chest.z + d.shoulderHalf * 0.7], r: d.shoulderHalf * 0.5,
      scale: [1.1, 1.0, 0.6], ws: 10, hs: 7, bones: [[bi('Chest'), 1]], color: shade(ctx.pri, 0.7)
    });
    B.addBlob({
      p: [chest.x, chest.y + 0.01, chest.z - d.shoulderHalf * 0.72], r: 0.06,
      ws: 9, hs: 6, bones: [[bi('Chest'), 1]], color: ctx.emi, group: GROUP_GLOW
    });
  },
  human_stealth(ctx) {
    const { w, bi } = ctx;
    // Lignes néon de combinaison furtive.
    for (const s of ['_L', '_R']) {
      accent(ctx, [w('UpperArm' + s), w('LowerArm' + s), w('Hand' + s)], 0.009,
        [[bi('UpperArm' + s), 0.5], [bi('LowerArm' + s), 0.5]], ctx.emi, { taper: 0.7 });
      accent(ctx, [w('UpperLeg' + s), w('LowerLeg' + s), w('Foot' + s)], 0.010,
        [[bi('UpperLeg' + s), 0.5], [bi('LowerLeg' + s), 0.5]], ctx.emi, { taper: 0.7 });
    }
    const chest = w('Chest'), hips = w('Hips');
    accent(ctx, [
      V3(chest.x, chest.y + 0.1, chest.z - 0.1),
      V3(hips.x, hips.y + 0.02, hips.z - 0.12)
    ], 0.01, [[bi('Chest'), 0.5], [bi('Spine'), 0.5]], ctx.emi, { taper: 1 });
  }
};

// Torses spéciaux (couleurs à motifs) par gabarit.
const TORSO_COLORS = {
  plant: (ctx) => (v, a) => {
    // Écorce striée verticale.
    const bark = 0.75 + 0.25 * Math.abs(Math.sin(a * 6 + v * 2));
    return shade(mix(ctx.sec, ctx.pri, 0.3 + v * 0.6), bark);
  },
  human_medic: (ctx) => (v, a, dir) => {
    // Buste blanc, épaules rouges.
    return v > 0.8 ? ctx.sec : shade(ctx.pri, 1 - v * 0.1 + (dir ? -dir.z * 0.05 : 0));
  },
  pale_mimic: (ctx) => (v, a) => mix(mix(ctx.pri, ctx.sec, 0.5 + 0.5 * Math.sin(a * 2 + v * 5)), ctx.emi, 0.12),
  human_stealth: (ctx) => (v) => shade(mix(ctx.pri, ctx.sec, v * 0.25), 0.9),
  round_energy: (ctx) => (v, a, dir) => (dir && -dir.z > 0.5 && v < 0.6 ? mix(ctx.pri, ctx.emi, 0.4) : mix(ctx.sec, ctx.pri, v))
};

/**
 * Construit la géométrie complète d'un personnage.
 * Retourne { geometry, triangles }.
 */
export function buildBody(def, rig) {
  const ctx = makeCtx(def, rig);
  const torsoColor = TORSO_COLORS[def.bodyType] ? TORSO_COLORS[def.bodyType](ctx) : null;
  buildTorso(ctx, { colorFn: torsoColor });
  buildLegs(ctx);
  buildArms(ctx);
  buildNeck(ctx);
  const headFn = HEADS[def.bodyType];
  if (!headFn) throw new Error(`Gabarit sans tête : ${def.bodyType}`);
  headFn(ctx);
  const accentFn = ACCENTS[def.bodyType];
  if (accentFn) accentFn(ctx);
  const geometry = ctx.B.build();
  return { geometry, triangles: ctx.B.triangles };
}
