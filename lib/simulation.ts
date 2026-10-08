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
/**
 * Pied en crochet (talon ou pointe sur une prise haute), dans le vide (pieds décollés en dévers)
 * ou en drapeau (jambe tendue sur le côté contre le mur, qui fait contrepoids sans porter).
 */
export type FootStyle = 'talon' | 'pointe' | 'vide' | 'drapeau';
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
  /** Repos : la main va au sac à magnésie, secoue le bras puis revient sur sa prise. */
  rest?: boolean;
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

/**
 * Proportions du corps, en fraction de la taille du grimpeur (mesures anthropométriques usuelles).
 * L'allonge d'un bras va de l'épaule au milieu des doigts posés sur la prise ; celle d'une jambe,
 * de la hanche à la pointe du chausson.
 */
export function body(height: number) {
  return {
    upperArm: 0.186 * height,
    forearm: 0.146 * height,
    /** Du poignet au milieu des doigts qui tiennent la prise. */
    hand: 0.06 * height,
    thigh: 0.245 * height,
    shin: 0.246 * height,
    /** Ce que la pointe du chausson ajoute à la jambe, de la cheville à la prise. */
    foot: 0.03 * height,
    torso: 0.29 * height,
    shoulders: 0.2 * height,
    hips: 0.12 * height,
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
 * `free` : pied en l'air (en train de bouger), qui ne porte plus le corps.
 */
export function solvePose(c: Contacts, height: number, types: HandTypes = {}, crouch = 0, free?: Limb): Pose {
  const b = body(height);
  const arm = b.upperArm + b.forearm + b.hand;
  const leg = b.thigh + b.shin + b.foot;
  const t = b.torso;
  const hands = mid(c.lh, c.rh);
  const standing = (['lf', 'rf'] as const).filter((l) => !types[l] && l !== free);
  const hooks = (['lf', 'rf'] as const).filter((l) => isHook(types[l]) && l !== free);
  const flags = (['lf', 'rf'] as const).filter((l) => types[l] === 'drapeau' && l !== free);
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
  else {
    // Pied d'appui hors de portée : le bassin se décale vers lui, le buste suit si besoin
    // (les bras le diront s'ils ne tiennent plus leurs prises).
    for (let it = 0; it < 3; it++) {
      for (const limb of standing) {
        const d = dist(hips, c[limb]);
        if (d > lMax) hips = lerp(c[limb], hips, lMax / d);
      }
      const ts = dist(shoulders, hips);
      if (ts > t) shoulders = lerp(hips, shoulders, t / ts);
    }
    tp = Math.min(tp, dist(shoulders, hips));
  }

  // Membres à portée : chaque main depuis son épaule, chaque pied depuis le bassin.
  // Ce qui fatigue, c'est de n'avoir aucun bras tendu : on compte surtout le bras le plus tendu.
  const bends = (['lh', 'rh'] as const).map((limb, i) => {
    const d = dist(shoulderOf(i ? 1 : -1), c[limb]);
    if (d > arm * 1.0) ok = false;
    if (d < arm * 0.12) ok = false; // main collée à l'épaule : trop groupé
    return clamp(1 - d / aMax, 0, 1);
  });
  const armBend = 0.7 * Math.min(...bends) + 0.3 * Math.max(...bends);
  for (const limb of [...standing, ...hooks, ...flags]) {
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

  // Centre de gravité (surtout le bassin) au-dessus des pieds d'appui. Un drapeau (jambe tendue
  // contre le mur sur le côté) fait contrepoids jusqu'à son pied.
  let offBalance = 0;
  if (!hanging) {
    const com = 0.6 * hips.x + 0.4 * shoulders.x;
    const xs = standing.map((s) => c[s].x);
    let lo = Math.min(...xs) - 0.06 * height;
    let hi = Math.max(...xs) + 0.06 * height;
    for (const l of flags) {
      lo = Math.min(lo, c[l].x);
      hi = Math.max(hi, c[l].x);
    }
    offBalance = com < lo ? lo - com : com > hi ? com - hi : 0;
  }
  return { shoulders, hips, zS, zH, armBend, legBend, lean, offBalance, ok };
}

/**
 * Où poser un pied en drapeau : jambe presque tendue sur le côté (à gauche pour le pied gauche),
 * un peu sous le bassin, calculé avec le corps qui tient sur l'autre pied.
 */
export function flagSpot(c: Contacts, height: number, types: HandTypes, limb: 'lf' | 'rf'): Pt {
  const pose = solvePose(c, height, { ...types, [limb]: undefined }, 0, limb);
  const side = limb === 'lf' ? -1 : 1;
  return { x: pose.hips.x + side * 0.42 * height, y: pose.hips.y + 0.2 * height };
}

/**
 * Pliure d'une jambe d'appui : 0 = jambe allongée, 1 = pied presque contre la hanche ou plus haut
 * que le bassin (on ne pousse plus vraiment dessus).
 */
export function legFold(pose: Pose, foot: Pt, side: number, height: number) {
  const b = body(height);
  const hip = { x: pose.hips.x + (side * b.hips) / 2, y: pose.hips.y };
  const leg = b.thigh + b.shin + b.foot;
  const near = (0.62 * leg - dist(hip, foot)) / (0.35 * leg);
  const above = (hip.y + 0.05 * height - foot.y) / (0.25 * height);
  return clamp(Math.max(near, above), 0, 1);
}

/** Ce qu'il faut pour dessiner le grimpeur à un instant de la méthode. */
export type Frame = {
  c: Contacts;
  types: HandTypes;
  moving: Limb | null;
  /** Décollement du mur du membre qui bouge (0 à 1). */
  lift: number;
  crouch: number;
  index: number;
  /** Position qui place le corps : en avance sur la main qui part (les jambes poussent d'abord). */
  body: Contacts;
  /** Report du poids sur l'autre pied pendant qu'un pied bouge (0 à 1). */
  shift: number;
  /** Avancement d'un repos (main au sac à magnésie, bras secoué, retour sur la prise) ; 0 sinon. */
  chalk: number;
};

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const smooth = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

/** Contacts au temps `t` (en nombre de mouvements, ex. 2.5 = milieu du 3e). */
export function contactsAt(start: Contacts, startTypes: HandTypes, moves: Move[], t: number): Frame {
  const c: Contacts = { ...start };
  const types: HandTypes = { ...startTypes };
  const done = Math.min(moves.length, Math.max(0, Math.floor(t)));
  for (let i = 0; i < done; i++) {
    const m = moves[i];
    if (m.rest) continue;
    c[m.limb] = m.to;
    if (m.limb === 'lh' || m.limb === 'rh') types[m.limb] = m.type;
    else types[m.limb] = m.hook;
  }
  const still: Frame = { c, types, moving: null, lift: 0, crouch: 0, index: done, body: c, shift: 0, chalk: 0 };
  const current = moves[done];
  if (!current || t >= moves.length) return { ...still, index: moves.length };
  const p = Math.max(0, t - done);
  if (current.rest) return { ...still, moving: current.limb, chalk: p };
  if (current.dyno) {
    // Jeté : le corps se charge (main encore sur sa prise), puis la main part vite et le corps monte.
    const load = 0.4;
    if (p < load) return { ...still, crouch: Math.sin((p / load) * (Math.PI / 2)) };
    const q = (p - load) / (1 - load);
    const e = 1 - (1 - q) ** 3;
    c[current.limb] = lerp(current.from, current.to, e);
    return { ...still, moving: current.limb, lift: Math.sin(Math.PI * e) * 0.6, crouch: 1 - 2.2 * Math.sin(Math.PI * q) - q };
  }
  if (current.limb === 'lh' || current.limb === 'rh') {
    // Les jambes poussent d'abord : le corps part vers la prise, la main lâche ensuite et le rattrape.
    const eh = ease(clamp((p - 0.15) / 0.85, 0, 1));
    const eb = ease(clamp(p / 0.8, 0, 1));
    c[current.limb] = lerp(current.from, current.to, eh);
    const bodyC = { ...c, [current.limb]: lerp(current.from, current.to, eb) };
    return { ...still, moving: current.limb, lift: Math.sin(Math.PI * eh), body: bodyC };
  }
  // Pied : le poids passe sur l'autre pied, le pied se déplace, puis le corps se recentre.
  const e = ease(clamp((p - 0.12) / 0.76, 0, 1));
  c[current.limb] = lerp(current.from, current.to, e);
  types[current.limb] = e > 0.5 ? current.hook : types[current.limb];
  const shift = smooth(0, 0.22, p) * (1 - smooth(0.78, 1, p));
  return { ...still, moving: current.limb, lift: Math.sin(Math.PI * e), shift };
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
const lerp3 = (a: P3, b: P3, k: number): P3 => add3(a, mul3(sub3(b, a), k));

/**
 * Articulation (coude ou genou) d'un membre à deux segments, qui plie dans la direction `pole`,
 * sans jamais rentrer dans le mur (z au moins `zMin`).
 */
function joint3(root: P3, target: P3, l1: number, l2: number, pole: P3, zMin = -Infinity): { joint: P3; end: P3 } {
  const u = norm3(sub3(target, root), { x: 0, y: 1, z: 0 });
  const d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(len3(sub3(target, root)), l1 + l2 - 1e-3));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const center = add3(root, mul3(u, a));
  let side = norm3(sub3(pole, mul3(u, dot3(pole, u))), { x: 0, y: 0, z: 1 });
  if (center.z + side.z * h < zMin) {
    // On fait tourner l'articulation autour du membre, vers l'extérieur du mur.
    const out = norm3(sub3({ x: 0, y: 0, z: 1 }, mul3(u, u.z)), side);
    let fixed = out;
    for (const k of [0.3, 0.7, 1.5, 4]) {
      const s2 = norm3(add3(side, mul3(out, k)), out);
      if (center.z + s2.z * h >= zMin) {
        fixed = s2;
        break;
      }
    }
    side = fixed;
  }
  return { joint: add3(center, mul3(side, h)), end: add3(root, mul3(u, d)) };
}

export type Skeleton = {
  head: P3;
  neck: P3;
  chest: P3;
  pelvis: P3;
  /** Gauche puis droite. `hand` : le poignet ; `grip` : le milieu des doigts, sur la prise. */
  arms: { shoulder: P3; elbow: P3; hand: P3; grip: P3 }[];
  /** Gauche puis droite. `foot` : la cheville ; `toe` : ce qui touche la prise (pointe, talon…). */
  legs: { hip: P3; knee: P3; foot: P3; toe: P3 }[];
};

/** Ce qui précise la posture en 3D, en plus des contacts. */
export type SkeletonExtra = {
  /** Contacts qui placent le corps (sinon ceux dessinés) : le corps part avant la main. */
  body?: Contacts;
  /** Report du poids sur l'autre pied, pendant que le pied `moving` bouge (0 à 1). */
  shift?: number;
  /** Repos de la main `moving` : 0 à 1 (sac à magnésie, bras secoué, retour). */
  chalk?: number;
  /** Inclinaison du mur en degrés (positif = dévers) : le corps pend selon la gravité. */
  angle?: number;
};

const blendPose = (a: Pose, b: Pose, k: number): Pose => ({
  ...a,
  shoulders: lerp(a.shoulders, b.shoulders, k),
  hips: lerp(a.hips, b.hips, k),
  zS: a.zS + (b.zS - a.zS) * k,
  zH: a.zH + (b.zH - a.zH) * k,
});

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
  extra: SkeletonExtra = {},
): Skeleton {
  const b = body(height);
  const bodyC = extra.body ?? c;
  let pose = solvePose(bodyC, height, types, crouch);
  // Pendant qu'un pied bouge, le poids passe en partie sur l'autre pied.
  const shift = extra.shift ?? 0;
  if (shift > 0 && (moving === 'lf' || moving === 'rf') && !types[moving === 'lf' ? 'rf' : 'lf']) {
    const free = solvePose(bodyC, height, types, crouch, moving);
    if (free.ok || !pose.ok) pose = blendPose(pose, free, shift * 0.6);
  }
  const th = ((extra.angle ?? 0) * Math.PI) / 180;
  const over = Math.max(0, Math.sin(th));
  // Sans pied qui pousse ni crochet, le corps pend à la verticale (vers l'extérieur en dévers).
  const hanging = !(['lf', 'rf'] as const).some((l) => !types[l] || isHook(types[l]));
  // En dévers, le bassin s'écarte un peu du mur sous son poids.
  const S = v3(pose.shoulders, pose.zS + 0.04 * height * over);
  let P = v3(pose.hips, pose.zH + 0.11 * height * over);
  if (hanging && over > 0) {
    const tp = dist(pose.shoulders, pose.hips);
    P = { x: S.x, y: S.y + tp * Math.cos(th), z: S.z + tp * Math.sin(th) };
  }

  const onWall = 0.03 * height;
  const contact = (l: Limb) => v3(c[l], onWall + (moving === l ? lift * 0.14 * height : 0));

  const up = norm3(sub3(S, P), { x: 0, y: -1, z: 0 });
  // Axe des épaules : dans le plan du mur, perpendiculaire au buste.
  const across = norm3({ x: -up.y, y: up.x, z: 0 }, { x: 1, y: 0, z: 0 });
  const chalk = extra.chalk ?? 0;
  const h = height;
  const arms = ([['lh', -1], ['rh', 1]] as const).map(([l, side]) => {
    const shoulder = add3(S, mul3(across, (side * b.shoulders) / 2));
    if (moving === l && chalk > 0) {
      // Repos : la main descend au sac à magnésie (dans le dos, à la ceinture), puis le bras
      // pend et se secoue sur le côté, et la main revient sur sa prise.
      const hold = contact(l);
      const bag = add3(P, { x: side * 0.012 * h, y: -0.035 * h, z: 0.075 * h });
      const shake = add3(shoulder, { x: side * (0.1 * h + 0.025 * h * Math.sin(chalk * 70)), y: 0.4 * h, z: 0.1 * h });
      const path = (k: number) => {
        if (k < 0.25) return lerp3(hold, bag, ease(k / 0.25));
        if (k < 0.45) return add3(bag, { x: 0, y: 0.012 * h * Math.sin((k - 0.25) * 60), z: 0 });
        if (k < 0.55) return lerp3(bag, shake, ease((k - 0.45) / 0.1));
        if (k < 0.8) return shake;
        return lerp3(shake, hold, ease((k - 0.8) / 0.2));
      };
      const grip = path(chalk);
      // Doigts vers le bas dans le sac et quand le bras pend : poignet au-dessus.
      const wrist = add3(grip, { x: 0, y: -b.hand, z: 0.01 * h });
      const r = joint3(shoulder, wrist, b.upperArm, b.forearm, { x: side * 0.9, y: 0.2, z: 0.6 }, 0.035 * h);
      return { shoulder, elbow: r.joint, hand: r.end, grip: add3(r.end, sub3(grip, wrist)) };
    }
    const grip = contact(l);
    // Poignet : sous la prise (doigts posés dessus), au-dessus pour une prise basse qu'on pousse
    // (rétablissement), à côté pour une latérale, et sous la prise pour une inversée (paume en l'air).
    const t = types[l];
    const low = grip.y > shoulder.y + 0.08 * h;
    const off: P3 =
      t === 'lat_g'
        ? { x: b.hand * 0.92, y: 0.015 * h, z: 0.025 * h }
        : t === 'lat_d'
          ? { x: -b.hand * 0.92, y: 0.015 * h, z: 0.025 * h }
          : t === 'inversee'
            ? { x: 0, y: 0.02 * h, z: b.hand * 0.95 }
            : low && moving !== l
              ? { x: 0, y: -b.hand * 0.8, z: 0.035 * h }
              : { x: 0, y: b.hand * 0.92, z: 0.025 * h };
    const wrist = add3(grip, off);
    // Coudes vers l'extérieur et vers le bas, un peu décollés du mur.
    const r = joint3(shoulder, wrist, b.upperArm, b.forearm, { x: side * 0.8, y: 0.6, z: 0.3 }, 0.035 * h);
    return { shoulder, elbow: r.joint, hand: r.end, grip: add3(r.end, sub3(grip, wrist)) };
  });
  const legs = ([['lf', -1], ['rf', 1]] as const).map(([l, side]) => {
    const hip = add3(P, mul3(across, (side * b.hips) / 2));
    const style = moving === l && lift > 0.5 ? undefined : types[l];
    // Pied dans le vide : la jambe pend sous le bassin (vers l'extérieur en dévers).
    const hangs = types[l] === 'vide' && moving !== l;
    const toe = hangs
      ? add3(hip, {
          x: side * 0.07 * h,
          y: 0.53 * h * Math.cos(th),
          z: 0.53 * h * Math.sin(th) - 0.08 * h * Math.cos(th),
        })
      : contact(l);
    // Cheville selon la façon dont le pied est posé : derrière et au-dessus de la pointe (pointe
    // tournée vers le mur, un peu vers l'extérieur), juste au-dessus du talon pour un crochet de
    // talon, sous la prise pour un crochet de pointe, sur le côté pour un drapeau.
    const off: P3 =
      style === 'talon'
        ? { x: -side * 0.01 * h, y: -0.035 * h, z: 0.03 * h }
        : style === 'pointe'
          ? { x: 0, y: 0.1 * h, z: 0.045 * h }
          : style === 'drapeau'
            ? { x: -side * 0.085 * h, y: -0.025 * h, z: 0.035 * h }
            : hangs
              ? { x: -side * 0.015 * h, y: -0.1 * h, z: 0.03 * h }
              : { x: -side * 0.022 * h, y: -0.04 * h, z: 0.095 * h };
    const ankle = add3(toe, off);
    // Genoux ouverts vers l'extérieur (grenouille), qui montent quand le pied est haut (pied
    // à hauteur de hanche : genou vers le haut, pas à l'horizontale) ; talon : genou vers le haut
    // et dehors ; pointe : jambe presque tendue, genou vers le haut ; drapeau : jambe tendue sur
    // le côté, genou vers le bas.
    const below = (ankle.y - hip.y) / (b.thigh + b.shin);
    const high = clamp((0.45 - below) / 0.35, 0, 1);
    const pole =
      style === 'talon'
        ? { x: side * 0.6, y: -0.7, z: 0.4 }
        : style === 'pointe'
          ? { x: 0, y: -1, z: 0.3 }
          : style === 'drapeau'
            ? { x: side * 0.15, y: 0.55, z: 0.8 }
            : { x: side * (0.85 - 0.15 * high), y: -0.25 - 0.45 * high, z: 0.45 - 0.2 * high };
    const r = joint3(hip, ankle, b.thigh, b.shin, pole, 0.045 * h);
    return { hip, knee: r.joint, foot: r.end, toe: add3(r.end, sub3(toe, ankle)) };
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
