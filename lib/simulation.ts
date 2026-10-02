/**
 * Simulation d'un grimpeur sur une photo de voie : à partir des prises de main (dans l'ordre)
 * et des prises de pied, on calcule une suite de mouvements, puis la posture du corps à
 * chaque instant (bras et jambes en cinématique inverse à deux segments).
 *
 * Les coordonnées sont en pixels d'affichage, y vers le bas.
 */

export type Pt = { x: number; y: number };
export type Limb = 'lh' | 'rh' | 'lf' | 'rf';
export type Contacts = Record<Limb, Pt>;
export type Move = { limb: Limb; from: Pt; to: Pt };

/** Proportions du corps, en fraction de la taille du grimpeur. */
export function body(height: number) {
  return {
    upperArm: 0.18 * height,
    forearm: 0.17 * height,
    thigh: 0.25 * height,
    shin: 0.25 * height,
    torso: 0.3 * height,
    shoulders: 0.2 * height,
    hips: 0.13 * height,
    head: 0.065 * height,
    neck: 0.05 * height,
  };
}

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const len = (a: Pt) => Math.hypot(a.x, a.y);
const dist = (a: Pt, b: Pt) => len(sub(a, b));
const mid = (a: Pt, b: Pt): Pt => mul(add(a, b), 0.5);
const lerp = (a: Pt, b: Pt, t: number): Pt => add(a, mul(sub(b, a), t));

/** Rapproche `p` de `target` pour que la distance ne dépasse pas `max`. */
function clampTo(p: Pt, target: Pt, max: number): Pt {
  const d = dist(p, target);
  return d <= max ? p : lerp(target, p, max / d);
}

/** Taille de grimpeur par défaut : proportionnelle à l'écart moyen entre deux prises de main. */
export function defaultHeight(hands: Pt[], imageHeight: number) {
  const gaps = hands.slice(1).map((p, i) => dist(p, hands[i])).sort((a, b) => a - b);
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : imageHeight * 0.2;
  return Math.min(imageHeight * 0.6, Math.max(imageHeight * 0.2, median * 2.4));
}

/** Pose d'équilibre : épaules sous les mains, bassin vers les pieds, membres à portée. */
function hipCenter(c: Contacts, height: number) {
  const b = body(height);
  const arm = b.upperArm + b.forearm;
  const leg = b.thigh + b.shin;
  const hands = mid(c.lh, c.rh);
  const feet = mid(c.lf, c.rf);
  let shoulders = add(hands, { x: 0, y: arm * 0.8 });
  let hips = add(shoulders, { x: 0, y: b.torso });
  for (let i = 0; i < 4; i++) {
    // Le bassin reste à portée des pieds, les épaules à portée des mains.
    hips = clampTo(hips, add(feet, { x: 0, y: -leg * 0.15 }), leg * 0.9);
    shoulders = add(hips, mul(norm(sub(hands, hips), { x: 0, y: -1 }), b.torso));
    shoulders = clampTo(shoulders, c.lh, arm * 0.98);
    shoulders = clampTo(shoulders, c.rh, arm * 0.98);
    hips = add(shoulders, mul(norm(sub(feet, shoulders), { x: 0, y: 1 }), b.torso));
  }
  return { shoulders, hips };
}

function norm(v: Pt, fallback: Pt): Pt {
  const l = len(v);
  return l < 1e-6 ? fallback : mul(v, 1 / l);
}

/** Pieds : la prise de pied la plus proche de l'endroit naturel, sinon en adhérence sur le mur. */
function footTarget(side: -1 | 1, hips: Pt, feet: Pt[], height: number, taken: Pt | null): Pt {
  const b = body(height);
  const leg = b.thigh + b.shin;
  const ideal = add(hips, { x: side * b.hips * 1.2, y: leg * 0.75 });
  const candidates = feet.filter(
    (f) => f !== taken && f.y > hips.y + leg * 0.2 && dist(f, hips) < leg * 0.95 && (f.x - hips.x) * side > -b.hips,
  );
  if (candidates.length === 0) return ideal;
  return candidates.reduce((a, f) => (dist(f, ideal) < dist(a, ideal) ? f : a));
}

