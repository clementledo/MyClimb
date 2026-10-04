/**
 * Matériel disponible et suggestion de séance du jour.
 */
import { GRADES } from './climbing';
import { getSetting, setSetting, type Block, type TrainingLog } from './db';
import { computeStats, todayIso } from './stats';
import {
  EQUIPMENT,
  SESSIONS,
  sessionEquipment,
  type Equipment,
  type Exercise,
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
