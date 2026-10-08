/**
 * Carte joueur façon FIFA : six stats d'escalade et une note globale, calculées à partir des
 * grimpes notées et des entraînements faits.
 *
 * Chaque stat = niveau (les cotations réussies, surtout dans ce que la stat mesure)
 * + pratique (ce qu'on a grimpé et travaillé ces derniers mois), qui monte à chaque séance de
 * moins en moins vite. La pratique s'efface petit à petit (moitié en quatre mois sans rien faire)
 * et les vieilles réussites comptent un peu moins chaque mois : les stats baissent doucement quand
 * on arrête, sans s'effondrer.
 */
import { GRADES, isFirstTry, isSent, type GradeSystem } from './climbing';
import type { Block, TrainingLog } from './db';
import { validatedDays } from './stats';
import { exerciseById, sessionById, type Focus } from './training';
import { findRoutine } from './trainingPlan';

export type StatId = 'force' | 'doigts' | 'technique' | 'endurance' | 'souplesse' | 'mental';

export const STATS: { id: StatId; short: string; name: string; what: string }[] = [
  { id: 'force', short: 'FOR', name: 'Force', what: 'Dévers, toits, jetés, compression, tractions et gainage.' },
  { id: 'doigts', short: 'DOI', name: 'Doigts', what: 'Réglettes, trous, plats, pinces et exercices de doigts.' },
  { id: 'technique', short: 'TEC', name: 'Technique', what: 'Dalles, dièdres, équilibre, rétablissements, flashs et exercices sur le mur.' },
  { id: 'endurance', short: 'END', name: 'Endurance', what: 'Voies, résistance, beaucoup de grimpes par séance, 4×4.' },
  { id: 'souplesse', short: 'SOU', name: 'Souplesse', what: 'Talons, pointes, dièdres, mobilité et étirements.' },
  { id: 'mental', short: 'MEN', name: 'Mental', what: 'Blocs enchaînés après beaucoup d’essais, en tête, dehors, et la régularité.' },
];

/** Style de grimpe, d'après la meilleure stat. */
const PLAYSTYLE: Record<StatId, string> = {
  force: 'Puissant',
  doigts: 'Crimpeur',
  technique: 'Technicien',
  endurance: 'Endurant',
  souplesse: 'Félin',
  mental: 'Guerrier',
};

export type Tier = 'bronze' | 'argent' | 'or' | 'legende';
export const TIERS: { id: Tier; name: string; from: number }[] = [
  { id: 'bronze', name: 'Bronze', from: 0 },
  { id: 'argent', name: 'Argent', from: 65 },
  { id: 'or', name: 'Or', from: 75 },
  { id: 'legende', name: 'Légende', from: 85 },
];

const OVERALL: Record<StatId, number> = { force: 0.2, doigts: 0.2, technique: 0.22, endurance: 0.13, souplesse: 0.1, mental: 0.15 };

/* ---------- Cotations ---------- */

/** Indice Fontainebleau équivalent de chaque cotation V (de VB à V17). */
const V_TO_FONT = [-1, 0, 2, 3, 4.5, 6.5, 8.5, 10, 11, 12.5, 14, 15, 16, 17, 18, 19, 20, 21, 22];
/** Indice de cotation française équivalent de chaque cotation YDS (de 5.5 à 5.15d). */
const YDS_TO_FR = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Note d'une cotation, de 30 (débutant) à 99 (meilleurs mondiaux) : 7A en bloc ≈ 67, 7a en voie ≈ 63. */
export function gradeRating(grade: string, system: GradeSystem): number | null {
  const i = GRADES[system].indexOf(grade);
  if (i < 0) return null;
  const font = (f: number) => 35 + 3.2 * f;
  const fr = (f: number) => 45 + 3 * (f - 7);
  const r =
    system === 'font' ? font(i) : system === 'v' ? font(V_TO_FONT[i] ?? 0) : system === 'fr' ? fr(i) : fr(YDS_TO_FR[i] ?? 7);
  return clamp(r, 30, 99);
}

/* ---------- Ce que travaille chaque grimpe ou entraînement ---------- */

type W = Partial<Record<StatId, number>>;

