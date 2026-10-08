/**
 * Matériel disponible, séance du jour et routine du jour.
 */
import { GRADES } from './climbing';
import { getSetting, setSetting, type Block, type TrainingLog } from './db';
import { computeStats, todayIso } from './stats';
import {
  EQUIPMENT,
  exerciseById,
  exerciseSeconds,
  routineById,
  ROUTINES,
  SESSIONS,
  sessionEquipment,
  type Equipment,
  type Exercise,
  type Routine,
  type SessionType,
} from './training';

/* ---------- Matériel ---------- */

const EQUIP_KEY = 'trainingEquipment';

export function myEquipment(): Equipment[] {
  const raw = getSetting(EQUIP_KEY);
  if (!raw) return EQUIPMENT.map((e) => e.id);
  try {
    return JSON.parse(raw) as Equipment[];
  } catch {
    return EQUIPMENT.map((e) => e.id);
  }
}

export function setMyEquipment(list: Equipment[]) {
  setSetting(EQUIP_KEY, JSON.stringify(list));
}

export const canDoSession = (s: SessionType, eq: Equipment[]) => sessionEquipment(s).every((e) => eq.includes(e));
export const canDoExercise = (x: Exercise, eq: Equipment[]) => x.equipment === 'none' || eq.includes(x.equipment);

/* ---------- Suggestion du jour ---------- */

export type Suggestion = { session: SessionType; reason: string };

