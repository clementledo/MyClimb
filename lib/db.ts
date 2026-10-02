import * as SQLite from 'expo-sqlite';

import type { BlockResult, GradeSystem } from './climbing';

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
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`);

export type Gym = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /** Référence Google de la première photo de la salle (non stockée en base). */
  photoName?: string | null;
};

export type Block = {
  id: number;
  gymId: string;
  gymName: string;
  photoUri: string | null;
  color: string | null;
  grade: string;
  gradeSystem: GradeSystem;
  styles: string[];
  result: BlockResult;
  attempts: number;
  date: string;
  note: string | null;
};

export type BlockInput = Omit<Block, 'id' | 'gymName'>;

type BlockRow = {
  id: number;
  gym_id: string;
  gym_name: string;
  photo_uri: string | null;
  color: string | null;
  grade: string;
  grade_system: GradeSystem;
  styles: string;
  result: BlockResult;
  attempts: number;
  date: string;
  note: string | null;
};

function toBlock(r: BlockRow): Block {
  return {
    id: r.id,
    gymId: r.gym_id,
    gymName: r.gym_name,
    photoUri: r.photo_uri,
    color: r.color,
    grade: r.grade,
    gradeSystem: r.grade_system,
    styles: JSON.parse(r.styles),
    result: r.result,
    attempts: r.attempts,
    date: r.date,
    note: r.note,
  };
}

const BLOCK_SELECT = `
  SELECT b.*, g.name AS gym_name FROM blocks b JOIN gyms g ON g.id = b.gym_id
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

export function getBlock(id: number): Block | null {
  const row = db.getFirstSync<BlockRow>(`${BLOCK_SELECT} WHERE b.id = ?`, id);
  return row ? toBlock(row) : null;
}

export function countBlocksByGym(): Record<string, number> {
  const rows = db.getAllSync<{ gym_id: string; n: number }>(
    'SELECT gym_id, COUNT(*) AS n FROM blocks GROUP BY gym_id',
  );
  return Object.fromEntries(rows.map((r) => [r.gym_id, r.n]));
}

export function insertBlock(b: BlockInput): number {
  const res = db.runSync(
    `INSERT INTO blocks (gym_id, photo_uri, color, grade, grade_system, styles, result, attempts, date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    b.gymId, b.photoUri, b.color, b.grade, b.gradeSystem, JSON.stringify(b.styles),
    b.result, b.attempts, b.date, b.note, Date.now(),
  );
  return res.lastInsertRowId;
}

export function updateBlock(id: number, b: BlockInput) {
  db.runSync(
    `UPDATE blocks SET gym_id = ?, photo_uri = ?, color = ?, grade = ?, grade_system = ?, styles = ?,
       result = ?, attempts = ?, date = ?, note = ? WHERE id = ?`,
    b.gymId, b.photoUri, b.color, b.grade, b.gradeSystem, JSON.stringify(b.styles),
    b.result, b.attempts, b.date, b.note, id,
  );
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
