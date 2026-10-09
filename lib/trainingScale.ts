import { getSetting, setSetting } from './db';
import type { Dose, Exercise } from './training';

/** Bouton Facile / Normal / Dur : adapte les séries et les temps d'un exercice, retenu par exercice. */
export type Scale = 'facile' | 'normal' | 'dur';

export const SCALES: { value: Scale; label: string }[] = [
  { value: 'facile', label: 'Facile' },
  { value: 'normal', label: 'Normal' },
  { value: 'dur', label: 'Dur' },
];

const KEY = 'doseScale';

function readAll(): Record<string, Scale> {
  try {
    return JSON.parse(getSetting(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export const scaleOf = (id: string): Scale => readAll()[id] ?? 'normal';

export function setScale(id: string, scale: Scale) {
  const all = readAll();
  if (scale === 'normal') delete all[id];
  else all[id] = scale;
  setSetting(KEY, JSON.stringify(all));
}

export function scaleDose(d: Dose, scale: Scale): Dose {
  if (scale === 'normal') return d;
  const f = scale === 'dur' ? 1.3 : 0.7;
  const sets = Math.max(1, d.sets + (scale === 'dur' ? 1 : -1));
  // Effort tenu : on change la durée ; répétitions comptées : le nombre de répétitions.
  if (d.work > 0) return { ...d, sets, work: Math.max(3, Math.round(d.work * f)) };
  return { ...d, sets, reps: d.reps > 1 ? Math.max(1, Math.round(d.reps * f)) : d.reps };
}

const dur = (s: number) => (s < 60 ? `${s} s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)} min ${s % 60}`);

/** Dose lisible recalculée, ex. « 7 × 13 s, repos 3 min ». */
export function doseText(d: Dose): string {
  const side = d.sides ? ' par côté' : '';
  const effort =
    d.work > 0 && d.reps > 1
      ? `${d.sets} séries de ${d.reps} × (${d.work} s / ${d.restRep ?? 0} s)`
      : d.work > 0
        ? `${d.sets} × ${d.work} s${side}`
        : d.reps > 1
          ? `${d.sets} × ${d.reps}${side}`
          : `${d.sets} séries${side}`;
  return `${effort}, repos ${dur(d.rest)}`;
}

/** L'exercice tel qu'il sera fait, au niveau choisi. */
export function scaled(x: Exercise, scale: Scale = scaleOf(x.id)): Exercise {
  if (scale === 'normal') return x;
  const dose = scaleDose(x.dose, scale);
  return { ...x, dose, doseText: doseText(dose) };
}
