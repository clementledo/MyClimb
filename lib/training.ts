/**
 * Bibliothèque d'entraînement : exercices (3 niveaux), séances, programme de 8 semaines et routines de souplesse.
 * Protocoles repris de sources reconnues : Eva López (suspensions max, réglette minimale), Lattice Training
 * (suspensions répétées 7/3, 4 × 4), Eric Hörst (7/53), Hooper's Beta (tirages de recrutement, souplesse),
 * Tension Climbing (suspensions longues).
 */
import type { AndroidSymbol } from 'expo-symbols';

/* ---------- Types ---------- */

export type Cat = 'doigts' | 'puissance' | 'tirage' | 'gainage' | 'antagonistes' | 'endurance' | 'technique' | 'souplesse';
/** Ancien nom gardé pour la carte joueur. */
export type Focus = Cat;
export type Zone = 'hanches' | 'ischios' | 'epaules' | 'dos' | 'poignets' | 'chevilles';
/** barre = ta barre de traction ; salle = poutre, pan ou mur de la salle ; sol = sans matériel (ou une bouteille, une chaise). */
export type Where = 'barre' | 'salle' | 'sol';
export type Lv = 1 | 2 | 3;

export const CATS: Record<Cat, { label: string; icon: AndroidSymbol; text: string }> = {
  doigts: { label: 'Doigts', icon: 'back_hand', text: 'Force et solidité des doigts, sur la poutre de la salle.' },
  puissance: { label: 'Puissance', icon: 'bolt', text: 'Mouvements explosifs et blocs à ta limite.' },
  tirage: { label: 'Tirage', icon: 'fitness_center', text: 'Tractions, blocages : la force des bras et du dos.' },
  gainage: { label: 'Gainage', icon: 'accessibility_new', text: 'Garder les pieds en dévers et transmettre la force.' },
  antagonistes: { label: 'Antagonistes', icon: 'shield', text: 'Pousser, ouvrir les épaules, protéger coudes et doigts.' },
  endurance: { label: 'Endurance', icon: 'timer', text: 'Résister à la fatigue des avant-bras (« la pompe »).' },
  technique: { label: 'Technique', icon: 'directions_walk', text: 'Placement, pieds précis, lecture.' },
  souplesse: { label: 'Souplesse', icon: 'self_improvement', text: 'Hanches, ischios, épaules, poignets, chevilles.' },
};

export const ZONES: Record<Zone, { label: string; icon: AndroidSymbol; text: string }> = {
  hanches: { label: 'Hanches', icon: 'airline_seat_legroom_extra', text: 'Pieds hauts, grenouille, rester près du mur.' },
  ischios: { label: 'Ischios', icon: 'directions_run', text: 'Crochets de talon, pieds loin devant.' },
  epaules: { label: 'Épaules', icon: 'sports_gymnastics', text: 'Bras au-dessus de la tête, épaules saines.' },
  dos: { label: 'Dos', icon: 'airline_seat_flat', text: 'Thoracique mobile, dos détendu après la grimpe.' },
  poignets: { label: 'Poignets et avant-bras', icon: 'pan_tool', text: 'Récupérer et protéger tendons et coudes.' },
  chevilles: { label: 'Chevilles et pieds', icon: 'do_not_step', text: 'Pointes de pied, carres, pieds de dalle.' },
};

export const WHERE: Record<Where, { label: string; icon: AndroidSymbol }> = {
  barre: { label: 'Barre de traction', icon: 'horizontal_rule' },
  salle: { label: 'À la salle', icon: 'location_city' },
  sol: { label: 'Sans matériel', icon: 'home' },
};

export const LEVELS = ['', 'Débutant', 'Intermédiaire', 'Avancé'] as const;
export const levelTone = (l: number) => (l >= 3 ? 'danger' : l === 2 ? 'primary' : 'success') as 'danger' | 'primary' | 'success';

/**
 * Déroulé d'un exercice, utilisé par le minuteur :
 * `sets` séries de `reps` répétitions ; chaque répétition dure `work` s (ou se compte si work = 0),
 * suivie de `restRep` s ; `rest` s de repos entre les séries.
 */
export type Dose = { sets: number; reps: number; work: number; restRep?: number; rest: number; sides?: boolean };

export type Exercise = {
  id: string;
  name: string;
  cat: Cat;
  zone?: Zone;
  where: Where;
  /** Animation d'un autre exercice à réutiliser (même geste). */
  anim?: string;
  goal: string;
  how: string;
  cues: string[];
  /** Dose par niveau (1 à 3) ; null si l'exercice n'existe pas à ce niveau. */
  levels: [Dose | null, Dose | null, Dose | null];
  /** Précision sur la charge ou la prise, par niveau. */
  notes?: [string?, string?, string?];
  warning?: string;
  source?: string;
};

export const animOf = (x: { id: string; anim?: string }) => x.anim ?? x.id;

/* ---------- Doses ---------- */

const d = (sets: number, reps: number, work: number, rest: number, extra: Partial<Dose> = {}): Dose => ({ sets, reps, work, rest, ...extra });
/** Étirement tenu : 2 × 30 s, 2 × 45 s, 3 × 60 s. */
const STRETCH: Exercise['levels'] = [d(2, 1, 30, 10), d(2, 1, 45, 10), d(3, 1, 60, 10)];
const STRETCH_SIDES: Exercise['levels'] = [d(1, 1, 30, 5, { sides: true }), d(2, 1, 45, 5, { sides: true }), d(2, 1, 60, 5, { sides: true })];
const MOBILITY: Exercise['levels'] = [d(1, 8, 0, 0), d(1, 10, 0, 0), d(2, 10, 0, 15)];

export function formatSeconds(s: number) {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return r ? `${m} min ${r}` : `${m} min`;
}

/** Dose lisible, ex. « 6 séries de 6 × (7 s / 3 s), repos 3 min ». */
export function doseText(x: Dose): string {
  const side = x.sides ? ' de chaque côté' : '';
  const rest = x.sets > 1 && x.rest ? `, repos ${formatSeconds(x.rest)}` : '';
  if (x.work > 0 && x.reps > 1) {
    const rep = x.restRep ? `${x.reps} × (${formatSeconds(x.work)} / ${formatSeconds(x.restRep)})` : `${x.reps} × ${formatSeconds(x.work)}`;
    return `${x.sets > 1 ? `${x.sets} séries de ` : ''}${rep}${side}${rest}`;
  }
  if (x.work > 0) return `${x.sets > 1 ? `${x.sets} × ` : ''}${formatSeconds(x.work)}${side}${rest}`;
  return `${x.sets > 1 ? `${x.sets} × ` : ''}${x.reps} répétition${x.reps > 1 ? 's' : ''}${side}${rest}`;
}

/** Durée d'une dose en secondes (3 s par répétition comptée). */
export function doseSeconds(x: Dose): number {
  const rep = x.work > 0 ? x.work : 3;
  const one = x.reps * rep + (x.reps - 1) * (x.restRep ?? 0);
  return (x.sets * one + (x.sets - 1) * x.rest) * (x.sides ? 2 : 1);
}

/** Niveau réellement disponible le plus proche de celui demandé. */
export function levelFor(x: Exercise, want: Lv): Lv {
  for (const l of [want, want - 1, want + 1, want - 2, want + 2] as number[]) if (l >= 1 && l <= 3 && x.levels[l - 1]) return l as Lv;
  return 1;
}
export const doseAt = (x: Exercise, want: Lv): Dose => x.levels[levelFor(x, want) - 1]!;
export const minLevel = (x: Exercise): Lv => (x.levels[0] ? 1 : x.levels[1] ? 2 : 3);

/* ---------- Exercices ---------- */