const TAGS: Record<string, W> = {
  // Profils du mur
  Dalle: { technique: 1, souplesse: 0.2 },
  Vertical: { doigts: 0.4, technique: 0.4 },
  Dévers: { force: 1, endurance: 0.2 },
  Toit: { force: 1.2, mental: 0.2 },
  Dièdre: { technique: 0.7, souplesse: 0.6 },
  Arête: { technique: 0.8, souplesse: 0.2 },
  // Prises
  Réglettes: { doigts: 1.2 },
  Plats: { doigts: 0.6, force: 0.3, technique: 0.2 },
  Pinces: { doigts: 0.5, force: 0.6 },
  Bacs: { force: 0.3, endurance: 0.3 },
  Inversées: { force: 0.4, technique: 0.4 },
  Trous: { doigts: 0.9 },
  Volumes: { technique: 0.6, souplesse: 0.2 },
  // Mouvements
  Dynamique: { force: 1, mental: 0.4 },
  Statique: { force: 0.5, technique: 0.4 },
  Compression: { force: 1 },
  Talon: { souplesse: 1, technique: 0.4 },
  Pointe: { souplesse: 0.9, technique: 0.4 },
  Rétablissement: { technique: 0.7, souplesse: 0.5 },
  Coordination: { technique: 0.8, mental: 0.3 },
  Équilibre: { technique: 1 },
  Résistance: { endurance: 1.2 },
};
/** Une grimpe sans détail noté travaille un peu tout. */
const PLAIN: W = { force: 0.35, doigts: 0.35, technique: 0.4, endurance: 0.25, souplesse: 0.1, mental: 0.15 };
const FOCUS_W: Record<Focus, W> = {
  doigts: { doigts: 1.5 },
  tirage: { force: 1.5 },
  gainage: { force: 0.9, technique: 0.3 },
  antagonistes: { force: 0.4, mental: 0.3 },
  jambes: { technique: 0.6, souplesse: 0.5 },
  mobilite: { souplesse: 1.5 },
  mur: { technique: 1, endurance: 0.6 },
};
/** Pratique qui donne les deux tiers du bonus maximal (les stats moins travaillées en demandent moins). */
const TAU: Record<StatId, number> = { force: 120, doigts: 120, technique: 130, endurance: 110, souplesse: 70, mental: 100 };
/** Bonus maximal apporté par la pratique. */
const PRACTICE_MAX = 14;
/** La pratique perd la moitié de son effet en quatre mois. */
const HALF_LIFE = 120;

const IDS = STATS.map((x) => x.id);

function addTo(w: W, x: W, k = 1) {
  for (const id of IDS) if (x[id]) w[id] = (w[id] ?? 0) + (x[id] ?? 0) * k;
}

/** Ce qu'une grimpe apporte à chaque stat, selon son profil, ses prises, ses mouvements et sa difficulté. */
function climbWork(b: Block, level: number | null): W {
  const tags = [...b.styles, ...b.holds, ...b.moves].map((t) => TAGS[t]).filter(Boolean);
  const w: W = {};
  if (tags.length) {
    addTo(w, PLAIN, 0.4);
    tags.forEach((t) => addTo(w, t, 1 / Math.sqrt(tags.length)));
  } else addTo(w, PLAIN);
  if (b.discipline === 'voie') addTo(w, { endurance: 1, mental: b.rope === 'lead' ? 0.6 : 0.1 });
  if (b.outdoor) addTo(w, { mental: 0.5, technique: 0.2 });
  // Persévérance : réussi après beaucoup d'essais. Lecture : réussi du premier coup.
  if (isSent(b.result) && b.attempts >= 4) addTo(w, { mental: Math.min(1, b.attempts / 8) });
  if (isFirstTry(b.result)) addTo(w, { technique: 0.3, mental: 0.1 });
  if (b.feel === 'hard') addTo(w, { mental: 0.2 });
  // Plus c'est dur pour toi, plus ça compte ; essayé sans réussir compte un peu moins.
  const r = gradeRating(b.grade, b.gradeSystem) ?? 45;
  const k = (level === null ? 1 : clamp(1 + (r - level) / 12, 0.4, 1.4)) * (isSent(b.result) ? 1 : 0.6);
  for (const id of IDS) if (w[id]) w[id] = (w[id] ?? 0) * k;
  return w;
}

/** Ce qu'un entraînement apporte, d'après ses exercices et ce qu'il cible, sa durée et son intensité. */
function trainingWork(l: TrainingLog): W {
  const focuses: Focus[] = [];
  let targets: string[] = [];
  const exercise = (id: string) => {
    const x = exerciseById(id);
    if (x) focuses.push(x.focus);
  };
  if (l.kind === 'exercise') exercise(l.ref);
  else if (l.kind === 'routine') findRoutine(l.ref)?.items.forEach(exercise);
  else {
    const session = sessionById(l.ref);
    session?.steps.forEach((st) => st.kind === 'exercise' && exercise(st.id));
    targets = (session?.targets ?? []).filter((t) => TAGS[t]);
  }
  const w: W = { mental: 0.15 };
  focuses.forEach((f) => addTo(w, FOCUS_W[f], 1 / focuses.length));
  targets.forEach((t) => addTo(w, TAGS[t], 0.5 / targets.length));
  const k = 1.5 * clamp((l.minutes || 15) / 20, 0.3, 2) * (0.7 + 0.15 * clamp(l.intensity || 2, 1, 3));
  for (const id of IDS) if (w[id]) w[id] = (w[id] ?? 0) * k;
  return w;
}

/* ---------- La carte ---------- */

const DAY = 86_400_000;
const days = (from: string, to: string) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY;

