/**
 * Moteur de méthode : à partir des prises de main dans l'ordre (et des prises de pied),
 * cherche la suite de mouvements la moins coûteuse en bougeant un membre à la fois, en
 * jugeant chaque position avec la même posture que la 3D (bras tendus, équilibre au-dessus
 * des pieds, bassin près du mur). Puis rédige un conseil et des alertes pour chaque étape.
 *
 * Unités : mètres sur le mur, y vers le bas.
 */
import {
  add,
  dist,
  flagSpot,
  legFold,
  mid,
  solvePose,
  type Contacts,
  type FootStyle,
  type HandTypes,
  type Hold,
  type HoldType,
  type Level,
  type Limb,
  type Move,
  type Pt,
} from './simulation';

export const HOLD_TYPES: Record<HoldType, { label: string; short: string; tip: string }> = {
  bac: { label: 'Bac', short: 'B', tip: 'Bac : tire bras tendu pour économiser tes avant-bras.' },
  reglette: { label: 'Réglette', short: 'R', tip: 'Réglette : semi-arquée, pouce verrouillé sur l’index si possible.' },
  plat: { label: 'Plat', short: 'Pl', tip: 'Plat : main ouverte, garde le bassin bas, sous la prise.' },
  pince: { label: 'Pince', short: 'Pi', tip: 'Pince : serre avec le pouce en opposition.' },
  inversee: { label: 'Inversée', short: 'I', tip: 'Inversée : monte les pieds haut et tire vers le haut, près du mur.' },
  lat_g: {
    label: 'Latérale ←',
    short: '←',
    tip: 'Latérale : tire vers la gauche, corps décalé à gauche, pieds qui poussent en opposition.',
  },
  lat_d: {
    label: 'Latérale →',
    short: '→',
    tip: 'Latérale : tire vers la droite, corps décalé à droite, pieds qui poussent en opposition.',
  },
};

const LIMB_NAMES: Record<Limb, string> = {
  lh: 'Main gauche',
  rh: 'Main droite',
  lf: 'Pied gauche',
  rf: 'Pied droit',
};

/** Corrections de l'utilisateur : main imposée sur une prise, pied imposé sur une prise de pied. */
export type Fixes = { hands?: Record<number, 'lh' | 'rh'>; feet?: Record<string, 'lf' | 'rf'> };

/** Voie en coordonnées de 0 à 1 sur la photo. */
export type RouteInput = {
  width: number;
  height: number;
  hands: Hold[];
  feet: Pt[];
  /** Hauteur du mur visible sur la photo, en mètres. */
  wallHeight?: number;
  /** Inclinaison du mur. */
  angle?: WallAngle;
  fix?: Fixes;
};

export type WallAngle = 'dalle' | 'vertical' | 'devers' | 'fort';
/** Inclinaison du mur, en degrés (positif = dévers, le haut du mur vient vers le grimpeur). */
export const WALL_ANGLES: Record<WallAngle, { label: string; deg: number }> = {
  dalle: { label: 'Dalle', deg: -12 },
  vertical: { label: 'Vertical', deg: 0 },
  devers: { label: 'Dévers', deg: 20 },
  fort: { label: 'Fort dévers', deg: 40 },
};

export const LEVELS: Record<Level, { label: string; color: string }> = {
  1: { label: 'Facile', color: '#2F9E44' },
  2: { label: 'Moyen', color: '#F08C00' },
  3: { label: 'Dur', color: '#E03131' },
};


const GRIP_DIFFICULTY: Record<HoldType, number> = {
  bac: -0.4,
  reglette: 1.2,
  plat: 1,
  pince: 0.8,
  inversee: 0.6,
  lat_g: 0.5,
  lat_d: 0.5,
};

/** Ce que chaque type de prise fatigue les avant-bras quand on la tient (sans type : prise moyenne). */
const GRIP_EFFORT: Record<HoldType, number> = {
  bac: 0,
  reglette: 0.55,
  plat: 0.45,
  pince: 0.4,
  inversee: 0.3,
  lat_g: 0.25,
  lat_d: 0.25,
};

/** Ce que le moteur compte le long d'une méthode. Chaque critère a un poids, ajusté par les corrections. */
export const FEATURES = [
  'mains',
  'pieds',
  'allonge',
  'bras',
  'jambes',
  'plie',
  'recul',
  'equilibre',
  'adherence',
  'crochet',
  'vide',
  'drapeau',
  'croise',
  'jete',
  'descente',
  'prise',
] as const;
export type Feature = (typeof FEATURES)[number];
export type Features = Record<Feature, number>;
/** Multiplicateurs appris (1 = réglage d'origine). */
export type Weights = Partial<Record<Feature, number>>;

const BASE: Features = {
  mains: 1,
  pieds: 0.45,
  allonge: 1.6,
  bras: 1.4,
  jambes: 0.35,
  plie: 0.5,
  recul: 0.7,
  equilibre: 6,
  adherence: 0.8,
  crochet: 0.5,
  vide: 3,
  drapeau: 0.7,
  croise: 1.5,
  jete: 3,
  descente: 2,
  prise: 1.5,
};

