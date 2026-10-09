/**
 * Moteur du jeu MyClimb Manager : club, grimpeurs, entraînement (qui continue app fermée),
 * compétitions en combiné bloc + difficulté, ligues et packs. Tout est sauvegardé dans un réglage
 * (donc aussi dans la sauvegarde Google Drive).
 */
import { getSetting, setSetting } from './db';
import { BLOCKS, COUNTRIES, MSTATS, RIVAL_CLUBS, SKILLS, STYLES, type BlockType, type MStat, type SkillId, type StyleId } from './managerData';
import { SKINS, type SkinId } from './skins';

/* ---------- Types ---------- */

export type Tier = 'bronze' | 'argent' | 'or' | 'legende';
export type Program = MStat | 'repos';
export type Attitude = 'forcer' | 'assurer' | 'economiser';
export type Reading = 'court' | 'long';
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
export type Rival = { id: string; name: string; color: string; strength: number; climbers: RivalClimber[] };

export type PackKind = 'bienvenue' | 'bronze' | 'argent' | 'or' | 'recompense';

export type Club = {
  v: 1;
  name: string;
  colors: [string, string];
  created: number;
  coins: number;
  climbers: Climber[];
  items: Item[];
  league: 0 | 1 | 2;
  season: { n: number; round: number; points: Record<string, number>; rivals: Rival[] };
  energy: { day: string; used: number };
  daily: { last: string; streak: number };
  packs: PackKind[];
  lastTick: number;
  history: { date: string; rank: number; total: number; league: number }[];
  best: { rank: number; league: number };
};

/* ---------- Réglages du jeu ---------- */

export const LEAGUES = [
  { name: 'Ligue régionale', short: 'Régionale', base: 57, color: '#43A047', reward: 1 },
  { name: 'Ligue nationale', short: 'Nationale', base: 69, color: '#1E88E5', reward: 1.6 },
  { name: 'Coupe du monde', short: 'Coupe du monde', base: 80, color: '#E9A100', reward: 2.4 },
] as const;
export const ROUNDS = 10;
export const ENERGY_PER_DAY = 10;
export const MAX_CLIMBERS = 12;
export const TEAM_SIZE = 3;
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
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
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

function makeRivals(league: number, n = 9): Rival[] {
  const names = [...RIVAL_CLUBS].sort(() => Math.random() - 0.5);
  const base = LEAGUES[league].base;
  return Array.from({ length: n }, (_, i) => {
    // Du plus faible au plus fort : le haut du classement est vraiment dur à aller chercher.
    const strength = base - 3 + (i / (n - 1)) * 11 + rnd(-1.5, 1.5);
    return {
      id: `r${i}-${uid()}`,
      name: names[i],
      color: pick(['#E53935', '#8E24AA', '#3949AB', '#00897B', '#F4511E', '#6D4C41', '#546E7A', '#C0CA33', '#D81B60']),
      strength,
      climbers: Array.from({ length: TEAM_SIZE }, () => {
        const m = makeClimber(Math.round(strength + rnd(-3, 3)));
        return { name: nameOf(m), flag: m.flag, skin: m.skin, stats: m.stats, skills: m.skills };
      }),
    };
  });
}

function newSeason(league: 0 | 1 | 2, n: number): Club['season'] {
  const rivals = makeRivals(league);
  return { n, round: 0, points: Object.fromEntries([['me', 0], ...rivals.map((r) => [r.id, 0])]), rivals };
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
    return raw ? (JSON.parse(raw) as Club) : null;
  } catch {
    return null;
  }
}

export function saveClub(c: Club) {
  setSetting(KEY, JSON.stringify(c));
  listeners.forEach((l) => l());
}

