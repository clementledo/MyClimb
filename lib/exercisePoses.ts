/**
 * Petites animations en boucle qui montrent comment faire chaque exercice.
 *
 * Un bonhomme en fil de fer 2D animé par cinématique directe : on donne des angles
 * (en degrés, 0 = vers le haut, 90 = vers la droite, 180 = vers le bas) et les os
 * gardent toujours la même longueur. Quelques membres peuvent être placés par
 * cinématique inverse à deux os (mains sur une prise, pieds au sol), ce qui ne les
 * étire pas non plus.
 *
 * Pur TypeScript, sans React : sert à l'app (components/ExerciseAnim.tsx) comme à un
 * rendu SVG en chaîne de caractères (`exerciseSvg`).
 *
 * Repère : boîte 0–100 × 0–100, y vers le bas, sol vers y = 92.
 */

export type Pt = { x: number; y: number };
export type View = 'side' | 'front' | 'close';
/** Teinte d'un tracé : corps, membre qui travaille, accessoire (et leur version atténuée). */
export type Tone = 'body' | 'bodyFar' | 'accent' | 'accentFar' | 'prop' | 'propSoft';

/** Un tracé : traits à bouts ronds, éventuellement rempli. */
export type Shape =
  | { k: 'path'; d: string; w: number; tone: Tone; fill?: boolean; dash?: number[] }
  | { k: 'circle'; cx: number; cy: number; r: number; tone: Tone; fill?: boolean; w?: number }
  | { k: 'rect'; x: number; y: number; width: number; height: number; rx: number; tone: Tone; fill?: boolean; w?: number };

export type BoneName =
  | 'torso'
  | 'uaL' | 'faL' | 'hdL' | 'uaR' | 'faR' | 'hdR'
  | 'thL' | 'shL' | 'ftL' | 'toL' | 'thR' | 'shR' | 'ftR' | 'toR'
  | 'palmL' | 'palmR' | 'finger';

export type Bone = { name: BoneName; a: Pt; b: Pt; c?: Pt; width: number; working: boolean; far: boolean };

export type Frame = {
  view: View;
  /** Articulations : head, neck, pelvis, shoulderL/R, elbowL/R, handL/R, hipL/R, kneeL/R, footL/R, toeL/R… */
  joints: Record<string, Pt>;
  bones: Bone[];
  head: { c: Pt; r: number } | null;
  /** Os mis en évidence (ceux qui travaillent). */
  working: BoneName[];
  /** Accessoires (sol, barre, poutre, mur…). */
  props: Shape[];
  /** Tout ce qu'il faut dessiner, dans l'ordre. */
  shapes: Shape[];
};

export type AnimColors = { body: string; accent: string; prop: string; bg: string };

/* ------------------------------------------------------------------ */
/* Géométrie                                                           */
/* ------------------------------------------------------------------ */

export const FLOOR = 92;
const FLOOR_W = 1.6;
/** Bord haut du trait de sol : là où les corps se posent. */
const GROUND = FLOOR - FLOOR_W / 2;

/** Longueurs des os et largeurs des traits (échelle 1). */
const LEN = { torso: 22, neck: 9.5, head: 5.6, ua: 12.5, fa: 11.5, hd: 5.5, th: 17.5, sh: 16.5, ft: 5, to: 2.4, sw: 5.6, hw: 3.4 };
const WID = { limb: 5, torso: 6.6 };

type P = Record<string, number>;
type J = Record<string, Pt>;

const rad = (a: number) => (a * Math.PI) / 180;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const dir = (a: number): Pt => ({ x: Math.sin(rad(a)), y: -Math.cos(rad(a)) });
const add = (p: Pt, d: Pt, k = 1): Pt => ({ x: p.x + d.x * k, y: p.y + d.y * k });
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpPt = (a: Pt, b: Pt, u: number): Pt => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });
const angleOf = (a: Pt, b: Pt) => (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
/** Ease-in-out doux. */
const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u, 0, 1));
const sinc = (x: number) => (Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x);
const wave = (t: number, period: number, phase = 0) => Math.sin(2 * Math.PI * (t / period + phase));
const r1 = (v: number) => Math.round(v * 100) / 100;

/**
 * Cinématique inverse à deux os : coude (ou genou) et main (ou pied) pour viser `t`
 * depuis `a`. `s` = sens du pli (+1 horaire à l'écran, -1 antihoraire). Si la cible
 * est trop loin, le membre se tend vers elle sans s'allonger.
 */
function ik2(a: Pt, t: Pt, l1: number, l2: number, s: number): [Pt, Pt] {
  const dx = t.x - a.x;
  const dy = t.y - a.y;
  const d = Math.hypot(dx, dy);
  const dc = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const ux = d > 1e-6 ? dx / d : 0;
  const uy = d > 1e-6 ? dy / d : 1;
  const A = Math.acos(clamp((l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc), -1, 1)) * s;
  const ex = ux * Math.cos(A) - uy * Math.sin(A);
  const ey = ux * Math.sin(A) + uy * Math.cos(A);
  return [
    { x: a.x + ex * l1, y: a.y + ey * l1 },
    { x: a.x + ux * dc, y: a.y + uy * dc },
  ];
}

/* ------------------------------------------------------------------ */
/* Description des exercices                                          */
/* ------------------------------------------------------------------ */

type Limb = 'aL' | 'aR' | 'lL' | 'lR';

type Key = {
  /** Paramètres de la pose (fusionnés avec `base`). */
  p: P;
  /** Temps passé immobile sur la pose (s). */
  hold?: number;
  /** Durée du passage à la pose suivante (s). */
  move?: number;
  /** Articulation clouée pour cette pose (sinon celle de l'exercice). */
  anchor?: string;
};

type Ex = {
  view?: View;
  /** Taille du bonhomme (1 = debout ~72 de haut). */
  scale?: number;
  base: P;
  keys: Key[];
  /** Articulation clouée en (ax, ay). */
  anchor?: string;
  /** Pose le point le plus bas sur le sol. */
  ground?: boolean;
  /** Fait pivoter tout le corps pour que ces deux articulations soient à la même hauteur. */
  level?: [string, string];
  /** Os qui ne pivotent pas avec `level` (angles absolus). */
  fixed?: string[];
  /** Membres placés par cinématique inverse (cible aLx/aLy…) avec le sens du pli (0 = vers l'extérieur). */
  ik?: Partial<Record<Limb, number>>;
  /** Os ou groupes qui travaillent : armL, arms, fore, legs, core, feet… */
  work: string[];
  /** Vue de profil : membres du côté droit dessinés devant, en pleine couleur ('armR', 'legR'). */
  near?: ('armR' | 'legR')[];
  /** Accessoires dessinés sous le corps. */
  props?: (j: J, t: number) => Shape[];
  /** Accessoires dessinés par-dessus le corps. */
  over?: (j: J, t: number) => Shape[];
  /** Retouche des paramètres à chaque image (mouvements procéduraux). */
  mod?: (p: P, t: number) => void;
  /** Retouche des articulations après calcul. */
  post?: (j: J, t: number, p: P) => void;
  /** Respiration : amplitude par paramètre, période `bp` (s). */
  breathe?: P;
  bp?: number;
  /** Dessin entièrement personnalisé (gros plan sur les mains…). */
  draw?: (t: number) => { joints: J; bones: Bone[]; props: Shape[]; over?: Shape[]; shapes?: Shape[]; head?: { c: Pt; r: number } };
  /** Durée de la boucle pour un dessin personnalisé. */
  loop?: number;
};

const EX: Record<string, Ex> = {};

const GROUPS: Record<string, BoneName[]> = {
  armL: ['uaL', 'faL', 'hdL'],
  armR: ['uaR', 'faR', 'hdR'],
  arms: ['uaL', 'faL', 'hdL', 'uaR', 'faR', 'hdR'],
  foreL: ['faL', 'hdL'],
  foreR: ['faR', 'hdR'],
  fore: ['faL', 'hdL', 'faR', 'hdR'],
  legL: ['thL', 'shL', 'ftL', 'toL'],
  legR: ['thR', 'shR', 'ftR', 'toR'],
  legs: ['thL', 'shL', 'ftL', 'toL', 'thR', 'shR', 'ftR', 'toR'],
  thighs: ['thL', 'thR'],
  calves: ['shL', 'ftL', 'shR', 'ftR'],
  feet: ['ftL', 'toL', 'ftR', 'toR'],
  core: ['torso'],
  hands: ['palmL', 'palmR', 'finger', 'hdL', 'hdR'],
};

function workSet(list: string[]): Set<BoneName> {
  const s = new Set<BoneName>();
  for (const w of list) for (const b of GROUPS[w] ?? [w as BoneName]) s.add(b);
  return s;
}

/* ------------------------------------------------------------------ */
/* Cinématique directe                                                 */
/* ------------------------------------------------------------------ */

type Skel = { j: J; ctrl?: Pt; k: number };

function fk(p: P, view: View, k: number, delta: number, fixed: Set<string>): Skel {
  const ang = (name: string, v: number) => v + (fixed.has(name) ? 0 : delta);
  const t = ang('torso', p.t ?? 0);
  const b = p.b ?? 0;
  const pelvis = { x: p.x ?? 50, y: p.y ?? 56 };
  const tilt = view === 'front' ? Math.cos(rad(p.tilt ?? 0)) : 1;
  const chord = LEN.torso * k * sinc(rad(b) / 2) * tilt;
  const neck = add(pelvis, dir(t), chord);
  const ctrl = Math.abs(b) > 0.5 ? add(pelvis, dir(t - b / 2), chord / 2 / Math.cos(rad(b / 2))) : undefined;
  const tEnd = t + b / 2;
  const hAng = p.h !== undefined ? ang('head', p.h) : tEnd;
  const head = add(neck, dir(hAng), LEN.neck * k * (view === 'front' ? Math.cos(rad(p.htilt ?? p.tilt ?? 0)) : 1));
  const j: J = { pelvis, neck, head };
  const shrug = (p.sh ?? 0) * k;
  if (view === 'front') {
    const perp = dir(tEnd + 90);
    const top = add(neck, dir(tEnd), shrug - 1.5 * k * tilt);
    j.shoulderL = add(top, perp, -LEN.sw * k);
    j.shoulderR = add(top, perp, LEN.sw * k);
    const perpH = dir(t - b / 2 + 90);
    j.hipL = add(pelvis, perpH, -LEN.hw * k);
    j.hipR = add(pelvis, perpH, LEN.hw * k);
  } else {
    j.shoulderL = j.shoulderR = add(neck, dir(tEnd), shrug - 2 * k);
    j.hipL = j.hipR = pelvis;
  }
  const seg = (from: Pt, name: string, len: number, def: number) =>
    add(from, dir(ang(name, p[name] ?? def)), len * k * Math.cos(rad(p[name + 'z'] ?? 0)));
  for (const s of ['L', 'R'] as const) {
    const defA = view === 'front' ? (s === 'L' ? -170 : 170) : 180;
    j['elbow' + s] = seg(j['shoulder' + s], 'ua' + s, LEN.ua, defA);
    j['hand' + s] = seg(j['elbow' + s], 'fa' + s, LEN.fa, defA);
    if (p['hd' + s] !== undefined) j['finger' + s] = seg(j['hand' + s], 'hd' + s, LEN.hd, 0);
    j['knee' + s] = seg(j['hip' + s], 'th' + s, LEN.th, 180);
    j['foot' + s] = seg(j['knee' + s], 'sh' + s, LEN.sh, 180);
    if (view === 'side' || p['ft' + s] !== undefined) {
      const shin = p['sh' + s] ?? 180;
      j['toe' + s] = seg(j['foot' + s], 'ft' + s, LEN.ft, fixed.has('sh' + s) ? shin - 90 - delta : shin - 90);
      if (p['to' + s] !== undefined) j['tip' + s] = seg(j['toe' + s], 'to' + s, LEN.to, 0);
    }
  }
  return { j, ctrl, k };
}

