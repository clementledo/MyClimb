/**
 * Méthode de grimpe : à partir des prises de main dans l'ordre (et des prises de pied),
 * choisit quelle main prend chaque prise, où poser les pieds avant et après chaque
 * mouvement, et rédige un conseil et des alertes pour chaque étape.
 *
 * Unités : mètres sur le mur, y vers le bas.
 */
import {
  add,
  dist,
  mid,
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
  fix?: Fixes;
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

export type Plan = {
  /** Largeur et hauteur de la photo en mètres. */
  W: number;
  H: number;
  /** Taille du grimpeur en mètres. */
  height: number;
  hands: Hold[];
  feet: Pt[];
  start: Contacts;
  startTypes: HandTypes;
  startText: string;
  moves: Move[];
};

/** Hauteur de mur par défaut (salle de bloc ou de voie courante), en mètres. */
export const DEFAULT_WALL = 6;

/** Hauteur de mur visible sur la photo, en mètres : celle que l'utilisateur a réglée, sinon 6 m. */
export function photoHeight(route: RouteInput) {
  return route.wallHeight && route.wallHeight > 0 ? route.wallHeight : DEFAULT_WALL;
}

/** Coût d'un crochet : plus sûr qu'une adhérence, moins qu'une vraie prise de pied. */
const HOOK_COST = 0.3;

type Foot = { pt: Pt; label: string | null; hook?: FootStyle };
type Feet = { lf: Foot; rf: Foot };

export function planRoute(route: RouteInput, climber: number): Plan {
  const H = photoHeight(route);
  const W = (H * route.width) / route.height;
  const h = climber;
  const hands: Hold[] = route.hands.map((p) => ({ x: p.x * W, y: p.y * H, type: p.type }));
  const feetHolds = route.feet.map((p) => ({ x: p.x * W, y: p.y * H }));
  const n = hands.length;
  const offset = 0.025 * h;
  const fixHands = route.fix?.hands ?? {};
  const fixFeet = route.fix?.feet ?? {};

  /* ---------- Équilibre d'une position (mains + pieds) ---------- */

  const stanceCost = (lh: Pt, rh: Pt, f: Feet) => {
    const lf = f.lf.pt;
    const rf = f.rf.pt;
    if (dist(lh, rh) > 0.95 * h) return Infinity;
    if (dist(lf, rf) > 0.95 * h) return Infinity;
    const hm = mid(lh, rh);
    let c = 0;
    for (const [limb, side] of [['lf', -1], ['rf', 1]] as const) {
      const foot = f[limb];
      const p = foot.pt;
      if (foot.hook) {
        // Crochet : prise sur le côté du pied, à portée de jambe.
        if ((p.x - hm.x) * side < 0.25 * h) return Infinity;
        if (Math.max(dist(p, lh), dist(p, rh)) > 1.05 * h) return Infinity;
        c += HOOK_COST;
      } else {
        for (const hand of [lh, rh]) if (dist(p, hand) > 1.18 * h) return Infinity;
        // Pieds sous les mains.
        if (p.y < Math.min(lh.y, rh.y) + 0.3 * h) return Infinity;
      }
      const forced = foot.label ? fixFeet[foot.label] : undefined;
      if (forced && forced !== limb) c += 50;
    }
    if (f.lf.hook && f.rf.hook) return Infinity;
    const standing = f.lf.hook ? rf : f.rf.hook ? lf : null;
    const fm = standing ?? mid(lf, rf);
    const ext = dist(hm, fm) / h;
    if (ext > 0.92) c += (ext - 0.92) * 25; // trop tendu
    if (ext < 0.5) c += (0.5 - ext) * 8; // trop groupé
    // Centre de gravité au-dessus des pieds ; un crochet retient le corps sur le côté.
    c += (Math.abs(hm.x - fm.x) / h) * (standing ? 1.2 : 2.5);
    if (!standing) {
      const spread = dist(lf, rf) / h;
      if (spread < 0.12) c += (0.12 - spread) * 4;
      if (spread > 0.6) c += (spread - 0.6) * 5;
      if (lf.x > rf.x + 0.05 * h) c += 1.2; // pieds croisés
    }
    if (f.lf.label === null) c += 0.7;
    if (f.rf.label === null) c += 0.7;
    if (f.lf.label !== null && f.lf.label === f.rf.label) c += 0.4;
    return c;
  };

  /**
   * Prises utilisables par les pieds : prises de pied, prises de main déjà dépassées, adhérence.
   * Une prise de main haute (au niveau des mains) ne peut servir qu'en crochet : talon, ou pointe si elle est loin sur le côté.
   */
  const footOptions = (lh: Pt, rh: Pt, below: number, reached: number): Foot[] => {
    const hm = mid(lh, rh);
    const high = Math.min(lh.y, rh.y) + 0.3 * h;
    const opt = (p: Pt, label: string): Foot =>
      p.y < high ? { pt: p, label, hook: Math.abs(p.x - hm.x) > 0.55 * h ? 'pointe' : 'talon' } : { pt: p, label };
    // Les prises de pied servent à pousser ; les crochets se font sur les prises de main.
    const opts: Foot[] = feetHolds.filter((p) => p.y >= high).map((p) => ({ pt: p, label: `pied ${feetHolds.indexOf(p) + 1}` }));
    hands.forEach((p, i) => {
      if (i < below) opts.push(opt(p, `prise ${i + 1}`));
      // Prise tenue par une main ou tout juste atteinte : seulement en crochet.
      else if (i <= reached && p.y < high) opts.push(opt(p, `prise ${i + 1}`));
    });
    opts.push({ pt: { x: hm.x - 0.13 * h, y: hm.y + 0.95 * h }, label: null });
    opts.push({ pt: { x: hm.x + 0.13 * h, y: hm.y + 0.95 * h }, label: null });
    return opts;
  };

  const bestFeet = (
    lh: Pt,
    rh: Pt,
    below: number,
    reached: number,
    prev: Feet | null,
    also?: (f: Feet) => number,
  ) => {
    const opts = footOptions(lh, rh, below, reached);
    let best: { f: Feet; cost: number } | null = null;
    for (const l of opts) {
      for (const r of opts) {
        // Deux pieds sur la même prise : côte à côte.
        const f =
          l.label !== null && l.label === r.label
            ? { lf: { ...l, pt: add(l.pt, { x: -offset, y: 0 }) }, rf: { ...r, pt: add(r.pt, { x: offset, y: 0 }) } }
            : { lf: l, rf: r };
        let cost = stanceCost(lh, rh, f);
        if (also) cost += also(f);
        if (prev) {
          if (dist(l.pt, prev.lf.pt) > 0.02 * h) cost += 0.2;
          if (dist(r.pt, prev.rf.pt) > 0.02 * h) cost += 0.2;
        }
        if (cost < (best?.cost ?? Infinity)) best = { f, cost };
      }
    }
    return best;
  };

  /* ---------- Choix des mains (programmation dynamique) ---------- */

  type Action = { limb: 'lh' | 'rh'; to: number; match: boolean };
  const idxOf = (p: Hold) => hands.indexOf(p);
  const key = (a: number, b: number) => a * n + b;
  const handCost = (limb: 'lh' | 'rh', target: Hold, other: Hold, bump: boolean) => {
    const d = dist(target, other);
    let c = 1 + (d > 0.9 * h ? 4 : (d / (0.9 * h)) ** 2 * 1.5);
    if (limb === 'lh' && target.x > other.x + 0.08 * h) c += 2;
    if (limb === 'rh' && target.x < other.x - 0.08 * h) c += 2;
    // Une latérale qu'on tire vers la gauche se prend de la main droite, et inversement.
    if (target.type === 'lat_g' && limb === 'lh') c += 1.2;
    if (target.type === 'lat_d' && limb === 'rh') c += 1.2;
    if (bump) c += 0.7;
    if (fixHands[idxOf(target)] && fixHands[idxOf(target)] !== limb) c += 50;
    return c;
  };

  const starts: [number, number][] = [[0, 0]];
  // Départ à deux prises proches et à la même hauteur.
  if (n >= 3 && dist(hands[0], hands[1]) < 0.45 * h && Math.abs(hands[0].y - hands[1].y) < 0.25 * h) {
    let leftFirst = hands[0].x <= hands[1].x;
    if (fixHands[0] === 'rh' || fixHands[1] === 'lh') leftFirst = false;
    if (fixHands[0] === 'lh' || fixHands[1] === 'rh') leftFirst = true;
    starts.push(leftFirst ? [0, 1] : [1, 0]);
  }
  const cost = new Map<number, number>();
  const back = new Map<number, { from: number; action: Action }>();
  starts.forEach(([a, b], i) => cost.set(key(a, b), i * 0.1));
  let best: { k: number; c: number } | null = null;
  for (let m = 0; m < n; m++) {
    for (let a = 0; a <= m; a++) {
      for (const b of a === m ? Array.from({ length: m + 1 }, (_, i) => i) : [m]) {
        const k = key(a, b);
        const c0 = cost.get(k);
        if (c0 === undefined) continue;
        const relax = (na: number, nb: number, action: Action, c: number) => {
          const nk = key(na, nb);
          if (c0 + c < (cost.get(nk) ?? Infinity)) {
            cost.set(nk, c0 + c);
            back.set(nk, { from: k, action });
          }
        };
        if (m === n - 1) {
          // Top : les deux mains dessus.
          if (a === b && (best === null || c0 < best.c)) best = { k, c: c0 };
          if (a !== b) relax(m, m, { limb: a < b ? 'lh' : 'rh', to: m, match: true }, 0.3);
          continue;
        }
        const t = m + 1;
        relax(t, b, { limb: 'lh', to: t, match: false }, handCost('lh', hands[t], hands[b], a === m && b !== m));
        relax(a, t, { limb: 'rh', to: t, match: false }, handCost('rh', hands[t], hands[a], b === m && a !== m));
        if (a !== b) relax(m, m, { limb: a < b ? 'lh' : 'rh', to: m, match: true }, 0.9);
      }
    }
  }
  const actions: Action[] = [];
  let startKey = key(0, 0);
  if (best) {
    let k = best.k;
    while (back.has(k)) {
      const step = back.get(k)!;
      actions.unshift(step.action);
      k = step.from;
    }
    startKey = k;
  }
  const startA = Math.floor(startKey / n);
  const startB = startKey % n;

  /* ---------- Déroulé : mains, pieds, conseils ---------- */

  const handPt = (limb: 'lh' | 'rh', idx: number, otherIdx: number) =>
    idx === otherIdx ? add(hands[idx], { x: limb === 'lh' ? -offset : offset, y: 0 }) : hands[idx];
  const idx = { lh: startA, rh: startB };
  const c: Contacts = {
    lh: handPt('lh', startA, startB),
    rh: handPt('rh', startB, startA),
    lf: { x: 0, y: 0 },
    rf: { x: 0, y: 0 },
  };
  const below = () => Math.min(idx.lh, idx.rh);
  const reached = () => Math.max(idx.lh, idx.rh);
  const startFeet = bestFeet(c.lh, c.rh, 0, Math.max(startA, startB), null)?.f ?? {
    lf: { pt: add(mid(c.lh, c.rh), { x: -0.13 * h, y: 0.95 * h }), label: null },
    rf: { pt: add(mid(c.lh, c.rh), { x: 0.13 * h, y: 0.95 * h }), label: null },
  };
  let feet: Feet = startFeet;
  c.lf = feet.lf.pt;
  c.rf = feet.rf.pt;
  const start = { ...c };
  const startTypes: HandTypes = {
    lh: hands[startA]?.type,
    rh: hands[startB]?.type,
    lf: startFeet.lf.hook,
    rf: startFeet.rf.hook,
  };
  const footText = (f: Foot) =>
    f.hook ? `en crochet de ${f.hook} sur ${f.label}` : f.label ? `sur ${f.label}` : 'en adhérence';
  const startText =
    n === 0
      ? ''
      : `${
          startA === startB
            ? `Départ : les deux mains sur la prise ${startA + 1}`
            : `Départ : main gauche sur ${startA + 1}, main droite sur ${startB + 1}`
        }, pied gauche ${footText(feet.lf)}, pied droit ${footText(feet.rf)}.`;

  const moves: Move[] = [];
  const pushFoot = (limb: 'lf' | 'rf', f: Foot, why: string, swap: boolean) => {
    const from = c[limb];
    if (dist(from, f.pt) < 0.02 * h && (limb === 'lf' ? feet.lf : feet.rf).hook === f.hook) return;
    const other = limb === 'lf' ? c.rf : c.lf;
    const smear = f.label === null;
    const fromSmear = (limb === 'lf' ? feet.lf : feet.rf).label === null;
    const tips = smear && fromSmear ? [] : [why];
    const alerts: string[] = [];
    let score = 0.4;
    if (f.hook === 'talon') {
      alerts.push('Crochet de talon');
      tips.splice(0, tips.length, 'Pose le talon sur la prise, pointe vers l’extérieur, et tire avec l’arrière de la cuisse pour coller les hanches au mur.');
      score += 1.2;
    } else if (f.hook === 'pointe') {
      alerts.push('Crochet de pointe');
      tips.splice(0, tips.length, 'Accroche le dessus du chausson sous la prise, jambe tendue, et tire la pointe vers toi pour ne pas pivoter.');
      score += 1.4;
    } else if (swap) {
      alerts.push('Changement de pied');
      tips.splice(0, tips.length, 'Pose ce pied juste au-dessus de l’autre, puis retire l’autre au dernier moment en gardant le poids sur la prise.');
      score += 0.8;
    }
    if (smear) {
      tips.push('Pas de prise de pied à portée : chausson à plat sur le mur, talon bas, et pousse.');
      score += 0.3;
    }
    if (!f.hook && other.y - f.pt.y > 0.35 * h) {
      tips.push('Pied haut : monte le bassin au-dessus du pied (rock-over).');
      score += 0.9;
    }
    const forced = f.label ? fixFeet[f.label] : undefined;
    moves.push({
      limb,
      from,
      to: f.pt,
      hook: f.hook,
      title: smear && fromSmear ? `${LIMB_NAMES[limb]} remonte en adhérence` : `${LIMB_NAMES[limb]} ${footText(f)}`,
      tips,
      alerts,
      level: level(score),
      fix: f.label ? { kind: 'foot', label: f.label } : undefined,
      corrected: forced === limb,
    });
    scores.push(score);
    c[limb] = f.pt;
  };
  const changeFeet = (target: Feet, why: string) => {
    // Le pied le plus bas monte en premier, sauf s'il doit prendre la place de l'autre (changement de pied).
    const takes = (a: 'lf' | 'rf', b: 'lf' | 'rf') =>
      target[a].label !== null && target[a].label === feet[b].label && target[b].label !== feet[b].label;
    let order: ('lf' | 'rf')[] = c.lf.y >= c.rf.y ? ['lf', 'rf'] : ['rf', 'lf'];
    if (takes('lf', 'rf')) order = ['lf', 'rf'];
    else if (takes('rf', 'lf')) order = ['rf', 'lf'];
    for (const limb of order) pushFoot(limb, target[limb], why, takes(limb, limb === 'lf' ? 'rf' : 'lf'));
    feet = target;
  };

  const scores: number[] = [];
  function level(score: number): Level {
    return score < 1.6 ? 1 : score < 3 ? 2 : 3;
  }

  for (const action of actions) {
    const limb = action.limb;
    const otherLimb = limb === 'lh' ? 'rh' : 'lh';
    const target = hands[action.to];
    const otherIdx = idx[otherLimb];
    const to = handPt(limb, action.to, otherIdx);
    const next = { ...c, [limb]: to };
    const nextBelow = Math.min(limb === 'lh' ? action.to : idx.lh, limb === 'rh' ? action.to : idx.rh);
    const nextReached = Math.max(nextBelow, action.to, idx[otherLimb]);
    const afterBest = bestFeet(next.lh, next.rh, nextBelow, nextReached, feet);
    const nowCost = stanceCost(next.lh, next.rh, feet);

    if (!action.match && (!Number.isFinite(nowCost) || nowCost > (afterBest?.cost ?? Infinity) + 1)) {
      // Préparer les pieds pour que la main arrive en statique.
      const bridge = bestFeet(next.lh, next.rh, below(), reached(), feet, (f) => stanceCost(c.lh, c.rh, f) * 0.5);
      if (bridge) changeFeet(bridge.f, 'Place le pied avant de lancer la main.');
    }

    const d = dist(target, hands[otherIdx]);
    const stance = stanceCost(next.lh, next.rh, feet);
    // Jeté si la main ne peut pas arriver en statique : trop loin, ou pieds impossibles à cette position.
    const dyno = !action.match && (d > 0.9 * h || (!Number.isFinite(stance) && d > 0.6 * h));
    const tips: string[] = [];
    const alerts: string[] = [];
    let score = 0.5 + (d / h) ** 2 * 3;
    if (action.match) {
      tips.push(action.to === n - 1 ? 'Rejoins le top à deux mains et tiens 2 secondes.' : 'Rejoins l’autre main sur la prise (match) pour libérer la suivante.');
    } else {
      if (target.type) {
        tips.push(HOLD_TYPES[target.type].tip);
        score += GRIP_DIFFICULTY[target.type];
      }
      score += Math.min(4, Number.isFinite(stance) ? stance : 4) * 0.45;
      if (feet.lf.label === null) score += 0.3;
      if (feet.rf.label === null) score += 0.3;
      if (feet.lf.hook || feet.rf.hook) score += 0.3;
      if (dyno) {
        alerts.push('Jeté');
        tips.push('Trop loin en statique : descends le bassin pour te charger, regarde la prise et pousse d’un coup sur les jambes ; la main part au point mort, quand le corps ne monte plus.');
        score += 1.5;
      } else if (d > 0.7 * h) {
        tips.push('Mouvement long : pousse sur les jambes, hanches collées au mur, bras tendu sur l’autre prise.');
      }
      const crossed = (limb === 'lh' && target.x > hands[otherIdx].x + 0.08 * h) || (limb === 'rh' && target.x < hands[otherIdx].x - 0.08 * h);
      if (crossed) {
        alerts.push('Main croisée');
        score += 0.8;
      }
      else if (Math.abs(target.x - hands[otherIdx].x) > 0.45 * h) {
        tips.push('Traversée : bascule les hanches vers la prise, genou rentré (lolotte) si ça aide.');
      }
      if (idx[limb] > otherIdx) tips.push('Même main deux fois de suite : l’autre main reste sur sa prise.');
      if (tips.length === 0) tips.push('Bras tendu sur l’autre main, pousse sur les pieds plutôt que de tirer.');
    }
    if (action.match) score = 0.6 + (target.type ? Math.max(0, GRIP_DIFFICULTY[target.type]) * 0.5 : 0);
    const forced = fixHands[action.to];
    scores.push(score);
    moves.push({
      limb,
      from: c[limb],
      to,
      type: target.type,
      dyno,
      level: level(score),
      fix: action.match ? undefined : { kind: 'hand', hold: action.to },
      corrected: !action.match && forced === limb,
      title: `${LIMB_NAMES[limb]} → ${action.to === n - 1 ? 'top' : `prise ${action.to + 1}`}${
        target.type ? ` · ${HOLD_TYPES[target.type].label}` : ''
      }${action.match ? ' (match)' : ''}`,
      tips,
      alerts,
    });
    c[limb] = to;
    idx[limb] = action.to;
    // Si l'autre main partageait la prise, elle se recentre.
    if (idx[otherLimb] === action.to) c[otherLimb] = handPt(otherLimb, action.to, action.to);

    // Replacer les pieds si une meilleure position existe maintenant (inutile une fois au top).
    if (idx.lh === n - 1 && idx.rh === n - 1) continue;
    const settle = bestFeet(c.lh, c.rh, below(), reached(), feet);
    const current = stanceCost(c.lh, c.rh, feet);
    if (settle && (!Number.isFinite(current) || current - settle.cost > 0.4)) {
      changeFeet(settle.f, dyno ? 'Récupère les pieds après le jeté.' : 'Remonte le pied pour te replacer sous la main.');
    }
  }

  // Crux : l'étape la plus dure, si elle n'est pas facile.
  let crux = -1;
  scores.forEach((sc, i) => {
    if (crux < 0 || sc > scores[crux]) crux = i;
  });
  if (crux >= 0 && moves[crux].level > 1) {
    moves[crux].crux = true;
    moves[crux].tips.push('C’est le crux : secoue les bras sur la position d’avant et visualise le mouvement avant de le lancer.');
  }

  return { W, H, height: h, hands, feet: feetHolds, start, startTypes, startText, moves };
}
