/**
 * Simulation d'un grimpeur sur une photo de voie : à partir des prises de main (dans l'ordre)
 * et des prises de pied, on calcule une suite de mouvements, puis la posture du corps à
 * chaque instant, en 3D (bras et jambes en cinématique inverse à deux segments).
 *
 * Coordonnées sur le mur avec y vers le bas, z = distance au mur.
 */

export type Pt = { x: number; y: number };
export type Limb = 'lh' | 'rh' | 'lf' | 'rf';
export type Contacts = Record<Limb, Pt>;
/** `hold` : numéro de la prise de main visée (à partir de 0). */
export type Move = { limb: Limb; from: Pt; to: Pt; hold?: number };

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
    // Le bassin reste au-dessus du pied le plus haut, sinon les jambes se replient à l'horizontale.
    hips = { x: hips.x, y: Math.min(hips.y, Math.min(c.lf.y, c.rf.y) - leg * 0.3) };
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
  const ideal = add(hips, { x: side * b.hips * 1.2, y: leg * 0.8 });
  const candidates = feet.filter(
    (f) => f !== taken && f.y > hips.y + leg * 0.35 && dist(f, hips) < leg * 0.98 && (f.x - hips.x) * side > -b.hips,
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
  const go = (limb: Limb, to: Pt, hold?: number) => {
    if (dist(c[limb], to) < height * 0.005) return;
    moves.push({ limb, from: c[limb], to, hold });
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
    go(hand, target, i);
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
    go(other, add(top, { x: (other === 'lh' ? -1 : 1) * b.shoulders * 0.12, y: 0 }), hands.length - 1);
  }
  return { start: start0, moves };
}

/** Contacts au temps `t` (en nombre de mouvements, ex. 2.5 = milieu du 3e) ; `lift` = décollement du mur (0 à 1). */
export function contactsAt(
  start: Contacts,
  moves: Move[],
  t: number,
): { c: Contacts; moving: Limb | null; lift: number; index: number } {
  const c: Contacts = { ...start };
  const done = Math.min(moves.length, Math.max(0, Math.floor(t)));
  for (let i = 0; i < done; i++) c[moves[i].limb] = moves[i].to;
  const current = moves[done];
  if (!current || t >= moves.length) return { c, moving: null, lift: 0, index: moves.length };
  const p = Math.max(0, t - done);
  const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
  c[current.limb] = lerp(current.from, current.to, e);
  return { c, moving: current.limb, lift: Math.sin(Math.PI * e), index: done };
}

/* ---------- Squelette en 3D ---------- */

export type P3 = { x: number; y: number; z: number };

const v3 = (p: Pt, z: number): P3 => ({ x: p.x, y: p.y, z });
const add3 = (a: P3, b: P3): P3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub3 = (a: P3, b: P3): P3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul3 = (a: P3, k: number): P3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot3 = (a: P3, b: P3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len3 = (a: P3) => Math.sqrt(dot3(a, a));
const norm3 = (a: P3, fallback: P3): P3 => {
  const l = len3(a);
  return l < 1e-6 ? fallback : mul3(a, 1 / l);
};

/** Articulation (coude ou genou) d'un membre à deux segments, qui plie dans la direction `pole`. */
function joint3(root: P3, target: P3, l1: number, l2: number, pole: P3): { joint: P3; end: P3 } {
  const u = norm3(sub3(target, root), { x: 0, y: 1, z: 0 });
  const d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(len3(sub3(target, root)), l1 + l2 - 1e-3));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const side = norm3(sub3(pole, mul3(u, dot3(pole, u))), { x: 0, y: 0, z: 1 });
  return { joint: add3(add3(root, mul3(u, a)), mul3(side, h)), end: add3(root, mul3(u, d)) };
}

export type Skeleton = {
  head: P3;
  neck: P3;
  chest: P3;
  pelvis: P3;
  /** Gauche puis droite. */
  arms: { shoulder: P3; elbow: P3; hand: P3 }[];
  legs: { hip: P3; knee: P3; foot: P3 }[];
};

/**
 * Squelette en 3D : x et y sur le mur (y vers le bas), z = distance au mur.
 * Les mains et les pieds sont sur le mur, le corps s'en écarte d'autant que les membres le permettent.
 */
export function skeleton(c: Contacts, height: number, moving: Limb | null = null, lift = 0): Skeleton {
  const b = body(height);
  const arm = b.upperArm + b.forearm;
  const leg = b.thigh + b.shin;
  const { shoulders, hips } = hipCenter(c, height);

  const onWall = 0.03 * height;
  const contact = (l: Limb) => v3(c[l], onWall + (moving === l ? lift * 0.14 * height : 0));
  const reachZ = (from: Pt, limbs: Limb[], length: number, min: number, max: number) => {
    const d = Math.max(...limbs.map((l) => dist(from, c[l])));
    return Math.min(max, Math.max(min, Math.sqrt(Math.max(0, (length * 0.97) ** 2 - d * d))));
  };
  const zS = reachZ(shoulders, ['lh', 'rh'], arm, 0.07 * height, 0.17 * height);
  const zH = reachZ(hips, ['lf', 'rf'], leg, 0.08 * height, 0.15 * height);
  const S = v3(shoulders, zS);
  const P = v3(hips, zH);

  const up = norm3(sub3(S, P), { x: 0, y: -1, z: 0 });
  // Axe des épaules : dans le plan du mur, perpendiculaire au buste.
  const across = norm3({ x: -up.y, y: up.x, z: 0 }, { x: 1, y: 0, z: 0 });
  const arms = ([['lh', -1], ['rh', 1]] as const).map(([l, side]) => {
    const shoulder = add3(S, mul3(across, (side * b.shoulders) / 2));
    // Coudes vers l'extérieur, vers le bas et décollés du mur.
    const r = joint3(shoulder, contact(l), b.upperArm, b.forearm, { x: side * 0.7, y: 0.6, z: 0.5 });
    return { shoulder, elbow: r.joint, hand: r.end };
  });
  const legs = ([['lf', -1], ['rf', 1]] as const).map(([l, side]) => {
    const hip = add3(P, mul3(across, (side * b.hips) / 2));
    // Genoux ouverts vers l'extérieur, comme en grenouille.
    const r = joint3(hip, contact(l), b.thigh, b.shin, { x: side * 0.5, y: -0.1, z: 0.85 });
    return { hip, knee: r.joint, foot: r.end };
  });
  const neck = add3(S, mul3(up, b.neck));
  return {
    neck,
    head: add3(add3(neck, mul3(up, b.head)), { x: 0, y: 0, z: 0.02 * height }),
    chest: S,
    pelvis: P,
    arms,
    legs,
  };
}