export type PlayerCard = {
  /** Valeurs exactes : la carte affiche la partie entière, la barre ce qui manque pour le point suivant. */
  overall: number;
  stats: Record<StatId, number>;
  tier: Tier;
  /** Bloc ou voie : la discipline la plus grimpée ces trois derniers mois. */
  position: 'BLOC' | 'VOIE';
  playstyle: string;
  /** Prochain palier de carte, s'il y en a un. */
  next: { name: string; missing: number } | null;
  /** Aucune grimpe ni entraînement noté. */
  empty: boolean;
};

/** La carte telle qu'elle était le jour `on` (AAAA-MM-JJ), avec ce qui était noté jusque-là. */
export function playerCard(allBlocks: Block[], allLogs: TrainingLog[], on: string): PlayerCard {
  const blocks = allBlocks.filter((b) => b.date <= on);
  const logs = allLogs.filter((l) => l.date <= on);

  // Niveau : moyenne des 5 meilleures réussites, les plus anciennes comptant un peu moins.
  const effective = (b: Block) => {
    const r = gradeRating(b.grade, b.gradeSystem);
    if (r === null || !isSent(b.result)) return null;
    return r + (isFirstTry(b.result) ? 1 : 0) - clamp((days(b.date, on) - 45) / 30, 0, 12);
  };
  const topMean = (values: number[], n: number) => {
    const top = [...values].sort((a, b) => b - a).slice(0, n);
    return top.reduce((a, b) => a + b, 0) / top.length - (n - top.length) * 1.5;
  };
  const sends = blocks.map((b) => ({ b, r: effective(b) })).filter((x): x is { b: Block; r: number } => x.r !== null);
  const level = sends.length ? topMean(sends.map((x) => x.r), 5) : null;

  // Pratique : tout ce qui a été grimpé et travaillé, qui s'efface doucement avec le temps.
  const practice: Record<StatId, number> = { force: 0, doigts: 0, technique: 0, endurance: 0, souplesse: 0, mental: 0 };
  const fade = (date: string) => 0.5 ** (Math.max(0, days(date, on)) / HALF_LIFE);
  const add = (w: W, date: string) => {
    const f = fade(date);
    for (const id of IDS) practice[id] += (w[id] ?? 0) * f;
  };
  // Seules les séances validées (5 grimpes ou plus) font progresser ; les réussites comptent toujours dans le niveau.
  const valid = validatedDays(blocks);
  const counted = blocks.filter((b) => valid.has(b.date));
  counted.forEach((b) => add(climbWork(b, level), b.date));
  // Chaque séance : venir grimper (mental), et beaucoup de grimpes d'affilée (endurance).
  const perDay = new Map<string, number>();
  counted.forEach((b) => perDay.set(b.date, (perDay.get(b.date) ?? 0) + 1));
  perDay.forEach((n, date) => add({ mental: 0.15, endurance: 0.12 * Math.max(0, n - 4) }, date));
  logs.forEach((l) => add(trainingWork(l), l.date));

  const stats = {} as Record<StatId, number>;
  for (const id of IDS) {
    // Niveau dans ce que mesure la stat : les meilleures réussites qui la travaillent vraiment.
    let base = 38;
    if (level !== null) {
      const own = sends.filter((x) => (climbWork(x.b, null)[id] ?? 0) >= 0.45).map((x) => x.r);
      const n = Math.min(own.length, 5);
      const special = n ? (topMean(own, Math.min(3, own.length)) * n + level * 2) / (n + 2) : level - 3;
      base = 0.6 * level + 0.4 * special - 4;
    }
    const bonus = PRACTICE_MAX * (1 - Math.exp(-practice[id] / TAU[id]));
    stats[id] = clamp(base + bonus, 30, 99.9);
  }
  const overall = IDS.reduce((a, id) => a + stats[id] * OVERALL[id], 0);
  const tierIndex = TIERS.reduce((t, x, i) => (Math.floor(overall) >= x.from ? i : t), 0);
  const next = TIERS[tierIndex + 1];
  const best = IDS.reduce((a, id) => (stats[id] > stats[a] ? id : a), IDS[0]);
  const recent = blocks.filter((b) => days(b.date, on) <= 90);
  const routes = recent.filter((b) => b.discipline === 'voie').length;
  return {
    overall,
    stats,
    tier: TIERS[tierIndex].id,
    position: routes > recent.length - routes ? 'VOIE' : 'BLOC',
    playstyle: PLAYSTYLE[best],
    next: next ? { name: next.name, missing: next.from - Math.floor(overall) } : null,
    empty: blocks.length === 0 && logs.length === 0,
  };
}

/** La carte d'aujourd'hui, et celles d'il y a 7 et 30 jours pour montrer ce qui a bougé. */
export function cardTrend(blocks: Block[], logs: TrainingLog[], today: string) {
  const ago = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) - n * DAY).toISOString().slice(0, 10);
  return { card: playerCard(blocks, logs, today), week: playerCard(blocks, logs, ago(7)), month: playerCard(blocks, logs, ago(30)) };
}