export function createClub(name: string, colors: [string, string]): Club {
  const club: Club = {
    v: 1,
    name: name.trim() || 'MyClimb Club',
    colors,
    created: Date.now(),
    coins: 600,
    climbers: [makeClimber(Math.round(rnd(56, 59)), 'puissant'), makeClimber(Math.round(rnd(56, 59)), 'technicien'), makeClimber(Math.round(rnd(55, 58)), 'endurant')],
    items: [],
    league: 0,
    season: newSeason(0, 1),
    energy: { day: dayOf(), used: 0 },
    daily: { last: '', streak: 0 },
    packs: ['bienvenue'],
    lastTick: Date.now(),
    history: [],
    best: { rank: 10, league: 0 },
  };
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
      c.fatigue = clamp(c.fatigue - hours * (c.program === 'repos' ? 8 : 4), 0, 100);
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

export type Pick = { id: string; attitude: Attitude; reading: Reading };
export type BlockResult = { type: BlockType; top: boolean; zone: boolean; tries: number; points: number };
export type ClimberResult = { name: string; flag: string; skin: SkinId; club: string; mine: boolean; blocks: BlockResult[]; lead: number; total: number; id?: string };
export type Moment = { text: string; climber: string; skin: SkinId; kind: 'flash' | 'top' | 'chute' | 'record' };
export type CompResult = {
  blocks: { type: BlockType; difficulty: number }[];
  climbers: ClimberResult[];
  teams: { id: string; name: string; color: string; total: number; mine: boolean }[];
  rank: number;
  coins: number;
  xp: number;
  moments: Moment[];
  seasonEnd?: { rank: number; up: boolean; down: boolean; pack: PackKind | null; coins: number };
};

const ATT = { forcer: { bonus: 4, spread: 9, tire: 18 }, assurer: { bonus: 0, spread: 4, tire: 12 }, economiser: { bonus: -3, spread: 6, tire: 7 } };

type Athlete = { stats: Record<MStat, number>; skills: SkillId[]; fatigue: number; attitude: Attitude; reading: Reading; boost: number };

function blockPerf(a: Athlete, type: BlockType) {
  const b = BLOCKS[type];
  let eff = b.stats.reduce((s, k) => s + a.stats[k], 0) / b.stats.length;
  if (a.skills.includes(b.skill)) eff += 8;
  if (a.reading === 'long') eff += a.skills.includes('lecture') ? 5 : 2;
  eff += (a.stats.mental - 60) * 0.08 + a.boost - Math.max(0, a.fatigue - 45) * 0.3;
  const att = ATT[a.attitude];
  return eff + att.bonus + gauss() * att.spread;
}

function leadPerf(a: Athlete) {
  let eff = (a.stats.endurance * 2 + a.stats.doigts + a.stats.mental + a.stats.technique) / 5;
  if (a.skills.includes('lolotte')) eff += 5;
  // Lire longtemps les blocs coûte du temps et de la fraîcheur pour la voie.
  if (a.reading === 'long') eff -= 2;
  eff += a.boost - Math.max(0, a.fatigue - 45) * 0.35;
  const att = ATT[a.attitude];
  return eff + att.bonus * 0.7 + gauss() * att.spread;
}

function climb(a: Athlete, blocks: { type: BlockType; difficulty: number }[], leadDiff: number) {
  const res: BlockResult[] = blocks.map(({ type, difficulty }) => {
    const p = blockPerf(a, type);
    const top = p >= difficulty;
    const zone = p >= difficulty - 9;
    const tries = top ? clamp(1 + Math.floor((difficulty + 8 - p) / 3.5), 1, 5) : clamp(2 + Math.floor((difficulty - p) / 4), 2, 6);
    const points = top ? 25 - (tries - 1) * 0.1 : zone ? 10 - (tries - 1) * 0.1 : 0;
    return { type, top, zone, tries, points: Math.max(0, Math.round(points * 10) / 10) };
  });
  const lp = leadPerf(a);
  const lead = lp >= leadDiff + 9 ? 100 : Math.round(clamp((lp - (leadDiff - 30)) / 39, 0, 0.99) * 100 * 10) / 10;
  return { blocks: res, lead, total: Math.round((res.reduce((s, b) => s + b.points, 0) + lead) * 10) / 10 };
}

export function competitionPreview(club: Club) {
  const L = LEAGUES[club.league];
  const r = club.season.round;
  // Les blocs durcissent au fil de la saison.
  return { round: r + 1, difficulty: Math.round(L.base + 6 + r * 0.6) };
}

export function runCompetition(club: Club, picks: Pick[], boostId: string | null): CompResult {
  tick(club);
  const L = LEAGUES[club.league];
  const round = club.season.round;
  const types = (Object.keys(BLOCKS) as BlockType[]).sort(() => Math.random() - 0.5).slice(0, 4);
  const base = L.base + 6 + round * 0.6;
  const blocks = types.map((type, i) => ({ type, difficulty: Math.round(base + i * 2.5 + rnd(-2, 3)) }));
  const leadDiff = Math.round(base + 4);
  const boost = boostId ? (club.items.find((i) => i.id === boostId && i.kind === 'boost')?.value ?? 0) : 0;

  const climbers: ClimberResult[] = [];
  for (const p of picks) {
    const c = club.climbers.find((x) => x.id === p.id);
    if (!c) continue;
    const stats = Object.fromEntries(MSTATS.map((s) => [s.id, statWithGear(club, c, s.id)])) as Record<MStat, number>;
    const r = climb({ stats, skills: c.skills, fatigue: c.fatigue, attitude: p.attitude, reading: p.reading, boost }, blocks, leadDiff);
    climbers.push({ ...r, name: nameOf(c), flag: c.flag, skin: c.skin, club: club.name, mine: true, id: c.id });
  }
  for (const rv of club.season.rivals) {
    // Les rivaux progressent un peu à chaque manche.
    const lift = round * 0.35;
    for (const rc of rv.climbers) {
      const stats = Object.fromEntries(MSTATS.map((s) => [s.id, rc.stats[s.id] + lift])) as Record<MStat, number>;
      const r = climb({ stats, skills: rc.skills, fatigue: 10, attitude: pick(['forcer', 'assurer', 'assurer', 'economiser'] as Attitude[]), reading: pick(['court', 'long'] as Reading[]), boost: 0 }, blocks, leadDiff);
      climbers.push({ ...r, name: rc.name, flag: rc.flag, skin: rc.skin, club: rv.name, mine: false });
    }
  }
  const teams = [
    { id: 'me', name: club.name, color: club.colors[0], total: climbers.filter((c) => c.mine).reduce((s, c) => s + c.total, 0), mine: true },
    ...club.season.rivals.map((rv) => ({ id: rv.id, name: rv.name, color: rv.color, total: climbers.filter((c) => !c.mine && c.club === rv.name).reduce((s, c) => s + c.total, 0), mine: false })),
  ]
    .map((t) => ({ ...t, total: Math.round(t.total * 10) / 10 }))
    .sort((a, b) => b.total - a.total);
  const rank = teams.findIndex((t) => t.mine) + 1;
  climbers.sort((a, b) => b.total - a.total);

  // Points de ligue, gains, fatigue, expérience.
  teams.forEach((t, i) => (club.season.points[t.id] = (club.season.points[t.id] ?? 0) + (POINTS[i] ?? 0)));
  const sponsor = club.items.filter((i) => i.kind === 'sponsor').reduce((s, i) => s + i.value, 0);
  const coins = Math.round((PRIZE[rank - 1] ?? 150) * L.reward) + sponsor;
  club.coins += coins;
  const xp = 30 + (10 - rank) * 6;
  for (const p of picks) {
    const c = club.climbers.find((x) => x.id === p.id);
    const r = climbers.find((x) => x.id === p.id);
    if (!c || !r) continue;
    c.fatigue = clamp(c.fatigue + ATT[p.attitude].tire, 0, 100);
    c.comps += 1;
    c.tops += r.blocks.filter((b) => b.top).length + (r.lead === 100 ? 1 : 0);
    const before = Math.floor(c.xp / 100);
    c.xp += xp + r.blocks.filter((b) => b.top).length * 8;
    c.potential = Math.min(99, c.potential + Math.floor(c.xp / 100) - before);
  }
  if (boostId) club.items = club.items.filter((i) => i.id !== boostId);
  if (club.energy.day !== dayOf()) club.energy = { day: dayOf(), used: 0 };
  club.energy.used += 1;

  // Moments clés pour la 3D : le top du bloc le plus dur, une voie au sommet, une chute rageante.
  const moments: Moment[] = [];
  const mine = climbers.filter((c) => c.mine);
  const hardest = blocks.reduce((m, b, i) => (b.difficulty > blocks[m].difficulty ? i : m), 0);
  const flash = mine.find((c) => c.blocks[hardest].top && c.blocks[hardest].tries === 1);
  const topper = mine.find((c) => c.blocks[hardest].top);
  if (flash) moments.push({ kind: 'flash', climber: flash.name, skin: flash.skin, text: `${flash.name} flashe le bloc le plus dur (${BLOCKS[blocks[hardest].type].name}) !` });
  else if (topper) moments.push({ kind: 'top', climber: topper.name, skin: topper.skin, text: `${topper.name} sort le bloc le plus dur (${BLOCKS[blocks[hardest].type].name}).` });
  const leadTop = mine.find((c) => c.lead === 100);
  if (leadTop) moments.push({ kind: 'record', climber: leadTop.name, skin: leadTop.skin, text: `${leadTop.name} enchaîne la voie jusqu’au sommet !` });
  const fall = mine.find((c) => c.lead >= 80 && c.lead < 100);
  if (fall) moments.push({ kind: 'chute', climber: fall.name, skin: fall.skin, text: `${fall.name} tombe tout près du sommet de la voie (${fall.lead} points).` });

  club.season.round += 1;
  club.history = [{ date: dayOf(), rank, total: teams.find((t) => t.mine)!.total, league: club.league }, ...club.history].slice(0, 20);
  if (rank < club.best.rank || club.league > club.best.league) club.best = { rank, league: club.league };

  const result: CompResult = { blocks, climbers, teams, rank, coins, xp, moments };
  if (club.season.round >= ROUNDS) result.seasonEnd = endSeason(club);
  saveClub(club);
  return result;
}

export function standings(club: Club) {
  const rows = [
    { id: 'me', name: club.name, color: club.colors[0], strength: avgTeam(club), mine: true },
    ...club.season.rivals.map((r) => ({ id: r.id, name: r.name, color: r.color, strength: r.strength, mine: false })),
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
  const up = rank <= 3 && club.league < 2;
  const down = rank >= 8 && club.league > 0;
  const coins = Math.round([2000, 1400, 1000, 600, 450, 380, 300, 240, 200, 150][rank - 1] * LEAGUES[club.league].reward);
  const pack: PackKind | null = rank === 1 ? 'or' : rank <= 3 ? 'argent' : rank <= 6 ? 'recompense' : null;
  club.coins += coins;
  if (pack) club.packs.push(pack);
  const league = (club.league + (up ? 1 : down ? -1 : 0)) as 0 | 1 | 2;
  club.league = league;
  club.season = newSeason(league, club.season.n + 1);
  return { rank, up, down, pack, coins };
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
const SPONSORS = ['Magnésie Crux', 'Chaussons Vertigo', 'Boisson Dyno', 'Cordes Altitude', 'Barres Granite'];

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