/** Effet de l'inclinaison : en dalle on tient sur les pieds, en dévers on tient sur les bras. */
const ANGLE: Record<WallAngle, Weights> = {
  dalle: { bras: 0.6, equilibre: 1.8, adherence: 0.4, recul: 0.6, jete: 1.6, crochet: Infinity, vide: Infinity },
  vertical: {},
  devers: { bras: 1.3, recul: 1.8, equilibre: 0.6, adherence: 2, crochet: 0.6, vide: 0.6, jete: 0.8, drapeau: 0.8 },
  fort: { bras: 1.5, recul: 2.5, equilibre: 0.3, adherence: Infinity, crochet: 0.4, vide: 0.3, jete: 0.6, drapeau: 0.7 },
};

/** Coût d'un départ replié (jambes très pliées, bassin reculé). */
const START = 6;

/** Coût d'une position impossible pour ce gabarit, utilisée seulement pour finir la voie. */
const IMPOSSIBLE = 30;

const zero = (): Features => Object.fromEntries(FEATURES.map((f) => [f, 0])) as Features;

export type Plan = {
  /** Largeur et hauteur de la photo en mètres. */
  W: number;
  H: number;
  /** Taille du grimpeur en mètres. */
  height: number;
  angle: WallAngle;
  hands: Hold[];
  feet: Pt[];
  start: Contacts;
  startTypes: HandTypes;
  startText: string;
  moves: Move[];
  /** Totaux des critères le long de la méthode (pour apprendre des corrections). */
  features: Features;
};

/** Hauteur de mur par défaut (salle de bloc ou de voie courante), en mètres. */
export const DEFAULT_WALL = 6;

/** Hauteur de mur visible sur la photo, en mètres : celle que l'utilisateur a réglée, sinon 6 m. */
export function photoHeight(route: RouteInput) {
  return route.wallHeight && route.wallHeight > 0 ? route.wallHeight : DEFAULT_WALL;
}

/**
 * Une place pour un pied : prise de pied, prise de main, point d'adhérence, dans le vide,
 * ou en drapeau (sa place dépend du corps : calculée pour chaque position).
 */
type Spot = { pt: Pt; label: string | null; kind: 'pied' | 'prise' | 'adh' | 'vide' | 'drapeau'; hand?: number };

type Eval = {
  cost: number;
  feat: Partial<Features>;
  types: HandTypes;
  c: Contacts;
  pose: ReturnType<typeof solvePose>;
  /** Position impossible pour ce gabarit (gardée en dernier recours pour finir la voie). */
  bad: boolean;
};
type Step = { kind: 'hand' | 'foot' | 'dyno'; limb: Limb; feat: Partial<Features> };

