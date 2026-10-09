/**
 * Moteur du jeu MyClimb Manager : club, grimpeurs, entraînement (qui continue app fermée),
 * compétitions en combiné bloc + difficulté, ligues et packs. Tout est sauvegardé dans un réglage
 * (donc aussi dans la sauvegarde Google Drive).
 */
import type { AndroidSymbol } from 'expo-symbols';

import { getSetting, setSetting } from './db';
import { BLOCKS, COUNTRIES, LEGENDS, MSTATS, RIVAL_CLUBS, SKILLS, STYLES, type BlockType, type LegendCond, type MStat, type SkillId, type StyleId } from './managerData';
import { SKINS, type SkinId } from './skins';

/* ---------- Types ---------- */

export type Tier = 'bronze' | 'argent' | 'or' | 'legende';
export type Program = MStat | 'repos';
export type ItemKind = 'materiel' | 'boost' | 'coach' | 'sponsor' | 'competence';

export type Climber = {
  id: string;
  first: string;
  last: string;
  flag: string;
  style: StyleId;
  skin: SkinId;
  bio: string;
  stats: Record<MStat, number>;
  /** Plafond des stats : il monte avec l'expérience. */
  potential: number;
  skills: SkillId[];
  /** 0 = en forme, 100 = épuisé. */
  fatigue: number;
  xp: number;
  program: Program | null;
  /** Matériel porté (2 au plus). */
  gear: string[];
  joined: number;
  comps: number;
  tops: number;
};

export type Item = {
  id: string;
  kind: ItemKind;
  name: string;
  /** 1 à 4 : plus c'est haut, plus c'est rare. */
  level: number;
  stat?: MStat;
  value: number;
  skill?: SkillId;
};

export type RivalClimber = { name: string; flag: string; skin: SkinId; stats: Record<MStat, number>; skills: SkillId[] };
export type Rival = { id: string; name: string; color: string; strength: number; climbers: RivalClimber[]; nemesis?: boolean };

/** Événement aléatoire avant une manche : parfois un choix à faire. */
export type EventKind = 'interview' | 'malade' | 'stage' | 'chaleur' | 'ouvreur' | 'public' | 'transfert' | 'agent' | 'blessure';
export type GameEvent = {
  kind: EventKind;
  icon: AndroidSymbol;
  title: string;
  text: string;
  choices: string[];
  climberId?: string;
  stat?: MStat;
  amount?: number;
  recruit?: Climber;
  /** Choix fait (index), absent tant que le joueur n'a pas répondu. */
  done?: number;
};

export type GoalId = 'tops' | 'podiums' | 'wins' | 'flash' | 'nemesis' | 'voie';
export type Contract = { sponsor: string; goal: GoalId; target: number; reward: number; progress: number; done: boolean };
export type Cup = { round: number; out: boolean; won: boolean; opps: Rival[]; next?: CompEvent[] };
export type News = { t: number; icon: AndroidSymbol; text: string };

export type PackKind = 'bienvenue' | 'bronze' | 'argent' | 'or' | 'recompense';

export type Club = {
  v: 1 | 2;
  name: string;
  colors: [string, string];
  created: number;
  coins: number;
  climbers: Climber[];
  items: Item[];
  league: 0 | 1 | 2;
  season: {
    n: number;
    round: number;
    points: Record<string, number>;
    rivals: Rival[];
    next?: CompEvent[];
    event?: GameEvent;
    cup?: Cup;
    offers?: Contract[];
    contract?: Contract;
  };
  energy: { day: string; used: number };
  daily: { last: string; streak: number };
  packs: PackKind[];
  lastTick: number;
  history: { date: string; rank: number; total: number; league: number }[];
  best: { rank: number; league: number };
  news?: News[];
  legends?: string[];
  contracts?: number;
  trophies?: { titles: number; cups: number };
};

/* ---------- Réglages du jeu ---------- */

export const LEAGUES = [
  { name: 'Ligue régionale', short: 'Régionale', base: 59, color: '#43A047', reward: 1 },
  { name: 'Ligue nationale', short: 'Nationale', base: 69, color: '#1E88E5', reward: 1.6 },
  { name: 'Coupe du monde', short: 'Coupe du monde', base: 80, color: '#E9A100', reward: 2.4 },
] as const;
export const ROUNDS = 10;
export const ENERGY_PER_DAY = 10;
export const MAX_CLIMBERS = 12;
export const TEAM_SIZE = 4;
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const PRIZE = [450, 350, 280, 230, 195, 165, 140, 120, 105, 95];

export const PACKS: Record<PackKind, { name: string; price: number; cards: number; color: string; text: string }> = {
  bienvenue: { name: 'Pack de bienvenue', price: 0, cards: 5, color: '#E8642C', text: 'Un grimpeur argent garanti' },
  bronze: { name: 'Pack bronze', price: 1000, cards: 4, color: '#B87333', text: '4 cartes, un grimpeur garanti' },
  argent: { name: 'Pack argent', price: 3000, cards: 4, color: '#9AA6B2', text: 'Un grimpeur argent ou mieux' },
  or: { name: 'Pack or', price: 8000, cards: 5, color: '#E9A100', text: 'Un grimpeur or garanti, légende possible' },
  recompense: { name: 'Pack récompense', price: 0, cards: 4, color: '#9B45E4', text: 'Gagné en fin de saison' },
};

export const PROGRAMS: { id: Program; name: string }[] = [...MSTATS.map((s) => ({ id: s.id as Program, name: s.name })), { id: 'repos', name: 'Repos' }];

/* ---------- Outils ---------- */

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const uid = () => Math.random().toString(36).slice(2, 10);
export const dayOf = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ---------- Grimpeurs ---------- */

export function rating(stats: Record<MStat, number>, style: StyleId) {
  const st = STYLES[style];
  let sum = 0;
  let w = 0;
  for (const s of MSTATS) {
    const k = st.strong.includes(s.id) ? 1.6 : st.weak.includes(s.id) ? 0.6 : 1;
    sum += stats[s.id] * k;
    w += k;
  }
  return Math.round(sum / w);
}
export const ratingOf = (c: Climber) => rating(c.stats, c.style);
export const tierOf = (r: number): Tier => (r >= 85 ? 'legende' : r >= 75 ? 'or' : r >= 65 ? 'argent' : 'bronze');
export const TIER_NAMES: Record<Tier, string> = { bronze: 'Bronze', argent: 'Argent', or: 'Or', legende: 'Légende' };
export const nameOf = (c: { first: string; last: string }) => `${c.first} ${c.last}`;

const PLAYABLE_SKINS = SKINS.map((s) => s.id);

function makeStats(target: number, style: StyleId) {
  const st = STYLES[style];
  const stats = {} as Record<MStat, number>;
  for (const s of MSTATS) {
    const bias = st.strong.includes(s.id) ? rnd(5, 10) : st.weak.includes(s.id) ? -rnd(6, 11) : rnd(-3, 3);
    stats[s.id] = target + bias;
  }
  // Recale pour tomber sur la note visée.
  const diff = target - rating(stats, style);
  for (const s of MSTATS) stats[s.id] = clamp(Math.round(stats[s.id] + diff), 25, 99);
  return stats;
}

