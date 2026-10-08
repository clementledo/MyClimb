/**
 * Simulation d'un grimpeur sur une photo de voie : posture du corps pour une position donnée
 * (mains et pieds posés), utilisée à la fois par le moteur qui choisit la méthode et par la 3D,
 * pour que ce que le moteur juge faisable soit exactement ce qui est dessiné.
 *
 * Coordonnées sur le mur avec y vers le bas, z = distance au mur.
 */

export type Pt = { x: number; y: number };
export type Limb = 'lh' | 'rh' | 'lf' | 'rf';
export type Contacts = Record<Limb, Pt>;
/** Types de prises de main (facultatifs). `lat_g` : latérale qu'on tire vers la gauche. */
export type HoldType = 'bac' | 'reglette' | 'plat' | 'pince' | 'inversee' | 'lat_g' | 'lat_d';
export type Hold = Pt & { type?: HoldType };
/** Pied en crochet (talon ou pointe sur une prise haute) ou dans le vide (pieds décollés en dévers). */
export type FootStyle = 'talon' | 'pointe' | 'vide';
/** Type de prise tenu par chaque main, et façon dont chaque pied est posé. */
export type HandTypes = { lh?: HoldType; rh?: HoldType; lf?: FootStyle; rf?: FootStyle };
/** Difficulté d'une étape : 1 facile, 2 moyen, 3 dur. */
export type Level = 1 | 2 | 3;