function translate(sk: Skel, dx: number, dy: number) {
  for (const n in sk.j) sk.j[n] = { x: sk.j[n].x + dx, y: sk.j[n].y + dy };
  if (sk.ctrl) sk.ctrl = { x: sk.ctrl.x + dx, y: sk.ctrl.y + dy };
}

/** Bord le plus bas du corps (traits compris). */
function lowest(sk: Skel): number {
  const half = (WID.limb * sk.k) / 2;
  let m = -Infinity;
  for (const n in sk.j) {
    if (n === 'head') m = Math.max(m, sk.j.head.y + LEN.head * sk.k);
    else m = Math.max(m, sk.j[n].y + (n === 'neck' || n === 'pelvis' ? (WID.torso * sk.k) / 2 : half));
  }
  if (sk.ctrl) {
    const mid = (sk.j.pelvis.y + 2 * sk.ctrl.y + sk.j.neck.y) / 4;
    m = Math.max(m, mid + (WID.torso * sk.k) / 2);
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* Lecture de l'animation                                              */
/* ------------------------------------------------------------------ */

const keyHold = (k: Key) => k.hold ?? 0.5;
const keyMove = (k: Key) => k.move ?? 1;

function loopLength(ex: Ex): number {
  if (ex.draw) return ex.loop ?? 4;
  return ex.keys.reduce((s, k) => s + keyHold(k) + (ex.keys.length > 1 ? keyMove(k) : 0), 0) || 1;
}

/** Où en est-on dans la boucle : pose de départ, pose d'arrivée, avancement adouci. */
function locate(ex: Ex, time: number): { a: number; b: number; u: number } {
  const n = ex.keys.length;
  if (n === 1) return { a: 0, b: 0, u: 0 };
  let t = ((time % loopLength(ex)) + loopLength(ex)) % loopLength(ex);
  for (let i = 0; i < n; i++) {
    const k = ex.keys[i];
    if (t < keyHold(k)) return { a: i, b: i, u: 0 };
    t -= keyHold(k);
    if (t < keyMove(k)) return { a: i, b: (i + 1) % n, u: ease(t / keyMove(k)) };
    t -= keyMove(k);
  }
  return { a: 0, b: 0, u: 0 };
}

function blend(a: P, b: P, u: number): P {
  const out: P = { ...a };
  for (const n in b) out[n] = n in a ? lerp(a[n], b[n], u) : b[n];
  return out;
}

/** Calcule le squelette pour un jeu de paramètres complet. */
function solve(ex: Ex, p: P, anchor: string | undefined, time: number): Skel {
  const view = ex.view ?? 'side';
  const k = ex.scale ?? 1;
  const fixed = new Set(ex.fixed ?? []);
  let delta = 0;
  if (ex.level && p.lv !== 0) {
    const [A, B] = ex.level;
    const off = p.lvy ?? 0;
    const g = (d: number) => {
      const s = fk(p, view, k, d, fixed).j;
      return s[B].y - s[A].y - off;
    };
    for (let i = 0; i < 12; i++) {
      const f0 = g(delta);
      if (Math.abs(f0) < 1e-3) break;
      const der = (g(delta + 0.5) - f0) / 0.5;
      if (Math.abs(der) < 1e-6) break;
      delta = clamp(delta - f0 / der, -120, 120);
    }
  }
  const sk = fk(p, view, k, delta, fixed);
  if (anchor && sk.j[anchor]) translate(sk, (p.ax ?? sk.j[anchor].x) - sk.j[anchor].x, (p.ay ?? sk.j[anchor].y) - sk.j[anchor].y);
  if (ex.ground) translate(sk, 0, GROUND - lowest(sk));
  const lens: Record<Limb, [string, string, string, number, number]> = {
    aL: ['shoulderL', 'elbowL', 'handL', LEN.ua, LEN.fa],
    aR: ['shoulderR', 'elbowR', 'handR', LEN.ua, LEN.fa],
    lL: ['hipL', 'kneeL', 'footL', LEN.th, LEN.sh],
    lR: ['hipR', 'kneeR', 'footR', LEN.th, LEN.sh],
  };
  for (const limb of Object.keys(ex.ik ?? {}) as Limb[]) {
    const tx = p[limb + 'x'];
    const ty = p[limb + 'y'];
    if (tx === undefined || ty === undefined) continue;
    const [root, mid, end, l1, l2] = lens[limb];
    const a = sk.j[root];
    let s = ex.ik?.[limb] ?? 0;
    if (s === 0) {
      const c = sk.j.pelvis.x;
      const m1 = ik2(a, { x: tx, y: ty }, l1 * k, l2 * k, 1)[0];
      const m2 = ik2(a, { x: tx, y: ty }, l1 * k, l2 * k, -1)[0];
      s = Math.abs(m1.x - c) >= Math.abs(m2.x - c) ? 1 : -1;
    }
    const [m, e] = ik2(a, { x: tx, y: ty }, l1 * k, l2 * k, s);
    const dm = { x: m.x - sk.j[mid].x, y: m.y - sk.j[mid].y };
    sk.j[mid] = m;
    sk.j[end] = e;
    // Ce qui pend au bout (main, pied, orteils) suit en gardant son angle.
    const tail = limb[0] === 'a' ? ['finger' + limb[1]] : ['toe' + limb[1], 'tip' + limb[1]];
    for (const n of tail) if (sk.j[n]) sk.j[n] = add(sk.j[n], dm, 0);
    if (limb[0] === 'a' && p['hd' + limb[1]] !== undefined) sk.j['finger' + limb[1]] = add(e, dir(p['hd' + limb[1]]), LEN.hd * k);
    if (limb[0] === 'l') {
      const ft = p['ft' + limb[1]] ?? angleOf(m, e) - 90;
      if (sk.j['toe' + limb[1]]) sk.j['toe' + limb[1]] = add(e, dir(ft), LEN.ft * k);
      const to = p['to' + limb[1]];
      if (to !== undefined && sk.j['toe' + limb[1]]) sk.j['tip' + limb[1]] = add(sk.j['toe' + limb[1]], dir(to), LEN.to * k);
    }
  }
  ex.post?.(sk.j, time, p);
  return sk;
}

function params(ex: Ex, time: number): { p: P; sk: Skel } {
  const { a, b, u } = locate(ex, time);
  const ka = ex.keys[a];
  const kb = ex.keys[b];
  const pa = { ...ex.base, ...ka.p };
  const pb = { ...ex.base, ...kb.p };
  const anA = ka.anchor ?? ex.anchor;
  const anB = kb.anchor ?? ex.anchor;
  const p = blend(pa, pb, u);
  const tweak = (q: P) => {
    if (ex.breathe) {
      // Période calée sur la boucle pour qu'elle reparte sans à-coup.
      const L = loopLength(ex);
      const bp = L / Math.max(1, Math.round(L / (ex.bp ?? 3.6)));
      for (const n in ex.breathe) q[n] = (q[n] ?? 0) + ex.breathe[n] * wave(time, bp);
    }
    ex.mod?.(q, time);
  };
  if (anA === anB || u === 0 || u === 1) {
    tweak(p);
    return { p, sk: solve(ex, p, u === 1 ? anB : anA, time) };
  }
  // Ancrages différents : on place chaque pose, puis on interpole la position du bassin.
  const sa = solve(ex, { ...pa }, anA, time).j.pelvis;
  const sb = solve(ex, { ...pb }, anB, time).j.pelvis;
  const q: P = { ...p, x: lerp(sa.x, sb.x, u), y: lerp(sa.y, sb.y, u) };
  delete q.ax;
  delete q.ay;
  tweak(q);
  const sk = solve(ex, q, undefined, time);
  // Pendant le passage, rien ne doit s'enfoncer dans le sol.
  const low = lowest(sk);
  if (low > GROUND) translate(sk, 0, GROUND - low);
  return { p: q, sk };
}

/* ------------------------------------------------------------------ */
/* Tracés                                                              */
/* ------------------------------------------------------------------ */

const f2 = (v: number) => (Math.round(v * 10) / 10).toString();
const M = (p: Pt) => `M${f2(p.x)} ${f2(p.y)}`;
const Lp = (p: Pt) => `L${f2(p.x)} ${f2(p.y)}`;
export const line = (a: Pt, b: Pt, w: number, tone: Tone, dash?: number[]): Shape => ({ k: 'path', d: `${M(a)}${Lp(b)}`, w, tone, dash });
const poly = (pts: Pt[], w: number, tone: Tone, closed = false, fill = false): Shape => ({
  k: 'path',
  d: pts.map((p, i) => (i ? Lp(p) : M(p))).join('') + (closed ? 'Z' : ''),
  w,
  tone,
  fill,
});
const curve = (a: Pt, c: Pt, b: Pt, w: number, tone: Tone): Shape => ({
  k: 'path',
  d: `${M(a)}Q${f2(c.x)} ${f2(c.y)} ${f2(b.x)} ${f2(b.y)}`,
  w,
  tone,
});
const dot = (c: Pt, r: number, tone: Tone): Shape => ({ k: 'circle', cx: r1(c.x), cy: r1(c.y), r, tone, fill: true });
const ring = (c: Pt, r: number, w: number, tone: Tone): Shape => ({ k: 'circle', cx: r1(c.x), cy: r1(c.y), r, tone, w });
const box = (x: number, y: number, width: number, height: number, rx: number, tone: Tone, fill = false, w = 1.6): Shape => ({
  k: 'rect',
  x,
  y,
  width,
  height,
  rx,
  tone,
  fill,
  w,
});
const pt = (x: number, y: number): Pt => ({ x, y });

function boneShape(b: Bone): Shape {
  const tone: Tone = b.working ? (b.far ? 'accentFar' : 'accent') : b.far ? 'bodyFar' : 'body';
  return b.c ? curve(b.a, b.c, b.b, b.width, tone) : line(b.a, b.b, b.width, tone);
}

function buildFrame(ex: Ex, sk: Skel, time: number, p: P): Frame {
  const view = ex.view ?? 'side';
  const { j, k } = sk;
  const work = workSet(ex.work);
  const bones: Bone[] = [];
  const mk = (name: BoneName, a: string, b: string, wf: number, far: boolean, c?: Pt) => {
    if (!j[a] || !j[b]) return;
    bones.push({ name, a: j[a], b: j[b], c, width: WID.limb * k * wf, working: work.has(name), far });
  };
  const leg = (s: 'L' | 'R', far: boolean) => {
    mk(('th' + s) as BoneName, 'hip' + s, 'knee' + s, 1, far);
    mk(('sh' + s) as BoneName, 'knee' + s, 'foot' + s, 1, far);
    mk(('ft' + s) as BoneName, 'foot' + s, 'toe' + s, 0.85, far);
    mk(('to' + s) as BoneName, 'toe' + s, 'tip' + s, 0.75, far);
  };
  const arm = (s: 'L' | 'R', far: boolean) => {
    mk(('ua' + s) as BoneName, 'shoulder' + s, 'elbow' + s, 1, far);
    mk(('fa' + s) as BoneName, 'elbow' + s, 'hand' + s, 1, far);
    mk(('hd' + s) as BoneName, 'hand' + s, 'finger' + s, 0.72, far);
  };
  const shapes: Shape[] = [];
  const props = ex.props?.(j, time) ?? [];
  const over = ex.over?.(j, time) ?? [];
  shapes.push(...props);
  const headR = LEN.head * k;
  const torsoBone = (): Bone => ({
    name: 'torso',
    a: j.pelvis,
    b: j.neck,
    c: sk.ctrl,
    width: WID.torso * k,
    working: work.has('torso'),
    far: false,
  });
  if (view === 'front') {
    leg('L', false);
    leg('R', false);
    const legBones = bones.length;
    const tb = torsoBone();
    bones.push(tb);
    arm('L', false);
    arm('R', false);
    for (const b of bones.slice(0, legBones)) shapes.push(boneShape(b));
    const tone: Tone = tb.working ? 'accent' : 'body';
    shapes.push(poly([j.shoulderL, j.shoulderR, j.hipR, j.hipL], WID.limb * k * 0.9, tone, true, true));
    shapes.push(dot(j.head, headR, 'body'));
    for (const b of bones.slice(legBones + 1)) shapes.push(boneShape(b));
  } else {
    const near = new Set(ex.near ?? []);
    if (!near.has('legR')) leg('R', true);
    if (!near.has('armR')) arm('R', true);
    const farCount = bones.length;
    const tb = torsoBone();
    bones.push(tb);
    leg('L', false);
    if (near.has('legR')) leg('R', false);
    arm('L', false);
    if (near.has('armR')) arm('R', false);
    for (const b of bones.slice(0, farCount)) shapes.push(boneShape(b));
    shapes.push(boneShape(tb));
    shapes.push(dot(j.head, headR, 'body'));
    // Petit nez pour savoir de quel côté regarde le visage.
    if (p.face !== undefined) shapes.push(dot(add(j.head, dir(p.face), headR * 0.85), headR * 0.4, 'body'));
    for (const b of bones.slice(farCount + 1)) shapes.push(boneShape(b));
  }
  shapes.push(...over);
  return {
    view,
    joints: j,
    bones,
    head: { c: j.head, r: headR },
    working: [...work],
    props: [...props, ...over],
    shapes,
  };
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export const HAS_ANIMATION = (id: string): boolean => id in EX;

/** Durée d'une boucle de l'animation (s). */
export function exerciseLoop(id: string): number {
  const ex = EX[id];
  return ex ? loopLength(ex) : 0;
}

/** Tout ce qu'il faut pour dessiner l'image de l'exercice `id` à l'instant `timeSec`. */
export function exercisePose(id: string, timeSec: number): Frame | null {
  const ex = EX[id];
  if (!ex) return null;
  const time = ((timeSec % loopLength(ex)) + loopLength(ex)) % loopLength(ex);
  if (ex.draw) {
    const d = ex.draw(time);
    const working = [...workSet(ex.work)];
    const shapes = d.shapes ?? [...d.props, ...d.bones.map(boneShape), ...(d.over ?? [])];
    return {
      view: 'close',
      joints: d.joints,
      bones: d.bones,
      head: d.head ?? null,
      working,
      props: [...d.props, ...(d.over ?? [])],
      shapes,
    };
  }
  const { p, sk } = params(ex, time);
  return buildFrame(ex, sk, time, p);
}

/** Mélange deux couleurs #rgb / #rrggbb (u = 0 : a, u = 1 : b). Null si illisible. */
function mixHex(a: string, b: string, u: number): string | null {
  const parse = (h: string) => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h.trim());
    if (!m) return null;
    const s = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  };
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return null;
  return `#${x.map((v, i) => Math.round(lerp(v, y[i], u)).toString(16).padStart(2, '0')).join('')}`;
}

/** Couleur et opacité d'une teinte. Les versions atténuées sont mélangées au fond, ou rendues transparentes. */
export function toneStyle(tone: Tone, c: AnimColors): { color: string; opacity: number } {
  const soft = (base: string, u: number) => {
    const m = mixHex(base, c.bg, u);
    return m ? { color: m, opacity: 1 } : { color: base, opacity: 1 - u };
  };
  switch (tone) {
    case 'body':
      return { color: c.body, opacity: 1 };
    case 'accent':
      return { color: c.accent, opacity: 1 };
    case 'prop':
      return { color: c.prop, opacity: 1 };
    case 'bodyFar':
      return soft(c.body, 0.55);
    case 'accentFar':
      return soft(c.accent, 0.45);
    case 'propSoft':
      return soft(c.prop, 0.5);
  }
}

/** Image autonome `<svg viewBox="0 0 100 100">…</svg>` de l'exercice à l'instant donné. */
export function exerciseSvg(id: string, timeSec: number, colors: AnimColors): string {
  const f = exercisePose(id, timeSec);
  const open = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">';
  if (!f) return open + '</svg>';
  const out: string[] = [open];
  const bg = colors.bg.trim().toLowerCase();
  if (bg && bg !== 'transparent' && bg !== 'none') out.push(`<rect width="100" height="100" fill="${colors.bg}"/>`);
  for (const s of f.shapes) {
    const { color, opacity } = toneStyle(s.tone, colors);
    const op = opacity < 1 ? ` opacity="${opacity}"` : '';
    const fill = s.fill ? color : 'none';
    const w = s.k === 'path' ? s.w : (s.w ?? 0);
    const stroke = w > 0 ? ` stroke="${color}" stroke-width="${f2(w)}" stroke-linecap="round" stroke-linejoin="round"` : '';
    if (s.k === 'path') {
      const dash = s.dash ? ` stroke-dasharray="${s.dash.join(' ')}"` : '';
      out.push(`<path d="${s.d}" fill="${fill}"${stroke}${dash}${op}/>`);
    } else if (s.k === 'circle') {
      out.push(`<circle cx="${s.cx}" cy="${s.cy}" r="${f2(s.r)}" fill="${fill}"${stroke}${op}/>`);
    } else {
      out.push(`<rect x="${f2(s.x)}" y="${f2(s.y)}" width="${f2(s.width)}" height="${f2(s.height)}" rx="${f2(s.rx)}" fill="${fill}"${stroke}${op}/>`);
    }
  }
  out.push('</svg>');
  return out.join('');
}

/* ------------------------------------------------------------------ */
/* Accessoires                                                         */
/* ------------------------------------------------------------------ */

/** Hauteur d'une articulation posée au sol (centre du trait). */
const ON_FLOOR = GROUND - WID.limb / 2;

const floor = (x1 = 4, x2 = 96): Shape => line(pt(x1, FLOOR), pt(x2, FLOOR), FLOOR_W, 'prop');
/** Barre de traction vue de côté ou de face, accrochée en haut. */
const bar = (cx: number, y: number, half = 17): Shape[] => [
  line(pt(cx - half, y), pt(cx - half, 0), 1.6, 'propSoft'),
  line(pt(cx + half, y), pt(cx + half, 0), 1.6, 'propSoft'),
  line(pt(cx - half - 2, y), pt(cx + half + 2, y), 2.8, 'prop'),
];
/** Poutre : bloc arrondi, les doigts prennent le bord du bas. */
const board = (cx: number, y: number, w = 34, h = 7): Shape[] => [
  box(cx - w / 2, y, w, h, 2.6, 'propSoft', true, 0),
  line(pt(cx - w / 2 + 2, y + h), pt(cx + w / 2 - 2, y + h), 1.8, 'prop'),
];
const chair = (x1: number, x2: number, seat: number, back?: number): Shape[] => {
  const s = [
    line(pt(x1, seat), pt(x2, seat), 2.4, 'prop'),
    line(pt(x1 + 1.5, seat), pt(x1 + 1.5, FLOOR), 1.6, 'prop'),
    line(pt(x2 - 1.5, seat), pt(x2 - 1.5, FLOOR), 1.6, 'prop'),
  ];
  if (back !== undefined) s.push(line(pt(back, seat), pt(back, seat - 18), 2, 'prop'));
  return s;
};
const mat = (x1: number, y1: number, x2: number, y2: number): Shape => box(x1, y1, x2 - x1, y2 - y1, 5, 'propSoft', false, 1.3);
const hold = (x: number, y: number, r = 2.3): Shape => dot(pt(x, y), r, 'prop');

/* ------------------------------------------------------------------ */
/* Poses de base                                                       */
/* ------------------------------------------------------------------ */

/** Debout de profil, regard vers la droite. */
const STAND: P = { x: 50, y: 54.7, t: 0, uaL: 176, faL: 168, uaR: 186, faR: 182, thL: 178, shL: 180, thR: 182, shR: 182 };
/** Debout de face. */
const STANDF: P = { x: 50, y: 54.7, t: 0, uaL: -170, faL: -174, uaR: 170, faR: 174, thL: 183, shL: 180, thR: 177, shR: 180 };

/** Vue de face : recopie le côté gauche (écran) en miroir sur le côté droit. */
function sym(p: P): P {
  const q: P = { ...p };
  const cx = p.x ?? 50;
  for (const n of ['ua', 'fa', 'hd', 'th', 'sh', 'ft']) {
    const v = p[n + 'L'];
    if (v !== undefined) q[n + 'R'] = n === 'th' || n === 'sh' ? 360 - v : -v;
    const z = p[n + 'Lz'];
    if (z !== undefined) q[n + 'Rz'] = z;
  }
  for (const l of ['a', 'l']) {
    if (p[l + 'Lx'] !== undefined) q[l + 'Rx'] = 2 * cx - p[l + 'Lx'];
    if (p[l + 'Ly'] !== undefined) q[l + 'Ry'] = p[l + 'Ly'];
  }
  return q;
}

/* ------------------------------------------------------------------ */
/* Gainage et sol                                                      */
/* ------------------------------------------------------------------ */

EX.plank = {
  base: { x: 46, t: 88, h: 92, face: 170, thL: 270, shL: 270, ftL: 182, thR: 270, shR: 271, ftR: 182, uaL: 180, faL: 90, uaR: 182, faR: 92 },
  keys: [{ p: {}, hold: 4 }],
  level: ['toeL', 'elbowL'],
  fixed: ['uaL', 'faL', 'uaR', 'faR'],
  ground: true,
  breathe: { b: -2.5 },
  work: ['core'],
  props: () => [floor()],
};

EX['side-plank'] = {
  view: 'front',
  base: { x: 46, y: 60, t: 70, thL: 252, shL: 252, thR: 250, shR: 250, uaR: 180, faR: 90, faRz: 55, uaL: 8, faL: 6 },
  keys: [
    { p: { b: 14 }, hold: 0.6, move: 1.4 },
    { p: { b: 0 }, hold: 2.2, move: 1.4 },
  ],
  level: ['footR', 'elbowR'],
  fixed: ['uaR', 'faR', 'uaL', 'faL'],
  ground: true,
  work: ['core'],
  props: () => [floor()],
};

EX.pushups = {
  base: { face: 160, h: 0, thL: 0, shL: 0, ftL: 172, thR: 0, shR: 0, ftR: 172, ax: 14, ay: ON_FLOOR + 0.4, aLx: 66, aLy: ON_FLOOR, aRx: 67.5, aRy: ON_FLOOR },
  keys: [
    { p: { t: 66, h: 70, thL: 246, shL: 246, thR: 247, shR: 247, face: 160 }, hold: 0.4, move: 1.3 },
    { p: { t: 82, h: 86, thL: 262, shL: 262, thR: 263, shR: 263, face: 176 }, hold: 0.2, move: 1.1 },
  ],
  anchor: 'toeL',
  ik: { aL: 1, aR: 1 },
  work: ['arms'],
  props: () => [floor()],
};

EX.hollow = {
  base: { x: 50, ftL: 358, ftR: 356 },
  keys: [
    { p: { t: 90, b: 0, h: 78, face: 0, thL: 270, shL: 270, thR: 271, shR: 271, uaL: 92, faL: 92, uaR: 93, faR: 93 }, hold: 0.7, move: 1.2 },
    { p: { t: 77, b: -30, h: 62, face: 335, thL: 244, shL: 244, thR: 245, shR: 245, uaL: 58, faL: 58, uaR: 60, faR: 60 }, hold: 2.6, move: 1.2 },
  ],
  ground: true,
  breathe: { b: 1.5 },
  work: ['core', 'legs'],
  props: () => [floor()],
};

EX.superman = {
  base: { x: 48, ftL: 268, ftR: 270 },
  keys: [
    { p: { t: 90, b: 0, h: 95, face: 180, thL: 270, shL: 270, thR: 271, shR: 271, uaL: 90, faL: 90, uaR: 91, faR: 91 }, hold: 0.7, move: 1.1 },
    { p: { t: 86, b: -34, h: 66, face: 140, thL: 252, shL: 250, thR: 253, shR: 251, uaL: 62, faL: 58, uaR: 63, faR: 59 }, hold: 2, move: 1.2 },
  ],
  ground: true,
  work: ['core'],
  props: () => [floor()],
};

EX['dead-bug'] = {
  base: { x: 46, t: 90, h: 80, face: 0, thL: 360, shL: 270, ftL: 360, thR: 362, shR: 272, ftR: 362, uaL: 0, faL: 0, uaR: 4, faR: 4 },
  keys: [
    { p: {}, hold: 0.4, move: 1.3 },
    { p: { uaL: 88, faL: 88, thR: 264, shR: 264, ftR: 350 }, hold: 0.5, move: 1.3 },
    { p: {}, hold: 0.4, move: 1.3 },
    { p: { uaR: 88, faR: 88, thL: 264, shL: 264, ftL: 350 }, hold: 0.5, move: 1.3 },
  ],
  ground: true,
  work: ['core'],
  props: () => [floor()],
};

const FOURS: P = { x: 30, y: ON_FLOOR - 17.5, t: 71, thL: 180, shL: 270, ftL: 268, thR: 181, shR: 270, ftR: 268, aLx: 49, aLy: ON_FLOOR, aRx: 50.5, aRy: ON_FLOOR };

EX['cat-cow'] = {
  base: { ...FOURS, uaL: 180, faL: 180, uaR: 181, faR: 179 },
  keys: [
    { p: { b: 42, h: 150, face: 150 }, hold: 0.7, move: 1.7 },
    { p: { b: -24, h: 42, face: 75, uaL: 190, faL: 170, uaR: 190, faR: 170 }, hold: 0.7, move: 1.7 },
  ],
  work: ['core'],
  props: () => [floor()],
};

EX['child-pose'] = {
  base: { ...FOURS, ax: 30, ay: ON_FLOOR },
  keys: [
    { p: { b: 0, h: 80, face: 150 }, hold: 0.6, move: 1.8 },
    { p: { thL: 120, thR: 121, t: 95, b: 30, h: 112, face: 180, aLx: 59, aRx: 60 }, hold: 2.6, move: 1.6 },
  ],
  anchor: 'kneeL',
  ik: { aL: 1, aR: 1 },
  breathe: { b: 2 },
  work: ['core', 'arms'],
  props: () => [floor()],
};

/* ------------------------------------------------------------------ */
/* Barre                                                               */
/* ------------------------------------------------------------------ */

const BAR_Y = 10;
/** Suspendu de profil, mains clouées à la barre. */
const HANG: P = { t: -2, sh: 2.5, uaL: 4, faL: 4, uaR: 6, faR: 6, thL: 182, shL: 186, thR: 184, shR: 188, ax: 50, ay: BAR_Y + 0.6 };
const sideBar = () => bar(50, BAR_Y, 16);

EX.pullups = {
  view: 'front',
  scale: 0.92,
  base: sym({ ...STANDF, ax: 31, ay: BAR_Y + 0.6, thL: 182, shL: 180 }),
  keys: [
    { p: sym({ uaL: -38.6, faL: -38.6, sh: 2 }), hold: 0.4, move: 1.3 },
    { p: sym({ uaL: -115, faL: -20, sh: 0 }), hold: 0.3, move: 1.7 },
  ],
  anchor: 'handL',
  work: ['arms'],
  props: () => bar(50, BAR_Y, 26),
};

EX.lockoffs = {
  scale: 0.92,
  base: { ...HANG, ax: 54, face: 90 },
  keys: [
    { p: {}, hold: 0.4, move: 1.1 },
    { p: { uaL: 95, faL: 5, uaR: 97, faR: 7, sh: 0, t: 4 }, hold: 1.6, move: 0.9 },
    { p: { uaL: 60, faL: 0, uaR: 62, faR: 2, sh: 0, t: 2 }, hold: 1.6, move: 1.2 },
  ],
  anchor: 'handL',
  work: ['arms'],
  props: () => bar(54, BAR_Y, 16),
};

EX['leg-raises'] = {
  scale: 0.92,
  base: { ...HANG, face: 90 },
  keys: [
    { p: {}, hold: 0.4, move: 1.3 },
    { p: { t: -10, thL: 90, shL: 90, thR: 92, shR: 92, sh: 0 }, hold: 0.4, move: 1.6 },
  ],
  anchor: 'handL',
  work: ['core', 'thighs'],
  props: sideBar,
};

EX['front-lever'] = {
  scale: 0.92,
  base: { ...HANG, face: 90 },
  keys: [
    { p: {}, hold: 0.6, move: 1.6 },
    { p: { t: -90, h: -80, face: 0, sh: -1, uaL: 32, faL: 32, uaR: 34, faR: 34, thL: -62, shL: 128, thR: -60, shR: 130 }, hold: 2.2, move: 1.4 },
  ],
  anchor: 'handL',
  work: ['core', 'arms'],
  props: sideBar,
};

EX['scap-pulls'] = {
  scale: 0.92,
  base: { ...HANG, face: 90 },
  keys: [
    { p: { sh: 3 }, hold: 0.5, move: 0.9 },
    { p: { sh: -1.5, t: 2 }, hold: 0.6, move: 1.2 },
  ],
  anchor: 'handL',
  work: ['core', 'uaL', 'uaR'],
  props: sideBar,
};

EX['dead-hang'] = {
  view: 'front',
  scale: 0.92,
  base: sym({ ...STANDF, ax: 41.5, ay: BAR_Y + 0.6, uaL: -12, faL: -12, sh: 2.5, thL: 181, shL: 180 }),
  keys: [{ p: {}, hold: 4 }],
  anchor: 'handL',
  breathe: { sh: 0.5 },
  mod: (p, t) => {
    const s = 2.5 * wave(t, 4);
    p.thL += s;
    p.thR += s;
    p.shL += s * 1.3;
    p.shR += s * 1.3;
    p.t = s * 0.3;
  },
  work: ['arms'],
  props: () => bar(50, BAR_Y, 26),
};

EX.dips = {
  scale: 0.95,
  base: { face: 90, ax: 54, ay: 47, thL: 172, shL: 250, thR: 168, shR: 246 },
  keys: [
    { p: { t: 6, uaL: 182, faL: 178, uaR: 186, faR: 182 }, hold: 0.4, move: 1.4 },
    { p: { t: 22, thL: 165, thR: 161, uaL: 284, faL: 182, uaR: 288, faR: 186 }, hold: 0.3, move: 1.2 },
  ],
  anchor: 'handL',
  work: ['arms'],
  props: () => [floor(), line(pt(30, 49.6), pt(76, 49.6), 2.8, 'prop'), line(pt(34, 49.6), pt(34, FLOOR), 1.8, 'propSoft'), line(pt(72, 49.6), pt(72, FLOOR), 1.8, 'propSoft')],
};

/** Corps gainé incliné de `a` degrés (allongé sur le dos, tête à droite). */
const plankBody = (a: number): P => ({ t: 90 - a, h: 90 - a, face: -a, thL: 270 - a, shL: 270 - a, ftL: 360 - a, thR: 271 - a, shR: 271 - a, ftR: 361 - a });

EX.rows = {
  base: { ax: 14, ay: ON_FLOOR - 1, aLx: 60, aLy: 49.6, aRx: 61, aRy: 49.6 },
  keys: [
    { p: plankBody(16), hold: 0.4, move: 1.2 },
    { p: { ...plankBody(34), h: 75 }, hold: 0.4, move: 1.4 },
  ],
  anchor: 'footL',
  ik: { aL: -1, aR: -1 },
  work: ['arms'],
  props: () => [floor(), line(pt(57, 47.2), pt(97, 47.2), 2.8, 'prop'), line(pt(93, 47.2), pt(93, FLOOR), 1.8, 'propSoft')],
};

/* ------------------------------------------------------------------ */
/* Poutre                                                              */
/* ------------------------------------------------------------------ */

const BOARD_Y = 6;
/** Hauteur des mains sur le bord de la poutre. */
const GRIP_Y = BOARD_Y + 7.4;

EX['hang-intro'] = {
  base: { face: 90, ax: 40, ay: GRIP_Y, t: -8, uaL: 6, faL: 6, uaR: 8, faR: 8, lLx: 66, lLy: 63.6, lRx: 67.5, lRy: 63.6, ftL: 60, ftR: 60 },
  keys: [
    { p: { sh: -0.5 }, hold: 2.2, move: 1.2 },
    { p: { sh: 2.2, t: -4 }, hold: 1.2, move: 1.2 },
  ],
  anchor: 'handL',
  ik: { lL: -1, lR: -1 },
  work: ['fore'],
  props: () => [floor(), ...board(40, BOARD_Y), ...chair(60, 80, 66.4, 79)],
};

EX['daily-hangs'] = {
  base: { face: 90, ax: 52, ay: GRIP_Y, t: -4, uaL: 8, faL: 8, uaR: 10, faR: 10, lLx: 50, lLy: ON_FLOOR, lRx: 51.5, lRy: ON_FLOOR, ftL: 90, ftR: 90 },
  keys: [
    { p: { sh: -2 }, hold: 0.8, move: 1.4 },
    { p: { sh: 2.6, t: -6 }, hold: 2.4, move: 1.4 },
  ],
  anchor: 'handL',
  ik: { lL: -1, lR: -1 },
  work: ['fore'],
  props: () => [floor(), ...board(52, BOARD_Y)],
};

/** Suspendu sous la poutre, genoux pliés pour décoller les pieds. */
const BOARD_HANG: P = { face: 90, ax: 50, ay: GRIP_Y, t: -3, sh: 2, uaL: 5, faL: 5, uaR: 7, faR: 7, thL: 142, shL: 236, thR: 146, shR: 240 };

EX.repeaters = {
  base: BOARD_HANG,
  keys: [
    { p: {}, hold: 2.6, move: 0.7 },
    { p: { ...STAND, x: 48, ax: 50, ay: ON_FLOOR, face: 90, sh: 0 }, anchor: 'footL', hold: 1, move: 0.7 },
  ],
  anchor: 'handL',
  work: ['fore'],
  props: () => [floor(), ...board(50, BOARD_Y)],
};

EX['max-hangs'] = {
  base: { ...BOARD_HANG, thL: 176, shL: 236, thR: 180, shR: 240, sh: 0.5 },
  keys: [{ p: {}, hold: 4 }],
  anchor: 'handL',
  breathe: { sh: 0.6, thL: 2, thR: 2 },
  work: ['fore'],
  over: (j) => {
    // Lest accroché au baudrier.
    const top = add(j.pelvis, pt(2, 1));
    const w = pt(top.x + 3, top.y + 17);
    return [line(top, w, 1.2, 'prop'), dot(w, 4.6, 'prop')];
  },
  props: () => [floor(), ...board(50, BOARD_Y)],
};

EX['pinch-hold'] = {
  base: { ...STAND, face: 90, ax: 46, ay: ON_FLOOR, ftL: 90, ftR: 90 },
  keys: [
    { p: { t: 52, h: 70, thL: 140, shL: 204, thR: 142, shR: 206, uaL: 168, faL: 168, uaR: 172, faR: 172 }, hold: 0.5, move: 1.4 },
    { p: { uaL: 180, faL: 180, uaR: 186, faR: 184 }, hold: 2.4, move: 1.4 },
  ],
  anchor: 'footL',
  work: ['foreL'],
  over: (j) => {
    const h = j.handL;
    // Bloc pincé, lest suspendu dessous (posé au sol quand la main descend).
    const disc = pt(h.x, Math.min(h.y + 15, GROUND - 4.8));
    return [line(pt(h.x, h.y + 4), disc, 1.2, 'prop'), dot(disc, 4.8, 'prop'), box(h.x - 2, h.y - 3.5, 4, 8, 1.2, 'prop', true, 0)];
  },
  props: () => [floor()],
};

/** Place un bras par cinématique inverse depuis `post` (s = sens du pli, cf. ik2). */
function reach(j: J, side: 'L' | 'R', target: Pt, s: number, k = 1) {
  const [m, e] = ik2(j['shoulder' + side], target, LEN.ua * k, LEN.fa * k, s);
  j['elbow' + side] = m;
  j['hand' + side] = e;
}

/* ------------------------------------------------------------------ */
/* Debout : mobilité et jambes                                        */
/* ------------------------------------------------------------------ */

EX['deep-squat'] = {
  base: { ...STAND, face: 90, ax: 50, ay: ON_FLOOR, ftL: 90, ftR: 90 },
  keys: [
    { p: {}, hold: 0.4, move: 1.6 },
    { p: { t: 24, h: 8, face: 95, thL: 80, shL: 214, thR: 76, shR: 210, uaL: 150, faL: 40, uaR: 154, faR: 44 }, hold: 2.2, move: 1.6 },
  ],
  anchor: 'footL',
  work: ['legs'],
  props: () => [floor()],
};

EX['hamstring-fold'] = {
  base: { ...STAND, face: 90, ax: 50, ay: ON_FLOOR, ftL: 90, ftR: 90 },
  keys: [
    { p: { aLx: 51, aLy: 58.5, aRx: 49, aRy: 58.5 }, hold: 0.4, move: 1.8 },
    { p: { t: 125, h: 150, face: 240, thL: 168, shL: 168, thR: 170, shR: 170, aLx: 60, aLy: ON_FLOOR, aRx: 58, aRy: ON_FLOOR }, hold: 2, move: 1.8 },
  ],
  anchor: 'footL',
  ik: { aL: 1, aR: 1 },
  work: ['thL', 'shL', 'thR', 'shR'],
  props: () => [floor()],
};

EX['shoulder-dislocates'] = {
  base: { ...STAND, face: 90, ax: 50, ay: ON_FLOOR, ftL: 90, ftR: 90 },
  keys: [
    { p: { uaL: 160, faL: 160, uaR: 163, faR: 163 }, hold: 0.4, move: 1.8 },
    { p: { uaL: -158, faL: -158, uaR: -155, faR: -155 }, hold: 0.4, move: 1.8 },
  ],
  anchor: 'footL',
  work: ['arms'],
  over: (j) => [dot(j.handL, 2.6, 'prop')],
  props: () => [floor()],
};

const STEP_TOP = 76;
EX['calf-raises'] = {
  scale: 0.88,
  base: { ...STAND, face: 90, ax: 53, ay: STEP_TOP - 0.8 - 1.9, uaL: 178, faL: 176 },
  keys: [
    { p: { ftL: 68, ftR: 68 }, hold: 0.4, move: 1.2 },
    { p: { ftL: 140, ftR: 140 }, hold: 0.5, move: 1.6 },
  ],
  anchor: 'toeL',
  work: ['calves'],
  props: () => [floor(), box(51.5, STEP_TOP, 34, FLOOR - STEP_TOP, 1.5, 'propSoft', true, 0), line(pt(51.5, STEP_TOP), pt(85.5, STEP_TOP), 1.6, 'prop')],
};

EX['single-leg-balance'] = {
  base: { ...STAND, face: 90, ax: 46, ay: ON_FLOOR, ftL: 90, thL: 176, shL: 184, thR: 100, shR: 192, uaL: 158, faL: 130, uaR: 196, faR: 186 },
  keys: [{ p: {}, hold: 4 }],
  anchor: 'footL',
  mod: (p, t) => {
    const s = wave(t, 2);
    const s2 = wave(t, 4 / 3, 0.2);
    p.t += 1.6 * s;
    p.thL -= 1 * s;
    p.uaL += 10 * s2;
    p.faL += 14 * s2;
    p.uaR -= 8 * s;
    p.faR -= 10 * s;
    p.thR += 3 * s2;
  },
  work: ['legL'],
  props: () => [floor()],
};

const POST_X = 80;
EX['pistol-assist'] = {
  base: { face: 90, ax: 46, ay: ON_FLOOR, ftL: 90, ftR: 70, aLx: POST_X - 2.5, aRx: POST_X - 2.5 },
  keys: [
    { p: { t: 0, thL: 178, shL: 180, thR: 160, shR: 162, aLy: 42, aRy: 44 }, hold: 0.5, move: 1.8 },
    { p: { t: 26, h: 20, thL: 76, shL: 212, thR: 92, shR: 94, aLy: 62, aRy: 64 }, hold: 0.6, move: 1.6 },
  ],
  anchor: 'footL',
  ik: { aL: 1, aR: 1 },
  work: ['legL'],
  props: () => [floor(), line(pt(POST_X, 4), pt(POST_X, FLOOR), 3.2, 'prop')],
};

/** Mur d'escalade en fond (vue de dos). */
const panel = (holds: [number, number][]): Shape[] => [box(8, 4, 84, FLOOR - 4, 4, 'propSoft', false, 1.4), ...holds.map(([x, y]) => hold(x, y))];

EX['high-step'] = {
  view: 'front',
  base: { ...STANDF, ax: 42, ay: ON_FLOOR, aLx: 30, aLy: 30, aRx: 58, aRy: 26 },
  keys: [
    { p: {}, hold: 0.6, move: 1.2 },
    { p: { t: -6, thR: 58, shR: 172, thL: 181 }, hold: 1.8, move: 2 },
  ],
  anchor: 'footL',
  ik: { aL: 0, aR: 0 },
  work: ['legR'],
  props: () => [floor(4, 96), ...panel([[30, 30], [58, 26], [66.5, 64.5], [26, 62], [76, 40]])],
};

EX['arm-circles'] = {
  view: 'front',
  base: sym({ ...STANDF, uaL: -90, faL: -90, ax: 50, ay: ON_FLOOR }),
  keys: [{ p: {}, hold: 4 }],
  anchor: 'footL',
  mod: (p, t) => {
    const a = 2 * Math.PI * t;
    const r = 11;
    for (const s of ['L', 'R']) {
      const sign = s === 'L' ? -1 : 1;
      p['ua' + s] = sign * (90 + r * Math.sin(a));
      p['fa' + s] = p['ua' + s];
      p['ua' + s + 'z'] = r * Math.cos(a);
      p['fa' + s + 'z'] = r * Math.cos(a);
    }
  },
  work: ['arms'],
  props: (j) => {
    const c = (s: 'L' | 'R') => add(j['shoulder' + s], dir(s === 'L' ? -90 : 90), 24);
    return [floor(), ring(c('L'), 4.6, 1, 'propSoft'), ring(c('R'), 4.6, 1, 'propSoft')];
  },
};

EX['hip-circles'] = {
  view: 'front',
  base: { ...STANDF, ax: 44, ay: ON_FLOOR, thL: 179, uaL: -145, faL: 140, uaR: 145, faR: -140 },
  keys: [{ p: {}, hold: 4 }],
  anchor: 'footL',
  mod: (p, t) => {
    p.t = -3 + 1.5 * wave(t, 4);
  },
  post: (j, t) => {
    // Le genou décrit un cercle : devant, puis sur le côté, puis en bas.
    const ph = 2 * Math.PI * (t / 4);
    const az = rad(45 + 45 * Math.sin(ph));
    const el = rad(-8 + 22 * Math.cos(ph));
    const hip = j.hipR;
    j.kneeR = { x: hip.x + LEN.th * Math.cos(el) * Math.sin(az), y: hip.y - LEN.th * Math.sin(el) };
    j.footR = { x: j.kneeR.x - 1, y: j.kneeR.y + LEN.sh };
  },
  work: ['legR'],
  props: () => [floor()],
};

const DOOR_X = 37;
EX['doorway-stretch'] = {
  base: { face: 90, lLx: 60, lLy: ON_FLOOR, lRx: 36, lRy: ON_FLOOR, ftL: 90, ftR: 90, uaR: 180, faR: 180 },
  keys: [
    { p: { x: 46, y: 56, t: 0 }, hold: 0.5, move: 1.6 },
    { p: { x: 52, y: 57.5, t: 12, h: 18 }, hold: 2.2, move: 1.6 },
  ],
  ik: { lL: -1, lR: -1 },
  post: (j) => {
    // Avant-bras posé contre le montant de la porte, coude à hauteur d'épaule.
    for (const s of ['L', 'R']) {
      j['elbow' + s] = pt(DOOR_X + 2, 36.5);
      j['hand' + s] = pt(DOOR_X + 2, 25);
    }
  },
  work: ['armL', 'core'],
  props: () => [floor(), line(pt(DOOR_X, 4), pt(DOOR_X, FLOOR), 3.2, 'prop')],
};

EX['external-rotation'] = {
  view: 'front',
  base: { ...STANDF, ax: 46, ay: ON_FLOOR, uaL: -178, faL: 90 },
  keys: [
    { p: { rot: 8 }, hold: 0.3, move: 1.4 },
    { p: { rot: 150 }, hold: 0.4, move: 1.6 },
  ],
  anchor: 'footL',
  post: (j, _t, p) => {
    // Coude collé au corps, l'avant-bras pivote vers l'extérieur (léger effet de perspective).
    const a = rad(p.rot ?? 0);
    j.handL = { x: j.elbowL.x + LEN.fa * Math.cos(a), y: j.elbowL.y + LEN.fa * 0.4 * Math.sin(a) };
  },
  work: ['foreL'],
  props: (j) => [floor(), line(pt(90, 30), pt(90, FLOOR), 3, 'prop'), line(j.handL, pt(89, j.elbowL.y), 1.6, 'accent')],
};

/* ------------------------------------------------------------------ */
/* Sol : mobilité                                                      */
/* ------------------------------------------------------------------ */

/** Vu de dessus, à plat ventre sur un tapis, tête à droite. */
const frogPose = (th: number): P => ({ thL: th, thR: 180 - th });
EX.frog = {
  view: 'front',
  base: { x: 40, y: 50, t: 90, uaL: 80, uaLz: 70, faL: 88, uaR: 100, uaRz: 70, faR: 92, shL: 270, shR: 270, ftL: 0, ftR: 180, ax: 40, ay: 29.1 },
  keys: [
    { p: frogPose(16), hold: 0.5, move: 2 },
    { p: frogPose(-10), hold: 2.2, move: 2 },
  ],
  anchor: 'kneeL',
  work: ['thighs'],
  props: () => [mat(8, 17, 90, 83)],
};

EX.pigeon = {
  base: { ax: 60, ay: ON_FLOOR, thL: 105, shL: 270, ftL: 272, thR: 262.4, shR: 262.4, ftR: 268 },
  keys: [
    { p: { t: 4, h: 4, face: 90, uaL: 176, faL: 176, uaR: 180, faR: 180 }, hold: 0.8, move: 1.8 },
    { p: { t: 66, b: 12, h: 100, face: 160, uaL: 178, faL: 90, uaR: 180, faR: 92 }, hold: 2.2, move: 1.8 },
  ],
  anchor: 'kneeL',
  breathe: { b: 1.5 },
  work: ['legL'],
  props: () => [floor()],
};

/** Assis jambes écartées, vu de face : le buste penche vers nous. */
EX.straddle = {
  view: 'front',
  base: { x: 50, y: ON_FLOOR, t: 0, thL: -90, shL: -90, thR: 90, shR: 90, ftL: 0, ftR: 0 },
  keys: [
    { p: { tilt: 0, uaL: -150, faL: -140, uaR: 150, faR: 140 }, hold: 0.6, move: 2 },
    { p: { tilt: 58, htilt: 70, uaL: -118, faL: -98, uaR: 118, faR: 98 }, hold: 2.2, move: 2 },
  ],
  work: ['legs'],
  props: () => [floor()],
};

EX.ytw = {
  view: 'front',
  base: sym({ ...STANDF, y: 58, thL: 181, shL: 180 }),
  keys: [
    { p: sym({ uaL: -32, faL: -32 }), hold: 0.6, move: 0.9 },
    { p: sym({ uaL: -90, faL: -90 }), hold: 0.6, move: 0.9 },
    { p: sym({ uaL: -128, faL: -28 }), hold: 0.6, move: 1.1 },
  ],
  work: ['arms'],
  props: () => [mat(24, 6, 76, 96)],
};

EX.breathing = {
  base: { x: 48, t: 90, h: 80, face: 0, uaL: 20, faL: 300, uaR: 20, faR: 300, thL: 318, shL: 212, ftL: 270, thR: 320, shR: 214, ftR: 270 },
  keys: [
    { p: { b: 0 }, hold: 0.6, move: 2.4 },
    { p: { b: 13 }, hold: 1.2, move: 3.2 },
  ],
  ground: true,
  post: (j, _t, p) => {
    // Mains posées sur le ventre, qui se soulève.
    const mid = lerpPt(j.pelvis, j.neck, 0.4);
    const belly = add(mid, pt(0, -3.4 - (p.b ?? 0) * 0.28));
    reach(j, 'L', add(belly, pt(-1, 0)), 1);
    reach(j, 'R', add(belly, pt(2, 0)), 1);
  },
  work: ['core'],
  props: () => [floor()],
  over: (j, t) => {
    // Onde douce autour du ventre, au rythme du souffle (inspire, bloque, expire).
    const b = tween(t, [[0.6, 0], [3, 1], [4.2, 1], [7.4, 0]]);
    const c = add(lerpPt(j.pelvis, j.neck, 0.4), pt(0, -3));
    return [{ k: 'path', d: arcPath(c, 7 + 7 * b, -62, 62), w: 1.4, tone: 'accentFar' }];
  },
};

/** Arc de cercle (angles en degrés, 0 = vers le haut). */
function arcPath(c: Pt, r: number, a0: number, a1: number): string {
  const p0 = add(c, dir(a0), r);
  const p1 = add(c, dir(a1), r);
  return `M${f2(p0.x)} ${f2(p0.y)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(p1.x)} ${f2(p1.y)}`;
}

const SEAT_Y = 66;
EX['ankle-circles'] = {
  base: { x: 36, y: SEAT_Y - 1.2 - WID.torso / 2, t: -4, face: 90, thL: 84, shL: 104, thR: 92, shR: 180, ftR: 90, uaL: 172, faL: 150, uaR: 176, faR: 156 },
  keys: [{ p: {}, hold: 4 }],
  mod: (p, t) => {
    p.ftL = (p.shL ?? 104) - 90 + 26 * wave(t, 2);
  },
  work: ['ftL'],
  props: (j) => {
    const c = add(j.footL, dir((EX['ankle-circles'].base.shL ?? 104) - 90), 4.5);
    return [floor(), ...chair(26, 46, SEAT_Y, 27.5), ring(c, 5.5, 1.1, 'propSoft')];
  },
};

const towelBump = (t: number) => {
  // Trois prises d'orteils pour ramener la serviette, puis on la repousse.
  if (t < 3) return Math.floor(t) / 3 + ease((t % 1) / 0.5) / 3;
  return 1 - ease((t - 3) / 1.2);
};
EX['toe-curls'] = {
  scale: 1.6,
  base: { face: 90, ax: 62, ay: GROUND - 3.8, t: -2, thL: 90, shL: 180, ftL: 92, toL: 92, thR: 88, shR: 180, ftR: 90, uaL: 160, faL: 110, uaR: 164, faR: 114 },
  keys: [{ p: {}, hold: 4.4 }],
  anchor: 'footL',
  mod: (p, t) => {
    if (t < 3) p.toL = 92 + 56 * Math.max(0, Math.sin(Math.PI * (t % 1) * 1.6));
    else p.toL = 92 - 8 * Math.sin(Math.PI * Math.min(1, (t - 3) / 1.4));
    // Les orteils se replient : la plante se soulève un peu, le bout reste au sol.
    p.ftL = 92 - Math.max(0, p.toL - 92) * 0.4;
  },
  work: ['ftL', 'toL'],
  props: (j) => [floor(), ...chair(j.pelvis.x - 22, j.pelvis.x + 7, j.pelvis.y + 6.6, j.pelvis.x - 20.5)],
  over: (j, t) => {
    const k = towelBump(t);
    const x0 = j.toeL.x - 6;
    const y = FLOOR - 2;
    const end = x0 + 34 - 10 * k;
    const h = 1 + 5 * k;
    const bx = j.toeL.x + 6.5;
    return [{ k: 'path', d: `M${f2(x0)} ${f2(y)}L${f2(bx - 4)} ${f2(y)}Q${f2(bx)} ${f2(y - h * 2)} ${f2(bx + 4)} ${f2(y)}L${f2(end)} ${f2(y)}`, w: 3, tone: 'prop' }];
  },
};

/* ------------------------------------------------------------------ */
/* Gros plans                                                          */
/* ------------------------------------------------------------------ */

/** Valeur interpolée (adoucie) sur une suite de points [temps, valeur]. */
function tween(t: number, pts: [number, number][]): number {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i];
    const [t0, v0] = pts[i - 1];
    if (t <= t1) return lerp(v0, v1, ease((t - t0) / (t1 - t0 || 1)));
  }
  return pts[pts.length - 1][1];
}