export function makeClimber(target: number, style?: StyleId): Climber {
  const c = pick(COUNTRIES);
  const sty = style ?? pick(Object.keys(STYLES) as StyleId[]);
  const stats = makeStats(target, sty);
  const r = rating(stats, sty);
  const skills: SkillId[] = [];
  const allSkills = Object.keys(SKILLS) as SkillId[];
  const nSkills = r >= 85 ? 2 : r >= 74 ? 1 : Math.random() < 0.25 ? 1 : 0;
  while (skills.length < nSkills) {
    const k = pick(allSkills);
    if (!skills.includes(k)) skills.push(k);
  }
  return {
    id: uid(),
    first: pick(c.first),
    last: pick(c.last),
    flag: c.flag,
    style: sty,
    skin: pick(PLAYABLE_SKINS),
    bio: pick(STYLES[sty].bios),
    stats,
    potential: clamp(Math.round(r + (sty === 'prodige' ? rnd(10, 18) : rnd(3, 11))), r + 2, 99),
    skills,
    fatigue: 0,
    xp: 0,
    program: null,
    gear: [],
    joined: Date.now(),
    comps: 0,
    tops: 0,
  };
}

/** Stat effective : base + matériel porté. */
export function statWithGear(club: Club, c: Climber, s: MStat) {
  let v = c.stats[s];
  for (const id of c.gear) {
    const it = club.items.find((i) => i.id === id);
    if (it?.kind === 'materiel' && it.stat === s) v += it.value;
  }
  return v;
}

/** Prix de vente d'un grimpeur. */
export const sellPrice = (c: Climber) => Math.round(((ratingOf(c) - 40) ** 2 * 1.6) / 10) * 10;

/* ---------- Rivaux et saisons ---------- */

const RIVAL_COLORS = ['#E53935', '#8E24AA', '#3949AB', '#00897B', '#F4511E', '#6D4C41', '#546E7A', '#C0CA33', '#D81B60'];
/** Les rivaux de toutes les ligues progressent de saison en saison. */
export const seasonLift = (n: number) => Math.min(5, (n - 1) * 0.8);
/** Nombre de rivaux classiques (le némésis en plus). */
const RIVALS = 8;

function rivalClimbers(strength: number): RivalClimber[] {
  return Array.from({ length: TEAM_SIZE }, () => {
    const m = makeClimber(Math.round(strength + rnd(-3, 3)));
    return { name: nameOf(m), flag: m.flag, skin: m.skin, stats: m.stats, skills: m.skills };
  });
}

function makeRival(strength: number, name: string, i: number): Rival {
  return { id: `r${i}-${uid()}`, name, color: RIVAL_COLORS[i % RIVAL_COLORS.length], strength, climbers: rivalClimbers(strength) };
}

const usedNames = (club: Club | null) => new Set([...(club?.season.rivals.map((r) => r.name) ?? []), club?.name]);

function makeRivals(league: number, lift: number, avoid = new Set<string | undefined>()): Rival[] {
  const names = RIVAL_CLUBS.filter((n) => !avoid.has(n)).sort(() => Math.random() - 0.5);
  const base = LEAGUES[league].base + lift;
  // Du plus faible au plus fort : le haut du classement est vraiment dur à aller chercher.
  return Array.from({ length: RIVALS }, (_, i) => makeRival(base - 5 + (i / (RIVALS - 1)) * 10 + rnd(-1.5, 1.5), names[i], i));
}

/** Monte (ou baisse) le niveau d'un rival en gardant ses grimpeurs. */
function shiftRival(rv: Rival, delta: number) {
  rv.strength += delta;
  for (const c of rv.climbers) for (const s of MSTATS) c.stats[s.id] = clamp(Math.round(c.stats[s.id] + delta), 25, 99);
}

/** Le némésis : toujours un peu au-dessus de ton équipe, il te suit de ligue en ligue. */
function nemesisStrength(club: Club, league: number, lift: number) {
  const base = LEAGUES[league].base + lift;
  return clamp(avgTeam(club) + 2, base + 6, base + 12);
}

function makeNemesis(club: Club, league: number, lift: number): Rival {
  const name = RIVAL_CLUBS.filter((n) => !usedNames(club).has(n))[0] ?? 'Les Invincibles';
  return { ...makeRival(nemesisStrength(club, league, lift), name, 8), color: '#111111', nemesis: true };
}

/** Une équipe rivale recrute une star : elle devient plus forte. */
function signStar(club: Club, rivals: Rival[]) {
  const rv = Math.random() < 0.3 ? (rivals.find((r) => r.nemesis) ?? pick(rivals)) : pick(rivals.filter((r) => !r.nemesis));
  const star = makeClimber(Math.round(rv.strength + rnd(6, 10)));
  const k = rv.climbers.reduce((m, c, i, a) => (rating(c.stats, 'technicien') < rating(a[m].stats, 'technicien') ? i : m), 0);
  rv.climbers[k] = { name: nameOf(star), flag: star.flag, skin: star.skin, stats: star.stats, skills: star.skills };
  rv.strength += 2.5;
  addNews(club, 'star', `${rv.name} recrute la star ${star.flag} ${nameOf(star)} (${ratingOf(star)}).`);
}

export function addNews(club: Club, icon: AndroidSymbol, text: string) {
  club.news = [{ t: Date.now(), icon, text }, ...(club.news ?? [])].slice(0, 12);
}

function newSeason(club: Club | null, league: 0 | 1 | 2, n: number): Club['season'] {
  const lift = seasonLift(n);
  const prev = club?.season;
  let rivals: Rival[];
  if (club && prev && club.league === league && prev.rivals.length) {
    // Même ligue : les rivaux restent, progressent, et les 2 plus faibles laissent la place.
    // Même ligue : les rivaux restent et progressent avec le niveau général ; les 2 plus faibles laissent la place.
    rivals = prev.rivals.filter((r) => !r.nemesis).sort((a, b) => a.strength - b.strength);
    const fresh = makeRivals(league, lift, usedNames(club));
    rivals.splice(0, 2, fresh[1], fresh[6]);
    rivals.sort((a, b) => a.strength - b.strength).forEach((r, i) => shiftRival(r, fresh[i].strength - r.strength));
  } else rivals = makeRivals(league, lift, usedNames(club));
  if (club) {
    const old = prev?.rivals.find((r) => r.nemesis);
    const target = nemesisStrength(club, league, lift);
    if (old) {
      shiftRival(old, target - old.strength);
      rivals.push(old);
    } else rivals.push(makeNemesis(club, league, lift));
    signStar(club, rivals);
  }
  const season: Club['season'] = { n, round: 0, points: Object.fromEntries([['me', 0], ...rivals.map((r) => [r.id, 0])]), rivals };
  season.cup = makeCup(league, lift);
  season.offers = makeOffers(league, rivals.find((r) => r.nemesis)?.name);
  return season;
}

/* ---------- Sauvegarde ---------- */

const KEY = 'manager';
const listeners = new Set<() => void>();
export const onManagerChange = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function loadClub(): Club | null {
  try {
    const raw = getSetting(KEY);
    if (!raw) return null;
    const club = JSON.parse(raw) as Club;
    if (club.v !== 2) migrate(club);
    return club;
  } catch {
    return null;
  }
}

export function saveClub(c: Club) {
  setSetting(KEY, JSON.stringify(c));
  listeners.forEach((l) => l());
}