/** Un mouvement de la méthode, avec ce qu'il faut afficher pour aider. */
export type Move = {
  limb: Limb;
  from: Pt;
  to: Pt;
  /** Type de la prise de main visée. */
  type?: HoldType;
  /** Crochet de pied ou pied dans le vide. */
  hook?: FootStyle;
  /** Jeté : le corps se charge puis part d'un coup. */
  dyno?: boolean;
  title: string;
  tips: string[];
  alerts: string[];
  level: Level;
  /** Étape la plus dure de la voie. */
  crux?: boolean;
  /** Ce que l'utilisateur peut corriger sur cette étape. */
  fix?: { kind: 'hand'; hold: number } | { kind: 'foot'; label: string };
  /** L'étape suit une correction de l'utilisateur. */
  corrected?: boolean;
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
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Posture du corps pour une position : où sont les épaules et le bassin, et à quel prix. */
export type Pose = {
  shoulders: Pt;
  hips: Pt;
  /** Distance au mur des épaules et du bassin. */
  zS: number;
  zH: number;
  /** 0 = bras tendus, 1 = bras très pliés. */
  armBend: number;
  /** 0 = jambes tendues, 1 = jambes très pliées. */
  legBend: number;
  /** 0 = bassin près du mur, 1 = bassin très reculé (fesses sorties). */
  lean: number;
  /** Distance du centre de gravité hors des pieds d'appui, en mètres. */
  offBalance: number;
  /** Faux si une main ou un pied ne peut pas atteindre sa prise. */
  ok: boolean;
};

const isHook = (s?: FootStyle) => s === 'talon' || s === 'pointe';

/**
 * Posture : le corps est une chaîne bras → buste → jambes tendue entre le milieu des mains
 * et le milieu des pieds d'appui. Quand les pieds sont hauts, la chaîne se raccourcit :
 * d'abord les jambes plient, puis le bassin recule, puis les bras plient (le plus fatigant).
 * `crouch` > 0 descend le corps (charge avant un jeté), < 0 le monte.
 */
export function solvePose(c: Contacts, height: number, types: HandTypes = {}, crouch = 0): Pose {
  const b = body(height);
  const arm = b.upperArm + b.forearm;
  const leg = b.thigh + b.shin;
  const t = b.torso;
  const hands = mid(c.lh, c.rh);
  const standing = (['lf', 'rf'] as const).filter((l) => !types[l]);
  const hooks = (['lf', 'rf'] as const).filter((l) => isHook(types[l]));
  const hanging = standing.length === 0;
  const feet = standing.length === 2 ? mid(c.lf, c.rf) : standing.length === 1 ? c[standing[0]] : add(hands, { x: 0, y: 2 * height });

  const v = sub(feet, hands);
  const D = Math.max(1e-6, len(v));
  // Direction du corps, des mains vers les pieds ; sans pied d'appui, le corps pend.
  const dir = hanging ? { x: 0, y: 1 } : mul(v, 1 / D);

  const aMax = arm * 0.97;
  const lMax = leg * 0.97;
  // Inversée : la prise se tient à hauteur de poitrine, bras pliés.
  const under = types.lh === 'inversee' || types.rh === 'inversee';
  let ok = true;

  // Épaules : sous les mains, bras tendus, puis remontées si une main est plus haute que l'autre.
  const pull = (t?: HoldType) => (t === 'lat_g' ? -1 : t === 'lat_d' ? 1 : 0);
  const side = { x: (pull(types.lh) + pull(types.rh)) * 0.07 * height, y: 0 };
  let shoulders = add(add(hands, mul(dir, under ? arm * 0.6 : aMax)), side);
  shoulders = add(shoulders, mul(dir, crouch * 0.12 * height));
  const across = { x: dir.y, y: -dir.x };
  const shoulderOf = (s: number) => add(shoulders, mul(across, (s * b.shoulders) / 2));
  for (let i = 0; i < 4; i++) {
    for (const [limb, s] of [['lh', -1], ['rh', 1]] as const) {
      const sh = shoulderOf(s);
      const d = dist(sh, c[limb]);
      if (d > aMax) shoulders = add(shoulders, mul(sub(c[limb], sh), 1 - aMax / d));
    }
  }

  // Buste et jambes entre les épaules et les pieds, comme un vrai grimpeur : les jambes plient,
  // le buste se redresse un peu (bras légèrement pliés), puis les genoux s'ouvrent (grenouille)
  // pour garder le bassin près du mur, puis seulement le bassin recule, et enfin les bras plient.
  let tp = t;
  let l = lMax;
  let down = dir;
  if (!hanging) {
    const rem = dist(shoulders, feet);
    down = rem > 1e-6 ? mul(sub(feet, shoulders), 1 / rem) : dir;
    let excess = tp + l - rem;
    if (excess < -0.02 * height) ok = false; // trop étiré
    const take = (cur: number, min: number) => {
      const d = Math.max(0, Math.min(excess, cur - min));
      excess -= d;
      return cur - d;
    };
    const rise = (max: number) => {
      const d = Math.min(excess, max);
      shoulders = add(shoulders, mul(down, -d));
      excess -= d;
    };
    if (excess > 0) l = take(l, leg * 0.55);
    if (excess > 0) rise(0.2 * aMax);
    if (excess > 0) l = take(l, leg * 0.32);
    if (excess > 0) tp = take(tp, t * 0.7);
    if (excess > 0) l = take(l, leg * 0.22);
    if (excess > 0) tp = take(tp, t * 0.4);
    if (excess > 0) shoulders = add(shoulders, mul(down, -excess));
  }
  let hips = add(shoulders, mul(down, tp));
  if (hanging) hips = add(shoulders, { x: 0, y: tp });

  // Membres à portée : chaque main depuis son épaule, chaque pied depuis le bassin.
  // Ce qui fatigue, c'est de n'avoir aucun bras tendu : on compte surtout le bras le plus tendu.
  const bends = (['lh', 'rh'] as const).map((limb, i) => {
    const d = dist(shoulderOf(i ? 1 : -1), c[limb]);
    if (d > arm * 1.0) ok = false;
    if (d < arm * 0.12) ok = false; // main collée à l'épaule : trop groupé
    return clamp(1 - d / aMax, 0, 1);
  });
  const armBend = 0.7 * Math.min(...bends) + 0.3 * Math.max(...bends);
  for (const limb of [...standing, ...hooks]) {
    if (dist(hips, c[limb]) > leg * 1.0) ok = false;
  }
  // Un crochet retient le bassin à portée de jambe.
  for (const limb of hooks) {
    const d = dist(hips, c[limb]);
    if (d > leg * 0.95) hips = lerp(c[limb], hips, (leg * 0.95) / d);
  }

  const legBend = hanging ? 0 : clamp(1 - l / lMax, 0, 1);
  const lean = clamp(1 - tp / t, 0, 1);
  // Épaules à une dizaine de centimètres du mur : bras pliés, ce sont les coudes qui plient,
  // le buste ne recule pas. Seule une inversée (prise tenue sous la poitrine) écarte le buste.
  const zS = (under ? 0.13 : 0.08) * height;
  const zH = clamp(zS * 0.9 + Math.sqrt(Math.max(0, t * t - tp * tp)), 0.08 * height, 0.4 * height);

  // Centre de gravité (surtout le bassin) au-dessus des pieds d'appui.
  let offBalance = 0;
  if (!hanging) {
    const com = 0.6 * hips.x + 0.4 * shoulders.x;
    const xs = standing.map((s) => c[s].x);
    const lo = Math.min(...xs) - 0.06 * height;
    const hi = Math.max(...xs) + 0.06 * height;
    offBalance = com < lo ? lo - com : com > hi ? com - hi : 0;
  }
  return { shoulders, hips, zS, zH, armBend, legBend, lean, offBalance, ok };
}

/** Contacts au temps `t` (en nombre de mouvements, ex. 2.5 = milieu du 3e) ; `lift` = décollement du mur (0 à 1). */
export function contactsAt(
  start: Contacts,
  startTypes: HandTypes,
  moves: Move[],
  t: number,
): { c: Contacts; types: HandTypes; moving: Limb | null; lift: number; crouch: number; index: number } {
  const c: Contacts = { ...start };
  const types: HandTypes = { ...startTypes };
  const done = Math.min(moves.length, Math.max(0, Math.floor(t)));
  for (let i = 0; i < done; i++) {
    const m = moves[i];
    c[m.limb] = m.to;
    if (m.limb === 'lh' || m.limb === 'rh') types[m.limb] = m.type;
    else types[m.limb] = m.hook;
  }
  const current = moves[done];
  if (!current || t >= moves.length) return { c, types, moving: null, lift: 0, crouch: 0, index: moves.length };
  const p = Math.max(0, t - done);
  if (current.dyno) {
    // Jeté : le corps se charge (main encore sur sa prise), puis la main part vite et le corps monte.
    const load = 0.4;
    if (p < load) return { c, types, moving: null, lift: 0, crouch: Math.sin((p / load) * (Math.PI / 2)), index: done };
    const q = (p - load) / (1 - load);
    const e = 1 - (1 - q) ** 3;
    c[current.limb] = lerp(current.from, current.to, e);
    return {
      c,
      types,
      moving: current.limb,
      lift: Math.sin(Math.PI * e) * 0.6,
      crouch: 1 - 2.2 * Math.sin(Math.PI * q) - q,
      index: done,
    };
  }
  const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
  c[current.limb] = lerp(current.from, current.to, e);
  if (current.limb === 'lf' || current.limb === 'rf') {
    // Le pied en mouvement ne porte plus le corps.
    types[current.limb] = e > 0.5 ? current.hook : types[current.limb];
  }
  return { c, types, moving: current.limb, lift: Math.sin(Math.PI * e), crouch: 0, index: done };
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
 * Les mains et les pieds sont sur le mur, le corps s'en écarte d'autant que la posture le demande.
 */
export function skeleton(
  c: Contacts,
  height: number,
  moving: Limb | null = null,
  lift = 0,
  types: HandTypes = {},
  crouch = 0,
): Skeleton {
  const b = body(height);
  const pose = solvePose(c, height, types, crouch);
  const S = v3(pose.shoulders, pose.zS);
  const P = v3(pose.hips, pose.zH);

  const onWall = 0.03 * height;
  const contact = (l: Limb) => v3(c[l], onWall + (moving === l ? lift * 0.14 * height : 0));

  const up = norm3(sub3(S, P), { x: 0, y: -1, z: 0 });
  // Axe des épaules : dans le plan du mur, perpendiculaire au buste.
  const across = norm3({ x: -up.y, y: up.x, z: 0 }, { x: 1, y: 0, z: 0 });
  const arms = ([['lh', -1], ['rh', 1]] as const).map(([l, side]) => {
    const shoulder = add3(S, mul3(across, (side * b.shoulders) / 2));
    // Coudes vers l'extérieur et vers le bas, un peu décollés du mur.
    const r = joint3(shoulder, contact(l), b.upperArm, b.forearm, { x: side * 0.8, y: 0.6, z: 0.3 });
    return { shoulder, elbow: r.joint, hand: r.end };
  });
  const legs = ([['lf', -1], ['rf', 1]] as const).map(([l, side]) => {
    const hip = add3(P, mul3(across, (side * b.hips) / 2));
    const style = types[l];
    // Pied dans le vide : la jambe pend sous le bassin.
    const target =
      style === 'vide' && moving !== l
        ? add3(hip, { x: side * 0.06 * height, y: 0.45 * height, z: -0.05 * height })
        : contact(l);
    // Genoux ouverts vers l'extérieur (grenouille), qui montent quand le pied est haut (pied
    // à hauteur de hanche : genou vers le haut, pas à l'horizontale) ; talon : genou vers le haut
    // et dehors ; pointe : jambe presque tendue, genou vers le haut.
    const below = (target.y - hip.y) / (b.thigh + b.shin);
    const high = clamp((0.45 - below) / 0.35, 0, 1);
    const pole =
      style === 'talon'
        ? { x: side * 0.6, y: -0.7, z: 0.4 }
        : style === 'pointe'
          ? { x: 0, y: -1, z: 0.3 }
          : { x: side * (0.85 - 0.4 * high), y: -0.25 - 0.6 * high, z: 0.45 + 0.1 * high };
    const r = joint3(hip, target, b.thigh, b.shin, pole);
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