/** Suite de mouvements pour enchaîner les prises de main, du départ au top. */
export function planMoves(hands: Pt[], feet: Pt[], height: number): { start: Contacts; moves: Move[] } {
  const b = body(height);
  const h0 = hands[0];
  const start0: Contacts = {
    lh: add(h0, { x: -b.shoulders * 0.1, y: 0 }),
    rh: add(h0, { x: b.shoulders * 0.1, y: 0 }),
    lf: h0,
    rf: h0,
  };
  const { hips } = hipCenter({ ...start0, lf: add(h0, { x: 0, y: height }), rf: add(h0, { x: 0, y: height }) }, height);
  start0.lf = footTarget(-1, hips, feet, height, null);
  start0.rf = footTarget(1, hips, feet, height, start0.lf);

  const moves: Move[] = [];
  const c: Contacts = { ...start0 };
  const go = (limb: Limb, to: Pt) => {
    if (dist(c[limb], to) < 1) return;
    moves.push({ limb, from: c[limb], to });
    c[limb] = to;
  };

  let lastHand: 'lh' | 'rh' | null = null;
  for (let i = 1; i < hands.length; i++) {
    const target = hands[i];
    // La main qui part est celle qui n'est pas sur la dernière prise ; au départ, selon le côté.
    const hand: 'lh' | 'rh' =
      lastHand === null ? (target.x >= h0.x ? 'rh' : 'lh') : lastHand === 'lh' ? 'rh' : 'lh';
    // Remonter les pieds avant un grand mouvement, puis lancer la main.
    const next = { ...c, [hand]: target };
    const { hips: nh } = hipCenter(next, height);
    const lf = footTarget(-1, nh, feet, height, null);
    const rf = footTarget(1, nh, feet, height, lf);
    const far = dist(c[hand], target) > (b.upperArm + b.forearm) * 0.9;
    if (far) {
      go('lf', lf);
      go('rf', rf);
    }
    go(hand, target);
    if (!far) {
      go('lf', lf);
      go('rf', rf);
    }
    lastHand = hand;
  }
  // Au top : les deux mains sur la dernière prise.
  if (hands.length > 1 && lastHand) {
    const top = hands[hands.length - 1];
    const other = lastHand === 'lh' ? 'rh' : 'lh';
    go(other, add(top, { x: (other === 'lh' ? -1 : 1) * b.shoulders * 0.12, y: 0 }));
  }
  return { start: start0, moves };
}

/** Pose des contacts au temps `t` (en nombre de mouvements, ex. 2.5 = milieu du 3e). */
export function contactsAt(start: Contacts, moves: Move[], t: number, height: number): { c: Contacts; moving: Limb | null } {
  const c: Contacts = { ...start };
  const done = Math.min(moves.length, Math.max(0, Math.floor(t)));
  for (let i = 0; i < done; i++) c[moves[i].limb] = moves[i].to;
  const current = moves[done];
  if (!current || t >= moves.length) return { c, moving: null };
  const p = t - done;
  const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
  // Trajectoire en arc : la main ou le pied s'écarte un peu du mur en se déplaçant.
  const arc = Math.sin(Math.PI * e) * height * 0.04;
  const dir = sub(current.to, current.from);
  const side = current.limb === 'lh' || current.limb === 'lf' ? -1 : 1;
  const normal = norm({ x: -dir.y * side, y: dir.x * side }, { x: side, y: 0 });
  c[current.limb] = add(lerp(current.from, current.to, e), mul(normal, -Math.abs(arc)));
  return { c, moving: current.limb };
}

/** Articulation d'un membre à deux segments (coude ou genou) qui plie vers `bend`. */
function joint(root: Pt, target: Pt, l1: number, l2: number, bend: Pt): { joint: Pt; end: Pt } {
  const v = sub(target, root);
  const d = Math.min(len(v), l1 + l2 - 1e-3);
  const u = norm(v, { x: 0, y: 1 });
  const end = add(root, mul(u, d));
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d || 1)));
  const a = Math.acos(cosA);
  // Deux solutions possibles ; on garde celle du côté de `bend`.
  const rot = (s: number) => ({
    x: u.x * Math.cos(a * s) - u.y * Math.sin(a * s),
    y: u.x * Math.sin(a * s) + u.y * Math.cos(a * s),
  });
  const j1 = add(root, mul(rot(1), l1));
  const j2 = add(root, mul(rot(-1), l1));
  const pick = dist(j1, add(root, bend)) < dist(j2, add(root, bend)) ? j1 : j2;
  return { joint: pick, end };
}

export type Pose = {
  head: Pt;
  neck: Pt;
  pelvis: Pt;
  arms: { shoulder: Pt; elbow: Pt; hand: Pt }[];
  legs: { hip: Pt; knee: Pt; foot: Pt }[];
};

/** Squelette complet à partir des contacts. */
export function poseFor(c: Contacts, height: number): Pose {
  const b = body(height);
  const { shoulders, hips } = hipCenter(c, height);
  const up = norm(sub(shoulders, hips), { x: 0, y: -1 });
  const across = { x: -up.y, y: up.x };
  const sL = add(shoulders, mul(across, -b.shoulders / 2));
  const sR = add(shoulders, mul(across, b.shoulders / 2));
  const hL = add(hips, mul(across, -b.hips / 2));
  const hR = add(hips, mul(across, b.hips / 2));
  const arm = (s: Pt, h: Pt, side: number) => {
    const r = joint(s, h, b.upperArm, b.forearm, { x: side * b.upperArm, y: b.upperArm * 0.6 });
    return { shoulder: s, elbow: r.joint, hand: r.end };
  };
  const leg = (h: Pt, f: Pt, side: number) => {
    const r = joint(h, f, b.thigh, b.shin, { x: side * b.thigh, y: -b.thigh * 0.2 });
    return { hip: h, knee: r.joint, foot: r.end };
  };
  return {
    neck: shoulders,
    head: add(shoulders, mul(up, b.neck + b.head)),
    pelvis: hips,
    arms: [arm(sL, c.lh, -1), arm(sR, c.rh, 1)],
    legs: [leg(hL, c.lf, -1), leg(hR, c.rf, 1)],
  };
}
