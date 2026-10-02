import {
  GRADES,
  HOLD_TYPES,
  isFirstTry,
  isSent,
  MOVE_TYPES,
  placeKey,
  placeOf,
  STYLES,
  type GradeSystem,
} from './climbing';
import type { Block } from './db';

export type Period = '30' | '90' | '365' | 'all';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function periodStart(period: Period, blocks: Block[]): string {
  if (period !== 'all') {
    const d = utc(todayIso());
    d.setUTCDate(d.getUTCDate() - Number(period) + 1);
    return iso(d);
  }
  return blocks.reduce((m, b) => (b.date < m ? b.date : m), todayIso());
}

type Unit = 'week' | 'month';

function bucketOf(date: string, unit: Unit) {
  if (unit === 'month') return `${date.slice(0, 7)}-01`;
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
}

/** Périodes successives (semaines ou mois) de `from` à aujourd'hui. */
export function buckets(from: string) {
  const days = (utc(todayIso()).getTime() - utc(from).getTime()) / 86_400_000;
  const unit: Unit = days <= 120 ? 'week' : 'month';
  const keys: string[] = [];
  const d = utc(bucketOf(from, unit));
  const end = bucketOf(todayIso(), unit);
  while (iso(d) <= end && keys.length < 120) {
    keys.push(iso(d));
    if (unit === 'week') d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  const multiYear = keys.length > 0 && keys[0].slice(0, 4) !== keys[keys.length - 1].slice(0, 4);
  const label = (k: string) => {
    const dt = utc(k);
    if (unit === 'week') return `${k.slice(8, 10)}/${k.slice(5, 7)}`;
    const m = MONTHS[dt.getUTCMonth()];
    return multiYear ? `${m.replace('.', '')} ${k.slice(2, 4)}` : m;
  };
  return { unit, keys, labels: keys.map(label), of: (date: string) => bucketOf(date, unit) };
}

/** Répartition premier coup / réussi après essais / pas encore. */
function split(list: Block[]) {
  const first = list.filter((b) => isFirstTry(b.result)).length;
  const sent = list.filter((b) => isSent(b.result)).length;
  return [first, sent - first, list.length - sent];
}

function rates(list: Block[], names: string[], pick: (b: Block) => string[]) {
  const rows = names
    .map((name) => {
      const all = list.filter((b) => pick(b).includes(name));
      const sent = all.filter((b) => isSent(b.result)).length;
      return { label: name, total: all.length, sent, rate: all.length ? sent / all.length : 0 };
    })
    .filter((r) => r.total > 0);
  // Point faible : le taux le plus bas parmi les catégories assez essayées.
  const tried = rows.filter((r) => r.total >= 3);
  const weakest = tried.length > 1 ? tried.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;
  return {
    rows: rows.map((r) => ({ label: r.label, rate: r.rate, detail: `${Math.round(r.rate * 100)} % · ${r.sent}/${r.total}` })),
    weakest: weakest && weakest.rate < 1 ? weakest.label : null,
  };
}

export function computeStats(list: Block[], system: GradeSystem, from: string) {
  const ladder = GRADES[system];
  const graded = list.filter((b) => b.gradeSystem === system);
  const idx = (b: Block) => ladder.indexOf(b.grade);
  const sent = list.filter((b) => isSent(b.result));
  const sentGraded = graded.filter((b) => isSent(b.result));
  const best = sentGraded.reduce((m, b) => Math.max(m, idx(b)), -1);
  const avgSent = sentGraded.length ? sentGraded.reduce((a, b) => a + idx(b), 0) / sentGraded.length : null;
  const firstTry = list.filter((b) => isFirstTry(b.result)).length;
  const afterTries = sent.filter((b) => !isFirstTry(b.result));
  const sessions = new Set(list.map((b) => b.date)).size;

  // Évolution par semaine ou par mois.
  const bk = buckets(from);
  const byBucket = new Map<string, Block[]>();
  list.forEach((b) => {
    const k = bk.of(b.date);
    byBucket.set(k, [...(byBucket.get(k) ?? []), b]);
  });
  const level = bk.keys.map((k) => {
    const s = (byBucket.get(k) ?? []).filter((b) => b.gradeSystem === system && isSent(b.result)).map(idx);
    if (s.length === 0) return { max: null, avg: null };
    // Moyenne des 5 meilleures réussites de la période : plus stable que le maximum.
    const top = [...s].sort((a, b) => b - a).slice(0, 5);
    return { max: Math.max(...s), avg: top.reduce((a, b) => a + b, 0) / top.length };
  });
  const volume = bk.keys.map((k) => split(byBucket.get(k) ?? []));
  const sessionsPerBucket = bk.keys.map((k) => new Set((byBucket.get(k) ?? []).map((b) => b.date)).size);

  // Pyramide : de la cotation la plus dure à la plus facile essayée.
  const usedIdx = graded.map(idx).filter((i) => i >= 0);
  const pyramid =
    usedIdx.length === 0
      ? []
      : ladder
          .slice(Math.min(...usedIdx), Math.max(...usedIdx) + 1)
          .map((g) => ({ label: g, parts: split(graded.filter((b) => b.grade === g)) }))
          .reverse();

  const attemptsByGrade = ladder
    .map((g) => {
      const s = graded.filter((b) => b.grade === g && isSent(b.result));
      return { label: g, n: s.length, avg: s.length ? s.reduce((a, b) => a + b.attempts, 0) / s.length : 0 };
    })
    .filter((r) => r.n > 0)
    .reverse();

  const feel = (['soft', 'fair', 'hard'] as const).map((f) => list.filter((b) => b.feel === f).length);

  const placeNames = new Map(list.map((b) => [placeKey(b), placeOf(b)]));
  const places = [...placeNames.entries()]
    .map(([k, label]) => ({ label, parts: split(list.filter((b) => placeKey(b) === k)) }))
    .sort((a, b) => b.parts.reduce((x, y) => x + y, 0) - a.parts.reduce((x, y) => x + y, 0))
    .slice(0, 5);

  const ropes = list.filter((b) => b.discipline === 'voie' && b.rope);
  const rope = {
    lead: split(ropes.filter((b) => b.rope === 'lead')),
    toprope: split(ropes.filter((b) => b.rope === 'toprope')),
  };

  return {
    total: list.length,
    sent: sent.length,
    successRate: list.length ? sent.length / list.length : 0,
    firstTryRate: list.length ? firstTry / list.length : 0,
    firstTry,
    sessions,
    perSession: sessions ? list.length / sessions : 0,
    avgAttempts: afterTries.length ? afterTries.reduce((a, b) => a + b.attempts, 0) / afterTries.length : null,
    best: best >= 0 ? ladder[best] : null,
    avgGrade: avgSent === null ? null : ladder[Math.round(avgSent)],
    ladder,
    bucketLabels: bk.labels,
    bucketUnit: bk.unit,
    level,
    volume,
    sessionsPerBucket,
    pyramid,
    attemptsByGrade,
    profiles: rates(list, STYLES, (b) => b.styles),
    holds: rates(list, HOLD_TYPES, (b) => b.holds),
    moves: rates(list, MOVE_TYPES, (b) => b.moves),
    feel,
    places,
    rope,
  };
}