const dayIso = (offset: number) => {
  const d = new Date(`${todayIso()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** Jours (aaaa-mm-jj) où il y a eu une séance de grimpe ou un entraînement intense. */
function hardDays(blocks: Block[], logs: TrainingLog[]) {
  const days = new Set(blocks.map((b) => b.date));
  logs.filter((l) => l.intensity >= 2).forEach((l) => days.add(l.date));
  return days;
}

export function suggest(blocks: Block[], logs: TrainingLog[], eq: Equipment[]): Suggestion | null {
  const available = SESSIONS.filter((s) => canDoSession(s, eq));
  if (available.length === 0) return null;
  const pick = (id: string) => available.find((s) => s.id === id);
  const last = logs[0]?.ref;

  // 1. Récupération si le corps a beaucoup donné ces derniers jours.
  const hard = hardDays(blocks, logs);
  const today = todayIso();
  const doneToday = hard.has(today);
  const twoDays = hard.has(dayIso(-1)) && hard.has(dayIso(-2));
  if (doneToday || twoDays) {
    const rest = pick('mobility') ?? pick('recovery') ?? pick('prehab');
    if (rest) {
      return {
        session: rest,
        reason: doneToday
          ? 'Tu as déjà grimpé ou entraîné aujourd’hui : place à la récupération.'
          : 'Deux jours d’affilée d’effort : une séance douce aide tes doigts à récupérer.',
      };
    }
  }

  // 2. Le point faible des 3 derniers mois (profil du mur, type de prise, mouvement).
  const from = dayIso(-89);
  const recent = blocks.filter((b) => b.date >= from);
  if (recent.length >= 10) {
    const system = recent.filter((b) => b.gradeSystem === 'font').length >= recent.length / 2 ? 'font' : recent[0].gradeSystem;
    if (GRADES[system]) {
      const st = computeStats(recent, system, from);
      const weak = [st.profiles, st.holds, st.moves]
        .filter((r) => r.weakest)
        .map((r) => ({ label: r.weakest as string, row: r.rows.find((x) => x.label === r.weakest) }))
        .sort((a, b) => (a.row?.rate ?? 1) - (b.row?.rate ?? 1));
      for (const w of weak) {
        const matches = available.filter((s) => s.targets.includes(w.label));
        const s = matches.find((m) => m.id !== last) ?? matches[0];
        if (s) {
          const pct = w.row ? ` (${Math.round(w.row.rate * 100)} % de réussite sur 3 mois)` : '';
          return { session: s, reason: `Ton point faible : ${w.label.toLowerCase()}${pct}.` };
        }
      }
    }
  }

  // 3. Sinon, on alterne selon le jour, sans refaire la dernière séance.
  const order = ['technique', 'pull', 'limit', 'core', 'endurance', 'prehab', 'fingers'];
  const start = new Date().getDay();
  for (let i = 0; i < order.length; i++) {
    const s = pick(order[(start + i) % order.length]);
    if (s && s.id !== last) {
      return {
        session: s,
        reason: recent.length < 10 ? 'Note quelques grimpes pour des conseils selon tes points faibles.' : 'Pour varier ton entraînement.',
      };
    }
  }
  return { session: available[0], reason: 'Pour varier ton entraînement.' };
}

/* ---------- Routines du quotidien ---------- */

export const canDoRoutine = (r: Routine, eq: Equipment[]) =>
  r.items.every((id) => {
    const x = exerciseById(id);
    return !!x && canDoExercise(x, eq);
  });

export type RoutinePick = { routine: Routine; reason: string };

/** Programme de la semaine : la force en début de semaine, la souplesse le week-end (0 = dimanche). */
const WEEK: string[] = ['soir', 'tirage', 'hanches', 'gainage', 'doigts', 'epaules', 'reveil'];
const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/** Routine conseillée aujourd'hui, selon le jour, la grimpe du jour et la récupération. */
export function routineOfDay(blocks: Block[], logs: TrainingLog[], eq: Equipment[]): RoutinePick | null {
  const available = ROUTINES.filter((r) => canDoRoutine(r, eq));
  if (available.length === 0) return null;
  const day = new Date().getDay();
  const today = todayIso();
  const climbedToday = blocks.some((b) => b.date === today);
  // Une routine de force sans repos depuis la veille : on passe à la souplesse.
  const forceYesterday = logs.some(
    (l) => l.kind === 'routine' && l.date === dayIso(-1) && ROUTINES.find((r) => r.id === l.ref && !r.daily),
  );
  const soft = available.filter((r) => r.kind === 'souplesse');
  for (let i = 0; i < WEEK.length; i++) {
    const r = available.find((x) => x.id === WEEK[(day + i) % WEEK.length]);
    if (!r) continue;
    if (!r.daily && (climbedToday || forceYesterday) && soft.length) {
      const alt = soft.find((x) => x.id === 'soir') ?? soft[0];
      return {
        routine: alt,
        reason: climbedToday
          ? 'Tu as grimpé aujourd’hui : on garde la force pour un autre jour.'
          : 'Force hier : aujourd’hui, on assouplit.',
      };
    }
    const reason =
      i > 0
        ? 'Pour varier ta semaine.'
        : r.kind === 'souplesse'
          ? `${DAY_NAMES[day]}, place à la souplesse.`
          : r.kind === 'prevention'
            ? `${DAY_NAMES[day]}, on protège les épaules.`
            : `${DAY_NAMES[day]}, place à la force.`;
    return { routine: r, reason };
  }
  return { routine: available[0], reason: 'Pour varier ta semaine.' };
}

/** Les 7 derniers jours (le plus ancien d'abord), avec ou sans routine faite. */
export function routineWeek(logs: TrainingLog[]) {
  const done = new Set(logs.filter((l) => l.kind === 'routine').map((l) => l.date));
  return [-6, -5, -4, -3, -2, -1, 0].map((o) => {
    const date = dayIso(o);
    const [y, m, d] = date.split('-').map(Number);
    const letter = 'DLMMJVS'[new Date(y, m - 1, d).getDay()];
    return { date, letter, done: done.has(date), today: o === 0 };
  });
}

/** Jours d'affilée avec au moins une routine (aujourd'hui compte s'il est déjà fait). */
export function routineStreak(logs: TrainingLog[]) {
  const done = new Set(logs.filter((l) => l.kind === 'routine').map((l) => l.date));
  let o = done.has(todayIso()) ? 0 : -1;
  let n = 0;
  while (done.has(dayIso(o))) {
    n++;
    o--;
  }
  return n;
}

/* Cases cochées pendant une routine : gardées jusqu'au soir, effacées le lendemain. */
const CHECKS_KEY = 'routineChecks';

type Checks = { date: string; byId: Record<string, string[]> };

function readChecks(): Checks {
  try {
    const c = JSON.parse(getSetting(CHECKS_KEY) ?? '') as Checks;
    if (c.date === todayIso()) return c;
  } catch {
    // Rien d'enregistré.
  }
  return { date: todayIso(), byId: {} };
}

export const routineChecks = (id: string) => readChecks().byId[id] ?? [];

export function setRoutineChecks(id: string, done: string[]) {
  const c = readChecks();
  c.byId[id] = done;
  setSetting(CHECKS_KEY, JSON.stringify(c));
}

/* ---------- Routines créées par l'utilisateur ---------- */

const CUSTOM_KEY = 'customRoutines';

export const isCustomRoutine = (id: string) => id.startsWith('perso-');

export function customRoutines(): Routine[] {
  try {
    const list = JSON.parse(getSetting(CUSTOM_KEY) ?? '[]') as Routine[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveCustomRoutine(r: Routine) {
  const list = customRoutines();
  const i = list.findIndex((x) => x.id === r.id);
  if (i >= 0) list[i] = r;
  else list.push(r);
  setSetting(CUSTOM_KEY, JSON.stringify(list));
}

export function deleteCustomRoutine(id: string) {
  setSetting(CUSTOM_KEY, JSON.stringify(customRoutines().filter((r) => r.id !== id)));
}

/** Routine toute faite ou créée par l'utilisateur. */
export const findRoutine = (id: string) => customRoutines().find((r) => r.id === id) ?? routineById(id);

/** Durée approximative d'une liste d'exercices, en minutes (repos compris, quelques secondes par répétition). */
export function routineMinutes(items: string[]) {
  const secs = items.reduce((sum, id) => {
    const x = exerciseById(id);
    if (!x) return sum;
    const d = x.dose;
    const counted = d.work > 0 ? 0 : (d.sides ? 2 : 1) * d.sets * d.reps * 4;
    return sum + exerciseSeconds(d) + counted + 30;
  }, 0);
  return Math.max(5, Math.round(secs / 60));
}
