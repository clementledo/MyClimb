export type GradeSystem = 'font' | 'v';

export const GRADES: Record<GradeSystem, string[]> = {
  font: [
    '4', '4+', '5', '5+',
    '6A', '6A+', '6B', '6B+', '6C', '6C+',
    '7A', '7A+', '7B', '7B+', '7C', '7C+',
    '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A',
  ],
  v: ['VB', ...Array.from({ length: 18 }, (_, i) => `V${i}`)],
};

export const GRADE_SYSTEM_LABELS: Record<GradeSystem, string> = {
  font: 'Fontainebleau',
  v: 'Échelle V',
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

export const STYLES = [
  'Dalle', 'Vertical', 'Dévers', 'Toit',
  'Réglettes', 'Pinces', 'Plats', 'Bi-doigts',
  'Dynamique', 'Compression', 'Talon / crochet',
];

export type BlockResult = 'flash' | 'sent' | 'project';

export const RESULT_LABELS: Record<BlockResult, string> = {
  flash: 'Flash',
  sent: 'Réussi',
  project: 'Pas encore',
};

export function holdHex(name: string): string {
  return HOLD_COLORS.find((c) => c.name === name)?.hex ?? '#CED4DA';
}
