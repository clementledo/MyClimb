import * as SQLite from 'expo-sqlite';

import type { BlockResult, Discipline, Feel, GradeSystem, Rope } from './climbing';

export const db = SQLite.openDatabaseSync('myclimb.db');

db.execSync(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS gyms (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id TEXT NOT NULL REFERENCES gyms(id),
    photo_uri TEXT,
    color TEXT,
    grade TEXT NOT NULL,
    grade_system TEXT NOT NULL,
    styles TEXT NOT NULL DEFAULT '[]',
    result TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    date TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS blocks_gym ON blocks(gym_id);
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    ts INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS spots (
    name TEXT PRIMARY KEY NOT NULL,
    lat REAL,
    lng REAL,
    last_used INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`);

// Version 1 : voies, extérieur et caractéristiques détaillées. La salle devient facultative.
if ((db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0) < 1) {
  db.withTransactionSync(() => {
    db.execSync(`
      CREATE TABLE blocks_v1 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discipline TEXT NOT NULL DEFAULT 'bloc',
        outdoor INTEGER NOT NULL DEFAULT 0,
        gym_id TEXT REFERENCES gyms(id),
        site TEXT,
        name TEXT,
        photo_uri TEXT,
        color TEXT,
        grade TEXT NOT NULL,
        grade_system TEXT NOT NULL,
        styles TEXT NOT NULL DEFAULT '[]',
        holds TEXT NOT NULL DEFAULT '[]',
        moves TEXT NOT NULL DEFAULT '[]',
        rope TEXT,
        feel TEXT,
        result TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 1,
        date TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL
      );
      INSERT INTO blocks_v1 (id, gym_id, photo_uri, color, grade, grade_system, styles, result, attempts, date, note, created_at)
        SELECT id, gym_id, photo_uri, color, grade, grade_system, styles, result, attempts, date, note, created_at FROM blocks;
      DROP TABLE blocks;
      ALTER TABLE blocks_v1 RENAME TO blocks;
      CREATE INDEX IF NOT EXISTS blocks_gym ON blocks(gym_id);
      PRAGMA user_version = 1;
    `);
  });
}

export type Gym = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /** Référence Google de la première photo de la salle (non stockée en base). */
  photoName?: string | null;
};

/** Une grimpe du carnet : un bloc ou une voie, en salle ou dehors. */
export type Block = {
  id: number;
  discipline: Discipline;
  outdoor: boolean;
  /** Salle, en intérieur. */
  gymId: string | null;
  gymName: string | null;
  /** Site ou secteur, en extérieur. */
  site: string | null;
  name: string | null;
  photoUri: string | null;
  color: string | null;
  grade: string;
  gradeSystem: GradeSystem;
  /** Profil du mur. */
  styles: string[];
  holds: string[];
  moves: string[];
  rope: Rope | null;
  feel: Feel | null;
  result: BlockResult;
  attempts: number;
  date: string;
  note: string | null;
};

export type BlockInput = Omit<Block, 'id' | 'gymName'>;

type BlockRow = {
  id: number;
  discipline: Discipline;
  outdoor: number;
  gym_id: string | null;
  gym_name: string | null;
  site: string | null;
  name: string | null;
  photo_uri: string | null;
  color: string | null;
  grade: string;
  grade_system: GradeSystem;
  styles: string;
  holds: string;
  moves: string;
  rope: Rope | null;
  feel: Feel | null;
  result: BlockResult;
  attempts: number;
  date: string;
  note: string | null;
};

function toBlock(r: BlockRow): Block {
  return {
    id: r.id,
    discipline: r.discipline,
    outdoor: r.outdoor === 1,
    gymId: r.gym_id,
    gymName: r.gym_name,
    site: r.site,
    name: r.name,
    photoUri: r.photo_uri,
    color: r.color,
    grade: r.grade,
    gradeSystem: r.grade_system,
    styles: JSON.parse(r.styles),
    holds: JSON.parse(r.holds),
    moves: JSON.parse(r.moves),
    rope: r.rope,
    feel: r.feel,
    result: r.result,
    attempts: r.attempts,
    date: r.date,
    note: r.note,
  };
}

const BLOCK_SELECT = `
  SELECT b.*, g.name AS gym_name FROM blocks b LEFT JOIN gyms g ON g.id = b.gym_id
`;

export function saveGym(gym: Gym) {
  db.runSync(
    `INSERT INTO gyms (id, name, address, lat, lng, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, address = excluded.address,
       lat = excluded.lat, lng = excluded.lng, updated_at = excluded.updated_at`,
    gym.id, gym.name, gym.address, gym.lat, gym.lng, Date.now(),
  );
}

export function getGym(id: string): Gym | null {
  return db.getFirstSync<Gym>('SELECT id, name, address, lat, lng FROM gyms WHERE id = ?', id);
}

export function listSavedGyms(): Gym[] {
  return db.getAllSync<Gym>(
    `SELECT g.id, g.name, g.address, g.lat, g.lng FROM gyms g
     WHERE EXISTS (SELECT 1 FROM blocks b WHERE b.gym_id = g.id) ORDER BY g.name`,
  );
}

export function listBlocks(gymId?: string): Block[] {
  const rows = gymId
    ? db.getAllSync<BlockRow>(`${BLOCK_SELECT} WHERE b.gym_id = ? ORDER BY b.date DESC, b.id DESC`, gymId)
    : db.getAllSync<BlockRow>(`${BLOCK_SELECT} ORDER BY b.date DESC, b.id DESC`);
  return rows.map(toBlock);
}

/** Grimpes ajoutées depuis `since` (horodatage en ms), les plus récentes d'abord. */
export function listBlocksAddedSince(since: number): Block[] {
  return db
    .getAllSync<BlockRow>(`${BLOCK_SELECT} WHERE b.created_at >= ? ORDER BY b.created_at DESC`, since)
    .map(toBlock);
}

export function getBlock(id: number): Block | null {
  const row = db.getFirstSync<BlockRow>(`${BLOCK_SELECT} WHERE b.id = ?`, id);
  return row ? toBlock(row) : null;
}

export function countBlocksByGym(): Record<string, number> {
  const rows = db.getAllSync<{ gym_id: string; n: number }>(
    'SELECT gym_id, COUNT(*) AS n FROM blocks WHERE gym_id IS NOT NULL GROUP BY gym_id',
  );
  return Object.fromEntries(rows.map((r) => [r.gym_id, r.n]));
}

const BLOCK_COLUMNS = [
  'discipline', 'outdoor', 'gym_id', 'site', 'name', 'photo_uri', 'color', 'grade', 'grade_system',
  'styles', 'holds', 'moves', 'rope', 'feel', 'result', 'attempts', 'date', 'note',
];

function blockValues(b: BlockInput) {
  return [
    b.discipline, b.outdoor ? 1 : 0, b.gymId, b.site, b.name, b.photoUri, b.color, b.grade, b.gradeSystem,
    JSON.stringify(b.styles), JSON.stringify(b.holds), JSON.stringify(b.moves), b.rope, b.feel,
    b.result, b.attempts, b.date, b.note,
  ];
}

export function insertBlock(b: BlockInput): number {
  const res = db.runSync(
    `INSERT INTO blocks (${BLOCK_COLUMNS.join(', ')}, created_at)
     VALUES (${BLOCK_COLUMNS.map(() => '?').join(', ')}, ?)`,
    ...blockValues(b), Date.now(),
  );
  return res.lastInsertRowId;
}

export function updateBlock(id: number, b: BlockInput) {
  db.runSync(
    `UPDATE blocks SET ${BLOCK_COLUMNS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
    ...blockValues(b), id,
  );
}

/** Spot extérieur : un site où tu as fait au moins une séance. */
export type Spot = { name: string; lat: number | null; lng: number | null; lastUsed: number; climbs: number };

/** Enregistre un spot au démarrage d'une séance ; garde sa position si on la connaît. */
export function saveSpot(name: string, pos: { latitude: number; longitude: number } | null) {
  db.runSync(
    `INSERT INTO spots (name, lat, lng, last_used) VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET lat = COALESCE(excluded.lat, lat), lng = COALESCE(excluded.lng, lng),
       last_used = excluded.last_used`,
    name, pos?.latitude ?? null, pos?.longitude ?? null, Date.now(),
  );
}

/** Spots extérieurs, du plus récent au plus ancien, avec le nombre de grimpes faites sur chacun. */
export function listSpots(): Spot[] {
  return db.getAllSync<Spot>(
    `SELECT name, lat, lng, last_used AS lastUsed,
       (SELECT COUNT(*) FROM blocks b WHERE b.outdoor = 1 AND b.site = s.name) AS climbs
     FROM spots s
     UNION ALL
     SELECT site, NULL, NULL, MAX(created_at), COUNT(*) FROM blocks
     WHERE outdoor = 1 AND site IS NOT NULL AND site NOT IN (SELECT name FROM spots) GROUP BY site
     ORDER BY lastUsed DESC`,
  );
}

/** Sites extérieurs déjà utilisés, du plus récent au plus ancien. */
export function listSites(): string[] {
  return db
    .getAllSync<{ site: string }>(
      'SELECT site FROM blocks WHERE site IS NOT NULL GROUP BY site ORDER BY MAX(date) DESC',
    )
    .map((r) => r.site);
}

export function deleteBlock(id: number) {
  db.runSync('DELETE FROM blocks WHERE id = ?', id);
}

export function getSetting(key: string): string | null {
  return db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}

/** Valeur en cache si elle a moins de `maxAgeMs`, sinon null. */
export function readCache<T>(key: string, maxAgeMs: number): T | null {
  const row = db.getFirstSync<{ value: string; ts: number }>('SELECT value, ts FROM cache WHERE key = ?', key);
  if (!row || Date.now() - row.ts > maxAgeMs) return null;
  return JSON.parse(row.value) as T;
}

export function writeCache(key: string, value: unknown) {
  db.runSync(
    'INSERT INTO cache (key, value, ts) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, ts = excluded.ts',
    key, JSON.stringify(value), Date.now(),
  );
}
