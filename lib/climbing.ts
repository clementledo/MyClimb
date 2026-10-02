import type { Block } from './db';

export type Discipline = 'bloc' | 'voie';

export const DISCIPLINE_LABELS: Record<Discipline, string> = { bloc: 'Bloc', voie: 'Voie' };

export type GradeSystem = 'font' | 'v' | 'fr' | 'yds';

/** Systèmes de cotation proposés pour chaque discipline, le premier par défaut. */
export const DISCIPLINE_SYSTEMS: Record<Discipline, GradeSystem[]> = {
  bloc: ['font', 'v'],
  voie: ['fr', 'yds'],
};

export const GRADES: Record<GradeSystem, string[]> = {
  font: [
    '4', '4+', '5', '5+',
    '6A', '6A+', '6B', '6B+', '6C', '6C+',
    '7A', '7A+', '7B', '7B+', '7C', '7C+',
    '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A',
  ],
  v: ['VB', ...Array.from({ length: 18 }, (_, i) => `V${i}`)],
  fr: [
    '3', '4a', '4b', '4c', '5a', '5b', '5c',
    ...['6', '7', '8', '9']
      .flatMap((n) => ['a', 'a+', 'b', 'b+', 'c', 'c+'].map((l) => `${n}${l}`))
      .filter((g) => g !== '9c+'),
  ],
  yds: [
    '5.5', '5.6', '5.7', '5.8', '5.9',
    ...Array.from({ length: 6 }, (_, i) => ['a', 'b', 'c', 'd'].map((l) => `5.${i + 10}${l}`)).flat(),
  ],
};

export const GRADE_SYSTEM_LABELS: Record<GradeSystem, string> = {
  font: 'Fontainebleau',
  v: 'Échelle V',
  fr: 'Française',
  yds: 'YDS (5.x)',
};

export const HOLD_COLORS: { name: string; hex: string }[] = [
  { name: 'Jaune', hex: '#FAD02C' },
  { name: 'Orange', hex: '#F08C00' },
  { name: 'Rouge', hex: '#E03131' },
  { name: 'Rose', hex: '#F06595' },
  { name: 'Violet', hex: '#7048E8' },
  { name: 'Bleu', hex: '#1C7ED6' },
  { name: 'Vert', hex: '#2F9E44' },
  { name: 'Marron', hex: '#8B5A2B' },
  { name: 'Gris', hex: '#868E96' },
  { name: 'Noir', hex: '#212529' },
  { name: 'Blanc', hex: '#FFFFFF' },
];

/** Profil du mur. */
export const STYLES = ['Dalle', 'Vertical', 'Dévers', 'Toit', 'Dièdre', 'Arête'];

export const HOLD_TYPES = ['Réglettes', 'Plats', 'Pinces', 'Bacs', 'Inversées', 'Trous', 'Volumes'];

export const MOVE_TYPES = [
  'Dynamique',
  'Statique',
  'Compression',
  'Talon',
  'Pointe',
  'Rétablissement',
  'Coordination',
  'Équilibre',
  'Résistance',
];

export type Rope = 'toprope' | 'lead';

export const ROPE_LABELS: Record<Rope, string> = { toprope: 'Moulinette', lead: 'En tête' };

export type Feel = 'soft' | 'fair' | 'hard';

export const FEEL_LABELS: Record<Feel, string> = { soft: 'Facile', fair: 'Juste', hard: 'Dure' };

export type BlockResult = 'onsight' | 'flash' | 'sent' | 'project';

export const RESULT_LABELS: Record<BlockResult, string> = {
  onsight: 'À vue',
  flash: 'Flash',
  sent: 'Réussi',
  project: 'Pas encore',
};

export const isSent = (r: BlockResult) => r !== 'project';
/** Réussi du premier coup, à vue ou flash. */
export const isFirstTry = (r: BlockResult) => r === 'onsight' || r === 'flash';

export function holdHex(name: string): string {
  return HOLD_COLORS.find((c) => c.name === name)?.hex ?? '#CED4DA';
}

export function formatPrice(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',').replace(',00', '')} $`;
}

/** Lieu d'une grimpe : la salle, ou le site en extérieur. */
export function placeOf(b: Pick<Block, 'outdoor' | 'gymName' | 'site'>): string {
  return b.outdoor ? (b.site ?? 'Extérieur') : (b.gymName ?? 'Salle');
}

/** Clé pour regrouper les grimpes par lieu. */
export function placeKey(b: Pick<Block, 'outdoor' | 'gymId' | 'site'>): string {
  return b.outdoor ? `site:${b.site ?? ''}` : `gym:${b.gymId ?? ''}`;
}