const bone = (name: BoneName, a: Pt, b: Pt, width: number, working: boolean, far = false): Bone => ({ name, a, b, width, working, far });

/**
 * Main vue de face, doigts vers `ang`. `spread` écarte les doigts (degrés),
 * `curl` les replie vers soi (0 = tendus, 90 = poing), `side` place le pouce.
 */
function handModel(wrist: Pt, ang: number, k: number, spread: number, curl: number, side: 1 | -1, working: boolean, palm = 1) {
  const bones: Bone[] = [];
  const palmEnd = add(wrist, dir(ang), 7.5 * k * palm);
  const perp = dir(ang + 90);
  bones.push(bone('palmL', add(wrist, dir(ang), 1.5 * k), palmEnd, 7.4 * k, working));
  const l1 = [4.1, 4.5, 4.2, 3.4];
  const l2 = [3.4, 3.8, 3.5, 2.8];
  const mids: Pt[] = [];
  const tips: Pt[] = [];
  const c1 = Math.cos(rad(Math.min(curl, 85) * 0.7));
  const c2 = Math.cos(rad(Math.min(curl * 1.3, 88)));
  for (let i = 0; i < 4; i++) {
    const base = add(palmEnd, perp, (i - 1.5) * 1.8 * k * side * -1);
    const a1 = ang + (i - 1.5) * spread * side * -1;
    const m = add(base, dir(a1), l1[i] * k * c1);
    const tip = add(m, dir(a1), l2[i] * k * c2);
    bones.push(bone('finger', base, m, 2.4 * k, working), bone('finger', m, tip, 2.2 * k, working));
    mids.push(m);
    tips.push(tip);
  }
  const tb = add(add(wrist, dir(ang), 2.8 * k * palm), perp, 3.2 * k * side);
  const ta = ang + (38 + spread * 1.6 - curl * 0.35) * side;
  const tm = add(tb, dir(ta), 3.6 * k);
  const tt = add(tm, dir(ta - (12 + curl * 0.5) * side), 3 * k * Math.max(0.4, c2));
  bones.push(bone('finger', tb, tm, 2.6 * k, working), bone('finger', tm, tt, 2.3 * k, working));
  return { bones, mids, tips, thumb: tt };
}