/** Anciennes sauvegardes : rivaux remis au nouveau niveau, némésis, coupe, sponsors. */
function migrate(club: Club) {
  const lift = seasonLift(club.season.n);
  const base = LEAGUES[club.league].base + lift;
  const sorted = [...club.season.rivals].sort((a, b) => a.strength - b.strength);
  sorted.forEach((r, i) => shiftRival(r, base - 5 + (i / Math.max(1, sorted.length - 1)) * 10 - r.strength));
  const top = sorted[sorted.length - 1];
  if (top) {
    top.nemesis = true;
    top.color = '#111111';
    shiftRival(top, nemesisStrength(club, club.league, lift) - top.strength);
  }
  club.season.cup = makeCup(club.league, lift);
  club.season.offers = makeOffers(club.league, top?.name);
  club.legends = [];
  club.contracts = 0;
  club.trophies = { titles: 0, cups: 0 };
  club.v = 2;
  addNews(club, 'local_fire_department', `Nouveau : ${top?.name ?? 'un club'} devient ton némésis. Il te suivra de ligue en ligue.`);
  if (club.league >= 1) unlockLegends(club, ['montee']);
  if (club.league >= 2) unlockLegends(club, ['monde']);
  setSetting(KEY, JSON.stringify(club));
}

export function createClub(name: string, colors: [string, string]): Club {
  const club: Club = {
    v: 2,
    name: name.trim() || 'MyClimb Club',
    colors,
    created: Date.now(),
    coins: 600,
    climbers: [makeClimber(Math.round(rnd(56, 59)), 'puissant'), makeClimber(Math.round(rnd(56, 59)), 'technicien'), makeClimber(Math.round(rnd(55, 58)), 'endurant')],
    items: [],
    league: 0,
    season: { n: 1, round: 0, points: {}, rivals: [] },
    energy: { day: dayOf(), used: 0 },
    daily: { last: '', streak: 0 },
    packs: ['bienvenue'],
    lastTick: Date.now(),
    history: [],
    best: { rank: 10, league: 0 },
    news: [],
    legends: [],
    contracts: 0,
    trophies: { titles: 0, cups: 0 },
  };
  club.season = newSeason(club, 0, 1);
  saveClub(club);
  return club;
}

/* ---------- Entraînement (continue app fermée) ---------- */

export const trainSpeed = (club: Club, s: MStat) => 1 + club.items.filter((i) => i.kind === 'coach' && i.stat === s).reduce((a, i) => a + i.value / 100, 0);

/** Fait avancer l'entraînement jusqu'à maintenant. Renvoie les progrès de chaque grimpeur. */
export function tick(club: Club, now = Date.now()) {
  const hours = clamp((now - club.lastTick) / 3.6e6, 0, 24);
  const gains: Record<string, number> = {};
  if (hours < 0.01) return gains;
  for (const c of club.climbers) {
    if (c.program && c.program !== 'repos') {
      const s = c.program;
      const room = clamp((c.potential - c.stats[s]) / Math.max(1, c.potential - 30), 0, 1);
      // Fatigué, on progresse à peine : il faut faire tourner l'équipe.
      const tired = c.fatigue >= 80 ? 0.2 : 1;
      const g = hours * 0.3 * trainSpeed(club, s) * room ** 1.4 * tired;
      const before = Math.floor(c.stats[s]);
      c.stats[s] = Math.min(c.potential, c.stats[s] + g);
      gains[c.id] = (gains[c.id] ?? 0) + Math.floor(c.stats[s]) - before;
      c.fatigue = clamp(c.fatigue + hours * 1.2, 0, 100);
    } else {
      c.fatigue = clamp(c.fatigue - hours * (c.program === 'repos' ? 25 : 12), 0, 100);
    }
  }
  club.lastTick = now;
  return gains;
}

/* ---------- Énergie et récompense du jour ---------- */

export function energyLeft(club: Club) {
  return club.energy.day === dayOf() ? ENERGY_PER_DAY - club.energy.used : ENERGY_PER_DAY;
}

export const canClaimDaily = (club: Club) => club.daily.last !== dayOf();

export function claimDaily(club: Club) {
  if (!canClaimDaily(club)) return null;
  const yesterday = dayOf(Date.now() - 86400000);
  const streak = club.daily.last === yesterday ? club.daily.streak + 1 : 1;
  const coins = 150 + Math.min(streak, 7) * 50;
  club.coins += coins;
  const pack = streak % 7 === 0;
  if (pack) club.packs.push('argent');
  club.daily = { last: dayOf(), streak };
  return { coins, streak, pack };
}

/* ---------- Compétition ---------- */

/** Une épreuve : 3 blocs puis une voie. Un grimpeur par épreuve. */
export type CompEvent = { kind: 'bloc' | 'voie'; type: BlockType | null; difficulty: number };
export type Lineup = (string | null)[];
export type EventRow = { name: string; flag: string; skin: SkinId; club: string; mine: boolean; id?: string; top: boolean; zone: boolean; tries: number; height: number; points: number };
export type Moment = { text: string; climber: string; skin: SkinId; kind: 'flash' | 'top' | 'chute' | 'record' };
export type Roll = { teamId: string; name: string; flag: string; skin: SkinId; club: string; mine: boolean; id?: string; perf: number; eff: number };
export type Mode = 'ligue' | 'coupe';
export type Team = { id: string; name: string; color: string; nemesis?: boolean };
export type Draft = { mode: Mode; events: CompEvent[]; rolls: Roll[][]; boost: number; lineup: Lineup; teams: Team[] };
export type CompResult = {
  events: CompEvent[];
  rows: EventRow[][];
  mode: Mode;
  teams: { id: string; name: string; color: string; total: number; mine: boolean; nemesis?: boolean; perEvent: number[] }[];
  lines: { event: number; name: string; skin: SkinId; text: string; good: boolean }[];
  rank: number;
  coins: number;
  xp: number;
  moments: Moment[];
  seasonEnd?: { rank: number; up: boolean; down: boolean; pack: PackKind | null; coins: number };
  cup?: { win: boolean; stage: string; champion: boolean; opp: string };
  contract?: { text: string; reward: number };
  /** Légendes débloquées par cette manche. */
  legends: string[];
  /** Nouvelles du championnat (stars recrutées…). */
  news: string[];
};

export const EVENTS = 4;
/** Écart type du hasard sur une épreuve. */
const SPREAD = 5;
/** Malus quand un grimpeur enchaîne une 2ᵉ épreuve. */
const DOUBLE = 6;

