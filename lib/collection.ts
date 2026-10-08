/**
 * Collection : objets à gagner dans des packs (costumes, contours et fonds de carte, titres,
 * célébrations au top, thèmes), de cinq raretés.
 *
 * Les packs se gagnent en grimpant : un par séance validée (5 grimpes ou plus), un quand on
 * s'entraîne trois jours dans la semaine, et des packs Exploit (meilleures chances) pour un record,
 * un flash à son niveau, une série de semaines ou une nouvelle carte. Chaque récompense a une clé :
 * elle n'est jamais donnée deux fois.
 *
 * Un pack contient 5 cartes. Les doublons deviennent de la magnésie, qui sert à acheter l'objet de
 * son choix. Réglé pour tout débloquer en six mois environ à 2 ou 3 séances par semaine
 * (simulation : médiane 27 semaines).
 */
import type { AndroidSymbol } from 'expo-symbols';

import { isFirstTry, isSent } from './climbing';
import { BACKDROPS, BACKDROP_KEY, CELEBRATIONS, CELEBRATION_KEY, FRAMES, FRAME_KEY, TITLES, TITLE_KEY } from './cosmetics';
import { getSetting, listBlocks, listTrainingLogs, setSetting, type Block, type TrainingLog } from './db';
import { gradeRating, playerCard, TIERS } from './playerCard';
import { RARITIES, rarityRank, type Rarity } from './rarity';
import { SKINS, SKIN_KEY } from './skins';
import { todayIso, validatedDays } from './stats';
import { currentTheme, themeOf, THEMES, type ThemeId } from './theme';

/* ---------- Catalogue ---------- */

export type Kind = 'costume' | 'contour' | 'fond' | 'titre' | 'celebration' | 'theme';

export const KINDS: { id: Kind; name: string; plural: string; icon: AndroidSymbol }[] = [
  { id: 'costume', name: 'Costume', plural: 'Costumes', icon: 'checkroom' },
  { id: 'contour', name: 'Contour de carte', plural: 'Contours', icon: 'crop_portrait' },
  { id: 'fond', name: 'Fond de carte', plural: 'Fonds', icon: 'wallpaper' },
  { id: 'titre', name: 'Titre', plural: 'Titres', icon: 'military_tech' },
  { id: 'celebration', name: 'Célébration', plural: 'Célébrations', icon: 'celebration' },
  { id: 'theme', name: 'Thème de l’app', plural: 'Thèmes', icon: 'palette' },
];
export const kindOf = (id: Kind) => KINDS.find((k) => k.id === id)!;

export type Item = {
  /** `<sorte>:<ref>`, par exemple `costume:dino`. */
  id: string;
  kind: Kind;
  /** Identifiant dans sa liste (costume, contour, thème…). */
  ref: string;
  name: string;
  rarity: Rarity;
};

const item = (kind: Kind, ref: string, name: string, rarity: Rarity): Item => ({ id: `${kind}:${ref}`, kind, ref, name, rarity });

/** Tous les objets à gagner (les costumes et thèmes de base, à tout le monde, n'y sont pas). */
export const CATALOG: Item[] = [
  ...SKINS.filter((s) => s.rarity).map((s) => item('costume', s.id, s.name, s.rarity!)),
  ...FRAMES.map((f) => item('contour', f.id, f.name, f.rarity)),
  ...BACKDROPS.map((b) => item('fond', b.id, b.name, b.rarity)),
  ...TITLES.map((t) => item('titre', t.id, t.name, t.rarity)),
  ...CELEBRATIONS.map((c) => item('celebration', c.id, c.name, c.rarity)),
  ...(Object.keys(THEMES) as ThemeId[])
    .filter((id) => themeOf(id).rarity)
    .map((id) => item('theme', id, THEMES[id].name, themeOf(id).rarity!)),
].sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity));

const BY_ID = new Map(CATALOG.map((i) => [i.id, i]));
export const itemById = (id: string) => BY_ID.get(id);
export const itemOf = (kind: Kind, ref: string) => BY_ID.get(`${kind}:${ref}`);

/* ---------- Règles des packs ---------- */