/** Ellipse (élastique) en tracé. */
const ellipse = (c: Pt, rx: number, ry: number, w: number, tone: Tone): Shape => ({
  k: 'path',
  d: `M${f2(c.x - rx)} ${f2(c.y)}A${f2(rx)} ${f2(ry)} 0 1 0 ${f2(c.x + rx)} ${f2(c.y)}A${f2(rx)} ${f2(ry)} 0 1 0 ${f2(c.x - rx)} ${f2(c.y)}Z`,
  w,
  tone,
});

EX['finger-extensors'] = {
  work: ['hands'],
  keys: [],
  base: {},
  loop: 4,
  draw: (t) => {
    const open = tween(t, [[0.4, 0], [1.2, 1], [1.9, 1], [3.4, 0]]);
    const wrist = pt(50, 70);
    const h = handModel(wrist, 0, 2.3, lerp(-2.5, 12, open), lerp(28, 0, open), 1, true);
    const fore = bone('faL', pt(53, 112), wrist, 10.5, false);
    const pts = [...h.mids, h.thumb];
    const xs = pts.map((p) => p.x);
    const cy = pts.slice(0, 4).reduce((s, p) => s + p.y, 0) / 4 + 1;
    const band = ellipse(pt((Math.min(...xs) + Math.max(...xs)) / 2, cy), (Math.max(...xs) - Math.min(...xs)) / 2 + 2.6, 2.2 + open, 1.8, 'prop');
    const bones = [fore, ...h.bones];
    return { joints: { handL: wrist }, bones, props: [], over: [band] };
  },
};

