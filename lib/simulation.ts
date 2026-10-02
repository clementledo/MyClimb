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
/** Types de prises de main (facultatifs). `lat_g` : latérale qu'on tire vers la gauche. */
export type HoldType = 'bac' | 'reglette' | 'plat' | 'pince' | 'inversee' | 'lat_g' | 'lat_d';
export type Hold = Pt & { type?: HoldType };
export type HandTypes = { lh?: HoldType; rh?: HoldType };

/** Un mouvement de la méthode, avec ce qu'il faut afficher pour aider. */
export type Move = {
  limb: Limb;
  from: Pt;
  to: Pt;
  /** Type de la prise de main visée. */
  type?: HoldType;
  title: string;
  tips: string[];
  alerts: string[];
};

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

export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const len = (a: Pt) => Math.hypot(a.x, a.y);
export const dist = (a: Pt, b: Pt) => len(sub(a, b));
export const mid = (a: Pt, b: Pt): Pt => mul(add(a, b), 0.5);
const lerp = (a: Pt, b: Pt, t: number): Pt => add(a, mul(sub(b, a), t));

/** Rapproche `p` de `target` pour que la distance ne dépasse pas `max`. */
function clampTo(p: Pt, target: Pt, max: number): Pt {
  const d = dist(p, target);
  return d <= max ? p : lerp(target, p, max / d);
}

/** Pose d'équilibre : épaules sous les mains, bassin vers les pieds, membres à portée. */
function hipCenter(c: Contacts, height: number, types: HandTypes = {}) {
  const b = body(height);
  // Latérale : le corps se décale du côté où l'on tire. Inversée ou plat : le corps descend.
  const pull = (t?: HoldType) => (t === 'lat_g' ? -1 : t === 'lat_d' ? 1 : 0);
  const sideShift = (pull(types.lh) + pull(types.rh)) * 0.1 * height;
  const low = (t?: HoldType) => (t === 'inversee' ? 0.3 : t === 'plat' ? 0.12 : 0);
  const drop = Math.max(low(types.lh), low(types.rh));
  const arm = b.upperArm + b.forearm;
  const leg = b.thigh + b.shin;
  const hands = mid(c.lh, c.rh);
  const feet = mid(c.lf, c.rf);
  let shoulders = add(hands, { x: sideShift, y: arm * (0.8 + drop) });
  let hips = add(shoulders, { x: 0, y: b.torso });
  for (let i = 0; i < 4; i++) {
    // Le bassin reste à portée des pieds, les épaules à portée des mains.
    hips = clampTo(hips, add(feet, { x: sideShift, y: -leg * 0.15 }), leg * 0.9);
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

/** Contacts au temps `t` (en nombre de mouvements, ex. 2.5 = milieu du 3e) ; `lift` = décollement du mur (0 à 1). */
export function contactsAt(
  start: Contacts,
  startTypes: HandTypes,
  moves: Move[],
  t: number,
): { c: Contacts; types: HandTypes; moving: Limb | null; lift: number; index: number } {
  const c: Contacts = { ...start };
  const types: HandTypes = { ...startTypes };
  const done = Math.min(moves.length, Math.max(0, Math.floor(t)));
  for (let i = 0; i < done; i++) {
    const m = moves[i];
    c[m.limb] = m.to;
    if (m.limb === 'lh' || m.limb === 'rh') types[m.limb] = m.type;
  }
  const current = moves[done];
  if (!current || t >= moves.length) return { c, types, moving: null, lift: 0, index: moves.length };
  const p = Math.max(0, t - done);
  const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
  c[current.limb] = lerp(current.from, current.to, e);
  return { c, types, moving: current.limb, lift: Math.sin(Math.PI * e), index: done };
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
export function skeleton(
  c: Contacts,
  height: number,
  moving: Limb | null = null,
  lift = 0,
  types: HandTypes = {},
): Skeleton {
  const b = body(height);
  const arm = b.upperArm + b.forearm;
  const leg = b.thigh + b.shin;
  const { shoulders, hips } = hipCenter(c, height, types);

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
