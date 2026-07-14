// Constructeur de géométrie skinnée — tubes organiques et blobs déformables,
// couleurs par sommet, poids de skinning sur 1-2 os (transitions douces).
import * as THREE from 'three';

export const GROUP_BODY = 0;   // matériau principal (vertexColors)
export const GROUP_GLOW = 1;   // matériau émissif (yeux, veines, néons)

// — Aides couleur —
export function rgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}
export function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function shade(c, f) {
  return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
}
/** Bruit déterministe simple (motifs de couleur). */
export function hash3(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** Normalise une liste de poids [[boneIndex, w], ...] (2 max). */
function normWeights(bones) {
  let list = Array.isArray(bones[0]) ? bones : [[bones[0], bones[1] ?? 1]];
  list = list.slice(0, 2);
  const sum = list.reduce((s, [, w]) => s + w, 0) || 1;
  return list.map(([i, w]) => [i, w / sum]);
}

export class BodyBuilder {
  constructor() {
    this.pos = [];
    this.col = [];
    this.sIdx = [];
    this.sWts = [];
    this.idx = { [GROUP_BODY]: [], [GROUP_GLOW]: [] };
    this.count = 0;
  }

  _vertex(p, color, bones) {
    this.pos.push(p.x, p.y, p.z);
    this.col.push(color[0], color[1], color[2]);
    const w = normWeights(bones);
    this.sIdx.push(w[0][0], w[1] ? w[1][0] : 0, 0, 0);
    this.sWts.push(w[0][1], w[1] ? w[1][1] : 0, 0, 0);
    return this.count++;
  }

  _tri(group, a, b, c) {
    this.idx[group].push(a, b, c);
  }

  /**
   * Tube organique le long d'une suite d'anneaux.
   * points : [{ p:[x,y,z]|Vector3, r, sx?, sz?, bones, color, twist? }]
   * - sx / sz : ovalisation de l'anneau (1 par défaut)
   * - bones : [[idx, poids], ...] (1-2 os)
   * options : { radial, caps: 'both'|'start'|'end'|'none', group }
   */
  addTube(points, { radial = 12, caps = 'both', group = GROUP_BODY } = {}) {
    const n = points.length;
    if (n < 2) throw new Error('addTube : au moins 2 anneaux requis');
    const centers = points.map((pt) => (pt.p.isVector3 ? pt.p.clone() : new THREE.Vector3(...pt.p)));

    // Repère transporté le long du chemin (évite les torsions brutales).
    const tangents = [];
    for (let i = 0; i < n; i++) {
      const a = centers[Math.max(0, i - 1)], b = centers[Math.min(n - 1, i + 1)];
      tangents.push(b.clone().sub(a).normalize());
    }
    let normal = Math.abs(tangents[0].y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    normal.sub(tangents[0].clone().multiplyScalar(normal.dot(tangents[0]))).normalize();

    const rings = [];
    for (let i = 0; i < n; i++) {
      const t = tangents[i];
      normal = normal.clone().sub(t.clone().multiplyScalar(normal.dot(t))).normalize();
      const binormal = new THREE.Vector3().crossVectors(t, normal);
      const pt = points[i];
      const ring = [];
      const twist = pt.twist || 0;
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2 + twist;
        const off = new THREE.Vector3()
          .addScaledVector(normal, Math.cos(a) * pt.r * (pt.sx ?? 1))
          .addScaledVector(binormal, Math.sin(a) * pt.r * (pt.sz ?? 1));
        const p = centers[i].clone().add(off);
        // colorFn(angle, direction monde) permet les motifs autour de l'anneau.
        const c = pt.colorFn ? pt.colorFn(a, off.clone().normalize()) : pt.color;
        ring.push(this._vertex(p, c, pt.bones));
      }
      rings.push(ring);
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const j2 = (j + 1) % radial;
        const a = rings[i][j], b = rings[i][j2], c = rings[i + 1][j], d = rings[i + 1][j2];
        this._tri(group, a, c, b);
        this._tri(group, b, c, d);
      }
    }
    const capColor = (pt) => pt.color || pt.colorFn(0, new THREE.Vector3(0, 1, 0));
    if (caps === 'both' || caps === 'start') {
      const c0 = this._vertex(centers[0].clone().addScaledVector(tangents[0], -points[0].r * 0.4), capColor(points[0]), points[0].bones);
      for (let j = 0; j < radial; j++) this._tri(group, c0, rings[0][j], rings[0][(j + 1) % radial]);
    }
    if (caps === 'both' || caps === 'end') {
      const last = n - 1;
      const c1 = this._vertex(centers[last].clone().addScaledVector(tangents[last], points[last].r * 0.4), capColor(points[last]), points[last].bones);
      for (let j = 0; j < radial; j++) this._tri(group, c1, rings[last][(j + 1) % radial], rings[last][j]);
    }
  }

  /**
   * Blob sphérique déformable (crânes, torses, mains, plaques…).
   * { p, r, scale:[sx,sy,sz], ws, hs, bones|bonesFn(v01), color|colorFn(dir,v01),
   *   deform(dir, theta, phi) → mult, rot: Euler|null, group }
   */
  addBlob({ p, r, scale = [1, 1, 1], ws = 14, hs = 10, bones, bonesFn = null, color, colorFn = null, deform = null, rot = null, group = GROUP_BODY }) {
    const center = p.isVector3 ? p.clone() : new THREE.Vector3(...p);
    const q = rot ? new THREE.Quaternion().setFromEuler(rot) : null;
    const grid = [];
    for (let iy = 0; iy <= hs; iy++) {
      const phi = (iy / hs) * Math.PI;
      const row = [];
      const v01 = 1 - iy / hs; // 1 = sommet, 0 = dessous
      for (let ix = 0; ix < ws; ix++) {
        const theta = (ix / ws) * Math.PI * 2;
        const dir = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta)
        );
        const m = deform ? deform(dir, theta, phi) : 1;
        const local = new THREE.Vector3(dir.x * r * scale[0] * m, dir.y * r * scale[1] * m, dir.z * r * scale[2] * m);
        if (q) local.applyQuaternion(q);
        const pos = local.add(center);
        const c = colorFn ? colorFn(dir, v01) : color;
        const bw = bonesFn ? bonesFn(v01) : bones;
        row.push(this._vertex(pos, c, bw));
      }
      grid.push(row);
    }
    for (let iy = 0; iy < hs; iy++) {
      for (let ix = 0; ix < ws; ix++) {
        const ix2 = (ix + 1) % ws;
        const a = grid[iy][ix], b = grid[iy][ix2], c = grid[iy + 1][ix], d = grid[iy + 1][ix2];
        if (iy > 0) this._tri(group, a, b, c);
        if (iy < hs - 1) this._tri(group, b, d, c);
      }
    }
  }

  /**
   * Nageoire / crête / corne plate : ruban triangulé entre une base et une crête.
   * base et crest : listes de Vector3 (même longueur), bones par sommet de colonne.
   */
  addFin(base, crest, bones, colorBase, colorTip, { group = GROUP_BODY, thickness = 0.012 } = {}) {
    const n = base.length;
    const side = (offset) => {
      const rows = [[], []];
      for (let i = 0; i < n; i++) {
        const nrm = new THREE.Vector3().subVectors(crest[i], base[i]).cross(
          new THREE.Vector3().subVectors(base[Math.min(n - 1, i + 1)], base[Math.max(0, i - 1)])
        ).normalize().multiplyScalar(offset);
        const bw = Array.isArray(bones[0]) || typeof bones[0] === 'number' ? bones : bones[i];
        rows[0].push(this._vertex(base[i].clone().add(nrm), colorBase, bw));
        rows[1].push(this._vertex(crest[i].clone().add(nrm), colorTip, bw));
      }
      for (let i = 0; i < n - 1; i++) {
        const a = rows[0][i], b = rows[0][i + 1], c = rows[1][i], d = rows[1][i + 1];
        if (offset >= 0) { this._tri(group, a, b, c); this._tri(group, b, d, c); }
        else { this._tri(group, a, c, b); this._tri(group, b, c, d); }
      }
    };
    side(thickness);
    side(-thickness);
  }

  get triangles() {
    return (this.idx[GROUP_BODY].length + this.idx[GROUP_GLOW].length) / 3;
  }

  /** Assemble la BufferGeometry finale (2 groupes de matériaux). */
  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.sIdx, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sWts, 4));
    const body = this.idx[GROUP_BODY], glow = this.idx[GROUP_GLOW];
    geo.setIndex([...body, ...glow]);
    geo.clearGroups();
    geo.addGroup(0, body.length, GROUP_BODY);
    geo.addGroup(body.length, glow.length, GROUP_GLOW);
    geo.computeVertexNormals();
    // Les sommets dégénérés (pôles, ailettes très fines) peuvent avoir une normale
    // nulle → on la remplace pour garder un attribut normalisé propre à l'export.
    const nrm = geo.attributes.normal;
    for (let i = 0; i < nrm.count; i++) {
      const x = nrm.getX(i), y = nrm.getY(i), z = nrm.getZ(i);
      const len = Math.hypot(x, y, z);
      if (len < 1e-4) nrm.setXYZ(i, 0, 1, 0);
      else if (Math.abs(len - 1) > 1e-3) nrm.setXYZ(i, x / len, y / len, z / len);
    }
    return geo;
  }
}