EX['wrist-warmup'] = {
  work: ['hands'],
  keys: [],
  base: {},
  loop: 5,
  draw: (t) => {
    const bones: Bone[] = [];
    const joints: J = {};
    for (const side of [-1, 1] as const) {
      const wrist = pt(50 + side * 17, 66);
      bones.push(bone(side < 0 ? 'faL' : 'faR', pt(50 + side * 21, 112), wrist, 9, false));
      let ang = 0;
      let palm = 1;
      let curl = 0;
      let spread = 9;
      if (t < 3) {
        // Cercles de poignets : la main tourne, vue un peu de biais.
        const a = (2 * Math.PI * t) / 1.5;
        ang = side * 26 * Math.sin(a);
        palm = 0.8 + 0.2 * Math.cos(a);
      } else {
        // Ouvrir, fermer les mains.
        const c = 0.5 - 0.5 * Math.cos((2 * Math.PI * (t - 3)) / 1);
        curl = 95 * c;
        spread = 9 * (1 - c);
      }
      const h = handModel(wrist, ang, 1.55, spread, curl, side < 0 ? -1 : 1, true, palm);
      bones.push(...h.bones);
      joints[side < 0 ? 'handL' : 'handR'] = wrist;
    }
    return { joints, bones, props: [] };
  },
};