export const EXERCISES: Exercise[] = [
  /* ----- Doigts (poutre de la salle) ----- */
  {
    id: 'hang-intro',
    name: 'Suspensions pieds au sol',
    cat: 'doigts',
    where: 'salle',
    goal: 'Charger les doigts sans risque, en dosant le poids',
    how: 'Sur une réglette de 20 à 25 mm, pieds posés au sol ou sur une chaise, mets juste assez de poids dans les doigts pour que ce soit dur mais propre.',
    cues: ['Prise semi-arquée (3 doigts à 90°), jamais arquée à fond', 'Épaules engagées, coudes presque tendus', 'Arrête si une douleur pique dans un doigt'],
    levels: [d(6, 1, 10, 60), d(6, 1, 10, 90), d(5, 1, 10, 90)],
    notes: ['Environ la moitié de ton poids dans les doigts', 'Environ 70 % de ton poids', 'En échauffement avant les suspensions max'],
    source: 'Lattice Training',
  },
  {
    id: 'recruitment',
    name: 'Tirages de recrutement à un bras',
    cat: 'doigts',
    where: 'salle',
    anim: 'hang-intro',
    goal: 'Réveiller les doigts et apprendre à tirer fort, sans décoller',
    how: 'Sur une petite réglette (10 à 15 mm), une main, pieds au sol. Tire vers le bas en montant l’effort seconde après seconde, comme on passe les vitesses, sans jamais décoller.',
    cues: ['Coude légèrement fléchi', 'Monte l’effort progressivement sur 5 s', 'Si tu décolles, la prise est trop grande'],
    levels: [d(2, 5, 5, 90, { restRep: 5, sides: true }), d(3, 5, 5, 90, { restRep: 5, sides: true }), d(3, 5, 5, 90, { restRep: 5, sides: true })],
    source: 'Hooper’s Beta',
  },
  {
    id: 'density-hangs',
    name: 'Suspensions longues',
    cat: 'doigts',
    where: 'salle',
    anim: 'daily-hangs',
    goal: 'Muscler les avant-bras et renforcer les tendons',
    how: 'Sur une réglette de 20 mm, suspends-toi longtemps à effort moyen (7 sur 10). Pieds au sol si besoin pour garder la bonne durée.',
    cues: ['Effort moyen : il doit te rester de la marge', 'Prise semi-arquée ou tendue', 'Respire pendant toute la suspension'],
    levels: [d(3, 1, 20, 120), d(4, 1, 30, 120), d(5, 1, 40, 120)],
    source: 'Tension Climbing',
  },
  {
    id: 'repeaters',
    name: 'Suspensions répétées 7/3',
    cat: 'doigts',
    where: 'salle',
    goal: 'Endurance de force des doigts',
    how: 'Suspends-toi 7 s, lâche 3 s, 6 fois de suite : c’est une série. Choisis une réglette où la dernière suspension est dure mais tenue.',
    cues: ['Même prise du début à la fin', 'Épaules actives, pas pendu dans les ligaments', 'Si tu lâches avant la fin, prends une plus grande réglette'],
    levels: [d(3, 6, 7, 180, { restRep: 3 }), d(5, 6, 7, 180, { restRep: 3 }), d(6, 6, 7, 180, { restRep: 3 })],
    notes: ['Réglette de 25 mm, pieds au sol si besoin', 'Réglette de 20 mm', 'Réglette de 18 mm ou lest léger'],
    warning: 'Pas plus de 2 séances de poutre par semaine.',
    source: 'Lattice Training',
  },
  {
    id: 'max-hangs',
    name: 'Suspensions max 10 s',
    cat: 'doigts',
    where: 'salle',
    goal: 'Force maximale des doigts (réglettes et plats)',
    how: 'Sur une réglette de 18 à 20 mm, tiens 10 s avec du lest (ou en t’allégeant avec un élastique) pour qu’il te reste 2 à 3 s de marge.',
    cues: ['Échauffe-toi 15 min avant', 'Repos complet de 3 min entre les essais', 'Note ton lest pour progresser semaine après semaine'],
    levels: [null, d(4, 1, 10, 180), d(5, 1, 10, 180)],
    notes: [undefined, 'Poids du corps, ou allégé si c’est trop dur', 'Lest de 10 à 30 % de ton poids'],
    warning: 'Jamais fatigué ni les doigts douloureux. 2 fois par semaine au plus.',
    source: 'Eva López (MaxHangs)',
  },
  {
    id: 'min-edge',
    name: 'Réglette minimale 10 s',
    cat: 'doigts',
    where: 'salle',
    anim: 'min-edge',
    goal: 'Force des doigts sur petites prises, sans lest',
    how: 'Poids du corps, sur la plus petite réglette que tu tiens 10 s avec 2 à 3 s de marge. Quand c’est facile, descends d’un ou deux millimètres.',
    cues: ['Prise semi-arquée', 'Corps immobile, pas de balancement', 'Arrête la série si la forme se dégrade'],
    levels: [null, null, d(5, 1, 10, 180)],
    warning: 'Réservé aux grimpeurs réguliers sur poutre.',
    source: 'Eva López (MinEdge)',
  },
  {
    id: 'hang-7-53',
    name: 'Suspensions 7/53',
    cat: 'doigts',
    where: 'salle',
    anim: 'weighted-max-hangs',
    goal: 'Force maximale avec beaucoup de récupération',
    how: '7 s de suspension très lourde (lest), puis 53 s de repos : 3 fois par série. La charge doit être celle que tu tiendrais 10 s au maximum.',
    cues: ['Lest élevé, temps court', 'Le repos de 53 s fait partie de l’exercice', 'Arrête si tu ne tiens plus les 7 s'],
    levels: [null, null, d(3, 3, 7, 180, { restRep: 53 })],
    source: 'Eric Hörst',
  },
  {
    id: 'abrahangs',
    name: 'Suspensions légères quotidiennes',
    cat: 'doigts',
    where: 'salle',
    anim: 'daily-hangs',
    goal: 'Entretenir les tendons des doigts tous les jours',
    how: 'Pieds au sol, 10 s de suspension à effort léger (4 à 6 sur 10), 20 s de repos. Ça se fait même les jours de repos.',
    cues: ['Très léger : aucune fatigue après', 'Varie les prises : semi-arquée, tendue, pince', 'Jamais jusqu’à l’échec'],
    levels: [d(1, 8, 10, 0, { restRep: 20 }), d(1, 10, 10, 0, { restRep: 20 }), d(1, 12, 10, 0, { restRep: 20 })],
    source: 'Emil Abrahamsson',
  },
  {
    id: 'pinch-hold',
    name: 'Tenue de pince',
    cat: 'doigts',
    where: 'salle',
    goal: 'Force du pouce et des pinces',
    how: 'Sur un volume ou une grosse pince de la salle (ou un bloc de bois), serre et tiens, pieds au sol puis décollés.',
    cues: ['Pouce bien opposé', 'Poignet droit', 'Monte la charge en enlevant le poids des pieds'],
    levels: [d(4, 1, 10, 60), d(5, 1, 10, 90), d(4, 1, 10, 90, { sides: true })],
    notes: ['Deux mains, pieds au sol', 'Deux mains, pieds décollés', 'Une main'],
  },

  /* ----- Puissance ----- */
  {
    id: 'limit-boulder',
    name: 'Blocs à ta limite',
    cat: 'puissance',
    where: 'salle',
    goal: 'Force maximale en grimpant : la base de la progression en bloc',
    how: 'Choisis 4 à 6 blocs courts (4 à 6 mouvements) à ton niveau maximum ou un peu au-dessus. Fais 3 à 5 essais à fond par bloc, avec un vrai repos.',
    cues: ['Repos de 3 à 4 min entre les essais', 'Chaque essai à 100 %', 'Arrête dès que tu baisses en qualité'],
    levels: [d(4, 3, 0, 180), d(5, 4, 0, 210), d(6, 5, 0, 240)],
    notes: ['Blocs de ton niveau (6C)', 'Blocs de ton niveau et un cran au-dessus', 'Projets et blocs durs'],
    source: 'Lattice Training',
  },
  {
    id: 'dynos',
    name: 'Jetés et mouvements explosifs',
    cat: 'puissance',
    where: 'salle',
    anim: 'limit-boulder',
    goal: 'Explosivité et précision dans les jetés',
    how: 'Sur le mur, choisis des jetés ou des mouvements dynamiques que tu ne réussis pas à chaque fois. Un essai, repos, recommence.',
    cues: ['Pousse avec les jambes', 'Regarde la prise d’arrivée', 'Frais à chaque essai'],
    levels: [d(1, 6, 0, 0), d(2, 6, 0, 120), d(3, 6, 0, 120)],
  },
  {
    id: 'explosive-pullups',
    name: 'Tractions explosives',
    cat: 'puissance',
    where: 'barre',
    anim: 'pullups',
    goal: 'Tirage rapide pour les mouvements lointains',
    how: 'Monte le plus vite possible, le plus haut possible (poitrine à la barre), descends contrôlé. Peu de répétitions, toutes rapides.',
    cues: ['Vitesse maximale à la montée', 'Descente en 2 s', 'Arrête quand tu ralentis'],
    levels: [d(4, 3, 0, 120), d(5, 3, 0, 120), d(5, 4, 0, 150)],
    notes: ['Tractions normales mais rapides', 'Poitrine à la barre', 'Lâcher-rattraper ou lest léger'],
  },
  {
    id: 'campus-ladders',
    name: 'Pan Güllich : échelles',
    cat: 'puissance',
    where: 'salle',
    goal: 'Puissance de contact',
    how: 'Sur le pan de la salle, monte réglette après réglette sans les pieds (1-2-3, puis 1-3-5 quand tu progresses).',
    cues: ['Prises les plus grandes', 'Mouvements rapides et précis', 'Arrête dès la première fatigue'],
    levels: [null, d(4, 2, 0, 180), d(5, 3, 0, 180)],
    notes: [undefined, 'Échelles 1-2-3 avec les pieds possibles', 'Échelles 1-3-5'],
    warning: 'Seulement frais, échauffé, et après plusieurs années de grimpe.',
  },
  {
    id: 'campus-doubles',
    name: 'Pan Güllich : sauts doubles',
    cat: 'puissance',
    where: 'salle',
    goal: 'Puissance maximale',
    how: 'Les deux mains montent et descendent ensemble d’une réglette à l’autre.',
    cues: ['Grandes réglettes', 'Atterris bras légèrement fléchis', 'Très peu de répétitions'],
    levels: [null, null, d(4, 3, 0, 180)],
    warning: 'Exercice très exigeant pour les doigts : avancés seulement.',
  },

  /* ----- Tirage ----- */
  {
    id: 'scap-pulls',
    name: 'Tirages d’omoplates',
    cat: 'tirage',
    where: 'barre',
    goal: 'Engager les épaules avant de tirer',
    how: 'Suspendu bras tendus, abaisse et resserre les omoplates pour monter de quelques centimètres, sans plier les coudes.',
    cues: ['Bras tendus du début à la fin', 'Poitrine sortie', 'Tiens 1 s en haut'],
    levels: [d(2, 8, 0, 60), d(3, 10, 0, 60), d(3, 12, 0, 60)],
  },
  {
    id: 'pullups',
    name: 'Tractions',
    cat: 'tirage',
    where: 'barre',
    goal: 'Force de tirage de base',
    how: 'Prise pronation largeur d’épaules, du bras tendu au menton au-dessus de la barre.',
    cues: ['Commence par les omoplates', 'Pas d’élan', 'Descente contrôlée en 2 s'],
    levels: [d(4, 5, 0, 120), d(4, 8, 0, 120), d(5, 10, 0, 120)],
    notes: ['Ou négatives lentes (5 s) si tu n’en fais pas 5', undefined, undefined],
  },
  {
    id: 'weighted-pullups',
    name: 'Tractions lestées',
    cat: 'tirage',
    where: 'barre',
    goal: 'Force maximale de tirage',
    how: 'Avec un sac à dos chargé, des tractions lourdes : tu dois pouvoir en faire 1 à 2 de plus à la fin de chaque série.',
    cues: ['Échauffe-toi avec des tractions sans lest', 'Repos complet', 'Note ta charge'],
    levels: [null, null, d(5, 4, 0, 180)],
    source: 'Lattice Training',
  },
  {
    id: 'lockoffs',
    name: 'Blocages 90° et 120°',
    cat: 'tirage',
    where: 'barre',
    goal: 'Tenir un bras plié pour aller chercher loin',
    how: 'Monte en haut, puis bloque immobile bras à 90°, et à 120° (presque tendu).',
    cues: ['Épaules basses', 'Respire', 'Descente lente'],
    levels: [d(3, 2, 5, 120, { restRep: 5 }), d(3, 3, 7, 120, { restRep: 5 }), d(4, 3, 10, 120, { restRep: 5 })],
  },
  {
    id: 'frenchies',
    name: 'Frenchies',
    cat: 'tirage',
    where: 'barre',
    anim: 'lockoffs',
    goal: 'Endurance de blocage',
    how: 'Traction complète en tenant 5 s en haut, traction en tenant 5 s à 90°, traction en tenant 5 s à 120° : c’est un cycle.',
    cues: ['Garde la forme jusqu’au bout', 'Tenues immobiles', 'Allège-toi avec les pieds si besoin'],
    levels: [null, d(3, 2, 0, 180), d(4, 3, 0, 180)],
    notes: [undefined, '2 cycles par série', '3 cycles par série'],
  },
  {
    id: 'rows',
    name: 'Rowing inversé',
    cat: 'tirage',
    where: 'sol',
    goal: 'Dos et arrière d’épaules, en tirant à l’horizontale',
    how: 'Allongé sous une table solide (ou ta barre placée bas), corps gainé, tire la poitrine vers le bord.',
    cues: ['Corps droit comme une planche', 'Serre les omoplates en haut', 'Descente lente'],
    levels: [d(3, 8, 0, 90), d(3, 12, 0, 90), d(4, 12, 0, 90)],
    notes: ['Genoux pliés', 'Jambes tendues', 'Pieds surélevés'],
  },
  {
    id: 'typewriter',
    name: 'Tractions machine à écrire',
    cat: 'tirage',
    where: 'barre',
    goal: 'Vers la traction à un bras',
    how: 'Monte en haut, glisse d’un côté puis de l’autre en tenant le menton au-dessus de la barre, puis redescends.',
    cues: ['Prise large', 'Le bras qui travaille se plie, l’autre se tend', 'Lent et contrôlé'],
    levels: [null, null, d(4, 4, 0, 150)],
  },
  {
    id: 'one-arm-negatives',
    name: 'Négatives à un bras',
    cat: 'tirage',
    where: 'barre',
    goal: 'Force d’un bras',
    how: 'Monte à deux bras, lâche une main et descends le plus lentement possible avec l’autre.',
    cues: ['5 s de descente au moins', 'Épaule engagée', 'Arrête si la descente s’accélère'],
    levels: [null, null, d(3, 3, 0, 180, { sides: true })],
  },

  /* ----- Gainage ----- */
  {
    id: 'hollow',
    name: 'Position creuse',
    cat: 'gainage',
    where: 'sol',
    goal: 'Gainage du ventre comme dans les dévers',
    how: 'Sur le dos, bas du dos plaqué au sol, jambes tendues et épaules décollées, bras au-dessus de la tête.',
    cues: ['Le bas du dos ne décolle pas', 'Plie les genoux pour simplifier', 'Respire'],
    levels: [d(3, 1, 20, 45), d(3, 1, 30, 45), d(4, 1, 45, 45)],
  },
  {
    id: 'plank',
    name: 'Planche',
    cat: 'gainage',
    where: 'sol',
    goal: 'Gainage de base',
    how: 'Sur les avant-bras et les pointes de pied, corps aligné.',
    cues: ['Fesses serrées', 'Ne creuse pas le dos', 'Regarde le sol'],
    levels: [d(3, 1, 30, 45), d(3, 1, 45, 45), d(3, 1, 60, 45)],
  },
  {
    id: 'side-plank',
    name: 'Planche latérale',
    cat: 'gainage',
    where: 'sol',
    goal: 'Obliques : rester proche du mur en lolotte',
    how: 'Sur un avant-bras, corps de profil et aligné, hanches hautes.',
    cues: ['Coude sous l’épaule', 'Hanches hautes', 'Change de côté'],
    levels: [d(2, 1, 20, 30, { sides: true }), d(3, 1, 30, 30, { sides: true }), d(3, 1, 45, 30, { sides: true })],
  },
  {
    id: 'dead-bug',
    name: 'Dead bug',
    cat: 'gainage',
    where: 'sol',
    goal: 'Gainage et coordination bras-jambes',
    how: 'Sur le dos, bras vers le plafond, genoux à 90°. Tends lentement un bras et la jambe opposée sans décoller le bas du dos.',
    cues: ['Lent', 'Bas du dos plaqué', 'Expire en tendant'],
    levels: [d(2, 8, 0, 45, { sides: true }), d(3, 10, 0, 45, { sides: true }), d(3, 12, 0, 45, { sides: true })],
  },
  {
    id: 'leg-raises',
    name: 'Relevés de jambes suspendu',
    cat: 'gainage',
    where: 'barre',
    goal: 'Monter les pieds en dévers',
    how: 'Suspendu, monte les genoux (ou les jambes tendues) sans te balancer.',
    cues: ['Pas d’élan', 'Épaules engagées', 'Descente lente'],
    levels: [d(3, 8, 0, 60), d(3, 8, 0, 60), d(4, 10, 0, 60)],
    notes: ['Genoux à la poitrine', 'Jambes tendues à l’horizontale', 'Jambes tendues, lent'],
  },
  {
    id: 'toes-to-bar',
    name: 'Pieds à la barre',
    cat: 'gainage',
    where: 'barre',
    goal: 'Gainage puissant pour les crochets et les toits',
    how: 'Suspendu, monte les pieds jusqu’à toucher la barre, jambes aussi tendues que possible.',
    cues: ['Contrôle la descente', 'Pas de balancier', 'Expire en montant'],
    levels: [null, d(3, 5, 0, 90), d(4, 8, 0, 90)],
  },
  {
    id: 'front-lever',
    name: 'Front lever groupé',
    cat: 'gainage',
    where: 'barre',
    goal: 'Gainage total en dévers',
    how: 'Suspendu bras tendus, genoux à la poitrine, bascule le dos à l’horizontale et tiens.',
    cues: ['Bras tendus', 'Pousse la barre vers les hanches', 'Dos à l’horizontale'],
    levels: [d(4, 1, 5, 90), d(5, 1, 10, 90), d(5, 1, 15, 90)],
  },
  {
    id: 'front-lever-one-leg',
    name: 'Front lever une jambe',
    cat: 'gainage',
    where: 'barre',
    goal: 'Vers le front lever complet',
    how: 'Comme le front lever groupé, avec une jambe tendue.',
    cues: ['Change de jambe à chaque série', 'Hanches dans l’alignement', 'Bras tendus'],
    levels: [null, null, d(5, 1, 8, 120)],
  },
  {
    id: 'windshield-wipers',
    name: 'Essuie-glaces suspendus',
    cat: 'gainage',
    where: 'barre',
    anim: 'toes-to-bar',
    goal: 'Obliques et rotation du bassin',
    how: 'Suspendu, jambes montées à la verticale, bascule-les d’un côté puis de l’autre.',
    cues: ['Contrôle à chaque côté', 'Épaules engagées', 'Genoux pliés pour simplifier'],
    levels: [null, null, d(3, 6, 0, 90, { sides: true })],
  },
  {
    id: 'superman',
    name: 'Superman',
    cat: 'gainage',
    where: 'sol',
    goal: 'Dos et fessiers, l’autre côté du gainage',
    how: 'Sur le ventre, décolle bras et jambes tendus et tiens 2 s en haut.',
    cues: ['Regarde le sol', 'Lent', 'Serre les fessiers'],
    levels: [d(2, 10, 0, 45), d(3, 10, 0, 45), d(3, 15, 0, 45)],
  },

  /* ----- Antagonistes et prévention ----- */
  {
    id: 'pushups',
    name: 'Pompes',
    cat: 'antagonistes',
    where: 'sol',
    goal: 'Équilibrer le tirage, protéger les épaules',
    how: 'Mains sous les épaules, corps gainé, poitrine jusqu’au sol.',
    cues: ['Coudes à 45°', 'Corps droit', 'Amplitude complète'],
    levels: [d(3, 8, 0, 60), d(3, 15, 0, 60), d(4, 20, 0, 60)],
    notes: ['Sur les genoux si besoin', undefined, 'Ou pompes archer'],
  },
  {
    id: 'scap-pushups',
    name: 'Pompes d’omoplates',
    cat: 'antagonistes',
    where: 'sol',
    anim: 'pushups',
    goal: 'Muscles qui stabilisent les omoplates (dentelé)',
    how: 'En position de pompe bras tendus, laisse les omoplates se rapprocher puis pousse le sol pour les écarter.',
    cues: ['Bras tendus', 'Seules les omoplates bougent', 'Lent'],
    levels: [d(2, 10, 0, 45), d(3, 12, 0, 45), d(3, 15, 0, 45)],
  },
  {
    id: 'dips',
    name: 'Dips sur chaises',
    cat: 'antagonistes',
    where: 'sol',
    goal: 'Triceps et poussée pour les rétablissements',
    how: 'Entre deux chaises stables (ou sur le bord d’une chaise), descends coudes vers l’arrière puis pousse.',
    cues: ['Épaules basses', 'Pas trop bas si l’épaule tire', 'Contrôle'],
    levels: [d(3, 8, 0, 60), d(3, 12, 0, 60), d(4, 15, 0, 60)],
  },
  {
    id: 'external-rotation',
    name: 'Rotations externes couché',
    cat: 'antagonistes',
    where: 'sol',
    goal: 'Coiffe des rotateurs : la meilleure protection des épaules',
    how: 'Couché sur le côté, coude collé au corps et plié à 90°, tiens une bouteille d’eau et fais pivoter l’avant-bras vers le plafond.',
    cues: ['Coude collé', 'Lent, 2 s dans chaque sens', 'Léger : 0,5 à 2 kg'],
    levels: [d(2, 12, 0, 45, { sides: true }), d(3, 15, 0, 45, { sides: true }), d(3, 15, 0, 45, { sides: true })],
  },
  {
    id: 'ytw',
    name: 'Y-T-W au sol',
    cat: 'antagonistes',
    where: 'sol',
    goal: 'Bas des trapèzes et arrière d’épaules',
    how: 'Sur le ventre, décolle les bras en Y, puis en T, puis en W, pouces vers le plafond.',
    cues: ['Omoplates serrées et basses', 'Tiens 2 s chaque position', 'Front au sol'],
    levels: [d(2, 6, 0, 45), d(3, 8, 0, 45), d(3, 10, 0, 45)],
  },
  {
    id: 'finger-extensors',
    name: 'Extension des doigts',
    cat: 'antagonistes',
    where: 'sol',
    goal: 'Équilibrer les fléchisseurs, prévenir les douleurs de coude',
    how: 'Place un élastique (de cuisine ou de bureau) autour des doigts et ouvre la main au maximum.',
    cues: ['Ouvre en grand', 'Retour lent', 'Les deux mains'],
    levels: [d(2, 20, 0, 30), d(3, 20, 0, 30), d(3, 25, 0, 30)],
  },
  {
    id: 'wrist-curls',
    name: 'Flexions et extensions de poignets',
    cat: 'antagonistes',
    where: 'sol',
    anim: 'wrist-warmup',
    goal: 'Tendons du poignet et du coude (épicondylite)',
    how: 'Avant-bras posé sur la cuisse, une bouteille en main : monte et descends le poignet, paume vers le haut puis vers le bas.',
    cues: ['Descente en 3 s', 'Seul le poignet bouge', 'Bouteille de 1 à 2 kg'],
    levels: [d(2, 12, 0, 45, { sides: true }), d(3, 15, 0, 45, { sides: true }), d(3, 15, 0, 45, { sides: true })],
  },
  {
    id: 'pronation',
    name: 'Prono-supination',
    cat: 'antagonistes',
    where: 'sol',
    anim: 'wrist-warmup',
    goal: 'Stabilité du coude',
    how: 'Coude plié à 90°, tiens un marteau ou une bouteille par une extrémité et fais tourner l’avant-bras paume en haut, paume en bas.',
    cues: ['Coude immobile', 'Lent', 'Plus loin de la main = plus dur'],
    levels: [d(2, 12, 0, 45, { sides: true }), d(3, 12, 0, 45, { sides: true }), d(3, 15, 0, 45, { sides: true })],
  },

  /* ----- Endurance ----- */
  {
    id: 'four-by-four',
    name: '4 × 4',
    cat: 'endurance',
    where: 'salle',
    goal: 'Résistance : continuer malgré la pompe',
    how: 'Choisis 4 blocs 3 niveaux sous ton max et enchaîne-les sans repos. Repos 4 min, et recommence.',
    cues: ['Tu dois finir le 4ᵉ tour avec peine', 'Si tu tombes, remonte aussitôt', 'Même blocs à chaque tour'],
    levels: [d(3, 4, 0, 240), d(4, 4, 0, 240), d(5, 4, 0, 240)],
    notes: ['Blocs faciles (5)', 'Blocs de 6A à 6B', 'Blocs de 6B+ à 6C'],
    source: 'Lattice Training',
  },
  {
    id: 'circuits',
    name: 'Circuits 30/30',
    cat: 'endurance',
    where: 'salle',
    anim: 'easy-traverse',
    goal: 'Récupérer en grimpant, encaisser la pompe',
    how: 'Grimpe 30 s en traversée (ou sur des blocs faciles), repos 30 s. Une série = 6 à 10 fois.',
    cues: ['Effort moyen', 'Respire', 'Secoue les bras pendant les repos'],
    levels: [d(2, 6, 30, 300, { restRep: 30 }), d(3, 8, 30, 300, { restRep: 30 }), d(3, 10, 30, 300, { restRep: 30 })],
  },
  {
    id: 'emom',
    name: 'Un bloc chaque minute',
    cat: 'endurance',
    where: 'salle',
    anim: 'four-by-four',
    goal: 'Puissance-endurance sans pompe excessive',
    how: 'Au début de chaque minute, grimpe un bloc court ; repose-toi le reste de la minute.',
    cues: ['Blocs 2 niveaux sous ton max', 'Le repos se raccourcit si tu grimpes lentement', 'Garde un beau style'],
    levels: [d(1, 8, 60, 0), d(1, 12, 60, 0), d(1, 15, 60, 0)],
  },
  {
    id: 'arc',
    name: 'Continuité (ARC)',
    cat: 'endurance',
    where: 'salle',
    goal: 'Endurance de fond et circulation dans les avant-bras',
    how: 'Grimpe sans t’arrêter, très facile, en traversée ou en montées-descentes. Une légère chaleur dans les bras, jamais la pompe.',
    cues: ['Très facile', 'Respire', 'Travaille les pieds silencieux'],
    levels: [d(2, 1, 600, 300), d(3, 1, 600, 300), d(3, 1, 900, 300)],
  },

  /* ----- Technique ----- */
  {
    id: 'silent-feet',
    name: 'Pieds silencieux',
    cat: 'technique',
    where: 'salle',
    goal: 'Poser les pieds précisément',
    how: 'Grimpe des blocs faciles en posant chaque pied sans aucun bruit, du premier coup.',
    cues: ['Regarde la prise jusqu’à ce que le pied y soit', 'Pas de réajustement', 'Lent'],
    levels: [d(1, 6, 0, 0), d(1, 8, 0, 0), d(1, 10, 0, 0)],
  },
  {
    id: 'easy-traverse',
    name: 'Traversée facile',
    cat: 'technique',
    where: 'salle',
    goal: 'Échauffement et fluidité',
    how: 'Traverse le mur sur de grosses prises en cherchant la fluidité.',
    cues: ['Respire', 'Hanches près du mur', 'Bras tendus le plus possible'],
    levels: [d(1, 1, 300, 0), d(1, 1, 300, 0), d(1, 1, 300, 0)],
  },

  /* ----- Souplesse : hanches ----- */
  {
    id: 'hip-circles',
    name: 'Cercles de hanches',
    cat: 'souplesse',
    zone: 'hanches',
    where: 'sol',
    goal: 'Réveiller les hanches dans toute leur amplitude',
    how: 'À quatre pattes ou debout, dessine les plus grands cercles possibles avec un genou, dans un sens puis dans l’autre.',
    cues: ['Lent et ample', 'Le bassin reste stable', 'Les deux sens'],
    levels: [d(1, 6, 0, 0, { sides: true }), d(1, 8, 0, 0, { sides: true }), d(2, 8, 0, 10, { sides: true })],
  },
  {
    id: 'butterfly',
    name: 'Papillon',
    cat: 'souplesse',
    zone: 'hanches',
    where: 'sol',
    anim: 'frog',
    goal: 'Ouvrir les adducteurs',
    how: 'Assis, plantes de pied l’une contre l’autre, laisse les genoux descendre vers le sol en gardant le dos droit.',
    cues: ['Dos droit', 'Pousse doucement les genoux avec les coudes', 'Respire dans l’étirement'],
    levels: STRETCH,
  },
  {
    id: 'frog',
    name: 'Grenouille',
    cat: 'souplesse',
    zone: 'hanches',
    where: 'sol',
    goal: 'La grenouille du grimpeur : bassin collé au mur',
    how: 'À quatre pattes, écarte les genoux au maximum, chevilles alignées avec les genoux, et recule doucement le bassin.',
    cues: ['Tibias parallèles', 'Recule le bassin, ne force pas', 'Sur les avant-bras pour aller plus loin'],
    levels: STRETCH,
    source: 'Hooper’s Beta',
  },
  {
    id: 'pigeon',
    name: 'Pigeon',
    cat: 'souplesse',
    zone: 'hanches',
    where: 'sol',
    goal: 'Rotation externe de hanche : pieds hauts de côté',
    how: 'Une jambe pliée devant toi, l’autre tendue derrière, descends le buste vers l’avant.',
    cues: ['Bassin face au sol', 'Pied avant flex', 'Change de côté'],
    levels: STRETCH_SIDES,
  },
  {
    id: 'couch-stretch',
    name: 'Étirement du psoas',
    cat: 'souplesse',
    zone: 'hanches',
    where: 'sol',
    anim: 'pigeon',
    goal: 'Avant de hanche, souvent raide chez le grimpeur assis',
    how: 'Un genou au sol contre un mur ou un canapé, le pied remonté derrière toi, l’autre pied devant. Avance le bassin.',
    cues: ['Serre les fessiers', 'Buste droit', 'Change de côté'],
    levels: STRETCH_SIDES,
  },
  {
    id: 'hip-9090',
    name: 'Rotations 90/90',
    cat: 'souplesse',
    zone: 'hanches',
    where: 'sol',
    anim: 'pigeon',
    goal: 'Rotations internes et externes des hanches',
    how: 'Assis, une jambe pliée devant à 90°, l’autre pliée sur le côté à 90°. Bascule les deux genoux de l’autre côté sans les mains.',
    cues: ['Dos droit', 'Lent', 'Appuie-toi sur les mains au début'],
    levels: MOBILITY,
  },
  {
    id: 'deep-squat',
    name: 'Squat profond',
    cat: 'souplesse',
    zone: 'hanches',
    where: 'sol',
    goal: 'Hanches et chevilles pour les pieds très hauts',
    how: 'Descends en squat le plus bas possible, talons au sol, coudes poussant les genoux vers l’extérieur.',
    cues: ['Talons au sol', 'Dos long', 'Tiens-toi à un poteau au début'],
    levels: STRETCH,
  },
  {
    id: 'high-step',
    name: 'Pieds hauts actifs',
    cat: 'souplesse',
    zone: 'hanches',
    where: 'sol',
    goal: 'Force dans l’amplitude : lever le pied haut sans les mains',
    how: 'Debout, monte un genou le plus haut possible sur le côté et tiens 3 s, sans te pencher.',
    cues: ['Buste droit', 'C’est la jambe qui monte, pas le buste qui descend', 'Change de côté'],
    levels: [d(1, 6, 0, 0, { sides: true }), d(2, 6, 0, 15, { sides: true }), d(2, 8, 0, 15, { sides: true })],
  },
  /* ----- Souplesse : ischios ----- */
  {
    id: 'hamstring-single',
    name: 'Ischio couché à une jambe',
    cat: 'souplesse',
    zone: 'ischios',
    where: 'sol',
    anim: 'hamstring-fold',
    goal: 'Ischios sans tirer sur le dos',
    how: 'Sur le dos, monte une jambe tendue avec une serviette autour du pied, l’autre jambe au sol.',
    cues: ['Genou tendu', 'Bassin au sol', 'Tire doucement'],
    levels: STRETCH_SIDES,
  },
  {
    id: 'hamstring-fold',
    name: 'Pince jambes tendues',
    cat: 'souplesse',
    zone: 'ischios',
    where: 'sol',
    goal: 'La pince : crochets de talon et pieds loin devant',
    how: 'Assis jambes tendues, bascule le bassin vers l’avant en gardant le dos long.',
    cues: ['Le ventre vers les cuisses', 'Genoux tendus mais pas verrouillés', 'Respire et relâche'],
    levels: STRETCH,
    source: 'Lattice Training',
  },
  {
    id: 'straddle',
    name: 'Écart assis',
    cat: 'souplesse',
    zone: 'ischios',
    where: 'sol',
    goal: 'Adducteurs et ischios pour les grands écarts de pieds',
    how: 'Assis jambes écartées, penche-toi vers l’avant puis vers chaque jambe.',
    cues: ['Rotules vers le plafond', 'Dos long', 'Avance avec les mains'],
    levels: STRETCH,
  },
  {
    id: 'standing-fold',
    name: 'Pince debout',
    cat: 'souplesse',
    zone: 'ischios',
    where: 'sol',
    anim: 'hamstring-fold',
    goal: 'Ischios et bas du dos',
    how: 'Debout, pieds serrés, laisse pendre le buste vers le sol, genoux légèrement fléchis puis de plus en plus tendus.',
    cues: ['Tête relâchée', 'Poids sur l’avant des pieds', 'Remonte en déroulant'],
    levels: STRETCH,
  },
  /* ----- Souplesse : épaules ----- */
  {
    id: 'arm-circles',
    name: 'Cercles de bras',
    cat: 'souplesse',
    zone: 'epaules',
    where: 'sol',
    goal: 'Échauffer les épaules',
    how: 'Grands cercles bras tendus, petits puis grands, vers l’avant puis vers l’arrière.',
    cues: ['Amplitude maximale', 'Épaules basses', 'Les deux sens'],
    levels: MOBILITY,
  },
  {
    id: 'shoulder-dislocates',
    name: 'Passages d’épaules au bâton',
    cat: 'souplesse',
    zone: 'epaules',
    where: 'sol',
    goal: 'Mobilité des épaules au-dessus de la tête',
    how: 'Avec un manche à balai ou une serviette tenue large, passe les bras tendus de l’avant vers l’arrière du corps.',
    cues: ['Bras tendus', 'Rapproche les mains au fil des semaines', 'Pas de douleur'],
    levels: MOBILITY,
  },
  {
    id: 'doorway-stretch',
    name: 'Pectoraux dans l’encadrement',
    cat: 'souplesse',
    zone: 'epaules',
    where: 'sol',
    goal: 'Ouvrir la poitrine, contre les épaules enroulées',
    how: 'Avant-bras contre un encadrement de porte, coude à hauteur d’épaule, avance le corps.',
    cues: ['Épaule basse', 'Ventre rentré', 'Change de côté'],
    levels: STRETCH_SIDES,
  },
  {
    id: 'lats-wall',
    name: 'Dorsaux au mur',
    cat: 'souplesse',
    zone: 'epaules',
    where: 'sol',
    anim: 'child-pose',
    goal: 'Grands dorsaux, raides après le tirage',
    how: 'Mains sur un mur ou une table, recule le bassin et laisse la poitrine descendre, bras tendus.',
    cues: ['Dos plat', 'Pousse les fesses en arrière', 'Respire'],
    levels: STRETCH,
  },
  {
    id: 'sleeper',
    name: 'Étirement du dormeur',
    cat: 'souplesse',
    zone: 'epaules',
    where: 'sol',
    anim: 'external-rotation',
    goal: 'Rotation interne de l’épaule',
    how: 'Couché sur le côté, bras du dessous devant toi coude plié à 90°, pousse doucement l’avant-bras vers le sol avec l’autre main.',
    cues: ['Doux', 'Épaule à plat', 'Change de côté'],
    levels: STRETCH_SIDES,
  },
  {
    id: 'dead-hang',
    name: 'Suspension passive',
    cat: 'souplesse',
    zone: 'epaules',
    where: 'barre',
    goal: 'Décompresser épaules et colonne',
    how: 'Suspends-toi à ta barre, pieds au sol si besoin, et laisse le corps se relâcher.',
    cues: ['Respire', 'Relâche les jambes', 'Pieds au sol pour doser'],
    levels: [d(2, 1, 20, 30), d(2, 1, 30, 30), d(3, 1, 45, 30)],
  },
  /* ----- Souplesse : dos ----- */
  {
    id: 'cat-cow',
    name: 'Chat et vache',
    cat: 'souplesse',
    zone: 'dos',
    where: 'sol',
    goal: 'Mobiliser toute la colonne',
    how: 'À quatre pattes, arrondis le dos en expirant, puis creuse-le en inspirant.',
    cues: ['Lent', 'Suit ta respiration', 'Vertèbre par vertèbre'],
    levels: MOBILITY,
  },
  {
    id: 'thread-needle',
    name: 'Fil de l’aiguille',
    cat: 'souplesse',
    zone: 'dos',
    where: 'sol',
    anim: 'thoracic-open',
    goal: 'Rotation du haut du dos',
    how: 'À quatre pattes, passe un bras sous le corps jusqu’à poser l’épaule au sol, puis ouvre-le vers le plafond.',
    cues: ['Bassin immobile', 'Suis la main du regard', 'Change de côté'],
    levels: [d(1, 6, 0, 0, { sides: true }), d(1, 8, 0, 0, { sides: true }), d(2, 8, 0, 10, { sides: true })],
  },
  {
    id: 'thoracic-open',
    name: 'Ouverture thoracique',
    cat: 'souplesse',
    zone: 'dos',
    where: 'sol',
    goal: 'Ouvrir la poitrine et tourner le haut du dos',
    how: 'Couché sur le côté, genoux pliés, ouvre le bras du dessus vers l’autre côté et laisse-le reposer.',
    cues: ['Genoux collés', 'Respire', 'Change de côté'],
    levels: STRETCH_SIDES,
  },
  {
    id: 'child-pose',
    name: 'Posture de l’enfant',
    cat: 'souplesse',
    zone: 'dos',
    where: 'sol',
    goal: 'Relâcher le dos et les épaules',
    how: 'À genoux, assieds-toi sur les talons et allonge les bras devant toi, front au sol.',
    cues: ['Respire dans le dos', 'Bras loin devant', 'Relâche'],
    levels: STRETCH,
  },
  {
    id: 'breathing',
    name: 'Respiration lente',
    cat: 'souplesse',
    zone: 'dos',
    where: 'sol',
    goal: 'Redescendre après la séance',
    how: 'Allongé, inspire 4 s par le nez, expire 6 s par la bouche.',
    cues: ['Ventre qui gonfle', 'Expiration plus longue', 'Yeux fermés'],
    levels: [d(1, 1, 60, 0), d(1, 1, 90, 0), d(1, 1, 120, 0)],
  },
  /* ----- Souplesse : poignets et avant-bras ----- */
  {
    id: 'wrist-warmup',
    name: 'Poignets et doigts',
    cat: 'souplesse',
    zone: 'poignets',
    where: 'sol',
    goal: 'Échauffer poignets et doigts',
    how: 'Cercles de poignets, ouvrir-fermer les mains, poings serrés puis doigts écartés.',
    cues: ['Les deux sens', 'Doux', 'Mains relâchées'],
    levels: MOBILITY,
  },
  {
    id: 'tendon-glides',
    name: 'Glissements des tendons',
    cat: 'souplesse',
    zone: 'poignets',
    where: 'sol',
    anim: 'wrist-warmup',
    goal: 'Faire glisser les tendons des doigts (récupération)',
    how: 'Main ouverte, puis crochet (doigts pliés en haut), poing, poing droit, table : enchaîne les 5 positions.',
    cues: ['Lent', 'Chaque position 2 s', 'Les deux mains'],
    levels: MOBILITY,
  },
  {
    id: 'forearm-stretch',
    name: 'Fléchisseurs des avant-bras',
    cat: 'souplesse',
    zone: 'poignets',
    where: 'sol',
    goal: 'Détendre les avant-bras après la grimpe',
    how: 'Bras tendu devant toi paume vers l’avant, tire doucement les doigts vers toi avec l’autre main.',
    cues: ['Coude tendu', 'Doux, jamais douloureux', 'Change de main'],
    levels: STRETCH_SIDES,
  },
  {
    id: 'extensors-stretch',
    name: 'Extenseurs des avant-bras',
    cat: 'souplesse',
    zone: 'poignets',
    where: 'sol',
    anim: 'forearm-stretch',
    goal: 'Le dessus de l’avant-bras, lié aux douleurs de coude',
    how: 'Bras tendu, paume vers le sol, plie le poignet vers le bas et tire doucement la main vers toi.',
    cues: ['Coude tendu', 'Poing fermé pour aller plus loin', 'Change de main'],
    levels: STRETCH_SIDES,
  },
  {
    id: 'reverse-prayer',
    name: 'Prière inversée',
    cat: 'souplesse',
    zone: 'poignets',
    where: 'sol',
    anim: 'forearm-stretch',
    goal: 'Poignets en extension',
    how: 'À genoux, mains au sol doigts tournés vers toi, recule doucement les fesses vers les talons.',
    cues: ['Paumes à plat', 'Doux', 'Recule petit à petit'],
    levels: STRETCH,
  },
  /* ----- Souplesse : chevilles et pieds ----- */
  {
    id: 'ankle-circles',
    name: 'Cercles de chevilles',
    cat: 'souplesse',
    zone: 'chevilles',
    where: 'sol',
    goal: 'Mobilité des chevilles',
    how: 'Assis ou debout, dessine de grands cercles avec la pointe du pied.',
    cues: ['Amplitude maximale', 'Les deux sens', 'Lent'],
    levels: [d(1, 8, 0, 0, { sides: true }), d(1, 10, 0, 0, { sides: true }), d(2, 10, 0, 10, { sides: true })],
  },
  {
    id: 'knee-wall',
    name: 'Genou au mur',
    cat: 'souplesse',
    zone: 'chevilles',
    where: 'sol',
    anim: 'deep-squat',
    goal: 'Flexion de cheville pour les pieds de dalle',
    how: 'Face à un mur, pied à 10 cm, avance le genou jusqu’à toucher le mur sans décoller le talon.',
    cues: ['Talon collé au sol', 'Genou dans l’axe du pied', 'Recule le pied quand c’est facile'],
    levels: [d(1, 10, 0, 0, { sides: true }), d(2, 10, 0, 10, { sides: true }), d(2, 12, 0, 10, { sides: true })],
  },
  {
    id: 'calf-stretch',
    name: 'Mollets au mur',
    cat: 'souplesse',
    zone: 'chevilles',
    where: 'sol',
    anim: 'calf-raises',
    goal: 'Mollets, souvent raides à force de chaussons',
    how: 'Mains au mur, une jambe tendue derrière, talon au sol, avance le bassin.',
    cues: ['Talon au sol', 'Pied droit', 'Change de côté'],
    levels: STRETCH_SIDES,
  },
  {
    id: 'toe-curls',
    name: 'Orteils actifs',
    cat: 'souplesse',
    zone: 'chevilles',
    where: 'sol',
    goal: 'Force des orteils pour les pointes de pied',
    how: 'Pieds nus, attrape une serviette avec les orteils et ramène-la vers toi.',
    cues: ['Talon au sol', 'Lent', 'Les deux pieds'],
    levels: [d(1, 10, 0, 0, { sides: true }), d(2, 10, 0, 15, { sides: true }), d(2, 15, 0, 15, { sides: true })],
  },
];

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id) ?? null;