export const CARDS_PER_PACK = 5;
/** Un Légendaire (ou mieux) au plus tard tous les 15 packs. */
export const PITY = 15;
/** Chances de chaque rareté pour une carte (Commun → Mythique). */
const ODDS = { normal: [0.59, 0.26, 0.1, 0.037, 0.013], exploit: [0.35, 0.33, 0.2, 0.1, 0.02] };
/** Magnésie rendue par un doublon. */
export const DUPE_CHALK: Record<Rarity, number> = { commun: 5, rare: 15, epique: 40, legendaire: 100, mythique: 250 };
/** Prix d'un objet à la boutique. */
export const PRICE: Record<Rarity, number> = { commun: 30, rare: 80, epique: 180, legendaire: 400, mythique: 700 };
/** Magnésie offerte à chaque pack ouvert. */
export const PACK_CHALK = 15;
/** Chance qu'une carte Commune, Rare ou Épique soit forcément un objet qu'on n'a pas encore. */
const NEW_BIAS = 0.35;
/** Packs donnés pour les séances déjà notées avant l'arrivée des packs. */
const PAST_SESSIONS = 10;

export type PackKind = 'bienvenue' | 'seance' | 'entrainement' | 'exploit';

export const PACKS: Record<PackKind, { name: string; blurb: string; colors: [string, string]; accent: string }> = {
  bienvenue: { name: 'Pack de bienvenue', blurb: 'Un Légendaire et un Épique garantis', colors: ['#FFB300', '#E8590C'], accent: '#FFF3BF' },
  seance: { name: 'Pack Séance', blurb: 'Au moins un Rare', colors: ['#FF8A3D', '#D9480F'], accent: '#FFE8D6' },
  entrainement: { name: 'Pack Entraînement', blurb: 'Au moins un Rare', colors: ['#20C997', '#1971C2'], accent: '#D3F9D8' },
  exploit: { name: 'Pack Exploit', blurb: 'Au moins un Épique, meilleures chances', colors: ['#B45CFF', '#5F3DC4'], accent: '#F3D9FA' },
};

export type Pack = { id: string; kind: PackKind; reason: string; date: string };

/** Une carte sortie d'un pack. */
export type PulledCard = { item: Item; isNew: boolean; chalk: number };

/* ---------- Ce qui est enregistré ---------- */

type State = {
  v: 1;
  /** Objets débloqués, avec l'heure d'obtention. */
  owned: Record<string, number>;
  /** Objets obtenus pas encore regardés dans la collection. */
  fresh: string[];
  /** Magnésie disponible. */
  chalk: number;
  packs: Pack[];
  /** Packs ouverts depuis le dernier Légendaire ou Mythique. */
  pity: number;
  opened: number;
  /** Récompenses déjà données. */
  granted: Record<string, 1>;
  /** Meilleure cotation réussie connue, par discipline (note de 30 à 99). */
  records: Record<string, number>;
  /** Meilleur palier de carte atteint (indice dans TIERS). */
  tier: number;
  /** Jour de l'arrivée des packs ; vide tant que rien n'a été calculé. */
  since: string;
};

const KEY = 'collection';
const empty = (): State => ({ v: 1, owned: {}, fresh: [], chalk: 0, packs: [], pity: 0, opened: 0, granted: {}, records: {}, tier: 0, since: '' });

let cache: { raw: string | null; state: State } | null = null;

function load(): State {
  const raw = getSetting(KEY);
  if (cache && cache.raw === raw) return cache.state;
  let state = empty();
  try {
    if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<State>) };
  } catch {
    // Réglage abîmé : on repart de zéro plutôt que de planter.
  }
  cache = { raw, state };
  return state;
}