/** Ouverture thoracique : allongé sur le côté, vu depuis la tête et un peu au-dessus. */
EX['thoracic-open'] = {
  work: ['torso', 'uaL', 'faL'],
  keys: [],
  base: {},
  loop: 5.2,
  draw: (t) => {
    const open = tween(t, [[0.4, 0], [2.2, 1], [3.2, 1], [5, 0]]);
    const k = 1.45;
    const cphi = Math.cos(rad(16));
    const sphi = Math.sin(rad(16));
    const P3 = (X: number, Y: number, Z: number) => pt(46 + X * k, GROUND - (Y * cphi + Z * sphi) * k);
    const psi = rad(62 * open);
    const cy = 7.6;
    const sTop = P3(-5.6 * Math.sin(psi), cy + 5.6 * Math.cos(psi), 0);
    const sBot = P3(1.4 * Math.sin(psi), cy - 5.6 * Math.cos(psi * 0.3), 0);
    const theta = rad(lerp(-24, 200, open));
    const sT3 = { X: -5.6 * Math.sin(psi), Y: cy + 5.6 * Math.cos(psi) };
    const eTop = P3(sT3.X + 12.5 * Math.cos(theta), sT3.Y + 12.5 * Math.sin(theta), 0);
    const hTop = P3(sT3.X + 24 * Math.cos(theta), Math.max(1.6, sT3.Y + 24 * Math.sin(theta)), 0);
    const head = P3(-3 * open, 8.2, -9.5);
    const neck = P3(0, cy, 0);
    const pelvis = P3(0, cy, 22);
    const W = WID.limb * k;
    const hip = (y: number) => P3(0, y, 22);
    const knee = (y: number) => P3(17.5, y, 22);
    const foot = (y: number) => P3(17.5, y, 38.5);
    void hip;
    void knee;
    void foot;
    const bones: Bone[] = [
      bone('uaR', sBot, P3(12.5, 2.2, 0), W, false, true),
      bone('faR', P3(12.5, 2.2, 0), P3(24, 2.2, 0), W, false, true),
    ];
    const top = [bone('uaL', sTop, eTop, W, true), bone('faL', eTop, hTop, W, true)];
    const shoulders: Shape = line(sBot, sTop, WID.torso * k, 'accent');
    const headR = LEN.head * k;
    const shapes: Shape[] = [
      floor(),
      ...bones.map(boneShape),
      shoulders,
      dot(head, headR, 'body'),
      ...top.map(boneShape),
    ];
    return {
      joints: { head, neck, pelvis, shoulderL: sTop, shoulderR: sBot, elbowL: eTop, handL: hTop },
      bones: [...bones, ...top],
      props: [],
      shapes,
      head: { c: head, r: headR },
    };
  },
};

