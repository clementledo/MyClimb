/**
 * Données de démonstration pour les captures de la vidéo de présentation (branche promo seulement).
 * Remplit le carnet avec ~4 mois de séances dans les salles trouvées autour de la position.
 */
import { HOLD_COLORS, HOLD_TYPES, MOVE_TYPES, STYLES, GRADES, type BlockResult } from './climbing';
import { db, getSetting, insertBlock, saveGym, saveSpot, setSetting, type Gym } from './db';

let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const some = <T,>(a: readonly T[], n: number) => [...a].sort(() => rnd() - 0.5).slice(0, n);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const FALLBACK: Gym[] = [
  { id: 'demo-blocshop', name: 'Bloc Shop Chabanel', address: '555 Rue Chabanel O, Montréal', lat: 45.5376, lng: -73.6539 },
  { id: 'demo-cafebloc', name: 'Café Bloc', address: '6420 Rue Saint-Hubert, Montréal', lat: 45.5357, lng: -73.6043 },
  { id: 'demo-allezup', name: 'Allez Up', address: '1555 Rue Saint-Patrick, Montréal', lat: 45.4859, lng: -73.5713 },
];

const NAMES = ['Le toit jaune', 'Tension', 'Petit pan', 'La vague', 'Crimpfest', 'Origami', 'Funambule', 'Le dièdre'];

export function seedDemo() {
  if (getSetting('demo')) return;
  const launch = Number(getSetting('demoLaunch') || 0) + 1;
  setSetting('demoLaunch', String(launch));
  const row = db.getFirstSync<{ value: string }>("SELECT value FROM cache WHERE key LIKE 'gyms-v2:%' ORDER BY ts DESC");
  let gyms = row ? (JSON.parse(row.value) as Gym[]).slice(0, 4) : [];
  // Sans salles trouvées (pas de réseau) : quelques salles de Montréal, au 2e lancement.
  if (gyms.length < 2) {
    if (launch < 2) return;
    gyms = FALLBACK;
  }
  gyms.forEach(saveGym);

  const font = GRADES.font;
  const fr = GRADES.fr;
  const today = new Date();
  const DAYS = 125;
  for (let d = DAYS; d >= 0; d--) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const wd = day.getDay();
    const isToday = d === 0;
    if (!isToday && !([1, 3, 6].includes(wd) && rnd() < 0.85) && !(wd === 5 && rnd() < 0.25)) continue;
    const progress = 1 - d / DAYS; // 0 → 1
    const base = 6 + Math.round(progress * 3.4); // 6B → 7A
    const outdoor = !isToday && (wd === 6 || wd === 0) && d < 60 && rnd() < 0.3;
    const gym = gyms[rnd() < 0.55 ? 0 : 1 + Math.floor(rnd() * (gyms.length - 1))];
    const site = outdoor ? pick(['Val-David', 'Mont-Rolland', 'Weir']) : null;
    if (site) saveSpot(site, null);
    const count = isToday ? 4 : 4 + Math.floor(rnd() * 5);
    for (let i = 0; i < count; i++) {
      const voie = !outdoor && rnd() < 0.15;
      let off = Math.floor(rnd() * 5) - 2;
      if (isToday && i === count - 1) off = 2;
      const idx = Math.max(0, Math.min(font.length - 1, base + off));
      let result: BlockResult;
      const r = rnd();
      if (off <= -1) result = r < 0.6 ? 'flash' : r < 0.75 ? 'onsight' : 'sent';
      else if (off === 0) result = r < 0.35 ? 'flash' : r < 0.8 ? 'sent' : 'project';
      else result = r < (isToday ? 1 : 0.35) ? 'sent' : 'project';
      if (isToday && i === count - 1) result = 'flash';
      const attempts = result === 'flash' || result === 'onsight' ? 1 : result === 'project' ? 2 + Math.floor(rnd() * 6) : 2 + Math.floor(rnd() * 4);
      insertBlock({
        discipline: voie ? 'voie' : 'bloc',
        outdoor,
        gymId: outdoor ? null : gym.id,
        site,
        name: outdoor || rnd() < 0.12 ? pick(NAMES) : null,
        photoUri: null,
        color: outdoor ? null : pick(HOLD_COLORS).name,
        grade: voie ? fr[Math.max(0, Math.min(fr.length - 1, fr.indexOf('6a') + idx - 6))] : font[idx],
        gradeSystem: voie ? 'fr' : 'font',
        styles: some(STYLES, 1 + Math.floor(rnd() * 2)),
        holds: some(HOLD_TYPES, 1 + Math.floor(rnd() * 2)),
        moves: some(MOVE_TYPES, 1 + Math.floor(rnd() * 2)),
        rope: voie ? pick(['lead', 'toprope'] as const) : null,
        feel: pick(['soft', 'fair', 'hard'] as const),
        result,
        attempts,
        date: iso(day),
        note: null,
      });
    }
  }
  setSetting('session', JSON.stringify({ gymId: gyms[0].id, site: null, startedAt: Date.now() - 52 * 60 * 1000 }));
  setSetting('demo', '1');
}
