// Clips SIGNATURE — danse (6-10 s, boucle) et intro (2.5-4 s, pose finale tenue)
// uniques par personnage, chorégraphiés selon la personnalité du contrat.
import {
  makeClip, stance, extrasSway, setArm, armUp, armFwd, legSwing, knee, footRot,
  legSpread, TAU, seg, env, ease, clamp01, pulse
} from './animlib.mjs';

const S = Math.sin, C = Math.cos;

// ————————————————————————— MOUVEMENTS RÉUTILISABLES —————————————————————————

/** Flexion accroupie cohérente (pieds ancrés). k ∈ [0..1.2]. */
function squat(P, X, k) {
  const tA = 1.05 * k, kA = 1.55 * k;
  const drop = X.d.thigh * (1 - C(tA)) + X.d.shin * (1 - C(kA - tA));
  for (const s of ['_L', '_R']) {
    legSwing(P, s, tA); knee(P, s, kA); footRot(P, s, kA - tA); legSpread(P, s, 0.1 * k);
  }
  P.pos('Hips', 0, -drop, 0);
  P.rot('Spine', -0.18 * k, 0, 0);
  P.rot('Head', 0.18 * k, 0, 0);
}

/** Rebond dansé sur place (ph en radians, 1 rebond par tour). */
function groove(P, X, ph, amp = 0.05) {
  const b = 0.5 - 0.5 * C(ph);
  squat(P, X, b * amp * 8);
  P.rot('Chest', -amp * 1.5 * b, 0, 0);
}

/** Déhanché latéral. */
function hipSway(P, ph, amp = 0.08) {
  P.pos('Hips', amp * S(ph), 0, 0);
  P.rot('Hips', 0, 0, -amp * 3.5 * S(ph));
  P.rot('Spine', 0, 0, amp * 2.2 * S(ph));
}

/** Rotation complète du corps (angle en radians, jambes comprises). */
function spin(P, angle) { P.rot('Hips', 0, angle, 0); }

/** Headbang (ph : 1 coup par tour). */
function headbang(P, ph, amp = 0.5) {
  const b = 0.5 - 0.5 * C(ph);
  P.rot('Head', -amp * b, 0, 0);
  P.rot('Neck', -amp * 0.5 * b, 0, 0);
  P.rot('Spine', -amp * 0.35 * b, 0, 0);
}

/** Salut militaire main droite à la tempe. */
function salute(P, k = 1) {
  setArm(P, '_R', { down: 0.5 * k, fwd: 0.35 * k, elbow: 2.3 * k });
  P.rot('Hand_R', 0, 0, -0.35 * k);
}

/** Bras croisés sur la poitrine. */
function crossArms(P, k = 1) {
  for (const s of ['_L', '_R']) setArm(P, s, { down: 0.85 * k, fwd: 0.45 * k, elbow: 1.95 * k });
}

/** Temps « robot » : marches d'escalier avec accroche sèche. */
function snap(x, steps, sharp = 7) {
  const q = x * steps, f = Math.floor(q);
  return (f + ease(clamp01((q - f) * sharp))) / steps;
}

// —————————————————————————————— DANSES ——————————————————————————————