/* ------------------------------------------------------------------ */
/* Mur : grimpeur vu de dos, le mur défile pour boucler                */
/* ------------------------------------------------------------------ */

type ClimbOpts = {
  /** Durée d'un cycle (deux mouvements de mains, deux de pieds). */
  period: number;
  /** 'up' : on monte, 'side' : on traverse vers la droite. */
  dir: 'up' | 'side';
  work: string[];
  /** Part du cycle consacrée au déplacement d'un membre. */
  mu?: number;
  /** Écart entre deux prises d'un même membre. */
  step?: number;
  /** Sans les pieds (pan Güllich). */
  campus?: boolean;
  /** Le pied marque un temps juste au-dessus de la prise avant de se poser. */
  hover?: boolean;
};

type Lane = { at: number; limbs: { limb: Limb; phase: number; grab: number }[] };

/**
 * Grimpeur vu de dos sur un mur qui défile : chaque membre avance d'une prise par cycle
 * pendant que le mur recule d'autant, ce qui boucle sans à-coup. Main et pied d'un même
 * côté (ou les deux mains d'une traversée) partagent la même file de prises.
 */
function climber(o: ClimbOpts): Ex {
  const T = o.period;
  const mu = o.mu ?? 0.3;
  const up = o.dir === 'up';
  const D = o.step ?? (up ? 18 : 16);
  const sg = up ? -1 : 1;
  const PX = 50;
  const PY = up ? (o.campus ? 58 : 53) : 56;
  /** Prise d'arrivée du second membre d'une file, calée sur les prises du premier. */
  const align = (want: number, g1: number, p1: number, p2: number) => {
    const base = g1 + sg * D * (p1 - p2);
    return base + D * Math.round((want - base) / D);
  };
  const lanes: Lane[] = up
    ? o.campus
      ? [
          { at: PX - 7, limbs: [{ limb: 'aL', phase: 0.5, grab: 16 }] },
          { at: PX + 7, limbs: [{ limb: 'aR', phase: 0, grab: 16 }] },
        ]
      : [
          { at: PX - 11, limbs: [{ limb: 'aL', phase: 0.5, grab: 17 }, { limb: 'lL', phase: 0.25, grab: align(PY + 16, 17, 0.5, 0.25) }] },
          { at: PX + 11, limbs: [{ limb: 'aR', phase: 0, grab: 17 }, { limb: 'lR', phase: 0.75, grab: align(PY + 16, 17, 0, 0.75) }] },
        ]
    : [
        { at: 16, limbs: [{ limb: 'aR', phase: 0, grab: 64 }, { limb: 'aL', phase: 0.5, grab: align(40, 64, 0, 0.5) }] },
        { at: 84, limbs: [{ limb: 'lL', phase: 0.25, grab: 46 }, { limb: 'lR', phase: 0.75, grab: align(70, 46, 0.25, 0.75) }] },
      ];
  const scroll = (t: number) => (D * t) / T;
  /** Coordonnée fixe sur le mur de la prise n° i d'un membre. */
  const wallPos = (g: number, phase: number, i: number) => g - sg * D * (1 - phase - mu) + sg * D * i;
  const toScreen = (w: number, t: number) => w - sg * scroll(t);
  /** Petit décalage propre à chaque prise pour que le mur ait l'air naturel. */
  const jitter = (laneAt: number, w: number) => {
    if (o.campus) return 0;
    const n = Math.round(w / D);
    return 2.6 * Math.sin(n * 2.7 + laneAt * 0.37);
  };
  const place = (laneAt: number, w: number, t: number): Pt => {
    const a = toScreen(w, t);
    const off = laneAt + jitter(laneAt, w);
    return up ? pt(off, a) : pt(a, off);
  };
  const target = (laneAt: number, l: Lane['limbs'][number], t: number): Pt => {
    const u = t / T - l.phase;
    const n = Math.floor(u);
    const f = u - n;
    const isFoot = l.limb[0] === 'l';
    // La main pend sous la prise, le pied se pose dessus.
    const lift = o.campus ? 1.6 : isFoot ? -2.4 : 2.2;
    const at = (i: number) => add(place(laneAt, wallPos(l.grab, l.phase, i), t), pt(0, lift));
    if (f >= mu) return at(n + 1);
    const x = f / mu;
    let e = ease(x);
    if (o.hover && isFoot) e = x < 0.65 ? 0.8 * ease(x / 0.65) : x < 0.85 ? 0.8 : lerp(0.8, 1, ease((x - 0.85) / 0.15));
    const p = lerpPt(at(n), at(n + 1), e);
    // Le membre décolle un peu du mur en chemin.
    const out = Math.sin(Math.PI * e) * (isFoot ? 2.5 : 3);
    if (up) p.x += p.x < PX ? -out : out;
    else p.y -= out;
    return p;
  };
  return {
    view: 'front',
    scale: 0.9,
    base: o.campus ? { x: PX, y: PY, t: 0, thL: 176, shL: 186, thR: 186, shR: 176 } : { x: PX, y: PY, t: 0 },
    keys: [{ p: {}, hold: T }],
    ik: o.campus ? { aL: 0, aR: 0 } : { aL: 0, aR: 0, lL: 0, lR: 0 },
    mod: (p, t) => {
      const c = 2 * Math.PI * (t / T);
      if (up) {
        p.x = PX + 2.2 * Math.sin(c);
        p.y = PY + 1.4 * Math.cos(2 * c);
        p.t = -2 * Math.sin(c);
      } else {
        p.x = PX + 1.2 * Math.sin(2 * c);
        p.y = PY + 1.5 * Math.cos(2 * c);
      }
      if (o.campus) {
        const sw = Math.sin(2 * c);
        p.thL = 176 + 6 * sw;
        p.thR = 186 + 6 * sw;
        p.shL = 188 + 8 * sw;
        p.shR = 178 + 8 * sw;
      }
      for (const lane of lanes)
        for (const l of lane.limbs) {
          const tg = target(lane.at, l, t);
          p[l.limb + 'x'] = tg.x;
          p[l.limb + 'y'] = tg.y;
        }
    },
    work: o.work,
    props: (_j, t) => {
      const s: Shape[] = [];
      if (up) s.push(line(pt(10, -2), pt(10, 102), 1.4, 'propSoft'), line(pt(90, -2), pt(90, 102), 1.4, 'propSoft'));
      else s.push(line(pt(-2, 5), pt(102, 5), 1.4, 'propSoft'), floor(-2, 102));
      for (const lane of lanes) {
        const l = lane.limbs[0];
        const first = Math.floor(t / T - l.phase) - 6;
        for (let i = first; i < first + 14; i++) {
          const c = place(lane.at, wallPos(l.grab, l.phase, i), t);
          if (c.x < -4 || c.x > 104 || c.y < -4 || c.y > 104) continue;
          if (o.campus) s.push(line(pt(36, c.y), pt(64, c.y), 2.4, 'prop'));
          else s.push(hold(c.x, c.y, 2.6));
        }
      }
      return s;
    },
  };
}

