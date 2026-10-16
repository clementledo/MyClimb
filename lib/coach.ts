/** État de l'entraînement : niveau par catégorie, programme de 8 semaines, progression automatique. */
import type { Feel } from './climbing';
import { getSetting, listTrainingLogs, setSetting, type TrainingLog } from './db';
import { todayIso } from './stats';
import { CATS, phaseOf, PROGRAM_WEEKS, sessionById, type Cat, type Lv, type Session } from './training';

/* ---------- Niveaux ---------- */

const LEVELS_KEY = 'trainingLevels';
type LevelState = { levels: Record<Cat, Lv>; easy: Partial<Record<Cat, number>> };

function readLevels(): LevelState {
  const base = Object.fromEntries(Object.keys(CATS).map((c) => [c, 2])) as Record<Cat, Lv>;
  try {
    const raw = getSetting(LEVELS_KEY);
    const v = raw ? (JSON.parse(raw) as LevelState) : null;
    return { levels: { ...base, ...v?.levels }, easy: v?.easy ?? {} };
  } catch {
    return { levels: base, easy: {} };
  }
}

export const myLevels = () => readLevels().levels;
export const levelOf = (cat: Cat): Lv => readLevels().levels[cat];

export function setLevel(cat: Cat, lv: Lv) {
  const s = readLevels();
  s.levels[cat] = lv;
  s.easy[cat] = 0;
  setSetting(LEVELS_KEY, JSON.stringify(s));
}

/**
 * Après une séance : deux séances « Facile » de suite dans une catégorie font monter d'un niveau.
 * Renvoie le nouveau niveau s'il change.
 */
export function afterSession(cat: Cat, played: Lv, feel: Feel | null): Lv | null {
  const s = readLevels();
  if (played < s.levels[cat]) return null;
  const n = feel === 'soft' ? (s.easy[cat] ?? 0) + 1 : 0;
  s.easy[cat] = n;
  let up: Lv | null = null;
  if (n >= 2 && s.levels[cat] < 3) {
    up = (s.levels[cat] + 1) as Lv;
    s.levels[cat] = up;
    s.easy[cat] = 0;
  }
  setSetting(LEVELS_KEY, JSON.stringify(s));
  return up;
}

/* ---------- Programme ---------- */

const PROGRAM_KEY = 'trainingProgram';
export type Program = { start: string; freq: 3 | 4 | 5 };

export function readProgram(): Program | null {
  try {
    const raw = getSetting(PROGRAM_KEY);
    return raw ? (JSON.parse(raw) as Program) : null;
  } catch {
    return null;
  }
}

export function startProgram(freq: 3 | 4 | 5) {
  setSetting(PROGRAM_KEY, JSON.stringify({ start: mondayOf(todayIso()), freq }));
}
export const stopProgram = () => setSetting(PROGRAM_KEY, '');
export function setFrequency(freq: 3 | 4 | 5) {
  const p = readProgram();
  if (p) setSetting(PROGRAM_KEY, JSON.stringify({ ...p, freq }));
}

const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);
export function mondayOf(iso: string) {
  const t = utc(iso);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return isoOf(t - dow * 86_400_000);
}

export type Week = { week: number; done: boolean; finished: boolean; start: string; end: string; phase: ReturnType<typeof phaseOf>; sessions: { session: Session; doneOn: string | null }[] };

/** Semaine en cours du programme et ses séances, cochées si faites cette semaine. */
export function currentWeek(p: Program, logs: TrainingLog[] = listTrainingLogs()): Week {
  const today = todayIso();
  const n = Math.floor((utc(mondayOf(today)) - utc(p.start)) / (7 * 86_400_000)) + 1;
  const week = Math.max(1, Math.min(PROGRAM_WEEKS, n));
  const start = isoOf(utc(p.start) + (week - 1) * 7 * 86_400_000);
  const end = isoOf(utc(start) + 6 * 86_400_000);
  const phase = phaseOf(week);
  const used = new Set<number>();
  const sessions = phase.plans[p.freq].map((id) => {
    const session = sessionById(id)!;
    const log = logs.find((l) => !used.has(l.id) && l.ref === id && l.date >= start && l.date <= end);
    if (log) used.add(log.id);
    return { session, doneOn: log?.date ?? null };
  });
  return { week, done: sessions.every((s) => s.doneOn), finished: n > PROGRAM_WEEKS, start, end, phase, sessions };
}