const DANCES = {
  // Breakdance nerveux : toprock, passe au sol tournoyante, freeze, remontée frimeuse.
  zephyr: { dur: 7.0, fn(t, P, X) {
    const u = t / 7.0;
    const A = env(clamp01(u / 0.24));                      // toprock
    const B = seg(u, 0.2, 0.28) * (1 - seg(u, 0.5, 0.58)); // passe au sol
    const Cx = seg(u, 0.52, 0.6) * (1 - seg(u, 0.7, 0.78)); // freeze
    const D = seg(u, 0.74, 0.82) * (1 - seg(u, 0.94, 1));  // point final
    const ph = TAU * t / 0.4375; // 16 pulsations par boucle
    groove(P, X, ph, 0.045 * A);
    setArm(P, '_L', { fwd: (0.9 * S(ph) + 0.4) * A, elbow: 1.2 * A });
    setArm(P, '_R', { fwd: (-0.9 * S(ph) + 0.4) * A, elbow: 1.2 * A });
    P.rot('Head', -0.15 * A * (0.5 - 0.5 * C(ph * 2)), 0.1 * A * S(ph * 0.5), 0);
    // Passe au sol : accroupi profond + 2 tours complets, jambes fouettées.
    squat(P, X, 1.15 * B);
    spin(P, TAU * 2 * seg(u, 0.24, 0.56));
    setArm(P, '_R', { down: 1.3 * B, elbow: -0.2 * B });   // bras d'appui
    armUp(P, '_L', 1.1 * B);
    legSwing(P, '_L', 0.9 * B * S(ph));
    // Freeze : appui bras droit, jambes croisées, immobile qui vibre.
    const shake = 0.02 * S(TAU * 12 * u);
    P.rot('Hips', 0, 0, 0.5 * Cx);
    armUp(P, '_L', (1.25 + shake) * Cx);
    P.rot('Head', 0, 0.4 * Cx, -0.3 * Cx);
    legSwing(P, '_R', 0.7 * Cx); knee(P, '_R', 1.1 * Cx);
    // Remontée : double point du doigt vers la caméra, menton haut.
    groove(P, X, ph, 0.03 * D);
    for (const s of ['_L', '_R']) setArm(P, s, { fwd: 1.25 * D, down: -0.15 * D, elbow: 0.15 * D });
    P.rot('Head', 0.22 * D, 0, 0.12 * D);
    extrasSway(P, t, 7.0, X.def, X.has, 1.6);
  } },

  // Stomp sismique : 4 pilonnages, marteau à deux bras, rugissement, coups au torse.
  krogoth: { dur: 8.0, fn(t, P, X) {
    const u = t / 8.0;
    const stompPh = TAU * clamp01(u / 0.5) * 4;            // 4 stomps sur la 1re moitié
    const stomp = (1 - seg(u, 0.46, 0.53)) * seg(u, 0, 0.03); // fondu entrée/sortie
    if (stomp > 0.001) {
      const side = S(stompPh / 2) > 0 ? '_L' : '_R';
      const lift = Math.abs(S(stompPh / 2)) * stomp;
      const impact = pulse((stompPh / TAU) % 1, 0.95, 20) * stomp;
      legSwing(P, side, 1.0 * lift); knee(P, side, 1.3 * lift);
      P.pos('Hips', 0, -0.05 * lift - 0.06 * impact, 0);
      P.rot('Chest', -0.12 * lift + 0.1 * impact, side === '_L' ? 0.15 * lift : -0.15 * lift, 0);
      for (const s of ['_L', '_R']) setArm(P, s, { down: 0.4 * stomp, elbow: 1.1 * stomp, fwd: 0.3 * lift });
      P.rot('Head', -0.1 * impact, 0, 0);
    }
    const smash = seg(u, 0.5, 0.58) * (1 - seg(u, 0.66, 0.72));
    const down = seg(u, 0.60, 0.66);
    for (const s of ['_L', '_R']) armUp(P, s, 1.35 * smash * (1 - down));
    if (smash) {
      P.rot('Spine', 0.25 * smash * (1 - down) - 0.55 * smash * down, 0, 0);
      P.pos('Hips', 0, -0.18 * smash * down, 0);
      for (const s of ['_L', '_R']) { knee(P, s, 0.8 * smash * down); legSwing(P, s, 0.5 * smash * down); }
      for (const s of ['_L', '_R']) setArm(P, s, { fwd: 1.5 * smash * down, elbow: 0.2 * smash });
    }
    const roar = seg(u, 0.72, 0.78) * (1 - seg(u, 0.86, 0.92));
    P.rot('Head', 0.5 * roar, 0, 0);
    P.rot('Spine', 0.2 * roar, 0, 0);
    if (X.has('Jaw')) P.rot('Jaw', -0.55 * roar, 0, 0);
    for (const s of ['_L', '_R']) setArm(P, s, { down: 0.25 * roar, elbow: 1.6 * roar });
    const pound = seg(u, 0.86, 0.9) * (1 - seg(u, 0.96, 1));
    const pph = TAU * 2 * clamp01((u - 0.86) / 0.1);
    setArm(P, '_R', { down: 0.5 * pound, fwd: (0.9 + 0.35 * S(pph)) * pound, elbow: 1.7 * pound });
    P.rot('Chest', 0.06 * pound * S(pph), 0, 0);
    extrasSway(P, t, 8.0, X.def, X.has, 1.8);
  } },

  // Valse d'opéra à 4 bras : tour complet en 3 temps, bras en volutes, révérences.
  sylkis: { dur: 9.6, fn(t, P, X) {
    const u = t / 9.6;
    const bar = TAU * t / 1.2;                              // 8 mesures de 1.2 s
    spin(P, TAU * ease(u));                                 // un tour complet fluide
    const b = 0.5 - 0.5 * C(bar);                           // élévation 3 temps
    P.pos('Hips', 0.03 * S(bar / 2), -0.05 + 0.045 * b, 0);
    for (const s of ['_L', '_R']) { knee(P, s, 0.35 * (1 - b)); legSwing(P, s, 0.12 * S(bar / 2)); }
    P.rot('Spine', -0.06, 0.12 * S(bar / 2), 0.08 * S(bar / 2));
    P.rot('Head', -0.05, 0.15 * S(bar / 2 + 0.8), 0.18 * S(bar / 2));
    // Paire principale : cadre de valse qui alterne.
    setArm(P, '_L', { down: 0.25, fwd: 0.7 + 0.3 * S(bar / 2), elbow: 0.9 });
    setArm(P, '_R', { down: -0.15 - 0.2 * S(bar / 2), elbow: 0.45 });
    // Paire secondaire : vagues d'éventail déphasées.
    setArm(P, '_L', { prefix: 'ArmB_', down: 0.5 + 0.4 * S(bar / 2 + 1.6), elbow: 0.8 + 0.5 * S(bar / 2 + 2.4) });
    setArm(P, '_R', { prefix: 'ArmB_', down: 0.5 + 0.4 * S(bar / 2 + 3.0), elbow: 0.8 + 0.5 * S(bar / 2 + 0.9) });
    // Révérences au milieu et à la fin.
    for (const bow of [seg(u, 0.44, 0.5) * (1 - seg(u, 0.56, 0.62)), seg(u, 0.9, 0.95) * (1 - seg(u, 0.985, 1))]) {
      P.rot('Spine', -0.5 * bow, 0, 0);
      P.rot('Head', 0.2 * bow, 0, 0);
      setArm(P, '_R', { down: -0.3 * bow, fwd: 0.5 * bow });
      setArm(P, '_L', { prefix: 'ArmB_', down: -0.4 * bow });
      setArm(P, '_R', { prefix: 'ArmB_', down: -0.4 * bow });
    }
    extrasSway(P, t, 9.6, X.def, X.has, 1.2);
  } },

  // Robot-dance glitchée : gestes quantifiés, vague saccadée, bouffées de parasites.
  vex9: { dur: 7.2, fn(t, P, X) {
    const u = t / 7.2;
    const q = snap(u, 24);                                  // temps crantés
    const phq = TAU * q * 6;
    setArm(P, '_L', { down: 0.4 + 0.5 * S(phq), elbow: 1.57 });
    setArm(P, '_R', { down: 0.4 - 0.5 * S(phq), elbow: 1.57 });
    P.rot('Head', 0, 0.45 * S(TAU * snap(u, 12) * 3), 0);
    P.rot('Chest', 0, 0.3 * S(phq / 2), 0);
    P.rot('Hips', 0, -0.2 * S(phq / 2), 0);
    P.pos('Hips', 0.04 * S(phq / 2), -0.03 - 0.02 * S(phq), 0);
    for (const s of ['_L', '_R']) knee(P, s, 0.25 + 0.15 * S(phq));
    // Vague robotique bras à bras (milieu de boucle).
    const wave = seg(u, 0.4, 0.45) * (1 - seg(u, 0.62, 0.68));
    const wq = snap(clamp01((u - 0.4) / 0.28), 10);
    armUp(P, '_L', wave * 0.9 * S(TAU * wq));
    armUp(P, '_R', wave * 0.9 * S(TAU * wq + Math.PI));
    // Bouffées de glitch : tremblement haute fréquence bref.
    const g = pulse(u, 0.3, 30) + pulse(u, 0.8, 30);
    const j = 0.06 * g;
    P.rot('Head', j * S(t * 90), j * S(t * 77), j * S(t * 83));
    P.rot('Chest', j * S(t * 71), 0, j * S(t * 67));
    P.pos('Hips', j * 0.3 * S(t * 88), 0, 0);
    extrasSway(P, t, 7.2, X.def, X.has, 0.8 + g);
  } },

  // Vogue fantomatique : cadres de bras autour du visage, tour lent, dip final.
  umbra: { dur: 8.0, fn(t, P, X) {
    const u = t / 8.0;
    const ph = TAU * u;
    P.pos('Hips', 0, 0.02 * S(ph * 2), 0);                  // flottement
    hipSway(P, ph * 2, 0.05);
    // Quatre cadres posés successivement autour de la tête.
    for (let k = 0; k < 4; k++) {
      const f = seg(u, k * 0.17, k * 0.17 + 0.05) * (1 - seg(u, k * 0.17 + 0.13, k * 0.17 + 0.18));
      const alt = k % 2 ? 1 : -1;
      setArm(P, alt > 0 ? '_R' : '_L', { down: -0.25 * f, fwd: 0.55 * f, elbow: 2.1 * f });
      setArm(P, alt > 0 ? '_L' : '_R', { down: 0.55 * f, fwd: 0.85 * f, elbow: 1.5 * f });
      P.rot('Head', 0, alt * 0.3 * f, -alt * 0.22 * f);
      P.rot('Chest', 0, alt * 0.15 * f, 0);
    }
    spin(P, TAU * seg(u, 0.68, 0.84));                      // tour spectral
    // Dip : cambré en arrière presque au sol.
    const dip = seg(u, 0.84, 0.9) * (1 - seg(u, 0.95, 1));
    P.rot('Hips', 0.5 * dip, 0, 0);
    P.pos('Hips', 0, -0.3 * dip, 0.1 * dip);
    for (const s of ['_L', '_R']) { knee(P, s, 1.3 * dip); legSwing(P, s, 0.7 * dip); }
    P.rot('Spine', 0.35 * dip, 0, 0);
    P.rot('Head', 0.4 * dip, 0, 0);
    armUp(P, '_L', 1.2 * dip);
    extrasSway(P, t, 8.0, X.def, X.has, 1.4);
  } },

  // Taï-chi végétal : arcs lents, fentes, poussée de paume, cercle de sève.
  thorne: { dur: 9.0, fn(t, P, X) {
    const u = t / 9.0;
    const ph = TAU * u;
    // Transfert de poids en fentes latérales lentes.
    P.pos('Hips', 0.09 * S(ph * 2), -0.06 - 0.02 * C(ph * 4), 0);
    P.rot('Hips', 0, 0.15 * S(ph * 2), -0.06 * S(ph * 2));
    for (const s of ['_L', '_R']) { knee(P, s, 0.45 + 0.25 * S(ph * 2 + (s === '_L' ? 0 : Math.PI))); legSpread(P, s, 0.18); }
    // Grands cercles de bras déphasés (comme des frondes qui ondulent).
    setArm(P, '_L', { down: 0.6 + 0.5 * S(ph * 2), fwd: 0.7 * S(ph * 2 + TAU / 4), elbow: 0.5 + 0.3 * S(ph * 2 + 1) });
    setArm(P, '_R', { down: 0.6 + 0.5 * S(ph * 2 + Math.PI), fwd: 0.7 * S(ph * 2 + TAU / 4 + Math.PI), elbow: 0.5 + 0.3 * S(ph * 2 + 4) });
    P.rot('Spine', -0.05 + 0.06 * S(ph * 2), 0.1 * S(ph * 2 + 0.5), 0);
    P.rot('Head', 0.05 * S(ph * 2 + 1), 0.12 * S(ph * 2), 0);
    // Poussée de paumes double au 2/3.
    const push = seg(u, 0.6, 0.68) * (1 - seg(u, 0.78, 0.86));
    for (const s of ['_L', '_R']) {
      setArm(P, s, { fwd: 1.15 * push, down: 0.3 * push, elbow: -0.2 * push });
      P.rot('Hand' + s, -0.9 * push, 0, 0);
    }
    P.rot('Spine', -0.12 * push, 0, 0);
    extrasSway(P, t, 9.0, X.def, X.has, 1.0);
  } },

  // Shuffle électrique frénétique : running-man, pompes de coudes, saut étoile.
  pulsar: { dur: 6.4, fn(t, P, X) {
    const u = t / 6.4;
    const main = 1 - seg(u, 0.78, 0.84) * (1 - seg(u, 0.94, 1));
    const ph = TAU * t / 0.32;                              // très rapide
    for (const [s, o] of [['_L', 0], ['_R', Math.PI]]) {
      legSwing(P, s, 0.7 * S(ph + o) * main);
      knee(P, s, (0.6 + 0.55 * S(ph + o + 1.2)) * main);
      setArm(P, s, { down: 0.5 * main, fwd: -0.6 * S(ph + o) * main, elbow: 1.3 * main });
    }
    const hop = Math.abs(S(ph));
    P.pos('Hips', 0, (-0.05 + 0.045 * hop) * main, 0);
    P.rot('Head', -0.12 * main * C(ph * 2), 0.08 * S(ph / 2) * main, 0);
    P.rot('Chest', -0.1 * main, 0.12 * S(ph) * main, 0);
    spin(P, TAU * seg(u, 0.45, 0.55));                      // toupie éclair
    // Saut étoile final.
    const star = seg(u, 0.8, 0.86) * (1 - seg(u, 0.93, 1));
    P.pos('Hips', 0, 0.22 * star, 0);
    for (const s of ['_L', '_R']) { legSpread(P, s, 0.6 * star); armUp(P, s, 1.15 * star); knee(P, s, -0.1 * star); }
    P.rot('Head', 0.25 * star, 0, 0);
    extrasSway(P, t, 6.4, X.def, X.has, 2.0);
  } },

  // Vague fluide : onde corporelle qui remonte, bras en houle, cercle gracieux.
  naia: { dur: 8.0, fn(t, P, X) {
    const u = t / 8.0;
    const ph = TAU * t / 2.0;                               // 4 vagues par boucle
    // L'onde parcourt hanches → tête avec retard de phase.
    P.rot('Hips', 0.14 * S(ph), 0, 0);
    P.rot('Spine', 0.18 * S(ph - 0.9), 0, 0);
    P.rot('Chest', 0.18 * S(ph - 1.8), 0, 0);
    P.rot('Neck', 0.14 * S(ph - 2.7), 0, 0);
    P.rot('Head', 0.12 * S(ph - 3.6), 0, 0);
    P.pos('Hips', 0.04 * S(ph - 0.5), -0.03 + 0.025 * S(ph * 2), 0.03 * C(ph));
    for (const s of ['_L', '_R']) knee(P, s, 0.3 + 0.2 * S(ph + 1));
    // Houle des bras : gauche puis droite, épaule → main.
    setArm(P, '_L', { down: 0.45 + 0.4 * S(ph), elbow: 0.7 + 0.55 * S(ph - 1.1) });
    P.rot('Hand_L', 0, 0, -0.6 * S(ph - 2.0));
    setArm(P, '_R', { down: 0.45 + 0.4 * S(ph + Math.PI), elbow: 0.7 + 0.55 * S(ph - 1.1 + Math.PI) });
    P.rot('Hand_R', 0, 0, 0.6 * S(ph - 2.0 + Math.PI));
    // Grand cercle des deux bras aux 3/4.
    const circ = seg(u, 0.7, 0.76) * (1 - seg(u, 0.92, 1));
    const cph = TAU * clamp01((u - 0.7) / 0.22);
    for (const s of ['_L', '_R']) setArm(P, s, { down: circ * (0.6 - 0.6 * C(cph)), fwd: circ * 0.7 * S(cph) });
    P.rot('Head', 0, 0.15 * S(TAU * u * 2), 0.08 * S(ph - 2));
    extrasSway(P, t, 8.0, X.def, X.has, 1.5);
  } },

  // Headbang rageur : jambes campées, 6 coups de tête, cornes du diable, double stomp.
  ragnok: { dur: 6.8, fn(t, P, X) {
    const u = t / 6.8;
    for (const s of ['_L', '_R']) { legSpread(P, s, 0.22); knee(P, s, 0.35); }
    const bangZone = seg(u, 0, 0.06) * (1 - seg(u, 0.62, 0.7));
    const ph = TAU * clamp01(u / 0.62) * 6;                 // 6 headbangs
    headbang(P, ph, 0.62 * bangZone);
    P.pos('Hips', 0, -0.05 - 0.04 * (0.5 - 0.5 * C(ph)) * bangZone, 0);
    if (X.has('Jaw')) P.rot('Jaw', -0.4 * bangZone * (0.5 - 0.5 * C(ph)), 0, 0);
    // Cornes du diable levées pendant le bang.
    for (const s of ['_L', '_R']) armUp(P, s, (0.85 + 0.15 * S(ph)) * bangZone);
    P.rot('Chest', 0, 0.1 * S(ph / 2) * bangZone, 0);
    // Double stomp + poing dans la paume.
    for (const [at, side] of [[0.68, '_L'], [0.78, '_R']]) {
      const st = seg(u, at, at + 0.04) * (1 - seg(u, at + 0.08, at + 0.12));
      legSwing(P, side, 0.9 * st); knee(P, side, 1.2 * st);
      P.pos('Hips', 0, -0.07 * pulse(u, at + 0.06, 25), 0);
    }
    const fist = seg(u, 0.86, 0.9) * (1 - seg(u, 0.96, 1));
    setArm(P, '_R', { down: 0.35 * fist, fwd: 1.0 * fist, elbow: 0.9 * fist });
    setArm(P, '_L', { down: 0.45 * fist, fwd: 1.05 * fist, elbow: 1.1 * fist });
    P.rot('Head', -0.3 * fist, 0, 0);
    P.rot('Spine', -0.15 * fist, 0, 0);
    extrasSway(P, t, 6.8, X.def, X.has, 1.9);
  } },

  // Echo mime les autres : stomp de Krogoth, valse de Sylkis, robot de Vex-9,
  // headbang de Ragnok — entrecoupés de sa petite inclinaison de tête curieuse.
  echo: { dur: 10.0, fn(t, P, X) {
    const u = t / 10.0;
    const parts = [
      ['krogoth', 0.02, 0.24], ['sylkis', 0.27, 0.49], ['vex9', 0.52, 0.74], ['ragnok', 0.77, 0.97]
    ];
    for (const [id, a, b] of parts) {
      const w = seg(u, a, a + 0.02) * (1 - seg(u, b - 0.02, b));
      if (w > 0.001) {
        const local = clamp01((u - a) / (b - a));
        const src = DANCES[id];
        // Rejoue la chorégraphie source à l'échelle de son segment.
        const P2 = { rot: (n, x, y, z) => P.rot(n, x * w, y * w, z * w), pos: (n, x, y, z) => P.pos(n, x * w, y * w, z * w) };
        src.fn(local * src.dur, P2, X);
      }
    }
    // Inclinaisons de tête d'enfant étrange entre les imitations.
    for (const at of [0.005, 0.255, 0.505, 0.755]) {
      const k = seg(u, at, at + 0.01) * (1 - seg(u, at + 0.02, at + 0.03));
      P.rot('Head', 0.05 * k, 0, 0.4 * k * (at < 0.5 ? 1 : -1));
    }
  } },

  // Marche d'apparat : pas cadencés, salut impeccable, demi-tours, garde-à-vous.
  steele: { dur: 6.4, fn(t, P, X) {
    const u = t / 6.4;
    const march = seg(u, 0, 0.05) * (1 - seg(u, 0.55, 0.62));
    const ph = TAU * t / 0.8;
    for (const [s, o] of [['_L', 0], ['_R', Math.PI]]) {
      legSwing(P, s, 0.75 * Math.max(0, S(ph + o)) * march);
      knee(P, s, 0.9 * Math.max(0, S(ph + o - 0.5)) * march);
      setArm(P, s, { fwd: -0.55 * S(ph + o) * march, elbow: 0.25 });
    }
    P.pos('Hips', 0, -0.02 * (0.5 - 0.5 * C(ph * 2)) * march, 0);
    P.rot('Spine', -0.06 * march, 0, 0);
    P.rot('Head', 0.04, 0, 0);
    spin(P, (TAU / 4) * seg(u, 0.3, 0.36) + (TAU / 4) * seg(u, 0.44, 0.5) + (TAU / 2) * seg(u, 0.9, 0.98));
    const sal = seg(u, 0.62, 0.68) * (1 - seg(u, 0.82, 0.88));
    salute(P, sal);
    P.rot('Chest', -0.05 * sal, 0, 0);
    // Mains dans le dos pour finir.
    const rest = seg(u, 0.85, 0.92) * (1 - seg(u, 0.97, 1));
    for (const s of ['_L', '_R']) setArm(P, s, { down: 1.05 * rest, fwd: -0.5 * rest, elbow: 0.9 * rest });
    extrasSway(P, t, 6.4, X.def, X.has, 0.4);
  } },

  // Laconique : doigts-pistolets précis, roulement d'épaules, bras croisés, hochement.
  wraith: { dur: 6.4, fn(t, P, X) {
    const u = t / 6.4;
    for (const [at, s] of [[0.05, '_R'], [0.25, '_L']]) {
      const dr = seg(u, at, at + 0.05) * (1 - seg(u, at + 0.14, at + 0.19));
      const kick = pulse(u, at + 0.09, 22) * dr;
      setArm(P, s, { down: 0.2 * dr, fwd: 0.15 * dr });
      armFwd(P, s, 1.25 * dr);
      P.rot('UpperArm' + s, 0.25 * kick, 0, 0);
      P.rot('Head', 0, (s === '_R' ? -0.25 : 0.25) * dr, 0);
    }
    const roll = seg(u, 0.46, 0.52) * (1 - seg(u, 0.62, 0.68));
    const rph = TAU * 2 * clamp01((u - 0.46) / 0.2);
    for (const s of ['_L', '_R']) P.rot('Shoulder' + s, 0.12 * roll * S(rph), 0, 0.15 * roll * C(rph));
    P.rot('Chest', 0.06 * roll * S(rph), 0, 0);
    const cross = seg(u, 0.66, 0.74) * (1 - seg(u, 0.9, 0.97));
    crossArms(P, cross);
    P.rot('Hips', 0, 0, 0.06 * cross);
    P.pos('Hips', 0.03 * cross, -0.02 * cross, 0);
    const nod = 4 * TAU * clamp01((u - 0.74) / 0.16);
    P.rot('Head', -0.16 * (0.5 - 0.5 * C(nod)) * cross, 0, 0);
    extrasSway(P, t, 6.4, X.def, X.has, 0.3);
  } },

  // Disco sarcastique : pointés travolta, bump de hanches, clap-défibrillateur, spin.
  ferrai: { dur: 7.2, fn(t, P, X) {
    const u = t / 7.2;
    const disco = seg(u, 0, 0.05) * (1 - seg(u, 0.5, 0.58));
    const ph = TAU * t / 0.9;
    hipSway(P, ph, 0.075 * disco);
    groove(P, X, ph * 2, 0.02 * disco);
    // Pointé diagonal haut/bas alterné (bras droit), gauche sur la hanche.
    const pt = S(ph / 2);
    setArm(P, '_R', { down: (0.35 - 0.75 * pt) * disco, fwd: 0.5 * disco, elbow: 0.15 * disco });
    P.rot('Head', 0, -0.2 * pt * disco, 0.1 * pt * disco);
    setArm(P, '_L', { down: 0.95 * disco, elbow: 1.5 * disco });
    // Clap défibrillateur ×2 : mains jointes devant + secousse.
    for (const at of [0.56, 0.7]) {
      const cl = seg(u, at, at + 0.03) * (1 - seg(u, at + 0.09, at + 0.13));
      const zap = pulse(u, at + 0.05, 18);
      for (const s of ['_L', '_R']) setArm(P, s, { down: 0.55 * cl, fwd: 1.05 * cl, elbow: 0.8 * cl });
      P.rot('Chest', 0.1 * zap * S(t * 60), 0, 0.08 * zap * S(t * 55));
      P.rot('Head', 0.12 * zap * S(t * 50), 0, 0);
    }
    spin(P, TAU * seg(u, 0.84, 0.94));
    const flip = seg(u, 0.94, 0.97) * (1 - seg(u, 0.99, 1));
    P.rot('Head', -0.2 * flip, 0, 0.35 * flip);
    extrasSway(P, t, 7.2, X.def, X.has, 0.8);
  } },

  // Piston mécanique : squats hydrauliques, pompes de bras alternées, rotation crantée.
  bastion7: { dur: 7.0, fn(t, P, X) {
    const u = t / 7.0;
    // Squats : descente lente, remontée sèche.
    const sq = (x) => { const c = x % 1; return c < 0.7 ? ease(c / 0.7) : ease((1 - c) / 0.3); };
    squat(P, X, 0.8 * sq(u * 3.5) * (1 - seg(u, 0.8, 0.86)));
    // Pompes de bras façon vérins.
    const ph = TAU * t / 1.0;
    const pump = (x) => snap(0.5 + 0.5 * S(x), 4, 9);
    setArm(P, '_L', { down: 0.35, fwd: 1.15 * pump(ph), elbow: 1.4 * (1 - pump(ph)) });
    setArm(P, '_R', { down: 0.35, fwd: 1.15 * pump(ph + Math.PI), elbow: 1.4 * (1 - pump(ph + Math.PI)) });
    // Torse en rotation crantée.
    P.rot('Chest', 0, 0.4 * S(TAU * snap(u, 14) * 2), 0);
    P.rot('Head', 0, -0.3 * S(TAU * snap(u, 14) * 2), 0);
    // Purge de vapeur : haussement + tremblement.
    const vent = seg(u, 0.8, 0.84) * (1 - seg(u, 0.92, 0.97));
    for (const s of ['_L', '_R']) P.rot('Shoulder' + s, 0, 0, -(s === '_R' ? 1 : -1) * 0.25 * vent);
    P.pos('Hips', 0.015 * vent * S(t * 70), 0.03 * vent, 0);
    P.rot('Chest', -0.1 * vent, 0, 0);
    extrasSway(P, t, 7.0, X.def, X.has, 0.5);
  } },

  // Provocatrice : body roll, baiser soufflé, pirouette, pose hanchée + clin d'œil.
  nyx: { dur: 7.5, fn(t, P, X) {
    const u = t / 7.5;
    const ph = TAU * t / 1.5;
    hipSway(P, ph, 0.085 * (1 - seg(u, 0.55, 0.62)));
    // Body roll descendant.
    const roll = seg(u, 0.2, 0.26) * (1 - seg(u, 0.42, 0.5));
    const rph = TAU * 1.5 * clamp01((u - 0.2) / 0.28);
    P.rot('Head', 0.22 * roll * S(rph), 0, 0);
    P.rot('Chest', 0.22 * roll * S(rph - 0.9), 0, 0);
    P.rot('Spine', 0.22 * roll * S(rph - 1.8), 0, 0);
    P.rot('Hips', 0.16 * roll * S(rph - 2.7), 0, 0);
    P.pos('Hips', 0, -0.1 * roll * (0.5 - 0.5 * C(rph)), 0);
    // Baiser soufflé : main aux lèvres puis tendue.
    const kiss = seg(u, 0.55, 0.6) * (1 - seg(u, 0.72, 0.78));
    const out = seg(u, 0.63, 0.7);
    setArm(P, '_R', { down: 0.5 * kiss * (1 - out), fwd: (0.6 + 0.7 * out) * kiss, elbow: 2.2 * kiss * (1 - out) + 0.2 * kiss * out });
    P.rot('Head', -0.08 * kiss, 0.15 * kiss * (1 - out), 0.1 * kiss);
    setArm(P, '_L', { down: 0.9 * kiss, elbow: 1.4 * kiss });
    spin(P, TAU * seg(u, 0.78, 0.87));
    // Pose finale hanchée, doigt-pistolet et clin d'œil (tête).
    const posefin = seg(u, 0.87, 0.92) * (1 - seg(u, 0.985, 1));
    P.pos('Hips', 0.06 * posefin, -0.03 * posefin, 0);
    P.rot('Hips', 0, 0, -0.16 * posefin);
    setArm(P, '_R', { down: 0.25 * posefin });
    armFwd(P, '_R', 1.15 * posefin);
    P.rot('Head', 0, -0.2 * posefin, 0.25 * posefin);
    setArm(P, '_L', { down: 0.95 * posefin, elbow: 1.6 * posefin });
    extrasSway(P, t, 7.5, X.def, X.has, 1.0);
  } }
};