const listeners = new Set<() => void>();
/** Prévient quand la collection change (packs gagnés ou ouverts, achat, objet porté). */
export function onCollectionChange(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const changed = () => listeners.forEach((cb) => cb());

function save(state: State) {
  const raw = JSON.stringify(state);
  setSetting(KEY, raw);
  cache = { raw, state };
  changed();
}

/** Pour les tests. */
export function resetCollectionCache() {
  cache = null;
}

/* ---------- Lecture ---------- */

/** Un objet est à moi : gagné, acheté, ou de base (costumes et thèmes classiques). */
export function owns(id: string): boolean {
  if (!BY_ID.has(id)) return true;
  return id in load().owned;
}

export const ownsSkin = (id: string) => owns(`costume:${id}`);
export const ownsTheme = (id: string) => owns(`theme:${id}`);

export function collectionSummary() {
  const s = load();
  const owned = CATALOG.filter((i) => i.id in s.owned).length;
  return { owned, total: CATALOG.length, chalk: s.chalk, packs: s.packs.length, fresh: s.fresh.filter((id) => BY_ID.has(id)).length };
}

export const pendingPacks = (): Pack[] => [...load().packs];
/** Quand l'objet a été obtenu (ms), ou null. */
export const ownedAt = (id: string): number | null => load().owned[id] ?? null;
export const chalkBalance = () => load().chalk;
export const isFresh = (id: string) => load().fresh.includes(id);

/** Objets de cette sorte, des plus courants aux plus rares, avec ce que j'en ai. */
export function itemsOf(kind: Kind) {
  const s = load();
  return CATALOG.filter((i) => i.kind === kind).map((i) => ({ item: i, owned: i.id in s.owned, fresh: s.fresh.includes(i.id) }));
}

/** Ne plus marquer comme nouveaux les objets regardés. */
export function markSeen(ids: string[]) {
  const s = load();
  const fresh = s.fresh.filter((id) => !ids.includes(id));
  if (fresh.length !== s.fresh.length) save({ ...s, fresh });
}

/* ---------- Objets portés ---------- */

const KIND_KEY: Partial<Record<Kind, string>> = {
  costume: SKIN_KEY,
  contour: FRAME_KEY,
  fond: BACKDROP_KEY,
  titre: TITLE_KEY,
  celebration: CELEBRATION_KEY,
};

/** L'objet porté de cette sorte (ref), s'il est à moi ; null pour « aucun ». */
export function equipped(kind: 'contour' | 'fond' | 'titre' | 'celebration'): string | null {
  const v = getSetting(KIND_KEY[kind]!);
  return v && itemOf(kind, v) && owns(`${kind}:${v}`) ? v : null;
}

/**
 * Porte un objet (ou retire le contour, le fond, le titre ou la célébration avec `ref` vide).
 * Pour un thème, l'appelant l'applique avec ThemeSwitch : il faut redessiner toute l'app.
 */
export function equip(kind: Kind, ref: string) {
  if (ref && !owns(`${kind}:${ref}`)) return false;
  const key = KIND_KEY[kind];
  if (key) setSetting(key, ref);
  changed();
  return true;
}

export function isEquipped(i: Item): boolean {
  if (i.kind === 'costume') return getSetting(SKIN_KEY) === i.ref;
  if (i.kind === 'theme') return currentTheme() === i.ref;
  return equipped(i.kind) === i.ref;
}

/* ---------- Boutique ---------- */

export function buy(id: string): boolean {
  const i = BY_ID.get(id);
  const s = load();
  if (!i || id in s.owned || s.chalk < PRICE[i.rarity]) return false;
  save({ ...s, chalk: s.chalk - PRICE[i.rarity], owned: { ...s.owned, [id]: Date.now() } });
  return true;
}

/* ---------- Ouvrir un pack ---------- */

type Rng = () => number;

function rollRarity(odds: number[], rng: Rng): number {
  let x = rng();
  for (let i = 0; i < odds.length; i++) {
    x -= odds[i];
    if (x < 0) return i;
  }
  return 0;
}

/** Les raretés des 5 cartes d'un pack, avec les garanties et le compteur de Légendaire. */
function packRarities(kind: PackKind, pity: number, rng: Rng): { ranks: number[]; pity: number } {
  const ranks = Array.from({ length: CARDS_PER_PACK }, () => rollRarity(kind === 'exploit' ? ODDS.exploit : ODDS.normal, rng));
  const lift = (min: number) => {
    if (Math.max(...ranks) >= min) return;
    const i = ranks.indexOf(Math.max(...ranks));
    ranks[i] = min;
  };
  if (kind === 'bienvenue') {
    ranks[0] = Math.max(ranks[0], 3);
    ranks[1] = Math.max(ranks[1], 2);
  }
  lift(kind === 'exploit' ? 2 : 1);
  let next = pity + 1;
  if (Math.max(...ranks) >= 3) next = 0;
  else if (next >= PITY) {
    lift(rng() < 0.15 ? 4 : 3);
    next = 0;
  }
  return { ranks, pity: next };
}

/** Choisit un objet de cette rareté : jamais deux fois le même dans un pack, et plutôt du neuf. */
function pickItem(rank: number, owned: Record<string, number>, taken: Set<string>, rng: Rng): Item | null {
  for (let r = rank; r >= 0; r--) {
    const pool = CATALOG.filter((i) => rarityRank(i.rarity) === r && !taken.has(i.id));
    if (!pool.length) continue;
    const missing = pool.filter((i) => !(i.id in owned));
    // Légendaires et Mythiques : toujours du neuf tant qu'il en reste.
    const fresh = missing.length > 0 && (r >= 3 || rng() < NEW_BIAS);
    const from = fresh ? missing : pool;
    return from[Math.floor(rng() * from.length)];
  }
  return null;
}

/**
 * Ouvre un pack : tire ses 5 cartes et les enregistre aussitôt (fermer l'app pendant
 * l'animation ne fait rien perdre). Les cartes sont rangées de la moins rare à la plus rare.
 */
export function openPack(packId: string, rng: Rng = Math.random) {
  const s = load();
  const pack = s.packs.find((p) => p.id === packId);
  if (!pack) return null;
  const { ranks, pity } = packRarities(pack.kind, s.pity, rng);
  const owned = { ...s.owned };
  const fresh = [...s.fresh];
  const taken = new Set<string>();
  let chalk = s.chalk + PACK_CHALK;
  const cards: PulledCard[] = [];
  for (const rank of ranks) {
    const i = pickItem(rank, owned, taken, rng);
    if (!i) continue;
    taken.add(i.id);
    if (i.id in owned) {
      chalk += DUPE_CHALK[i.rarity];
      cards.push({ item: i, isNew: false, chalk: DUPE_CHALK[i.rarity] });
    } else {
      owned[i.id] = Date.now();
      fresh.push(i.id);
      cards.push({ item: i, isNew: true, chalk: 0 });
    }
  }
  cards.sort((a, b) => rarityRank(a.item.rarity) - rarityRank(b.item.rarity));
  save({ ...s, owned, fresh, chalk, pity, opened: s.opened + 1, packs: s.packs.filter((p) => p.id !== packId) });
  return { pack, cards, chalk: chalk - s.chalk, best: cards.length ? cards[cards.length - 1].item.rarity : RARITIES[0].id };
}

export type OpenedPack = NonNullable<ReturnType<typeof openPack>>;

/* ---------- Gagner des packs ---------- */

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « 8 octobre », « 1er mai » */
export function longDate(iso: string) {
  const d = Number(iso.slice(8, 10));
  return `${d === 1 ? '1er' : d} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
}

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** Lundi de la semaine de ce jour. */
function weekOf(iso: string) {
  const d = new Date(utc(iso));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

type Reward = { key: string; kind: PackKind; reason: string; date: string };

/** Toutes les récompenses méritées d'après le carnet (déjà données ou non). */
function rewards(blocks: Block[], logs: TrainingLog[]): Reward[] {
  const out: Reward[] = [];
  const valid = [...validatedDays(blocks)].sort();

  // Une séance validée = un pack.
  for (const d of valid) out.push({ key: `seance:${d}`, kind: 'seance', reason: `Séance du ${longDate(d)}`, date: d });

  // Trois jours d'entraînement dans la même semaine.
  const trainingDays = new Map<string, Set<string>>();
  for (const l of logs) {
    const w = weekOf(l.date);
    if (!trainingDays.has(w)) trainingDays.set(w, new Set());
    trainingDays.get(w)!.add(l.date);
  }
  for (const [w, days] of trainingDays) {
    if (days.size < 3) continue;
    const third = [...days].sort()[2];
    out.push({ key: `entrainement:${w}`, kind: 'entrainement', reason: '3 jours d’entraînement dans la semaine', date: third });
  }

  // Série : chaque fois 4 semaines d'affilée avec au moins 2 séances validées.
  const perWeek = new Map<string, number>();
  valid.forEach((d) => perWeek.set(weekOf(d), (perWeek.get(weekOf(d)) ?? 0) + 1));
  if (valid.length) {
    let streak = 0;
    for (let t = utc(weekOf(valid[0])); t <= utc(valid[valid.length - 1]); t += 7 * DAY) {
      const w = new Date(t).toISOString().slice(0, 10);
      streak = (perWeek.get(w) ?? 0) >= 2 ? streak + 1 : 0;
      if (streak > 0 && streak % 4 === 0) {
        out.push({ key: `serie:${w}`, kind: 'exploit', reason: `${streak} semaines d’affilée avec 2 séances`, date: w });
      }
    }
  }

  // Flash à son niveau (un par jour au plus) : au moins la moyenne de ses 5 meilleures réussites d'avant.
  const sends = blocks
    .filter((b) => isSent(b.result))
    .map((b) => ({ b, r: gradeRating(b.grade, b.gradeSystem) }))
    .filter((x): x is { b: Block; r: number } => x.r !== null)
    .sort((a, b) => (a.b.date < b.b.date ? -1 : a.b.date > b.b.date ? 1 : a.b.id - b.b.id));
  const best: number[] = [];
  const flashed = new Set<string>();
  for (let i = 0; i < sends.length; ) {
    const day = sends[i].b.date;
    const level = best.length >= 3 ? best.slice(0, 5).reduce((a, v) => a + v, 0) / Math.min(5, best.length) : Infinity;
    const today: typeof sends = [];
    while (i < sends.length && sends[i].b.date === day) today.push(sends[i++]);
    const top = today.filter((x) => isFirstTry(x.b.result) && x.r >= level - 1).sort((a, b) => b.r - a.r)[0];
    if (top && !flashed.has(day)) {
      flashed.add(day);
      out.push({ key: `flash:${day}`, kind: 'exploit', reason: `Flash en ${top.b.grade} à ton niveau`, date: day });
    }
    today.forEach((x) => best.push(x.r));
    best.sort((a, b) => b - a);
  }
  return out;
}

/** Meilleure cotation réussie de chaque discipline. */
function bestRecords(blocks: Block[]) {
  const out: Record<string, { r: number; grade: string }> = {};
  for (const b of blocks) {
    if (!isSent(b.result)) continue;
    const r = gradeRating(b.grade, b.gradeSystem);
    if (r !== null && r > (out[b.discipline]?.r ?? -1)) out[b.discipline] = { r, grade: b.grade };
  }
  return out;
}

/**
 * Donne les packs mérités depuis la dernière fois (à appeler après une grimpe, un entraînement,
 * ou en ouvrant la Progression). La première fois : pack de bienvenue, un pack par séance déjà
 * validée (les 10 plus récentes), et le costume et le thème portés restent acquis.
 * Renvoie les nouveaux packs.
 */
export function syncRewards(blocks: Block[], logs: TrainingLog[], today: string): Pack[] {
  const s = load();
  const first = !s.since;
  const granted = { ...s.granted };
  const added: Pack[] = [];
  const give = (r: Reward) => {
    granted[r.key] = 1;
    const pack: Pack = { id: r.key, kind: r.kind, reason: r.reason, date: r.date };
    added.push(pack);
  };

  const all = rewards(blocks, logs).filter((r) => !granted[r.key]);
  const records = bestRecords(blocks);
  const tier = TIERS.findIndex((t) => t.id === playerCard(blocks, logs, today).tier);
  const owned = { ...s.owned };
  const next: State = { ...s };

  if (first) {
    // Le passé : tout est marqué comme déjà donné, sauf les 10 dernières séances.
    const sessions = all.filter((r) => r.kind === 'seance').slice(-PAST_SESSIONS);
    all.forEach((r) => (granted[r.key] = 1));
    give({ key: 'bienvenue', kind: 'bienvenue', reason: 'Pour démarrer ta collection', date: today });
    sessions.reverse().forEach((r) => give(r));
    next.records = Object.fromEntries(Object.entries(records).map(([d, x]) => [d, x.r]));
    next.tier = tier;
    next.since = today;
    // Ce qu'on porte déjà reste à soi.
    const skin = getSetting(SKIN_KEY);
    if (skin && itemOf('costume', skin)) owned[`costume:${skin}`] = Date.now();
    const theme = currentTheme();
    if (itemOf('theme', theme)) owned[`theme:${theme}`] = Date.now();
  } else {
    all.forEach(give);
    // Nouveau record dans une discipline.
    const known = { ...s.records };
    for (const [d, x] of Object.entries(records)) {
      if (x.r > (known[d] ?? Infinity) + 0.01) {
        const key = `record:${d}:${Math.round(x.r * 10)}`;
        if (!granted[key]) give({ key, kind: 'exploit', reason: `Nouveau record en ${d} : ${x.grade}`, date: today });
      }
      known[d] = Math.max(known[d] ?? -1, x.r);
    }
    next.records = known;
    // Nouvelle carte (Argent, Or, Légende) atteinte pour la première fois.
    if (tier > s.tier) {
      const t = TIERS[tier];
      const key = `palier:${t.id}`;
      if (!granted[key]) give({ key, kind: 'exploit', reason: `Carte ${t.name} débloquée`, date: today });
      next.tier = tier;
    }
  }

  if (!first && added.length === 0 && next.tier === s.tier && JSON.stringify(next.records) === JSON.stringify(s.records)) return [];
  save({ ...next, owned, granted, packs: [...s.packs, ...added] });
  return added;
}

/** Donne les packs mérités d'après tout le carnet enregistré (grimpes et entraînements). */
export function syncFromJournal(): Pack[] {
  return syncRewards(listBlocks(), listTrainingLogs(), todayIso());
}