EX['easy-traverse'] = climber({ period: 3, dir: 'side', work: ['legs'] });
EX['four-by-four'] = climber({ period: 2, dir: 'up', work: ['arms'] });
EX.arc = climber({ period: 3.4, dir: 'up', work: ['fore'], mu: 0.26 });
EX['silent-feet'] = climber({ period: 3.6, dir: 'up', work: ['legs'], mu: 0.32, hover: true });
EX['campus-ladders'] = climber({ period: 1.6, dir: 'up', work: ['arms'], campus: true, mu: 0.38, step: 22 });

/** Un mouvement dur : on s'enroule, puis on pousse sur les jambes pour aller chercher loin. */
EX['limit-boulder'] = {
  view: 'front',
  scale: 0.9,
  base: { t: 0, aLx: 36, aLy: 36, lLx: 38, lLy: 80, lRx: 58, lRy: 74 },
  keys: [
    { p: { x: 46, y: 62, t: -4, aRx: 54, aRy: 40 }, hold: 0.9, move: 0.45 },
    { p: { x: 54, y: 51, t: 14, aRx: 72, aRy: 15 }, hold: 1, move: 1.4 },
  ],
  ik: { aL: 0, aR: 0, lL: 0, lR: 0 },
  work: ['armR', 'legs'],
  props: () => [floor(4, 96), ...panel([[36, 36], [54, 40], [72, 15], [38, 80], [58, 74], [24, 58], [80, 50], [60, 90]])],
};

/** Main de profil : paume puis doigts (2 phalanges), pouce. */
function sideHand(wrist: Pt, palmAng: number, fingerAng: number, k: number, working: boolean, far = false) {
  const knuckle = add(wrist, dir(palmAng), 7 * k);
  const mid = add(knuckle, dir(fingerAng), 4.6 * k);
  const tip = add(mid, dir(fingerAng + (fingerAng - palmAng) * 0.25), 3.8 * k);
  const tb = add(wrist, dir(palmAng), 2.2 * k);
  const tt = add(tb, dir(palmAng + 35), 5 * k);
  return {
    bones: [
      bone('palmL', wrist, knuckle, 6 * k, working, far),
      bone('finger', knuckle, mid, 3.4 * k, working, far),
      bone('finger', mid, tip, 3 * k, working, far),
      bone('finger', tb, tt, 3.2 * k, working, far),
    ],
    knuckle,
    mid,
    tip,
  };
}

/** Gros plan : bras tendu, l'autre main tire les doigts vers soi (paume devant, puis vers le bas). */
EX['forearm-stretch'] = {
  work: ['foreL', 'hands'],
  keys: [],
  base: {},
  loop: 7,
  draw: (t) => {
    const k = 1.8;
    const wrist = pt(46, 55);
    // 0 = paume devant (doigts en haut), 1 = paume vers le bas (doigts en bas).
    const flip = tween(t, [[2.9, 0], [3.6, 1], [6.2, 1], [6.9, 0]]);
    const stUp = tween(t, [[0.2, 0], [0.9, 1], [2.2, 1], [2.8, 0]]);
    const stDown = tween(t, [[3.7, 0], [4.4, 1], [5.6, 1], [6.1, 0]]);
    const palm = lerp(lerp(6, -16, stUp), lerp(172, 196, stDown), flip);
    const fing = lerp(lerp(4, -34, stUp), lerp(176, 214, stDown), flip);
    const fore = bone('faL', pt(-4, wrist.y), wrist, WID.limb * k * 1.15, true);
    const h = sideHand(wrist, palm, fing, k, true);
    // L'autre main vient du devant et enveloppe le bout des doigts.
    const pullFor = (down: boolean, st: number) => {
      const g = sideHand(wrist, down ? lerp(172, 196, st) : lerp(6, -16, st), down ? lerp(176, 214, st) : lerp(4, -34, st), k, true);
      const d = { x: g.tip.x - g.mid.x, y: g.tip.y - g.mid.y };
      const len = Math.hypot(d.x, d.y) || 1;
      const uu = { x: d.x / len, y: d.y / len };
      const n0 = { x: -uu.y, y: uu.x };
      const front = n0.x >= 0 ? n0 : { x: -n0.x, y: -n0.y };
      const kn = add(add(g.tip, uu, 1.5), front, 3.4 + lerp(10, 0, st));
      const pw = add(add(kn, front, 13), uu, -6);
      const pf = add(add(kn, front, -6.5), uu, 1.5);
      const elbow = add(pw, { x: 0.45, y: down ? -0.9 : 0.9 }, 50);
      return { kn, pw, pf, elbow };
    };
    const a = pullFor(false, stUp);
    const b = pullFor(true, stDown);
    const mix = (key: 'kn' | 'pw' | 'pf' | 'elbow') => lerpPt(a[key], b[key], flip);
    const pull = [
      bone('faR', mix('pw'), mix('elbow'), WID.limb * k * 1.15, false),
      bone('palmR', mix('pw'), mix('kn'), 6 * k, false),
      bone('finger', mix('kn'), mix('pf'), 3.2 * k, false),
    ];
    return { joints: { handL: wrist, fingerL: h.tip, handR: mix('pw') }, bones: [fore, ...h.bones, ...pull], props: [] };
  },
};