/* ---------- Séances ---------- */

/** Une étape : un exercice (ou un par niveau), ou un temps libre. */
export type Step = { kind: 'ex'; ids: string | [string, string, string]; note?: string } | { kind: 'free'; title: string; detail: string; minutes: number; icon: AndroidSymbol };

export type Session = {
  id: string;
  name: string;
  cat: Cat;
  goal: string;
  icon: AndroidSymbol;
  where: Where;
  intensity: 1 | 2 | 3;
  steps: Step[];
  source?: string;
  /** Routine de souplesse plutôt que séance. */
  zone?: Zone | 'tout';
};

const ex = (ids: string | [string, string, string], note?: string): Step => ({ kind: 'ex', ids, note });
const WARM_WALL: Step = { kind: 'free', title: 'Échauffement au mur', detail: '5 min de mobilité (poignets, épaules, hanches), puis 6 à 8 blocs de plus en plus durs, jusqu’à 2 niveaux sous ton max.', minutes: 12, icon: 'local_fire_department' };
const WARM_HOME: Step = { kind: 'free', title: 'Échauffement', detail: 'Cercles de bras et de poignets, 20 jumping jacks, 10 pompes faciles et 5 tirages d’omoplates.', minutes: 5, icon: 'local_fire_department' };
const COOL: Step = { kind: 'free', title: 'Retour au calme', detail: 'Quelques blocs très faciles, puis secoue et étire les avant-bras.', minutes: 5, icon: 'spa' };