// —————————————————————————————— INTROS ——————————————————————————————
// Non bouclées : la dernière pose est tenue (LoopOnce + clamp à l'exécution).

const INTROS = {
  // Dérapage d'arrivée, bras croisés, pointé arrogant du menton.
  zephyr: { dur: 3.0, fn(t, P, X) {
    const u = t / 3.0;
    const skid = 1 - seg(u, 0.15, 0.35);
    P.rot('Spine', -0.5 * skid, 0, 0.15 * skid);
    P.pos('Hips', 0, -0.18 * skid, 0);
    for (const s of ['_L', '_R']) { knee(P, s, 1.0 * skid); legSwing(P, s, 0.5 * skid); }
    setArm(P, '_L', { down: 0.2 * skid, fwd: -0.8 * skid });
    setArm(P, '_R', { down: 0.2 * skid, fwd: 0.9 * skid });
    const cross = seg(u, 0.35, 0.5) * (1 - seg(u, 0.68, 0.8));
    crossArms(P, cross);
    P.rot('Head', 0.12 * cross, 0.25 * cross, 0);
    const point = seg(u, 0.8, 0.92);
    setArm(P, '_R', { down: -0.1 * point, fwd: 1.3 * point });
    P.rot('Head', 0.2 * point, 0, 0.1 * point);
    P.rot('Chest', 0, -0.15 * point, 0);
    extrasSway(P, t, 3.0, X.def, X.has, 1.5);
  } },

  // Se relève d'un genou, deux coups au plastron, rugissement, stance colossale.
  krogoth: { dur: 3.5, fn(t, P, X) {
    const u = t / 3.5;
    const kneel = 1 - seg(u, 0.1, 0.35);
    legSwing(P, '_L', 1.05 * kneel); knee(P, '_L', 1.5 * kneel);
    legSwing(P, '_R', -0.35 * kneel); knee(P, '_R', 1.85 * kneel);
    P.pos('Hips', 0, -(X.d.thigh * 0.8) * kneel, 0);
    P.rot('Spine', -0.35 * kneel, 0, 0);
    for (const at of [0.42, 0.54]) {
      const beat = seg(u, at, at + 0.04) * (1 - seg(u, at + 0.08, at + 0.11));
      setArm(P, '_R', { down: 0.5 * beat, fwd: 1.15 * beat, elbow: 1.9 * beat });
      P.rot('Chest', 0.08 * pulse(u, at + 0.06, 25), 0, 0);
    }
    const roar = seg(u, 0.66, 0.76) * (1 - seg(u, 0.88, 0.96));
    P.rot('Head', 0.55 * roar, 0, 0);
    P.rot('Spine', 0.22 * roar, 0, 0);
    if (X.has('Jaw')) P.rot('Jaw', -0.6 * roar, 0, 0);
    for (const s of ['_L', '_R']) setArm(P, s, { down: 0.3 * roar, elbow: 1.5 * roar });
    const fin = seg(u, 0.88, 1);
    for (const s of ['_L', '_R']) { legSpread(P, s, 0.2 * fin); knee(P, s, 0.25 * fin); }
    P.rot('Spine', -0.08 * fin, 0, 0);
    extrasSway(P, t, 3.5, X.def, X.has, 1.6);
  } },

  // Éventail des 4 bras ouvert un à un, grande révérence d'opéra, port de reine.
  sylkis: { dur: 4.0, fn(t, P, X) {
    const u = t / 4.0;
    const opens = [
      ['_L', '', 0.05], ['_R', '', 0.17], ['_L', 'ArmB_', 0.29], ['_R', 'ArmB_', 0.41]
    ];
    for (const [s, pre, at] of opens) {
      const o = seg(u, at, at + 0.12);
      setArm(P, s, { prefix: pre, down: (pre ? 0.35 : -0.25) * o, fwd: 0.25 * o, elbow: 0.3 * o });
    }
    const bow = seg(u, 0.56, 0.7) * (1 - seg(u, 0.82, 0.94));
    P.rot('Spine', -0.6 * bow, 0, 0);
    P.rot('Head', 0.25 * bow, 0, 0);
    P.pos('Hips', 0, -0.08 * bow, 0);
    legSwing(P, '_R', -0.35 * bow); knee(P, '_R', 0.5 * bow);
    setArm(P, '_R', { down: -0.2 * bow, fwd: 0.6 * bow });
    setArm(P, '_L', { down: 0.7 * bow, fwd: -0.5 * bow });
    const fin = seg(u, 0.85, 1);
    P.rot('Head', -0.12 * fin, 0, 0);
    P.rot('Chest', 0.06 * fin, 0, 0);
    for (const s of ['_L', '_R']) setArm(P, s, { prefix: 'ArmB_', down: 0.55 * fin, elbow: 0.7 * fin });
    extrasSway(P, t, 4.0, X.def, X.has, 1.0);
  } },

  // Séquence de boot : pantin éteint → segments qui s'enclenchent → scan de visière.
  vex9: { dur: 3.0, fn(t, P, X) {
    const u = t / 3.0;
    const off = 1 - seg(u, 0.08, 0.18);
    P.rot('Spine', -0.55 * off, 0, 0);
    P.rot('Head', -0.6 * off, 0, 0.15 * off);
    for (const s of ['_L', '_R']) { setArm(P, s, { down: 0.35 * off, fwd: 0.3 * off, elbow: 0.2 * off }); knee(P, s, 0.5 * off); }
    P.pos('Hips', 0, -0.14 * off, 0);
    // Enclenchements secs segment par segment.
    const snapOn = (at) => seg(u, at, at + 0.035);
    P.rot('Chest', -0.15 * (1 - snapOn(0.22)), 0, 0);
    P.rot('Head', 0.12 * snapOn(0.3), 0, -0.15 * snapOn(0.3));
    // Balayage de visière : la tête scanne de gauche à droite.
    const scan = seg(u, 0.42, 0.5) * (1 - seg(u, 0.72, 0.8));
    P.rot('Head', 0, -0.7 * scan * C(TAU * 0.5 * clamp01((u - 0.42) / 0.38)), 0);
    const ready = seg(u, 0.8, 0.95);
    setArm(P, '_R', { down: 0.3 * ready, elbow: 1.3 * ready });
    setArm(P, '_L', { down: 0.55 * ready, elbow: 0.6 * ready });
    P.rot('Chest', 0, -0.12 * ready, 0);
    extrasSway(P, t, 3.0, X.def, X.has, 0.6);
  } },

  // S'élève comme une fumée : ascension lente, bras en volutes, tête relevée en dernier.
  umbra: { dur: 3.5, fn(t, P, X) {
    const u = t / 3.5;
    const rise = seg(u, 0, 0.55);
    const low = 1 - rise;
    squat(P, X, 1.1 * low);
    P.rot('Spine', -0.45 * low, 0, 0);
    P.rot('Head', -0.5 * (1 - seg(u, 0.45, 0.68)), 0, 0);
    // Les bras montent en retard, comme aspirés.
    const armsUpK = seg(u, 0.25, 0.7);
    for (const s of ['_L', '_R']) {
      setArm(P, s, { down: 0.9 * (1 - armsUpK), elbow: 0.6 * (1 - armsUpK) });
      armUp(P, s, 0.5 * armsUpK * (1 - seg(u, 0.75, 0.95)));
    }
    const drift = S(TAU * u * 2);
    P.pos('Hips', 0.02 * drift * rise, 0.015 * S(TAU * u * 3) * rise, 0);
    const fin = seg(u, 0.8, 0.95);
    P.rot('Head', 0.08 * fin, 0.2 * fin, 0);
    extrasSway(P, t, 3.5, X.def, X.has, 1.2);
  } },

  // Se déplie comme une pousse : recroquevillé → croissance → paumes ouvertes au ciel.
  thorne: { dur: 4.0, fn(t, P, X) {
    const u = t / 4.0;
    const curled = 1 - seg(u, 0.1, 0.6);
    squat(P, X, 1.15 * curled);
    P.rot('Spine', -0.7 * curled, 0, 0);
    P.rot('Head', -0.3 * curled, 0, 0);
    crossArms(P, curled);
    // Déploiement des bras-feuilles avec léger tremblé organique.
    const unfold = seg(u, 0.5, 0.8);
    const tremble = 0.03 * S(TAU * u * 6) * unfold;
    for (const s of ['_L', '_R']) {
      armUp(P, s, (0.55 + tremble) * unfold * (1 - seg(u, 0.85, 1) * 0.5));
      P.rot('Hand' + s, -0.7 * unfold, 0, 0);
    }
    P.rot('Head', 0.25 * unfold * (1 - seg(u, 0.85, 1) * 0.6), 0, 0);
    if (X.has('Crest')) P.rot('Crest', 0.3 * unfold, 0, 0);
    extrasSway(P, t, 4.0, X.def, X.has, 0.9);
  } },

  // Trois bonds surexcités, poings qui tremblent de joie, pose étoile.
  pulsar: { dur: 2.6, fn(t, P, X) {
    const u = t / 2.6;
    const hops = 1 - seg(u, 0.55, 0.65);
    const ph = TAU * t / 0.45;
    const hop = Math.max(0, S(ph));
    P.pos('Hips', 0, 0.14 * hop * hops - 0.04 * (1 - hop) * hops, 0);
    for (const s of ['_L', '_R']) {
      knee(P, s, (0.7 - 0.5 * hop) * hops);
      setArm(P, s, { down: 0.5 * hops, elbow: (1.2 + 0.3 * S(ph * 2)) * hops });
    }
    const shake = seg(u, 0.62, 0.7) * (1 - seg(u, 0.8, 0.86));
    for (const s of ['_L', '_R']) setArm(P, s, { down: 0.4 * shake, elbow: (1.6 + 0.12 * S(t * 40)) * shake });
    P.rot('Head', -0.1 * shake + 0.12 * shake * S(t * 35), 0, 0);
    const star = seg(u, 0.84, 0.97);
    for (const s of ['_L', '_R']) { armUp(P, s, 1.1 * star); legSpread(P, s, 0.4 * star); }
    P.rot('Head', 0.25 * star, 0, 0);
    extrasSway(P, t, 2.6, X.def, X.has, 2.0);
  } },

  // Montée en vague, cercle de bras, main au cœur et inclinaison sereine.
  naia: { dur: 3.2, fn(t, P, X) {
    const u = t / 3.2;
    const rise = seg(u, 0, 0.4);
    squat(P, X, 0.9 * (1 - rise));
    P.rot('Spine', 0.25 * S(TAU * clamp01(u / 0.4)) * (1 - rise), 0, 0);
    const circ = seg(u, 0.35, 0.42) * (1 - seg(u, 0.6, 0.68));
    const cph = TAU * clamp01((u - 0.35) / 0.33);
    for (const s of ['_L', '_R']) setArm(P, s, { down: circ * (0.5 - 0.5 * C(cph)), fwd: circ * 0.6 * S(cph) });
    const bow = seg(u, 0.68, 0.8) * (1 - seg(u, 0.92, 1));
    setArm(P, '_R', { down: 0.6 * bow, fwd: 0.7 * bow, elbow: 2.1 * bow });
    P.rot('Spine', -0.3 * bow, 0, 0);
    P.rot('Head', 0.12 * bow, 0, 0);
    const fin = seg(u, 0.92, 1);
    P.rot('Head', -0.06 * fin, 0.1 * fin, 0);
    extrasSway(P, t, 3.2, X.def, X.has, 1.4);
  } },

  // Deux stomps qui avancent, double flexion rugissante, poing dans la paume.
  ragnok: { dur: 3.0, fn(t, P, X) {
    const u = t / 3.0;
    for (const [at, side] of [[0.05, '_R'], [0.2, '_L']]) {
      const st = seg(u, at, at + 0.05) * (1 - seg(u, at + 0.1, at + 0.15));
      legSwing(P, side, 1.0 * st); knee(P, side, 1.3 * st);
      P.pos('Hips', 0, -0.06 * pulse(u, at + 0.08, 22), 0);
      P.rot('Spine', -0.1 * st, 0, side === '_R' ? -0.08 * st : 0.08 * st);
    }
    const flex = seg(u, 0.38, 0.48) * (1 - seg(u, 0.66, 0.76));
    for (const s of ['_L', '_R']) setArm(P, s, { down: 0.25 * flex, elbow: 1.7 * flex });
    P.rot('Head', 0.4 * flex, 0, 0);
    P.rot('Spine', 0.15 * flex, 0, 0);
    if (X.has('Jaw')) P.rot('Jaw', -0.5 * flex, 0, 0);
    const fist = seg(u, 0.76, 0.86);
    setArm(P, '_R', { down: 0.35 * fist, fwd: 1.05 * fist, elbow: 0.85 * fist });
    setArm(P, '_L', { down: 0.45 * fist, fwd: 1.1 * fist, elbow: 1.15 * fist });
    P.rot('Spine', -0.18 * fist, 0, 0);
    P.rot('Head', -0.05 * fist, 0, 0);
    for (const s of ['_L', '_R']) legSpread(P, s, 0.22 * fist);
    extrasSway(P, t, 3.0, X.def, X.has, 1.8);
  } },

  // Observe, penche la tête, imite un salut, petit signe de la main timide.
  echo: { dur: 3.4, fn(t, P, X) {
    const u = t / 3.4;
    const tilt1 = seg(u, 0.05, 0.12) * (1 - seg(u, 0.25, 0.32));
    P.rot('Head', 0.05 * tilt1, 0.15 * tilt1, 0.42 * tilt1);
    const tilt2 = seg(u, 0.3, 0.37) * (1 - seg(u, 0.48, 0.55));
    P.rot('Head', 0.05 * tilt2, -0.15 * tilt2, -0.42 * tilt2);
    const sal = seg(u, 0.52, 0.62) * (1 - seg(u, 0.72, 0.8));
    salute(P, sal);
    P.rot('Head', 0, 0, 0.15 * sal); // salut penché, pas tout à fait juste
    const wave = seg(u, 0.8, 0.86) * (1 - seg(u, 0.96, 1));
    const wph = TAU * 3 * clamp01((u - 0.8) / 0.16);
    setArm(P, '_R', { down: -0.1 * wave, elbow: 1.2 * wave });
    P.rot('Hand_R', 0, 0, 0.4 * wave * S(wph));
    P.rot('Head', 0.05 * wave, 0, 0.2 * wave);
    extrasSway(P, t, 3.4, X.def, X.has, 0.8);
  } },

  // Garde-à-vous, salut réglementaire, repos parade.
  steele: { dur: 2.8, fn(t, P, X) {
    const u = t / 2.8;
    const attention = seg(u, 0.05, 0.2);
    for (const s of ['_L', '_R']) setArm(P, s, { down: 1.28 * attention, elbow: 0.05 * attention });
    P.rot('Spine', 0.06 * attention, 0, 0);
    P.rot('Head', -0.04 * attention, 0, 0);
    const sal = seg(u, 0.3, 0.42) * (1 - seg(u, 0.68, 0.8));
    salute(P, sal);
    const rest = seg(u, 0.8, 0.95);
    for (const s of ['_L', '_R']) setArm(P, s, { down: 1.05 * rest, fwd: -0.5 * rest, elbow: 0.85 * rest });
    for (const s of ['_L', '_R']) legSpread(P, s, 0.08 * rest);
    extrasSway(P, t, 2.8, X.def, X.has, 0.2);
  } },

  // Se relève d'une position de tir agenouillée, fait craquer sa nuque, prêt.
  wraith: { dur: 3.0, fn(t, P, X) {
    const u = t / 3.0;
    const kneelAim = 1 - seg(u, 0.3, 0.55);
    legSwing(P, '_L', 1.0 * kneelAim); knee(P, '_L', 1.45 * kneelAim);
    legSwing(P, '_R', -0.3 * kneelAim); knee(P, '_R', 1.8 * kneelAim);
    P.pos('Hips', 0, -(X.d.thigh * 0.75) * kneelAim, 0);
    setArm(P, '_R', { down: 0.2 * kneelAim });
    armFwd(P, '_R', 1.3 * kneelAim);
    P.rot('LowerArm_R', 0, 0.25 * kneelAim, 0);
    setArm(P, '_L', { down: 0.4 * kneelAim });
    armFwd(P, '_L', 1.1 * kneelAim);
    P.rot('LowerArm_L', 0, -1.0 * kneelAim, 0);
    P.rot('Head', 0.05 * kneelAim, 0.12 * kneelAim, 0);
    // Craquement de nuque : gauche, droite.
    const crack1 = seg(u, 0.6, 0.66) * (1 - seg(u, 0.7, 0.76));
    const crack2 = seg(u, 0.76, 0.82) * (1 - seg(u, 0.86, 0.92));
    P.rot('Head', 0, 0, 0.4 * crack1 - 0.4 * crack2);
    const fin = seg(u, 0.92, 1);
    P.rot('Spine', -0.05 * fin, 0, 0);
    extrasSway(P, t, 3.0, X.def, X.has, 0.3);
  } },

  // Consulte son poignet, hausse les épaules blasée, croise les bras, tape du pied.
  ferrai: { dur: 3.0, fn(t, P, X) {
    const u = t / 3.0;
    const check = seg(u, 0.05, 0.15) * (1 - seg(u, 0.32, 0.42));
    setArm(P, '_L', { down: 0.5 * check, fwd: 0.7 * check, elbow: 1.9 * check });
    P.rot('Head', -0.28 * check, -0.2 * check, 0);
    const shrug = seg(u, 0.42, 0.5) * (1 - seg(u, 0.6, 0.68));
    for (const s of ['_L', '_R']) {
      P.rot('Shoulder' + s, 0, 0, -(s === '_R' ? 1 : -1) * 0.3 * shrug);
      setArm(P, s, { down: 0.65 * shrug, elbow: 1.5 * shrug });
      P.rot('Hand' + s, 0, 0, (s === '_R' ? 1 : -1) * 0.8 * shrug); // paumes vers le ciel
    }
    P.rot('Head', 0, 0, 0.15 * shrug);
    const cross = seg(u, 0.68, 0.78);
    crossArms(P, cross);
    P.rot('Hips', 0, 0, 0.08 * cross);
    P.pos('Hips', 0.04 * cross, 0, 0);
    // Tape du pied impatiente.
    const tap = seg(u, 0.8, 0.85);
    footRot(P, '_R', 0.35 * tap * Math.max(0, S(TAU * 4 * clamp01((u - 0.8) / 0.2))));
    extrasSway(P, t, 3.0, X.def, X.has, 0.5);
  } },

  // Mise sous tension : affaissé → redressement lourd → test des servos → poings serrés.
  bastion7: { dur: 3.6, fn(t, P, X) {
    const u = t / 3.6;
    const slump = 1 - seg(u, 0.1, 0.4);
    P.rot('Spine', -0.5 * slump, 0, 0);
    P.rot('Head', -0.55 * slump, 0, 0);
    P.pos('Hips', 0, -0.16 * slump, 0);
    for (const s of ['_L', '_R']) knee(P, s, 0.55 * slump);
    // Test servo : rotation des bras vers l'extérieur puis retour, un par un.
    for (const [s, at] of [['_L', 0.45], ['_R', 0.6]]) {
      const sv = seg(u, at, at + 0.06) * (1 - seg(u, at + 0.12, at + 0.18));
      armUp(P, s, 0.65 * sv);
      P.rot('LowerArm' + s, 0, (s === '_R' ? 1 : -1) * 0.9 * sv, 0);
    }
    const clench = seg(u, 0.8, 0.9);
    for (const s of ['_L', '_R']) {
      setArm(P, s, { down: 0.35 * clench, elbow: 0.9 * clench });
      P.rot('Hand' + s, -0.5 * clench, 0, 0);
      legSpread(P, s, 0.15 * clench);
    }
    P.rot('Chest', -0.06 * clench, 0, 0);
    extrasSway(P, t, 3.6, X.def, X.has, 0.3);
  } },

  // Pirouette d'entrée, baiser soufflé, salut moqueur à deux doigts, pose hanchée.
  nyx: { dur: 3.0, fn(t, P, X) {
    const u = t / 3.0;
    spin(P, TAU * seg(u, 0.02, 0.22));
    const land = seg(u, 0.2, 0.28);
    P.pos('Hips', 0, -0.05 * land * (1 - seg(u, 0.3, 0.4)), 0);
    const kiss = seg(u, 0.32, 0.4) * (1 - seg(u, 0.52, 0.6));
    const out = seg(u, 0.44, 0.52);
    setArm(P, '_R', { down: 0.5 * kiss * (1 - out), fwd: (0.6 + 0.7 * out) * kiss, elbow: 2.2 * kiss * (1 - out) });
    P.rot('Head', -0.08 * kiss, 0.1 * kiss, 0.12 * kiss);
    const mock = seg(u, 0.6, 0.68) * (1 - seg(u, 0.78, 0.86));
    salute(P, mock * 0.8);
    P.rot('Head', 0, 0, -0.2 * mock);
    const posefin = seg(u, 0.86, 0.96);
    P.pos('Hips', 0.06 * posefin, -0.02 * posefin, 0);
    P.rot('Hips', 0, 0, -0.15 * posefin);
    crossArms(P, posefin * 0.7);
    P.rot('Head', 0.05 * posefin, -0.18 * posefin, 0.12 * posefin);
    extrasSway(P, t, 3.0, X.def, X.has, 0.9);
  } }
};

/** Construit les clips `dance` et `intro` du personnage. */
export function buildSignatureClips(def, rig) {
  const X = { def, d: rig.dims, has: (n) => rig.byName.has(n) };
  const dn = DANCES[def.id], intro = INTROS[def.id];
  if (!dn || !intro) throw new Error(`Signature manquante pour ${def.id}`);
  const dance = makeClip('dance', dn.dur, 24, rig, (t, P) => {
    stance(P, def, X.has);
    dn.fn(t, P, X);
  });
  const intr = makeClip('intro', intro.dur, 24, rig, (t, P) => {
    stance(P, def, X.has);
    intro.fn(t, P, X);
  });
  return [dance, intr];
}