/** Petit tas binaire pour la recherche du meilleur chemin. */
class Heap {
  private a: { p: number; k: number }[] = [];
  get size() {
    return this.a.length;
  }
  push(p: number, k: number) {
    const a = this.a;
    a.push({ p, k });
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (a[j].p <= a[i].p) break;
      [a[i], a[j]] = [a[j], a[i]];
      i = j;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].p < a[m].p) m = l;
        if (r < a.length && a[r].p < a[m].p) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export function planRoute(route: RouteInput, climber: number, learned: Weights = {}): Plan {
  const H = photoHeight(route);
  const W = (H * route.width) / route.height;
  const h = climber;
  const angle = route.angle ?? 'vertical';
  const hands: Hold[] = route.hands.map((p) => ({ x: p.x * W, y: p.y * H, type: p.type }));
  const feetHolds = route.feet.map((p) => ({ x: p.x * W, y: p.y * H }));
  const n = hands.length;
  const offset = 0.025 * h;
  const fixHands = route.fix?.hands ?? {};
  const fixFeet = route.fix?.feet ?? {};
  const leg = 0.52 * h;
  const w = zero();
  for (const f of FEATURES) {
    const k = Math.min(4, Math.max(0.25, learned[f] ?? 1));
    w[f] = BASE[f] * (ANGLE[angle][f] ?? 1) * k;
  }

  const empty: Contacts = { lh: { x: W / 2, y: H / 2 }, rh: { x: W / 2, y: H / 2 }, lf: { x: W / 2, y: H }, rf: { x: W / 2, y: H } };
  if (n === 0) {
    return { W, H, height: h, angle, hands, feet: feetHolds, start: empty, startTypes: {}, startText: '', moves: [], features: zero() };
  }

  /* ---------- Places possibles pour les pieds ---------- */

  const spots: Spot[] = feetHolds.map((pt, i) => ({ pt, label: `pied ${i + 1}`, kind: 'pied' }));
  hands.forEach((pt, i) => spots.push({ pt, label: `prise ${i + 1}`, kind: 'prise', hand: i }));
  if (Number.isFinite(w.adherence)) {
    // Adhérence : une grille de points sur le mur, sauf là où il y a déjà une prise.
    const xs = [...hands, ...feetHolds].map((p) => p.x);
    const step = 0.4;
    const top = Math.min(...hands.map((p) => p.y)) + 0.3 * h;
    for (let y = H - 0.15; y >= top; y -= step) {
      for (let x = Math.max(0.1, Math.min(...xs) - 0.6); x <= Math.min(W - 0.1, Math.max(...xs) + 0.6); x += step) {
        const pt = { x, y };
        if (spots.some((s) => dist(s.pt, pt) < 0.22)) continue;
        spots.push({ pt, label: null, kind: 'adh' });
      }
    }
  }
  spots.push({ pt: { x: 0, y: 0 }, label: null, kind: 'vide' });
  spots.push({ pt: { x: 0, y: 0 }, label: null, kind: 'drapeau' });
  const NS = spots.length;
  const computed = (i: number) => spots[i].kind === 'vide' || spots[i].kind === 'drapeau';

  const handPt = (limb: 'lh' | 'rh', idx: number, other: number) =>
    idx === other ? add(hands[idx], { x: limb === 'lh' ? -offset : offset, y: 0 }) : hands[idx];

  /* ---------- Coût d'une position ---------- */

  const cache = new Map<number, Eval | null>();
  const keyOf = (a: number, b: number, f: number, g: number) => ((a * n + b) * NS + f) * NS + g;

  const footStyle = (s: Spot, limb: 'lf' | 'rf', lh: Pt, rh: Pt, a: number, b: number): FootStyle | undefined | null => {
    if (s.kind === 'vide') return Number.isFinite(w.vide) ? 'vide' : null;
    if (s.kind === 'drapeau') return Number.isFinite(w.drapeau) ? 'drapeau' : null;
    const hm = mid(lh, rh);
    const high = Math.min(lh.y, rh.y) + 0.42 * h;
    if (s.pt.y >= high) {
      // Debout sur la prise ; pas sur une prise tenue par une main.
      if (s.hand !== undefined && (s.hand === a || s.hand === b)) return null;
      return undefined;
    }
    // Prise haute : seulement en crochet, sur le côté du pied.
    if (s.kind === 'adh' || !Number.isFinite(w.crochet)) return null;
    if (s.hand !== undefined && (s.hand === a || s.hand === b)) return null;
    const dx = (s.pt.x - hm.x) * (limb === 'lf' ? -1 : 1);
    if (dx < 0.25 * h) return null;
    return dx > 0.55 * h ? 'pointe' : 'talon';
  };

  const evaluate = (a: number, b: number, f: number, g: number): Eval | null => {
    const k = keyOf(a, b, f, g);
    const hit = cache.get(k);
    if (hit !== undefined) return hit;
    let res: Eval | null = null;
    compute: {
      if (f === g && spots[f].kind === 'adh') break compute;
      const lh = handPt('lh', a, b);
      const rh = handPt('rh', b, a);
      const sl = footStyle(spots[f], 'lf', lh, rh, a, b);
      const sr = footStyle(spots[g], 'rf', lh, rh, a, b);
      if (sl === null || sr === null) break compute;
      // Drapeau : seulement si l'autre pied est posé et pousse.
      if ((sl === 'drapeau' && sr !== undefined) || (sr === 'drapeau' && sl !== undefined)) break compute;
      const hm = mid(lh, rh);
      const place = (i: number, side: number, other: number) => {
        if (spots[i].kind === 'vide' || spots[i].kind === 'drapeau') return add(hm, { x: side * 0.12 * h, y: 1.05 * h });
        // Deux pieds sur la même prise : côte à côte.
        return i === other ? add(spots[i].pt, { x: side * offset, y: 0 }) : spots[i].pt;
      };
      const c: Contacts = { lh, rh, lf: place(f, -1, g), rf: place(g, 1, f) };
      const types: HandTypes = { lh: hands[a].type, rh: hands[b].type, lf: sl, rf: sr };
      for (const limb of ['lf', 'rf'] as const) {
        if (types[limb] !== 'drapeau') continue;
        const at = flagSpot(c, h, types, limb);
        c[limb] = { x: Math.min(W - 0.05, Math.max(0.05, at.x)), y: Math.min(H - 0.05, at.y) };
      }
      const pose = solvePose(c, h, types);
      const feat: Partial<Features> = {};
      const under = types.lh === 'inversee' || types.rh === 'inversee';
      feat.bras = pose.armBend ** 2 * (under ? 0.3 : 1) * 3;
      feat.jambes = pose.legBend ** 2;
      // Pied d'appui très haut, contre la hanche : la jambe pousse mal.
      feat.plie = (sl ? 0 : legFold(pose, c.lf, -1, h) ** 2) + (sr ? 0 : legFold(pose, c.rf, 1, h) ** 2);
      feat.recul = pose.lean ** 2;
      feat.equilibre = pose.offBalance / h;
      feat.adherence = (spots[f].kind === 'adh' ? 1 : 0) + (spots[g].kind === 'adh' ? 1 : 0);
      feat.crochet = (sl === 'talon' || sl === 'pointe' ? 1 : 0) + (sr === 'talon' || sr === 'pointe' ? 1 : 0);
      feat.vide = (sl === 'vide' ? 1 : 0) + (sr === 'vide' ? 1 : 0);
      feat.drapeau = (sl === 'drapeau' ? 1 : 0) + (sr === 'drapeau' ? 1 : 0);
      let cross = 0;
      if (!sl && !sr && c.lf.x > c.rf.x + 0.05 * h) cross += 1;
      if (lh.x > rh.x + 0.08 * h) cross += 2;
      feat.croise = cross;
      // La position du corps doit aller avec le type de prise.
      let grip = 0;
      for (const limb of ['lh', 'rh'] as const) {
        const t = types[limb];
        const p = c[limb];
        if (t === 'lat_g' && pose.hips.x > p.x + 0.05 * h) grip += (pose.hips.x - p.x) / h;
        if (t === 'lat_d' && pose.hips.x < p.x - 0.05 * h) grip += (p.x - pose.hips.x) / h;
        if (t === 'plat' && p.y > pose.shoulders.y - 0.15 * h) grip += ((p.y - pose.shoulders.y + 0.15 * h) / h) * 2;
        if (t === 'inversee' && p.y < pose.shoulders.y - 0.1 * h) grip += ((pose.shoulders.y - 0.1 * h - p.y) / h) * 3;
      }
      feat.prise = grip;
      let cost =
        w.bras * feat.bras +
        w.jambes * feat.jambes +
        w.plie * feat.plie +
        w.recul * feat.recul +
        w.equilibre * feat.equilibre +
        w.croise * cross +
        w.prise * grip;
      if (feat.adherence) cost += w.adherence * feat.adherence;
      if (feat.crochet) cost += w.crochet * feat.crochet;
      if (feat.vide) cost += w.vide * feat.vide;
      if (feat.drapeau) cost += w.drapeau * feat.drapeau;
      if (!Number.isFinite(cost)) break compute;
      // Corrections : pied imposé sur une prise.
      for (const [i, limb] of [[f, 'lf'], [g, 'rf']] as const) {
        const forced = spots[i].label ? fixFeet[spots[i].label!] : undefined;
        if (forced && forced !== limb) cost += 50;
      }
      // Position impossible : seulement si rien d'autre ne permet de finir.
      if (!pose.ok) cost += IMPOSSIBLE;
      res = { cost, feat, types, c, pose, bad: !pose.ok };
    }
    cache.set(k, res);
    return res;
  };

  /* ---------- Recherche du meilleur chemin (A*) ---------- */

  const g = new Map<number, number>();
  const parent = new Map<number, { from: number; step: Step }>();
  const heap = new Heap();
  const decode = (k: number) => {
    const gg = k % NS;
    const r1 = (k - gg) / NS;
    const f = r1 % NS;
    const r2 = (r1 - f) / NS;
    const b = r2 % n;
    const a = (r2 - b) / n;
    return { a, b, f, g: gg };
  };
  // Estimation du reste (volontairement large pour chercher vite) : chaque prise restante
  // coûte au moins un mouvement de main et une position.
  const remaining = (a: number, b: number) => (2 * (n - 1) - a - b) * 0.5 * (w.mains + 1.5);

  // Départs : les deux mains sur la première prise, ou sur les deux premières si elles sont proches.
  const starts: [number, number][] = [[0, 0]];
  if (n >= 3 && dist(hands[0], hands[1]) < 0.75 * h && Math.abs(hands[0].y - hands[1].y) < 0.35 * h) {
    starts.push([0, 1], [1, 0]);
  }
  for (const [a, b] of starts) {
    let extra = 0;
    if (a !== b) {
      if (fixHands[a] && fixHands[a] !== 'lh') extra += 50;
      if (fixHands[b] && fixHands[b] !== 'rh') extra += 50;
    }
    const hm = mid(hands[a], hands[b]);
    const near = [...Array(NS).keys()].filter(
      (i) => spots[i].kind === 'vide' || (!computed(i) && spots[i].pt.y > hm.y + 0.3 * h && dist(spots[i].pt, hm) < 1.25 * h),
    );
    for (const f of near) {
      for (const gg of near) {
        const e = evaluate(a, b, f, gg);
        if (!e) continue;
        const k = keyOf(a, b, f, gg);
        // Un vrai départ se prend pieds bas, corps allongé : sans ce coût, le moteur partirait
        // pieds déjà hauts, tout replié, pour s'économiser des mouvements de pied.
        const cost = e.cost + extra + 0.1 * (a + b) + START * (e.pose.legBend ** 2 + e.pose.lean ** 2 + (e.feat.plie ?? 0));
        if (cost < (g.get(k) ?? Infinity)) {
          g.set(k, cost);
          heap.push(cost + remaining(a, b), k);
        }
      }
    }
  }

  /** Meilleurs pieds pour une position de mains (arrivée d'un jeté), calculés une seule fois. */
  const feetMemo = new Map<number, [number, number, number] | null>();
  const feetFor = (na: number, nb: number) => {
    const mk = na * n + nb;
    if (feetMemo.has(mk)) return feetMemo.get(mk)!;
    const hm = mid(hands[na], hands[nb]);
    const near = [...Array(NS).keys()].filter(
      (i) => computed(i) || (spots[i].pt.y > hm.y + 0.3 * h && dist(spots[i].pt, hm) < 1.2 * h),
    );
    let bestFeet: [number, number, number] | null = null;
    for (const nf of near) {
      for (const ng of near) {
        const e = evaluate(na, nb, nf, ng);
        if (e && e.cost < (bestFeet?.[2] ?? Infinity)) bestFeet = [nf, ng, e.cost];
      }
    }
    feetMemo.set(mk, bestFeet);
    return bestFeet;
  };

  let goal = -1;
  let best = -1;
  let expansions = 0;
  const done = new Set<number>();
  while (heap.size && expansions < 60000) {
    const { k } = heap.pop();
    if (done.has(k)) continue;
    done.add(k);
    expansions++;
    const { a, b, f, g: gf } = decode(k);
    if (a === n - 1 && b === n - 1) {
      goal = k;
      break;
    }
    if (best < 0 || a + b > decode(best).a + decode(best).b) best = k;
    const here = evaluate(a, b, f, gf)!;
    const base = g.get(k)!;
    const relax = (na: number, nb: number, nf: number, ng: number, extra: number, step: Step) => {
      const e = evaluate(na, nb, nf, ng);
      if (!e) return false;
      const nk = keyOf(na, nb, nf, ng);
      const cost = base + extra + e.cost;
      if (cost < (g.get(nk) ?? Infinity)) {
        g.set(nk, cost);
        parent.set(nk, { from: k, step });
        heap.push(cost + remaining(na, nb), nk);
      }
      return true;
    };

    // Mains : la suivante dans l'ordre, ou rejoindre l'autre main sur la plus haute prise atteinte.
    const m = Math.max(a, b);
    const handMoves: ['lh' | 'rh', number][] = [];
    if (a !== b) handMoves.push([a < b ? 'lh' : 'rh', m]);
    if (m < n - 1) handMoves.push(['lh', m + 1], ['rh', m + 1]);
    for (const [limb, t] of handMoves) {
      const na = limb === 'lh' ? t : a;
      const nb = limb === 'rh' ? t : b;
      const from = here.c[limb];
      const other = limb === 'lh' ? here.c.rh : here.c.lh;
      const target = hands[t];
      const d = dist(from, target);
      const feat: Partial<Features> = { mains: 1, allonge: (d / h) ** 2 };
      // Main qui passe de l'autre côté de l'autre main.
      if ((limb === 'lh' && target.x > other.x + 0.08 * h) || (limb === 'rh' && target.x < other.x - 0.08 * h)) feat.croise = 1;
      // Pendant le mouvement, le corps tient sur l'autre main et les pieds (posés, en crochet ou
      // en drapeau) : sinon il pivote (porte de grange).
      const standing = (['lf', 'rf'] as const).filter((l) => here.types[l] !== 'vide');
      if (standing.length) {
        const xs = [...standing.map((l) => here.c[l].x), other.x];
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        const out = target.x < lo ? lo - target.x : target.x > hi ? target.x - hi : 0;
        feat.equilibre = Math.max(0, out - 0.3 * h) / h;
      }
      let extra = 0;
      for (const [name, v] of Object.entries(feat) as [Feature, number][]) if (v) extra += w[name] * v;
      if (fixHands[t] && fixHands[t] !== limb && !(a !== b && t === m)) extra += 50;
      // Statique si la position d'arrivée tient avec les mêmes pieds : les jambes poussent, la main suit.
      const arrival = evaluate(na, nb, f, gf);
      if (arrival && !arrival.bad) {
        relax(na, nb, f, gf, extra, { kind: 'hand', limb, feat });
        continue;
      }
      // Dernier recours : position impossible, pour pouvoir quand même finir la voie.
      if (arrival) relax(na, nb, f, gf, extra, { kind: 'hand', limb, feat });
      // Sinon jeté : la main part et les pieds se replacent à l'arrivée.
      if (d > 1.05 * h) continue;
      // Un jeté se rattrape mal sur une petite prise, et encore moins de côté.
      const jete = 1 + 0.6 * (target.type ? Math.max(0, GRIP_DIFFICULTY[target.type]) : 0.3) + (0.5 * Math.abs(target.x - from.x)) / Math.max(d, 1e-6);
      const dynoFeat = { ...feat, jete };
      const dynoExtra = extra + w.jete * jete;
      if (!Number.isFinite(dynoExtra)) continue;
      const bestFeet = feetFor(na, nb);
      if (bestFeet) relax(na, nb, bestFeet[0], bestFeet[1], dynoExtra + w.pieds * 2, { kind: 'dyno', limb, feat: { ...dynoFeat, pieds: 2 } });
    }

    // Pieds : vers une place à portée de jambe depuis le bassin.
    for (const limb of ['lf', 'rf'] as const) {
      const cur = limb === 'lf' ? f : gf;
      const curPt = here.c[limb];
      for (let i = 0; i < NS; i++) {
        if (i === cur) continue;
        const s = spots[i];
        const feat: Partial<Features> = { pieds: 1 };
        if (!computed(i)) {
          if (Math.abs(s.pt.x - here.pose.hips.x) > leg || Math.abs(s.pt.y - here.pose.hips.y) > leg) continue;
          if (dist(here.pose.hips, s.pt) > leg) continue;
          if (here.types[limb] !== 'vide' && here.types[limb] !== 'drapeau') {
            // Un pied ne redescend presque jamais.
            const down = s.pt.y - curPt.y;
            if (down > 0.25 * h) continue;
            if (down > 0.05 * h) feat.descente = down / h;
          }
        }
        let extra = 0;
        for (const [name, v] of Object.entries(feat) as [Feature, number][]) if (v) extra += w[name] * v;
        if (!Number.isFinite(extra)) continue;
        relax(a, b, limb === 'lf' ? i : f, limb === 'rf' ? i : gf, extra, { kind: 'foot', limb, feat });
      }
    }
  }
  if (goal < 0) goal = best;

  /* ---------- Méthode : du chemin trouvé aux étapes expliquées ---------- */

  const path: { k: number; step: Step | null }[] = [];
  for (let k = goal; ; ) {
    const p = parent.get(k);
    path.unshift({ k, step: p?.step ?? null });
    if (!p) break;
    k = p.from;
  }
  const states = path.map(({ k }) => {
    const s = decode(k);
    return { ...s, e: evaluate(s.a, s.b, s.f, s.g)! };
  });
  const s0 = states[0];
  const features = zero();
  const addFeat = (feat: Partial<Features>) => {
    for (const [name, v] of Object.entries(feat) as [Feature, number][]) features[name] += v ?? 0;
  };
  states.forEach((s) => addFeat(s.e.feat));

  const spotText = (i: number, style?: FootStyle) => {
    const s = spots[i];
    if (s.kind === 'vide') return 'dans le vide';
    if (s.kind === 'drapeau') return 'en drapeau';
    if (style === 'talon' || style === 'pointe') return `en crochet de ${style} sur ${s.label}`;
    return s.label ? `sur ${s.label}` : 'en adhérence';
  };
  const startText = `${
    s0.a === s0.b
      ? `Départ : les deux mains sur la prise ${s0.a + 1}`
      : `Départ : main gauche sur ${s0.a + 1}, main droite sur ${s0.b + 1}`
  }, pied gauche ${spotText(s0.f, s0.e.types.lf)}, pied droit ${spotText(s0.g, s0.e.types.rf)}.`;

  const moves: Move[] = [];
  const scores: number[] = [];
  /** Fatigue des avant-bras apportée par chaque étape. */
  const efforts: number[] = [];
  const level = (score: number): Level => (score < 1.6 ? 1 : score < 3 ? 2 : 3);
  const effortOf = (e: Eval, kind: Step['kind']) => {
    const grip = (['lh', 'rh'] as const).reduce((sum, l) => sum + (e.types[l] ? GRIP_EFFORT[e.types[l]!] : 0.15), 0) / 2;
    const feet = (['lf', 'rf'] as const).filter((l) => !e.types[l]).length;
    return 0.25 + 1.1 * e.pose.armBend + grip + (feet === 0 ? 0.7 : feet === 1 ? 0.15 : 0) + (kind === 'dyno' ? 0.8 : 0) + (kind === 'foot' ? 0 : 0.2);
  };
  /** Positions où l'on peut lâcher une main pour la magnésie : bras tendus, deux pieds posés, l'autre main sur une bonne prise. */
  const restSpots: { at: number; limb: 'lh' | 'rh'; c: Contacts; quality: number }[] = [];
  const restFrom = (e: Eval, next: Step) => {
    if (e.bad || e.pose.armBend > 0.3 || e.pose.offBalance > 0.02 * h || e.types.lf || e.types.rf) return null;
    const good = (t?: HoldType) => !t || t === 'bac';
    const order: ('lh' | 'rh')[] = next.limb === 'rh' ? ['rh', 'lh'] : ['lh', 'rh'];
    for (const limb of order) {
      const other = limb === 'lh' ? 'rh' : 'lh';
      if (good(e.types[other])) return { limb, quality: 1 - e.pose.armBend + (e.types[other] === 'bac' ? 0.4 : 0) };
    }
    return null;
  };

  for (let i = 1; i < states.length; i++) {
    const prev = states[i - 1];
    const cur = states[i];
    const step = path[i].step!;
    if (i >= 2) {
      const r = restFrom(prev.e, step);
      if (r) restSpots.push({ at: moves.length, c: prev.e.c, ...r });
    }
    addFeat(step.feat);
    const limb = step.limb;
    const tips: string[] = [];
    const alerts: string[] = [];

    if (limb === 'lh' || limb === 'rh') {
      const idx = limb === 'lh' ? cur.a : cur.b;
      const otherIdx = limb === 'lh' ? cur.b : cur.a;
      const match = idx === otherIdx;
      const target = hands[idx];
      const d = dist(prev.e.c[limb], cur.e.c[limb]);
      const dyno = step.kind === 'dyno';
      let score = 0.4 + (d / h) ** 2 * 3 + Math.min(4, cur.e.cost) * 0.35;
      if (match) {
        tips.push(idx === n - 1 ? 'Rejoins le top à deux mains et tiens 2 secondes.' : 'Rejoins l’autre main sur la prise (match) pour libérer la suivante.');
        score = 0.5 + (target.type ? Math.max(0, GRIP_DIFFICULTY[target.type]) * 0.5 : 0);
      } else {
        if (target.type) {
          tips.push(HOLD_TYPES[target.type].tip);
          score += GRIP_DIFFICULTY[target.type];
        }
        if (dyno) {
          alerts.push('Jeté');
          tips.push('Trop loin en statique : descends le bassin pour te charger, regarde la prise et pousse d’un coup sur les jambes ; la main part au point mort, quand le corps ne monte plus.');
          score += 1.5;
        } else if (d > 0.7 * h) {
          tips.push('Mouvement long : pousse sur les jambes, hanches collées au mur, bras tendu sur l’autre prise.');
        }
        if (cur.e.bad) {
          alerts.push('Trop loin pour ta taille');
          tips.push('Le moteur ne trouve pas de position possible ici : vérifie la hauteur du mur, ta taille et l’ordre des prises.');
          score += 2;
        }
        if (step.feat.croise) {
          alerts.push('Main croisée');
          score += 0.8;
        }
        if ((step.feat.equilibre ?? 0) > 0.05) {
          alerts.push('Risque de porte de grange');
          tips.push('Le corps va pivoter : sors une jambe en contrepoids (drapeau) ou plaque la hanche côté prise contre le mur.');
          score += 0.8;
        }
        if (prev.e.pose.legBend > 0.5) tips.push('Pieds hauts : pousse d’abord sur les jambes pour monter le bassin, puis lève la main.');
        else if (prev.e.pose.armBend > 0.4 && !step.feat.croise) tips.push('Garde le bras tendu sur l’autre prise et pousse sur les pieds plutôt que de tirer.');
        if ((cur.e.feat.prise ?? 0) > 0.05) tips.push('Décale le corps du côté où tu tires la prise.');
        if (tips.length === 0) tips.push('Bras tendu sur l’autre main, pousse sur les pieds plutôt que de tirer.');
      }
      const forced = fixHands[idx];
      scores.push(score);
      efforts.push(effortOf(cur.e, step.kind));
      moves.push({
        limb,
        from: prev.e.c[limb],
        to: cur.e.c[limb],
        type: target.type,
        dyno,
        title: `${LIMB_NAMES[limb]} → ${idx === n - 1 ? 'top' : `prise ${idx + 1}`}${target.type ? ` · ${HOLD_TYPES[target.type].label}` : ''}${match ? ' (match)' : ''}`,
        tips,
        alerts,
        level: level(score),
        fix: match ? undefined : { kind: 'hand', hold: idx },
        corrected: !match && forced === limb,
      });
      // Après un jeté, les pieds se replacent d'un coup : une étape par pied qui a bougé.
      if (dyno) {
        for (const fl of ['lf', 'rf'] as const) {
          const was = fl === 'lf' ? prev.f : prev.g;
          const now = fl === 'lf' ? cur.f : cur.g;
          if (was === now) continue;
          scores.push(0.5);
          efforts.push(0);
          moves.push({
            limb: fl,
            from: prev.e.c[fl],
            to: cur.e.c[fl],
            hook: cur.e.types[fl],
            title: `${LIMB_NAMES[fl]} ${spotText(now, cur.e.types[fl])}`,
            tips: [
              cur.e.types[fl] === 'drapeau'
                ? 'Après le jeté, tends cette jambe sur le côté contre le mur (drapeau) pour arrêter le balancement.'
                : 'Récupère les pieds après le jeté pour arrêter le balancement.',
            ],
            alerts: [],
            level: 1,
            fix: spots[now].label ? { kind: 'foot', label: spots[now].label! } : undefined,
          });
        }
      }
      continue;
    }

    // Pied.
    const fi = limb === 'lf' ? cur.f : cur.g;
    const was = limb === 'lf' ? prev.f : prev.g;
    const otherWas = limb === 'lf' ? prev.g : prev.f;
    const s = spots[fi];
    const style = cur.e.types[limb];
    const next = path[i + 1]?.step;
    let score = 0.4;
    if (style === 'talon') {
      alerts.push('Crochet de talon');
      tips.push('Pose le talon sur la prise, pointe vers l’extérieur, et tire avec l’arrière de la cuisse pour coller les hanches au mur.');
      score += 1.2;
    } else if (style === 'pointe') {
      alerts.push('Crochet de pointe');
      tips.push('Accroche le dessus du chausson sous la prise, jambe tendue, et tire la pointe vers toi pour ne pas pivoter.');
      score += 1.4;
    } else if (style === 'vide') {
      alerts.push('Pied décollé');
      tips.push('Rien d’utile pour ce pied : gainage, bras tendus, et ramène-le dès qu’une prise est à portée.');
      score += 1.2;
    } else if (style === 'drapeau') {
      alerts.push('Drapeau');
      tips.push(
        `Pas de bonne prise de ce côté : tends la jambe ${limb === 'lf' ? 'gauche' : 'droite'} sur le côté, chausson contre le mur, pour faire contrepoids pendant le mouvement suivant.`,
      );
      score += 0.7;
    } else if (s.label && s.label === spots[otherWas].label) {
      if (next && next.kind === 'foot' && next.limb !== limb) {
        alerts.push('Changement de pied');
        tips.push('Pose ce pied juste au-dessus de l’autre, puis retire l’autre au dernier moment en gardant le poids sur la prise.');
        score += 0.8;
      } else {
        tips.push('Pose ce pied à côté de l’autre sur la même prise, chaussons serrés, chacun sur sa moitié.');
        score += 0.3;
      }
    } else if (s.kind === 'adh') {
      tips.push('Pas de prise de pied ici : chausson à plat sur le mur, talon bas, et pousse.');
      score += 0.3;
    } else if (next && next.kind !== 'foot') {
      tips.push('Place le pied avant de lancer la main : c’est lui qui va pousser.');
    } else {
      tips.push('Remonte le pied pour te replacer sous les mains.');
    }
    const otherPt = limb === 'lf' ? cur.e.c.rf : cur.e.c.lf;
    if (!style && otherPt.y - s.pt.y > 0.35 * h) {
      tips.push('Pied haut : monte le bassin au-dessus du pied (rock-over).');
      score += 0.9;
    }
    const forced = s.label ? fixFeet[s.label] : undefined;
    scores.push(score);
    efforts.push(effortOf(cur.e, step.kind));
    moves.push({
      limb,
      from: prev.e.c[limb],
      to: cur.e.c[limb],
      hook: style,
      title:
        s.kind === 'adh' && spots[was].kind === 'adh'
          ? `${LIMB_NAMES[limb]} remonte en adhérence`
          : style === 'vide'
            ? `${LIMB_NAMES[limb]} décolle`
            : style === 'drapeau'
              ? `${LIMB_NAMES[limb]} en drapeau`
              : `${LIMB_NAMES[limb]} ${spotText(fi, style)}`,
      tips,
      alerts,
      level: level(score),
      fix: s.label ? { kind: 'foot', label: s.label } : undefined,
      corrected: forced === limb,
    });
  }

  /* ---------- Fatigue, repos et crux ---------- */

  // Fatigue des avant-bras avant chaque étape : elle monte à chaque position tenue et redescend
  // un peu à chaque repos. Plus on est fatigué, plus une étape est dure.
  const pumpBefore = (rests: Set<number>) => {
    const out: number[] = [];
    let pump = 0;
    efforts.forEach((e, k) => {
      if (rests.has(k)) pump *= 0.45;
      out.push(pump);
      pump = pump * 0.9 + e * 0.3;
    });
    return out;
  };
  const tired = (pump: number) => 0.35 * Math.max(0, pump - 0.8);
  // Repos : avant le crux, et quand les bras chauffent sur une longue voie (deux au plus).
  const chosen = new Set<number>();
  const pick = (from: number, to: number) => {
    const ok = restSpots.filter(
      (r) => r.at >= Math.max(2, from) && r.at <= to && r.at < moves.length && [...chosen].every((c) => Math.abs(c - r.at) >= 4),
    );
    if (!ok.length) return;
    const best = ok.reduce((a, b) => (b.quality + 0.15 * b.at > a.quality + 0.15 * a.at ? b : a));
    chosen.add(best.at);
  };
  if (moves.length >= 8) {
    const pump0 = pumpBefore(new Set());
    let crux0 = 0;
    scores.forEach((sc, k) => {
      if (sc + tired(pump0[k]) > scores[crux0] + tired(pump0[crux0])) crux0 = k;
    });
    if (scores[crux0] + tired(pump0[crux0]) >= 2.4) pick(crux0 - 4, crux0);
    const pumped = pump0.findIndex((pp, k) => pp > 1.6 && [...chosen].every((c) => k < c || k - c > 5));
    if (pumped >= 0) pick(pumped - 4, pumped);
  }
  const pump = pumpBefore(chosen);
  moves.forEach((m, k) => {
    if (m.limb === 'lf' || m.limb === 'rf' || m.title.endsWith('(match)')) return;
    scores[k] += tired(pump[k]);
    m.level = level(scores[k]);
    if (pump[k] > 1.8 && m.level > 1) {
      m.alerts.push('Bras fatigués');
      m.tips.push('Tes avant-bras chauffent à ce stade : enchaîne sans traîner et relâche la prise dès que l’autre main tient.');
    }
  });

  // Crux : l'étape la plus dure, si elle n'est pas facile.
  let crux = -1;
  scores.forEach((sc, i) => {
    if (crux < 0 || sc > scores[crux]) crux = i;
  });
  if (crux >= 0 && moves[crux].level > 1) {
    moves[crux].crux = true;
    moves[crux].tips.push('C’est le crux : secoue les bras sur la position d’avant et visualise le mouvement avant de le lancer.');
  }

  // Étapes de repos, de la dernière à la première pour garder les positions.
  for (const at of [...chosen].sort((a, b) => b - a)) {
    const r = restSpots.find((x) => x.at === at)!;
    const beforeCrux = crux >= at && crux - at <= 4;
    moves.splice(at, 0, {
      limb: r.limb,
      from: r.c[r.limb],
      to: r.c[r.limb],
      rest: true,
      title: `Repos · magnésie ${r.limb === 'lh' ? 'main gauche' : 'main droite'}`,
      tips: [
        'Position reposante : bras tendus et poids sur les pieds. Mets de la magnésie et secoue le bras quelques secondes en respirant.',
        ...(beforeCrux ? ['Le crux arrive : visualise le passage avant de repartir.'] : []),
      ],
      alerts: [],
      level: 1,
    });
  }

  return {
    W,
    H,
    height: h,
    angle,
    hands,
    feet: feetHolds,
    start: s0.e.c,
    startTypes: s0.e.types,
    startText,
    moves,
    features,
  };
}

/**
 * Apprend d'une correction : les critères que la méthode corrigée utilise plus que l'ancienne
 * coûtent un peu moins, ceux qu'elle évite coûtent un peu plus, pour que le moteur choisisse
 * de lui-même ce genre de méthode la prochaine fois.
 */
export function learnFrom(before: Features, after: Features, learned: Weights): Weights {
  const next: Weights = { ...learned };
  const diff = FEATURES.map((f) => after[f] - before[f]);
  const norm = diff.reduce((s, d) => s + Math.abs(d), 0);
  if (norm < 1e-6) return next;
  FEATURES.forEach((f, i) => {
    const k = (next[f] ?? 1) * Math.exp((-0.6 * diff[i]) / norm);
    next[f] = Math.min(4, Math.max(0.25, k));
  });
  return next;
}