export const SESSIONS: Session[] = [
  {
    id: 'doigts-force',
    name: 'Force des doigts',
    cat: 'doigts',
    goal: 'Le protocole le plus efficace pour des doigts plus forts.',
    icon: 'back_hand',
    where: 'salle',
    intensity: 3,
    steps: [WARM_WALL, ex('recruitment'), ex(['hang-intro', 'max-hangs', 'max-hangs'], 'Ta série principale'), ex(['pinch-hold', 'pinch-hold', 'min-edge']), ex('forearm-stretch')],
    source: 'Eva López, Hooper’s Beta',
  },
  {
    id: 'doigts-endurance',
    name: 'Doigts : endurance de force',
    cat: 'doigts',
    goal: 'Tenir les prises plus longtemps dans les blocs à rallonge.',
    icon: 'back_hand',
    where: 'salle',
    intensity: 2,
    steps: [WARM_WALL, ex('repeaters'), ex('density-hangs'), ex('forearm-stretch')],
    source: 'Lattice Training',
  },
  {
    id: 'doigts-tendons',
    name: 'Doigts : tendons solides',
    cat: 'doigts',
    goal: 'Séance légère pour renforcer tendons et poulies, idéale les jours sans grimpe.',
    icon: 'healing',
    where: 'salle',
    intensity: 1,
    steps: [ex('wrist-warmup'), ex('abrahangs'), ex('finger-extensors'), ex('wrist-curls'), ex('tendon-glides')],
    source: 'Emil Abrahamsson, Tension Climbing',
  },
  {
    id: 'blocs-limite',
    name: 'Blocs à la limite',
    cat: 'puissance',
    goal: 'Grimper dur et frais : ce qui fait le plus progresser en bloc.',
    icon: 'landscape',
    where: 'salle',
    intensity: 3,
    steps: [WARM_WALL, ex('limit-boulder'), COOL],
    source: 'Lattice Training',
  },
  {
    id: 'puissance-bloc',
    name: 'Puissance bloc',
    cat: 'puissance',
    goal: 'Explosivité : jetés, mouvements lointains, contacts rapides.',
    icon: 'bolt',
    where: 'salle',
    intensity: 3,
    steps: [WARM_WALL, ex('dynos'), ex(['explosive-pullups', 'campus-ladders', 'campus-doubles']), ex('limit-boulder', 'Termine par 2 ou 3 blocs durs'), ex('forearm-stretch')],
  },
  {
    id: 'tirage-lourd',
    name: 'Tirage lourd',
    cat: 'tirage',
    goal: 'Des bras et un dos plus forts, à ta barre.',
    icon: 'fitness_center',
    where: 'barre',
    intensity: 3,
    steps: [WARM_HOME, ex('scap-pulls'), ex(['pullups', 'pullups', 'weighted-pullups']), ex('lockoffs'), ex(['rows', 'frenchies', 'one-arm-negatives']), ex('lats-wall')],
  },
  {
    id: 'gainage',
    name: 'Gainage de grimpeur',
    cat: 'gainage',
    goal: 'Garder les pieds en dévers et transmettre la force.',
    icon: 'accessibility_new',
    where: 'barre',
    intensity: 2,
    steps: [WARM_HOME, ex('hollow'), ex(['leg-raises', 'toes-to-bar', 'toes-to-bar']), ex(['front-lever', 'front-lever', 'front-lever-one-leg']), ex(['side-plank', 'side-plank', 'windshield-wipers']), ex('superman')],
  },
  {
    id: 'antagonistes',
    name: 'Antagonistes et épaules',
    cat: 'antagonistes',
    goal: 'Équilibrer tout le tirage de la grimpe pour éviter les blessures.',
    icon: 'shield',
    where: 'sol',
    intensity: 2,
    steps: [WARM_HOME, ex('pushups'), ex('dips'), ex('scap-pushups'), ex('external-rotation'), ex('ytw'), ex('finger-extensors')],
  },
  {
    id: 'prevention',
    name: 'Prévention doigts, coudes, épaules',
    cat: 'antagonistes',
    goal: '20 min pour protéger les zones qui se blessent le plus en grimpe.',
    icon: 'health_and_safety',
    where: 'sol',
    intensity: 1,
    steps: [ex('wrist-warmup'), ex('wrist-curls'), ex('pronation'), ex('finger-extensors'), ex('external-rotation'), ex('ytw')],
  },
  {
    id: 'quatre-quatre',
    name: '4 × 4 résistance',
    cat: 'endurance',
    goal: 'Ne plus lâcher à cause de la pompe en fin de bloc.',
    icon: 'timer',
    where: 'salle',
    intensity: 3,
    steps: [WARM_WALL, ex('four-by-four'), COOL],
    source: 'Lattice Training',
  },
  {
    id: 'circuits',
    name: 'Circuits et continuité',
    cat: 'endurance',
    goal: 'Endurance de fond et récupération en grimpant.',
    icon: 'all_inclusive',
    where: 'salle',
    intensity: 2,
    steps: [WARM_WALL, ex('circuits'), ex(['arc', 'emom', 'emom']), COOL],
  },
  {
    id: 'volume-technique',
    name: 'Volume technique',
    cat: 'technique',
    goal: 'Beaucoup de blocs faciles et propres : la technique devient automatique.',
    icon: 'directions_walk',
    where: 'salle',
    intensity: 1,
    steps: [ex('easy-traverse'), ex('silent-feet'), { kind: 'free', title: 'Pyramide de blocs', detail: '10 blocs 2 à 3 niveaux sous ton max, dans des styles variés (dalle, dévers, réglettes, plats). Chaque bloc doit être fluide.', minutes: 25, icon: 'stacked_bar_chart' }, COOL],
  },
  {
    id: 'express-barre',
    name: 'Express 20 min à la barre',
    cat: 'tirage',
    goal: 'Une séance courte et complète chez toi.',
    icon: 'bolt',
    where: 'barre',
    intensity: 2,
    steps: [WARM_HOME, ex('pullups'), ex('leg-raises'), ex('pushups'), ex('hollow')],
  },
  {
    id: 'complet-maison',
    name: 'Complet maison 40 min',
    cat: 'tirage',
    goal: 'Tirage, gainage et antagonistes en une séance.',
    icon: 'home',
    where: 'barre',
    intensity: 2,
    steps: [WARM_HOME, ex('scap-pulls'), ex(['pullups', 'pullups', 'typewriter']), ex('lockoffs'), ex(['leg-raises', 'toes-to-bar', 'toes-to-bar']), ex('pushups'), ex('external-rotation'), ex('hollow')],
  },

  /* ----- Souplesse ----- */
  { id: 'souplesse-hanches', name: 'Hanches de grimpeur', cat: 'souplesse', zone: 'hanches', goal: 'Pieds hauts, grenouille et bassin près du mur.', icon: 'airline_seat_legroom_extra', where: 'sol', intensity: 1, steps: [ex('hip-circles'), ex('butterfly'), ex('frog'), ex('pigeon'), ex('couch-stretch'), ex('high-step')], source: 'Hooper’s Beta' },
  { id: 'souplesse-ischios', name: 'Ischios et pince', cat: 'souplesse', zone: 'ischios', goal: 'Crochets de talon et pieds loin devant.', icon: 'directions_run', where: 'sol', intensity: 1, steps: [ex('hamstring-single'), ex('standing-fold'), ex('hamstring-fold'), ex('straddle')], source: 'Lattice Training' },
  { id: 'souplesse-epaules', name: 'Épaules libres', cat: 'souplesse', zone: 'epaules', goal: 'Bras au-dessus de la tête sans raideur.', icon: 'sports_gymnastics', where: 'sol', intensity: 1, steps: [ex('arm-circles'), ex('shoulder-dislocates'), ex('doorway-stretch'), ex('lats-wall'), ex('sleeper'), ex('dead-hang')] },
  { id: 'souplesse-dos', name: 'Dos et thoracique', cat: 'souplesse', zone: 'dos', goal: 'Un haut du dos mobile et détendu.', icon: 'airline_seat_flat', where: 'sol', intensity: 1, steps: [ex('cat-cow'), ex('thread-needle'), ex('thoracic-open'), ex('child-pose'), ex('breathing')] },
  { id: 'souplesse-poignets', name: 'Avant-bras et doigts', cat: 'souplesse', zone: 'poignets', goal: 'Récupérer et protéger tendons et coudes.', icon: 'pan_tool', where: 'sol', intensity: 1, steps: [ex('wrist-warmup'), ex('tendon-glides'), ex('forearm-stretch'), ex('extensors-stretch'), ex('reverse-prayer')] },
  { id: 'souplesse-chevilles', name: 'Chevilles et pieds', cat: 'souplesse', zone: 'chevilles', goal: 'Pointes de pied, carres et dalles.', icon: 'do_not_step', where: 'sol', intensity: 1, steps: [ex('ankle-circles'), ex('knee-wall'), ex('calf-stretch'), ex('toe-curls'), ex('deep-squat')] },
  { id: 'souplesse-apres', name: 'Après la grimpe', cat: 'souplesse', zone: 'tout', goal: 'Le corps entier en 15 min, juste après la séance.', icon: 'spa', where: 'sol', intensity: 1, steps: [ex('forearm-stretch'), ex('extensors-stretch'), ex('doorway-stretch'), ex('lats-wall'), ex('child-pose'), ex('frog'), ex('pigeon'), ex('hamstring-fold')] },
  { id: 'souplesse-express', name: 'Express 5 min', cat: 'souplesse', zone: 'tout', goal: 'Le minimum quotidien, n’importe où.', icon: 'bolt', where: 'sol', intensity: 1, steps: [ex('wrist-warmup'), ex('cat-cow'), ex('frog'), ex('deep-squat')] },
];