const normal = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
// Fonction de répartition de la loi normale (approximation d'Abramowitz-Stegun).
function phi(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export function eventName(e: CompEvent) {
  return e.kind === 'voie' ? 'Voie' : BLOCKS[e.type!].name;
}

/** Stats utiles pour une épreuve. */
export function eventStats(e: CompEvent): MStat[] {
  return e.kind === 'voie' ? ['endurance', 'doigts', 'mental', 'technique'] : BLOCKS[e.type!].stats;
}

type Athlete = { stats: Record<MStat, number>; skills: SkillId[]; fatigue: number };

function effOf(a: Athlete, e: CompEvent, boost: number, double: boolean) {
  let eff: number;
  if (e.kind === 'voie') {
    eff = (a.stats.endurance * 2 + a.stats.doigts + a.stats.mental + a.stats.technique) / 5;
    if (a.skills.includes('lolotte')) eff += 5;
  } else {
    const b = BLOCKS[e.type!];
    eff = b.stats.reduce((s, k) => s + a.stats[k], 0) / b.stats.length;
    if (a.skills.includes(b.skill)) eff += 8;
    if (a.skills.includes('lecture')) eff += 3;
  }
  return eff + (a.stats.mental - 60) * 0.08 + boost - Math.max(0, a.fatigue - 45) * 0.3 - (double ? DOUBLE : 0);
}

function athleteOf(club: Club, c: Climber): Athlete {
  return { stats: Object.fromEntries(MSTATS.map((s) => [s.id, statWithGear(club, c, s.id)])) as Record<MStat, number>, skills: c.skills, fatigue: c.fatigue };
}

/* ---------- Événements, sponsors, coupe, légendes ---------- */

export const CUP_STAGES = ['Quart de finale', 'Demi-finale', 'Finale'];
/** Manche de ligue après laquelle chaque tour de coupe se débloque. */
export const CUP_AFTER = [2, 5, 8];
const CUP_PRIZE = [400, 700, 1500];

function makeCup(league: number, lift: number): Cup {
  const base = LEAGUES[league].base + lift;
  const names = [...RIVAL_CLUBS].sort(() => Math.random() - 0.5);
  return { round: 0, out: false, won: false, opps: [3, 7, 11].map((d, i) => makeRival(base + d + rnd(-1, 1), names[i], i + 3)) };
}

export type CupStatus = { available: boolean; text: string; stage?: string; opp?: Rival };
export function cupStatus(club: Club): CupStatus {
  const cup = club.season.cup;
  if (!cup) return { available: false, text: 'Pas de coupe cette saison' };
  if (cup.won) return { available: false, text: 'Coupe gagnée !' };
  if (cup.out) return { available: false, text: `Éliminé en ${CUP_STAGES[cup.round].toLowerCase()}` };
  const ready = club.season.round >= CUP_AFTER[cup.round];
  const stage = CUP_STAGES[cup.round];
  const opp = cup.opps[cup.round];
  return { available: ready, stage, opp, text: ready ? `${stage} contre ${opp.name}` : `${stage} après la manche ${CUP_AFTER[cup.round]}` };
}

const GOALS: Record<GoalId, { text: (n: number, nem?: string) => string; range: [number, number]; worth: number }> = {
  tops: { text: (n) => `Réussir ${n} tops dans la saison`, range: [12, 18], worth: 1 },
  podiums: { text: (n) => `Finir ${n} fois sur le podium`, range: [2, 4], worth: 1.1 },
  wins: { text: (n) => `Gagner ${n} manche${n > 1 ? 's' : ''}`, range: [1, 2], worth: 1.2 },
  flash: { text: (n) => `Flasher ${n} blocs`, range: [4, 7], worth: 1 },
  nemesis: { text: (n, nem) => `Finir ${n} fois devant ${nem ?? 'ton némésis'}`, range: [3, 5], worth: 1.2 },
  voie: { text: (n) => `Sortir la voie ${n} fois`, range: [3, 5], worth: 1 },
};

export function contractText(c: Contract, club: Club) {
  return GOALS[c.goal].text(c.target, club.season.rivals.find((r) => r.nemesis)?.name);
}

function makeOffers(league: number, nem?: string): Contract[] {
  const goals = (Object.keys(GOALS) as GoalId[]).filter((g) => g !== 'nemesis' || nem).sort(() => Math.random() - 0.5).slice(0, 3);
  const sponsors = [...SPONSORS].sort(() => Math.random() - 0.5);
  return goals.map((goal, i) => {
    const [lo, hi] = GOALS[goal].range;
    const target = Math.round(rnd(lo, hi));
    const frac = (target - lo) / Math.max(1, hi - lo);
    const reward = Math.round((1200 * GOALS[goal].worth * LEAGUES[league].reward * (0.8 + frac * 0.5)) / 50) * 50;
    return { sponsor: sponsors[i], goal, target, reward, progress: 0, done: false };
  });
}

export function chooseContract(club: Club, i: number) {
  const offer = club.season.offers?.[i];
  if (!offer) return;
  club.season.contract = offer;
  club.season.offers = undefined;
  saveClub(club);
}

function makeEvent(club: Club, events: CompEvent[]): GameEvent | undefined {
  if (club.season.n === 1 && club.season.round === 0) return undefined;
  if (Math.random() > 0.45) return undefined;
  const L = LEAGUES[club.league];
  const cl = [...club.climbers].sort((a, b) => ratingOf(b) - ratingOf(a));
  const best = cl[0];
  const any = pick(cl);
  const nem = club.season.rivals.find((r) => r.nemesis);
  const kinds: EventKind[] = ['interview', 'malade', 'stage', 'chaleur', 'ouvreur', 'public'];
  if (cl.length > EVENTS + 1) kinds.push('transfert');
  if (cl.length < MAX_CLIMBERS) kinds.push('agent');
  if (nem) kinds.push('blessure');
  const kind = pick(kinds);
  const money = (v: number) => Math.round((v * L.reward) / 10) * 10;
  switch (kind) {
    case 'interview': {
      const amount = money(250);
      return { kind, icon: 'mic', title: 'Interview télé', text: `Une chaîne veut interviewer ${nameOf(best)} juste avant la manche. Ça rapporte ${amount} pièces mais ça le fatigue (+20).`, choices: [`Accepter (+${amount} pièces)`, 'Refuser'], climberId: best.id, amount };
    }
    case 'malade':
      return { kind, icon: 'sick', title: 'Coup de froid', text: `${nameOf(any)} a attrapé un rhume : +35 de fatigue.`, choices: ['Compris'], climberId: any.id, amount: 35 };
    case 'stage': {
      const stat = pick(MSTATS);
      const amount = money(300);
      return { kind, icon: 'school', title: 'Stage express', text: `Un coach propose un stage ${stat.name} à ${nameOf(any)} : +2 ${stat.name} tout de suite, mais +15 de fatigue.`, choices: [`Payer ${amount} pièces`, 'Non merci'], climberId: any.id, stat: stat.id, amount };
    }
    case 'chaleur':
      events[3].difficulty += 3;
      return { kind, icon: 'thermostat', title: 'Canicule', text: 'Il fait très chaud dans la salle : les prises glissent, la voie est plus dure (+3).', choices: ['Compris'] };
    case 'ouvreur': {
      const i = Math.floor(Math.random() * 3);
      events[i].difficulty += 4;
      return { kind, icon: 'construction', title: 'Ouvreur sadique', text: `Le bloc ${eventName(events[i])} a été durci (+4).`, choices: ['Compris'] };
    }
    case 'public':
      return { kind, icon: 'groups', title: 'Public en feu', text: 'Tes supporters ont fait le déplacement : +2 pour tous tes grimpeurs pendant cette manche.', choices: ['Super !'], amount: 2 };
    case 'transfert': {
      const c = pick(cl.slice(1));
      const amount = Math.round((sellPrice(c) * 1.6) / 10) * 10;
      const buyer = pick(club.season.rivals.filter((r) => !r.nemesis)).name;
      return { kind, icon: 'swap_horiz', title: 'Offre de transfert', text: `${buyer} propose ${amount} pièces pour ${nameOf(c)} (${ratingOf(c)}).`, choices: [`Vendre (+${amount})`, 'Garder'], climberId: c.id, amount };
    }
    case 'agent': {
      const r = makeClimber(Math.round(clamp(avgTeam(club) + rnd(1, 5), 50, 84)));
      const amount = Math.round((sellPrice(r) * 1.3) / 10) * 10;
      return { kind, icon: 'person_add', title: 'Agent libre', text: `${r.flag} ${nameOf(r)} (${ratingOf(r)}, ${STYLES[r.style].name.toLowerCase()}) cherche un club.`, choices: [`Recruter (${amount} pièces)`, 'Non merci'], recruit: r, amount };
    }
    case 'blessure':
      return { kind, icon: 'healing', title: 'Coup dur chez le némésis', text: `La star de ${nem!.name} s’est tordu la cheville : son équipe sera moins forte à cette manche.`, choices: ['Bonne nouvelle'], amount: 5 };
  }
}

/** Répond à l'événement de la manche. Renvoie un message si le choix est impossible. */
export function resolveEvent(club: Club, choice: number): string | null {
  const e = club.season.event;
  if (!e || e.done !== undefined) return null;
  const c = club.climbers.find((x) => x.id === e.climberId);
  const amount = e.amount ?? 0;
  if (choice === 0) {
    if (e.kind === 'interview' && c) {
      club.coins += amount;
      c.fatigue = clamp(c.fatigue + 20, 0, 100);
    } else if (e.kind === 'malade' && c) c.fatigue = clamp(c.fatigue + amount, 0, 100);
    else if (e.kind === 'stage' && c && e.stat) {
      if (club.coins < amount) return 'Pas assez de pièces.';
      club.coins -= amount;
      c.stats[e.stat] = Math.min(99, c.stats[e.stat] + 2);
      c.potential = Math.max(c.potential, Math.ceil(c.stats[e.stat]));
      c.fatigue = clamp(c.fatigue + 15, 0, 100);
    } else if (e.kind === 'transfert' && c && club.climbers.length > EVENTS) {
      club.coins += amount;
      club.climbers = club.climbers.filter((x) => x.id !== c.id);
      addNews(club, 'swap_horiz', `${nameOf(c)} est vendu pour ${amount} pièces.`);
    } else if (e.kind === 'agent' && e.recruit) {
      if (club.coins < amount) return 'Pas assez de pièces.';
      if (club.climbers.length >= MAX_CLIMBERS) return 'Ton équipe est complète.';
      club.coins -= amount;
      club.climbers.push({ ...e.recruit, joined: Date.now() });
      addNews(club, 'person_add', `${nameOf(e.recruit)} rejoint ton club.`);
    }
  }
  e.done = choice;
  saveClub(club);
  return null;
}

/** Bonus de l'événement en cours pour mes grimpeurs. */
const eventBoost = (club: Club, mode: Mode) => (mode === 'ligue' && club.season.event?.kind === 'public' ? (club.season.event.amount ?? 0) : 0);

function unlockLegends(club: Club, conds: LegendCond[]) {
  const got: string[] = [];
  for (const L of LEGENDS) {
    if (!conds.includes(L.cond) || club.legends?.includes(L.id)) continue;
    const c = makeClimber(L.rating, L.style);
    Object.assign(c, { first: L.first, last: L.last, flag: L.flag, skin: L.skin, bio: L.bio, potential: Math.min(99, L.rating + 5) });
    club.climbers.push(c);
    club.legends = [...(club.legends ?? []), L.id];
    addNews(club, 'auto_awesome', `Légende débloquée : ${L.first} ${L.last} rejoint ton club !`);
    got.push(`${L.first} ${L.last}`);
  }
  return got;
}

/* ---------- Manches ---------- */

/** Les épreuves de la prochaine manche (ligue ou coupe), connues à l'avance. */
export function upcoming(club: Club, mode: Mode = 'ligue'): CompEvent[] {
  const cup = club.season.cup;
  const stored = mode === 'coupe' ? cup?.next : club.season.next;
  if (stored?.length === EVENTS) return stored;
  const base = LEAGUES[club.league].base + seasonLift(club.season.n) * 0.5 + club.season.round * 0.6 + (mode === 'coupe' ? 2 + (cup?.round ?? 0) * 2 : 0);
  const types = (Object.keys(BLOCKS) as BlockType[]).sort(() => Math.random() - 0.5).slice(0, 3);
  const events: CompEvent[] = types.map((type, i) => ({ kind: 'bloc', type, difficulty: Math.round(base + i * 2.5 + rnd(-2, 3)) }));
  events.push({ kind: 'voie', type: null, difficulty: Math.round(base + 1 + rnd(-1, 2)) });
  if (mode === 'coupe' && cup) cup.next = events;
  else {
    club.season.next = events;
    club.season.event = makeEvent(club, events);
  }
  saveClub(club);
  return events;
}

/** Chance de réussir (top) une épreuve, de 0 à 1. */
export function chanceOf(club: Club, id: string, event: number, lineup: Lineup, boost = 0, mode: Mode = 'ligue') {
  const c = club.climbers.find((x) => x.id === id);
  if (!c) return 0;
  const e = upcoming(club, mode)[event];
  const double = lineup.findIndex((x) => x === id) !== event && lineup.includes(id);
  return phi((effOf(athleteOf(club, c), e, boost + eventBoost(club, mode), double) - e.difficulty) / SPREAD);
}

/** Meilleure composition : chaque grimpeur au plus une fois si possible. */
export function autoLineup(club: Club, boost = 0, mode: Mode = 'ligue'): Lineup {
  const events = upcoming(club, mode);
  const b = boost + eventBoost(club, mode);
  const team = club.climbers.filter((c) => c.program !== 'repos' || club.climbers.length <= EVENTS);
  const pool = (team.length >= Math.min(EVENTS, club.climbers.length) ? team : club.climbers).map((c) => ({ c, a: athleteOf(club, c) }));
  const score = (i: number, a: Athlete, double: boolean) => phi((effOf(a, events[i], b, double) - events[i].difficulty) / SPREAD) + (0.02 * (effOf(a, events[i], b, double) - events[i].difficulty)) / SPREAD;
  let best: Lineup = [null, null, null, null];
  let bestScore = -Infinity;
  const go = (i: number, cur: string[], total: number) => {
    if (i === EVENTS) {
      if (total > bestScore) [bestScore, best] = [total, [...cur]];
      return;
    }
    for (const { c, a } of pool) {
      const used = cur.includes(c.id);
      if (used && pool.length >= EVENTS) continue;
      cur.push(c.id);
      go(i + 1, cur, total + score(i, a, used));
      cur.pop();
    }
  };
  go(0, [], 0);
  return best;
}

/** Lance la manche : tire le hasard de chacun. Consomme l'énergie et le boost. */
export function startCompetition(club: Club, lineup: Lineup, boostId: string | null, mode: Mode = 'ligue'): Draft {
  tick(club);
  const events = upcoming(club, mode);
  const boost = (boostId ? (club.items.find((i) => i.id === boostId && i.kind === 'boost')?.value ?? 0) : 0) + eventBoost(club, mode);
  const ev = mode === 'ligue' ? club.season.event : undefined;
  const lift = club.season.round * 0.35;
  const opponents = mode === 'coupe' ? [club.season.cup!.opps[club.season.cup!.round]] : club.season.rivals;
  const rolls: Roll[][] = events.map(() => []);
  const roll = (teamId: string, clubName: string, mine: boolean, who: { name: string; flag: string; skin: SkinId; id?: string; a: Athlete }, i: number, double: boolean, b: number) => {
    const eff = effOf(who.a, events[i], b, double);
    rolls[i].push({ teamId, name: who.name, flag: who.flag, skin: who.skin, club: clubName, mine, id: who.id, eff, perf: eff + normal() * SPREAD });
  };
  lineup.forEach((id, i) => {
    const c = club.climbers.find((x) => x.id === id);
    if (c) roll('me', club.name, true, { name: nameOf(c), flag: c.flag, skin: c.skin, id: c.id, a: athleteOf(club, c) }, i, lineup.indexOf(id) !== i, boost);
  });
  for (const rv of opponents) {
    // Les rivaux progressent un peu à chaque manche et placent leurs spécialistes.
    const hurt = rv.nemesis && ev?.kind === 'blessure' ? (ev.amount ?? 0) : 0;
    const pool = rv.climbers.map((rc) => ({ ...rc, a: { stats: Object.fromEntries(MSTATS.map((s) => [s.id, rc.stats[s.id] + lift - hurt])) as Record<MStat, number>, skills: rc.skills, fatigue: 10 } }));
    const used = new Set<number>();
    events.forEach((e, i) => {
      const free = pool.map((p, k) => k).filter((k) => !used.has(k));
      const cands = free.length ? free : pool.map((p, k) => k);
      const k = cands.reduce((m, x) => (effOf(pool[x].a, e, 0, false) > effOf(pool[m].a, e, 0, false) ? x : m), cands[0]);
      roll(rv.id, rv.name, false, pool[k], i, used.has(k), 0);
      used.add(k);
    });
  }
  if (boostId) club.items = club.items.filter((i) => i.id !== boostId);
  if (club.energy.day !== dayOf()) club.energy = { day: dayOf(), used: 0 };
  club.energy.used += 1;
  saveClub(club);
  return { mode, events, rolls, boost, lineup, teams: opponents.map((r) => ({ id: r.id, name: r.name, color: r.color, nemesis: r.nemesis })) };
}

function scoreRoll(e: CompEvent, perf: number) {
  const top = perf >= e.difficulty;
  if (e.kind === 'voie') {
    const height = top ? 100 : Math.round(clamp((perf - (e.difficulty - 30)) / 30, 0, 0.99) * 1000) / 10;
    return { top, zone: height >= 60, tries: 1, height, points: Math.round(height * 0.25 * 10) / 10 };
  }
  const zone = perf >= e.difficulty - 9;
  const tries = top ? clamp(1 + Math.floor((e.difficulty + 8 - perf) / 3.5), 1, 5) : clamp(2 + Math.floor((e.difficulty - perf) / 4), 2, 6);
  const points = top ? 25 - (tries - 1) * 0.1 : zone ? 10 - (tries - 1) * 0.1 : 0;
  return { top, zone, tries, height: 0, points: Math.max(0, Math.round(points * 10) / 10) };
}

/** Résultats d'une épreuve. */
export function eventRows(d: Draft, i: number): EventRow[] {
  return d.rolls[i]
    .map((r) => ({ name: r.name, flag: r.flag, skin: r.skin, club: r.club, mine: r.mine, id: r.id, ...scoreRoll(d.events[i], r.perf) }))
    .sort((a, b) => b.points - a.points);
}

/** Totaux des équipes après les épreuves 0..upto-1. */
export function teamTotals(club: Club, d: Draft, upto: number) {
  const teams = [{ id: 'me', name: club.name, color: club.colors[0], mine: true, nemesis: false }, ...d.teams.map((rv) => ({ ...rv, mine: false, nemesis: !!rv.nemesis }))];
  return teams
    .map((t) => {
      const perEvent = d.events.map((e, i) => {
        if (i >= upto) return 0;
        const r = d.rolls[i].find((x) => x.teamId === t.id);
        return r ? scoreRoll(e, r.perf).points : 0;
      });
      return { ...t, perEvent, total: Math.round(perEvent.reduce((a, b) => a + b, 0) * 10) / 10 };
    })
    .sort((a, b) => b.total - a.total);
}

/** Pourquoi mon grimpeur a réussi ou raté. */
function explain(club: Club, d: Draft, i: number) {
  const r = d.rolls[i].find((x) => x.mine);
  const c = club.climbers.find((x) => x.id === r?.id);
  if (!r || !c) return null;
  const e = d.events[i];
  const res = scoreRoll(e, r.perf);
  const a = athleteOf(club, c);
  const stats = eventStats(e).map((k) => ({ k, v: Math.round(a.stats[k]), name: MSTATS.find((m) => m.id === k)!.name }));
  const best = stats.reduce((m, x) => (x.v > m.v ? x : m));
  const worst = stats.reduce((m, x) => (x.v < m.v ? x : m));
  const where = e.kind === 'voie' ? 'la voie' : `le bloc ${eventName(e)}`;
  const parts: string[] = [];
  if (res.top) parts.push(`${c.first} sort ${where}${res.tries === 1 && e.kind === 'bloc' ? ' du premier coup' : ''} : ${best.name} ${best.v} au rendez-vous.`);
  else parts.push(`${c.first} ${e.kind === 'voie' ? `tombe à ${res.height} %` : res.zone ? 'atteint la zone' : 'rate'} ${e.kind === 'voie' ? 'de la voie' : `sur ${where}`} (niveau ${e.difficulty}) : ${worst.name} ${worst.v} trop juste.`);
  if (e.kind === 'bloc' && !c.skills.includes(BLOCKS[e.type!].skill) && !res.top) parts.push(`La compétence ${SKILLS[BLOCKS[e.type!].skill].name} aurait aidé.`);
  if (c.fatigue > 45) parts.push(`Fatigue ${Math.round(c.fatigue)} : il grimpe moins bien.`);
  if (d.lineup.indexOf(c.id) !== i) parts.push('2ᵉ épreuve pour lui, il a moins de jus.');
  if (r.perf - r.eff > SPREAD * 1.2) parts.push('Jour de grâce, il a dépassé son niveau.');
  else if (r.eff - r.perf > SPREAD * 1.2 && !res.top) parts.push('Pas dans un bon jour.');
  return { event: i, name: nameOf(c), skin: c.skin, text: parts.join(' '), good: res.top };
}

/** Termine la manche : points, gains, fatigue, expérience. */
export function finishCompetition(club: Club, d: Draft): CompResult {
  const L = LEAGUES[club.league];
  const rows = d.events.map((e, i) => eventRows(d, i));
  const teams = teamTotals(club, d, EVENTS);
  const rank = teams.findIndex((t) => t.mine) + 1;
  const lines = d.events.map((e, i) => explain(club, d, i)).filter((x) => x !== null);
  const xp = d.mode === 'coupe' ? (rank === 1 ? 70 : 35) : 30 + (10 - rank) * 6;
  const done = new Set<string>();
  d.lineup.forEach((id, i) => {
    const c = club.climbers.find((x) => x.id === id);
    const row = rows[i].find((x) => x.mine);
    if (!c || !row) return;
    c.fatigue = clamp(c.fatigue + 12, 0, 100);
    c.tops += row.top ? 1 : 0;
    const before = Math.floor(c.xp / 100);
    c.xp += (done.has(c.id) ? 0 : xp) + (row.top ? 10 : 0);
    c.potential = Math.min(99, c.potential + Math.floor(c.xp / 100) - before);
    if (!done.has(c.id)) c.comps += 1;
    done.add(c.id);
  });

  // Moments clés pour la 3D.
  const moments: Moment[] = [];
  const hard = [0, 1, 2].reduce((m, i) => (d.events[i].difficulty > d.events[m].difficulty ? i : m), 0);
  const hr = rows[hard].find((x) => x.mine);
  if (hr?.top) moments.push({ kind: hr.tries === 1 ? 'flash' : 'top', climber: hr.name, skin: hr.skin, text: `${hr.name} ${hr.tries === 1 ? 'flashe' : 'sort'} le bloc le plus dur (${eventName(d.events[hard])}) !` });
  const lr = rows[3].find((x) => x.mine);
  if (lr?.top) moments.push({ kind: 'record', climber: lr.name, skin: lr.skin, text: `${lr.name} enchaîne la voie jusqu’au sommet !` });
  else if (lr && lr.height >= 80) moments.push({ kind: 'chute', climber: lr.name, skin: lr.skin, text: `${lr.name} tombe tout près du sommet de la voie (${lr.height} %).` });

  const result: CompResult = { mode: d.mode, events: d.events, rows, teams, lines, rank, coins: 0, xp, moments, legends: [], news: [] };
  const newsBefore = club.news?.[0];
  const sponsor = club.items.filter((i) => i.kind === 'sponsor').reduce((s, i) => s + i.value, 0);

  if (d.mode === 'coupe') {
    const cup = club.season.cup!;
    const win = rank === 1;
    const stage = CUP_STAGES[cup.round];
    result.coins = Math.round(((win ? CUP_PRIZE[cup.round] : 150) * L.reward) / 10) * 10 + sponsor;
    cup.next = undefined;
    if (!win) cup.out = true;
    else if (cup.round === CUP_STAGES.length - 1) {
      cup.won = true;
      club.trophies = { titles: club.trophies?.titles ?? 0, cups: (club.trophies?.cups ?? 0) + 1 };
      club.packs.push('or');
      addNews(club, 'emoji_events', `${club.name} remporte la Coupe !`);
      result.legends.push(...unlockLegends(club, ['coupe']));
    } else cup.round += 1;
    result.cup = { win, stage, champion: cup.won, opp: d.teams[0]?.name ?? '' };
  } else {
    teams.forEach((t, i) => (club.season.points[t.id] = (club.season.points[t.id] ?? 0) + (POINTS[i] ?? 0)));
    result.coins = Math.round((PRIZE[rank - 1] ?? 150) * L.reward) + sponsor;

    // Contrat de sponsor.
    const k = club.season.contract;
    if (k && !k.done) {
      const mine = rows.map((r) => r.find((x) => x.mine));
      const nemRank = teams.findIndex((t) => t.nemesis) + 1;
      const add: Record<GoalId, number> = {
        tops: mine.filter((r) => r?.top).length,
        flash: mine.filter((r, i) => r?.top && r.tries === 1 && d.events[i].kind === 'bloc').length,
        voie: mine[3]?.top ? 1 : 0,
        podiums: rank <= 3 ? 1 : 0,
        wins: rank === 1 ? 1 : 0,
        nemesis: nemRank > 0 && rank < nemRank ? 1 : 0,
      };
      k.progress += add[k.goal];
      if (k.progress >= k.target) {
        k.done = true;
        club.coins += k.reward;
        club.contracts = (club.contracts ?? 0) + 1;
        result.contract = { text: `${k.sponsor} : contrat rempli !`, reward: k.reward };
        addNews(club, 'handshake', `Contrat ${k.sponsor} rempli : +${k.reward} pièces.`);
        if (club.contracts >= 3) result.legends.push(...unlockLegends(club, ['contrats']));
      }
    }

    club.season.round += 1;
    club.season.next = undefined;
    club.season.event = undefined;
    // À mi-saison, un rival frappe un grand coup sur le marché.
    if (club.season.round === 5) signStar(club, club.season.rivals);
    const total = teams.find((t) => t.mine)!.total;
    club.history = [{ date: dayOf(), rank, total, league: club.league }, ...club.history].slice(0, 20);
    if (rank < club.best.rank || club.league > club.best.league) club.best = { rank, league: club.league };
    if (club.season.round >= ROUNDS) {
      const end = endSeason(club);
      result.seasonEnd = end.info;
      result.legends.push(...end.legends);
    }
  }
  club.coins += result.coins;
  // Les nouvelles apparues pendant cette manche.
  const fresh = club.news ?? [];
  const cut = newsBefore ? fresh.indexOf(newsBefore) : fresh.length;
  result.news = fresh.slice(0, cut < 0 ? fresh.length : cut).map((n) => n.text);
  saveClub(club);
  return result;
}

export function competitionPreview(club: Club) {
  const r = club.season.round;
  return { round: r + 1, difficulty: Math.round(LEAGUES[club.league].base + seasonLift(club.season.n) * 0.5 + r * 0.6) };
}

export function standings(club: Club) {
  const rows = [
    { id: 'me', name: club.name, color: club.colors[0], strength: avgTeam(club), mine: true, nemesis: false },
    ...club.season.rivals.map((r) => ({ id: r.id, name: r.name, color: r.color, strength: r.strength + club.season.round * 0.35, mine: false, nemesis: !!r.nemesis })),
  ];
  return rows.map((r) => ({ ...r, points: club.season.points[r.id] ?? 0 })).sort((a, b) => b.points - a.points || b.strength - a.strength);
}

export function avgTeam(club: Club) {
  const best = [...club.climbers].sort((a, b) => ratingOf(b) - ratingOf(a)).slice(0, TEAM_SIZE);
  return best.length ? best.reduce((s, c) => s + ratingOf(c), 0) / best.length : 0;
}

function endSeason(club: Club) {
  const table = standings(club);
  const rank = table.findIndex((r) => r.mine) + 1;
  const nemRank = table.findIndex((r) => r.nemesis) + 1;
  const up = rank <= 3 && club.league < 2;
  const down = rank >= 8 && club.league > 0;
  const coins = Math.round([2000, 1400, 1000, 600, 450, 380, 300, 240, 200, 150][rank - 1] * LEAGUES[club.league].reward);
  const pack: PackKind | null = rank === 1 ? 'or' : rank <= 3 ? 'argent' : rank <= 6 ? 'recompense' : null;
  club.coins += coins;
  if (pack) club.packs.push(pack);
  const conds: LegendCond[] = [];
  if (rank === 1) {
    club.trophies = { titles: (club.trophies?.titles ?? 0) + 1, cups: club.trophies?.cups ?? 0 };
    conds.push('titre');
  }
  if (nemRank > rank) conds.push('nemesis');
  const league = (club.league + (up ? 1 : down ? -1 : 0)) as 0 | 1 | 2;
  if (up && league >= 1) conds.push('montee');
  if (up && league === 2) conds.push('monde');
  const legends = unlockLegends(club, conds);
  const season = newSeason(club, league, club.season.n + 1);
  club.league = league;
  club.season = season;
  return { info: { rank, up, down, pack, coins }, legends };
}

/* ---------- Packs ---------- */

export type PackCard = { kind: 'grimpeur'; climber: Climber; extra: boolean } | { kind: 'objet'; item: Item } | { kind: 'pieces'; coins: number };

const GEAR_NAMES: Record<MStat, string[]> = {
  force: ['Gants de muscu', 'Gilet lesté'],
  doigts: ['Poutre en bois', 'Wristband magnésie'],
  technique: ['Chaussons précis', 'Chaussons pro'],
  endurance: ['Gourde isotherme', 'Montre cardio'],
  souplesse: ['Pantalon stretch', 'Tapis de yoga'],
  mental: ['Casque audio', 'Carnet de visualisation'],
  puissance: ['Pan Güllich', 'Élastiques pro'],
  agilite: ['Chaussons souples', 'Corde à sauter'],
  equilibre: ['Slackline', 'Chaussons dalle'],
};
const COACH_NAMES = ['Coach', 'Préparateur', 'Kiné', 'Entraîneur'];
export const SPONSORS = ['Magnésie Crux', 'Chaussons Vertigo', 'Boisson Dyno', 'Cordes Altitude', 'Barres Granite'];

function makeItem(level: number): Item {
  const kind = pick<ItemKind>(['materiel', 'materiel', 'materiel', 'boost', 'boost', 'coach', 'sponsor', 'competence']);
  const stat = pick(MSTATS).id;
  if (kind === 'materiel') return { id: uid(), kind, name: GEAR_NAMES[stat][level >= 3 ? 1 : 0], level, stat, value: [2, 3, 5, 7][level - 1] };
  if (kind === 'boost') return { id: uid(), kind, name: ['Boisson énergisante', 'Super magnésie', 'Mental de champion', 'Jour de gloire'][level - 1], level, value: [3, 5, 7, 10][level - 1] };
  if (kind === 'coach') return { id: uid(), kind, name: `${pick(COACH_NAMES)} ${MSTATS.find((s) => s.id === stat)!.name}`, level, stat, value: [15, 25, 35, 50][level - 1] };
  if (kind === 'sponsor') return { id: uid(), kind, name: pick(SPONSORS), level, value: [40, 80, 140, 220][level - 1] };
  const skill = pick(Object.keys(SKILLS) as SkillId[]);
  return { id: uid(), kind, name: `Stage ${SKILLS[skill].name}`, level, skill, value: 0 };
}

/** Note du grimpeur garanti selon le pack. */
function packClimberTarget(kind: PackKind) {
  if (kind === 'or') return Math.random() < 0.04 ? rnd(85, 88) : rnd(75, 82);
  if (kind === 'argent') return Math.random() < 0.12 ? rnd(75, 78) : rnd(65, 72);
  if (kind === 'bienvenue') return rnd(65, 68);
  if (kind === 'recompense') return rnd(66, 76);
  return Math.random() < 0.15 ? rnd(65, 69) : rnd(57, 64);
}

export function buyPack(club: Club, kind: PackKind) {
  const price = PACKS[kind].price;
  if (club.coins < price) return false;
  club.coins -= price;
  club.packs.push(kind);
  saveClub(club);
  return true;
}

export function openPack(club: Club, index = 0): { kind: PackKind; cards: PackCard[] } | null {
  const kind = club.packs[index];
  if (!kind) return null;
  club.packs.splice(index, 1);
  const P = PACKS[kind];
  const cards: PackCard[] = [];
  const climber = makeClimber(Math.round(packClimberTarget(kind)));
  cards.push(addClimber(club, climber));
  const lv = kind === 'or' ? [2, 4] : kind === 'argent' || kind === 'recompense' ? [1, 3] : [1, 2];
  while (cards.length < P.cards) {
    if (Math.random() < 0.15) {
      const coins = Math.round(rnd(100, 300) * (kind === 'or' ? 3 : kind === 'argent' ? 2 : 1) / 10) * 10;
      club.coins += coins;
      cards.push({ kind: 'pieces', coins });
    } else if (Math.random() < 0.12 && kind !== 'bronze') {
      cards.push(addClimber(club, makeClimber(Math.round(packClimberTarget('bronze')))));
    } else {
      const item = makeItem(Math.round(rnd(lv[0], lv[1])));
      club.items.push(item);
      cards.push({ kind: 'objet', item });
    }
  }
  saveClub(club);
  // La plus belle carte en dernier.
  const score = (c: PackCard) => (c.kind === 'grimpeur' ? 100 + ratingOf(c.climber) : c.kind === 'objet' ? c.item.level * 10 : 0);
  return { kind, cards: cards.sort((a, b) => score(a) - score(b)) };
}

function addClimber(club: Club, climber: Climber): PackCard {
  if (club.climbers.length >= MAX_CLIMBERS) {
    club.coins += sellPrice(climber);
    return { kind: 'grimpeur', climber, extra: true };
  }
  club.climbers.push(climber);
  return { kind: 'grimpeur', climber, extra: false };
}

/* ---------- Gestion des grimpeurs et objets ---------- */

export function setProgram(club: Club, id: string, program: Program | null) {
  tick(club);
  const c = club.climbers.find((x) => x.id === id);
  if (c) c.program = program;
  saveClub(club);
}

export function equip(club: Club, climberId: string, itemId: string) {
  const c = club.climbers.find((x) => x.id === climberId);
  if (!c) return;
  for (const o of club.climbers) o.gear = o.gear.filter((g) => g !== itemId);
  c.gear = [...c.gear.filter((g) => g !== itemId), itemId].slice(-2);
  saveClub(club);
}

export function unequip(club: Club, climberId: string, itemId: string) {
  const c = club.climbers.find((x) => x.id === climberId);
  if (c) c.gear = c.gear.filter((g) => g !== itemId);
  saveClub(club);
}

export function teachSkill(club: Club, climberId: string, itemId: string) {
  const c = club.climbers.find((x) => x.id === climberId);
  const it = club.items.find((i) => i.id === itemId);
  if (!c || !it?.skill || c.skills.includes(it.skill)) return false;
  c.skills.push(it.skill);
  club.items = club.items.filter((i) => i.id !== itemId);
  saveClub(club);
  return true;
}

export function release(club: Club, climberId: string) {
  const c = club.climbers.find((x) => x.id === climberId);
  if (!c || club.climbers.length <= TEAM_SIZE) return 0;
  const price = sellPrice(c);
  club.climbers = club.climbers.filter((x) => x.id !== climberId);
  club.coins += price;
  saveClub(club);
  return price;
}

export function sellItem(club: Club, itemId: string) {
  const it = club.items.find((i) => i.id === itemId);
  if (!it) return 0;
  const price = it.level * 60;
  club.items = club.items.filter((i) => i.id !== itemId);
  for (const c of club.climbers) c.gear = c.gear.filter((g) => g !== itemId);
  club.coins += price;
  saveClub(club);
  return price;
}

export function resetClub() {
  setSetting(KEY, '');
  listeners.forEach((l) => l());
}

/** Effet d'un objet, en une ligne. */
export function itemText(it: Item) {
  const stat = it.stat ? MSTATS.find((m) => m.id === it.stat)!.name : '';
  if (it.kind === 'materiel') return `+${it.value} ${stat} quand il est porté`;
  if (it.kind === 'boost') return `+${it.value} partout pendant une compétition`;
  if (it.kind === 'coach') return `Entraînement ${stat} +${it.value} %`;
  if (it.kind === 'sponsor') return `+${it.value} pièces par compétition`;
  return it.skill ? `Apprend « ${SKILLS[it.skill].name} » à un grimpeur` : '';
}