export const sessionById = (id: string) => SESSIONS.find((s) => s.id === id) ?? null;
export const isStretch = (s: Session) => s.cat === 'souplesse';

/** Une étape résolue au niveau choisi. */
export type Item = { kind: 'ex'; exercise: Exercise; dose: Dose; level: Lv; note?: string } | { kind: 'free'; title: string; detail: string; minutes: number; icon: AndroidSymbol };

export function sessionItems(s: Session, level: Lv): Item[] {
  return s.steps.flatMap((st): Item[] => {
    if (st.kind === 'free') return [st];
    const id = typeof st.ids === 'string' ? st.ids : st.ids[level - 1];
    const x = exerciseById(id);
    if (!x) return [];
    const l = levelFor(x, level);
    return [{ kind: 'ex', exercise: x, dose: x.levels[l - 1]!, level: l, note: st.note }];
  });
}

/** Durée estimée en minutes (avec 20 s de transition entre exercices). */
export function sessionMinutes(s: Session, level: Lv) {
  const secs = sessionItems(s, level).reduce((t, it) => t + (it.kind === 'free' ? it.minutes * 60 : doseSeconds(it.dose) + 20), 0);
  return Math.max(5, Math.round(secs / 60));
}

/* ---------- Programme de 8 semaines ---------- */

export type Phase = { name: string; text: string; weeks: number[]; plans: Record<3 | 4 | 5, string[]> };
export const PROGRAM_WEEKS = 8;

/** Cycle classique : force, récupération, puissance et résistance, récupération et test. */
export const PHASES: Phase[] = [
  {
    name: 'Force',
    text: 'Charges lourdes, peu de répétitions, beaucoup de repos : doigts et tirage deviennent plus forts.',
    weeks: [1, 2, 3],
    plans: {
      3: ['blocs-limite', 'doigts-force', 'tirage-lourd'],
      4: ['blocs-limite', 'doigts-force', 'tirage-lourd', 'antagonistes'],
      5: ['blocs-limite', 'doigts-force', 'tirage-lourd', 'antagonistes', 'volume-technique'],
    },
  },
  {
    name: 'Récupération',
    text: 'Semaine allégée : le corps assimile le travail. Grimpe facile, technique et prévention.',
    weeks: [4],
    plans: {
      3: ['volume-technique', 'doigts-tendons', 'prevention'],
      4: ['volume-technique', 'doigts-tendons', 'prevention', 'gainage'],
      5: ['volume-technique', 'doigts-tendons', 'prevention', 'gainage', 'circuits'],
    },
  },
  {
    name: 'Puissance et résistance',
    text: 'On transforme la force en explosivité et on apprend à résister à la pompe.',
    weeks: [5, 6, 7],
    plans: {
      3: ['puissance-bloc', 'quatre-quatre', 'gainage'],
      4: ['puissance-bloc', 'quatre-quatre', 'gainage', 'doigts-endurance'],
      5: ['puissance-bloc', 'quatre-quatre', 'gainage', 'doigts-endurance', 'antagonistes'],
    },
  },
  {
    name: 'Récupération et test',
    text: 'Repos actif, puis va tenter ton projet : c’est le moment de voir tes progrès.',
    weeks: [8],
    plans: {
      3: ['volume-technique', 'prevention', 'blocs-limite'],
      4: ['volume-technique', 'prevention', 'doigts-tendons', 'blocs-limite'],
      5: ['volume-technique', 'prevention', 'doigts-tendons', 'circuits', 'blocs-limite'],
    },
  },
];

export const phaseOf = (week: number) => PHASES.find((p) => p.weeks.includes(week)) ?? PHASES[0];
