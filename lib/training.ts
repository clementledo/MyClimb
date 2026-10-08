/**
 * Entraînement : exercices de renforcement et séances types.
 * Contenu écrit à la main d'après les méthodes courantes d'entraînement en escalade.
 */
import type { AndroidSymbol } from 'expo-symbols';

export type Equipment = 'none' | 'hangboard' | 'bar' | 'bands' | 'wall';

export const EQUIPMENT: { id: Equipment; label: string; icon: AndroidSymbol }[] = [
  { id: 'none', label: 'Poids du corps', icon: 'self_improvement' },
  { id: 'hangboard', label: 'Poutre', icon: 'back_hand' },
  { id: 'bar', label: 'Barre de traction', icon: 'horizontal_rule' },
  { id: 'bands', label: 'Élastiques ou haltères', icon: 'fitness_center' },
  { id: 'wall', label: 'Mur d’escalade', icon: 'landscape' },
];

export type Focus = 'doigts' | 'tirage' | 'gainage' | 'antagonistes' | 'mobilite' | 'mur';

export const FOCUS: Record<Focus, { label: string; icon: AndroidSymbol }> = {
  doigts: { label: 'Doigts', icon: 'back_hand' },
  tirage: { label: 'Tirage et blocages', icon: 'keyboard_double_arrow_up' },
  gainage: { label: 'Gainage', icon: 'accessibility_new' },
  antagonistes: { label: 'Antagonistes et épaules', icon: 'shield' },
  mobilite: { label: 'Mobilité et souplesse', icon: 'self_improvement' },
  mur: { label: 'Sur le mur', icon: 'landscape' },
};

/**
 * Déroulé d'un exercice, utilisé par le minuteur :
 * `sets` séries de `reps` répétitions ; chaque répétition dure `work` s (ou se compte si work = 0),
 * suivie de `restRep` s ; `rest` s de repos entre les séries.
 */
export type Dose = {
  sets: number;
  reps: number;
  /** Durée d'effort d'une répétition en secondes ; 0 = répétitions comptées, sans minuteur. */
  work: number;
  /** Repos entre deux répétitions d'une même série (suspensions répétées). */
  restRep?: number;
  /** Repos entre les séries. */
  rest: number;
  /** À faire de chaque côté. */
  sides?: boolean;
};

export type Exercise = {
  id: string;
  name: string;
  focus: Focus;
  equipment: Equipment;
  /** 1 = accessible, 2 = intermédiaire, 3 = avancé. */
  level: 1 | 2 | 3;
  /** Ce que ça travaille, en une ligne. */
  goal: string;
  how: string;
  cues: string[];
  dose: Dose;
  /** Dose lisible, ex. « 5 × 10 s, repos 3 min ». */
  doseText: string;
  warning?: string;
};

export const LEVELS = ['', 'Accessible', 'Intermédiaire', 'Avancé'] as const;

export const EXERCISES: Exercise[] = [
  /* ---------- Doigts ---------- */
  {
    id: 'hang-intro',
    name: 'Suspensions pieds au sol',
    focus: 'doigts',
    equipment: 'hangboard',
    level: 1,
    goal: 'Habituer les doigts à la poutre sans risque',
    how: 'Sur une grande réglette, pieds posés sur une chaise devant toi, mets juste assez de poids dans les doigts pour que ce soit dur mais propre.',
    cues: ['Prise semi-arquée ou tendue, jamais arquée à fond', 'Épaules engagées, coudes presque tendus', 'Arrête si une douleur pique dans un doigt'],
    dose: { sets: 6, reps: 1, work: 10, rest: 60 },
    doseText: '6 × 10 s, repos 1 min',
  },
  {
    id: 'repeaters',
    name: 'Suspensions répétées 7/3',
    focus: 'doigts',
    equipment: 'hangboard',
    level: 2,
    goal: 'Endurance de force des doigts',
    how: 'Suspends-toi 7 s, lâche 3 s, recommence 6 fois : c’est une série. Choisis une réglette où la dernière suspension est dure mais tenue.',
    cues: ['Même prise du début à la fin', 'Dos et épaules actifs, pas pendu dans les ligaments', 'Si tu lâches avant la fin, prends une plus grande réglette'],
    dose: { sets: 6, reps: 6, work: 7, restRep: 3, rest: 180 },
    doseText: '6 séries de 6 × (7 s / 3 s), repos 3 min',
    warning: 'Après au moins un an de grimpe régulière. Pas plus de 2 séances de poutre par semaine.',
  },
  {
    id: 'max-hangs',
    name: 'Suspensions max 10 s',
    focus: 'doigts',
    equipment: 'hangboard',
    level: 3,
    goal: 'Force maximale des doigts (réglettes et plats)',
    how: 'Sur une réglette de 18–20 mm, tiens 10 s avec du lest ou une main assistée pour que ce soit à ta limite (tu pourrais tenir 12–13 s au mieux).',
    cues: ['Échauffe-toi bien avant (15 min et quelques suspensions faciles)', 'Repos complet entre les essais', 'Note ton lest pour progresser semaine après semaine'],
    dose: { sets: 5, reps: 1, work: 10, rest: 180 },
    doseText: '5 × 10 s à ta limite, repos 3 min',
    warning: 'Exercice avancé : jamais fatigué ou les doigts douloureux. Au plus 2 fois par semaine.',
  },
  {
    id: 'pinch-hold',
    name: 'Tenue de pince',
    focus: 'doigts',
    equipment: 'hangboard',
    level: 2,
    goal: 'Pince et pouce, utiles sur volumes et prises larges',
    how: 'Pince le bord d’une poutre (ou un bloc en bois) et tiens en suspension, pieds au sol pour doser.',
    cues: ['Pouce bien opposé aux doigts', 'Alterne les mains', 'Garde le poignet neutre'],
    dose: { sets: 4, reps: 1, work: 10, rest: 90, sides: true },
    doseText: '4 × 10 s par main, repos 1 min 30',
  },
  {
    id: 'daily-hangs',
    name: 'Suspensions légères',
    focus: 'doigts',
    equipment: 'hangboard',
    level: 1,
    goal: 'Entretenir les tendons des doigts chaque jour, sans fatigue',
    how: 'Sur une grosse réglette (20 mm), pieds au sol ou avec un élastique, ne mets qu’une partie de ton poids : tu dois pouvoir tenir bien plus que 10 s.',
    cues: ['Effort léger, environ 4 sur 10', 'Doigts semi-arqués, jamais arqués', 'Tu dois finir aussi frais qu’au début'],
    dose: { sets: 1, reps: 10, work: 10, restRep: 20, rest: 0 },
    doseText: '10 × 10 s légères, repos 20 s',
  },
  /* ---------- Tirage ---------- */
  {
    id: 'pullups',
    name: 'Tractions',
    focus: 'tirage',
    equipment: 'bar',
    level: 1,
    goal: 'Force de tirage générale',
    how: 'Mains écartées largeur d’épaules, monte le menton au-dessus de la barre, redescends lentement bras tendus.',
    cues: ['Descente en 2–3 s', 'Pas d’élan avec les jambes', 'Trop dur : élastique sous les pieds'],
    dose: { sets: 4, reps: 6, work: 0, rest: 120 },
    doseText: '4 × 6 répétitions, repos 2 min',
  },
  {
    id: 'lockoffs',
    name: 'Blocages 90° et 120°',
    focus: 'tirage',
    equipment: 'bar',
    level: 2,
    goal: 'Tenir le bras plié pour aller chercher loin',
    how: 'Monte en traction et bloque 5 s coudes à 90°, puis 5 s à 120°, puis redescends. Une répétition = les deux blocages.',
    cues: ['Épaules basses, loin des oreilles', 'Gainage serré, pas de balancier', 'Version dure : sur un seul bras, l’autre main au poignet'],
    dose: { sets: 4, reps: 3, work: 10, restRep: 20, rest: 150 },
    doseText: '4 séries de 3 blocages, repos 2 min 30',
  },
  {
    id: 'rows',
    name: 'Tirage horizontal',
    focus: 'tirage',
    equipment: 'none',
    level: 1,
    goal: 'Dos et omoplates, idéal pour commencer',
    how: 'Allongé sous une table solide (ou anneaux), corps gainé, tire la poitrine vers le bord puis redescends.',
    cues: ['Serre les omoplates en haut', 'Corps droit comme une planche', 'Pieds plus loin = plus dur'],
    dose: { sets: 3, reps: 10, work: 0, rest: 90 },
    doseText: '3 × 10 répétitions, repos 1 min 30',
  },
  /* ---------- Gainage ---------- */
  {
    id: 'plank',
    name: 'Planche',
    focus: 'gainage',
    equipment: 'none',
    level: 1,
    goal: 'Gainage de base pour garder les pieds au mur',
    how: 'En appui sur les avant-bras et les pointes de pieds, corps aligné de la tête aux talons.',
    cues: ['Fesses serrées, bassin rentré', 'Respire normalement', 'Arrête quand le dos se creuse'],
    dose: { sets: 3, reps: 1, work: 45, rest: 45 },
    doseText: '3 × 45 s, repos 45 s',
  },
  {
    id: 'side-plank',
    name: 'Planche latérale',
    focus: 'gainage',
    equipment: 'none',
    level: 1,
    goal: 'Obliques, pour les placements de hanche',
    how: 'Sur un avant-bras, de côté, corps droit, hanche haute.',
    cues: ['Coude sous l’épaule', 'Hanche qui ne tombe pas', 'Version dure : lève la jambe du dessus'],
    dose: { sets: 3, reps: 1, work: 30, rest: 30, sides: true },
    doseText: '3 × 30 s par côté',
  },
  {
    id: 'hollow',
    name: 'Position creuse',
    focus: 'gainage',
    equipment: 'none',
    level: 2,
    goal: 'Tension du corps en dévers',
    how: 'Sur le dos, bas du dos plaqué au sol, épaules et jambes tendues décollées, bras derrière la tête.',
    cues: ['Le bas du dos ne décolle jamais', 'Plie les genoux si c’est trop dur', 'Regarde tes pieds'],
    dose: { sets: 4, reps: 1, work: 30, rest: 45 },
    doseText: '4 × 30 s, repos 45 s',
  },
  {
    id: 'leg-raises',
    name: 'Relevés de jambes suspendu',
    focus: 'gainage',
    equipment: 'bar',
    level: 2,
    goal: 'Remonter les pieds en dévers et au toit',
    how: 'Suspendu à la barre, monte les genoux (facile) ou les jambes tendues (dur) jusqu’à la barre, redescends contrôlé.',
    cues: ['Pas de balancier', 'Épaules engagées', 'Expire en montant'],
    dose: { sets: 4, reps: 8, work: 0, rest: 90 },
    doseText: '4 × 8 répétitions, repos 1 min 30',
  },
  {
    id: 'front-lever',
    name: 'Front lever groupé',
    focus: 'gainage',
    equipment: 'bar',
    level: 3,
    goal: 'Gainage total pour les dévers et les toits',
    how: 'Suspendu, bras tendus, monte le corps à l’horizontale genoux pliés contre la poitrine et tiens.',
    cues: ['Bras tendus, pousse la barre vers les hanches', 'Dos plat', 'Progresse en dépliant une jambe'],
    dose: { sets: 5, reps: 1, work: 8, rest: 90 },
    doseText: '5 × 8 s, repos 1 min 30',
  },
  {
    id: 'dead-bug',
    name: 'Dead bug',
    focus: 'gainage',
    equipment: 'none',
    level: 1,
    goal: 'Gainage du bas du dos, pour garder les pieds sur les prises',
    how: 'Sur le dos, bras tendus vers le plafond, genoux à 90°. Descends lentement un bras et la jambe opposée sans décoller le bas du dos, puis change.',
    cues: ['Bas du dos plaqué au sol', 'Lent et contrôlé', 'Expire en descendant'],
    dose: { sets: 3, reps: 10, work: 0, rest: 30, sides: true },
    doseText: '3 × 10 par côté',
  },
  /* ---------- Antagonistes et épaules ---------- */
  {
    id: 'pushups',
    name: 'Pompes',
    focus: 'antagonistes',
    equipment: 'none',
    level: 1,
    goal: 'Équilibre poussée / tirage, protège les épaules',
    how: 'Mains sous les épaules, corps gainé, poitrine jusqu’au sol puis pousse.',
    cues: ['Coudes à 45° du corps', 'Tête dans l’alignement', 'Sur les genoux si besoin'],
    dose: { sets: 3, reps: 12, work: 0, rest: 60 },
    doseText: '3 × 12 répétitions, repos 1 min',
  },
  {
    id: 'external-rotation',
    name: 'Rotations externes',
    focus: 'antagonistes',
    equipment: 'bands',
    level: 1,
    goal: 'Coiffe des rotateurs : épaules solides',
    how: 'Coude collé au corps plié à 90°, tire l’élastique vers l’extérieur sans décoller le coude.',
    cues: ['Lent et contrôlé', 'Charge légère', 'Pas de douleur'],
    dose: { sets: 3, reps: 15, work: 0, rest: 45, sides: true },
    doseText: '3 × 15 par bras',
  },
  {
    id: 'ytw',
    name: 'Y-T-W',
    focus: 'antagonistes',
    equipment: 'none',
    level: 1,
    goal: 'Bas des trapèzes et omoplates',
    how: 'À plat ventre (ou penché en avant), lève les bras en Y, puis en T, puis en W, pouces vers le ciel. 1 répétition = les 3 lettres.',
    cues: ['Omoplates serrées et basses', 'Petite amplitude, sans élan', 'Tiens 2 s en haut'],
    dose: { sets: 3, reps: 8, work: 0, rest: 45 },
    doseText: '3 × 8 répétitions',
  },
  {
    id: 'finger-extensors',
    name: 'Extension des doigts',
    focus: 'antagonistes',
    equipment: 'bands',
    level: 1,
    goal: 'Muscles extenseurs : prévient les douleurs de coude',
    how: 'Un élastique autour des doigts serrés, ouvre la main au maximum puis referme lentement.',
    cues: ['Contrôle le retour', 'Les deux mains', 'Idéal en fin de séance'],
    dose: { sets: 3, reps: 20, work: 0, rest: 30, sides: true },
    doseText: '3 × 20 par main',
  },
  {
    id: 'dips',
    name: 'Dips',
    focus: 'antagonistes',
    equipment: 'none',
    level: 2,
    goal: 'Poussée, utile pour les rétablissements',
    how: 'Mains sur une chaise ou des barres parallèles, descends jusqu’à 90° aux coudes puis pousse.',
    cues: ['Épaules basses', 'Pas plus bas que 90°', 'Jambes pliées pour alléger'],
    dose: { sets: 3, reps: 10, work: 0, rest: 90 },
    doseText: '3 × 10 répétitions, repos 1 min 30',
  },
  {
    id: 'scap-pulls',
    name: 'Tirages d’omoplates',
    focus: 'antagonistes',
    equipment: 'bar',
    level: 1,
    goal: 'Réveiller les omoplates et protéger les épaules en suspension',
    how: 'Suspendu bras tendus, abaisse et resserre les omoplates pour monter de quelques centimètres sans plier les coudes, puis relâche lentement.',
    cues: ['Coudes toujours tendus', 'Épaules loin des oreilles', 'Tiens 1 s en haut'],
    dose: { sets: 3, reps: 8, work: 0, rest: 45 },
    doseText: '3 × 8',
  },
  /* ---------- Mobilité ---------- */
  {
    id: 'frog',
    name: 'Grenouille',
    focus: 'mobilite',
    equipment: 'none',
    level: 1,
    goal: 'Ouverture des hanches : hanches collées au mur',
    how: 'À quatre pattes, écarte les genoux au maximum, chevilles alignées, recule doucement le bassin.',
    cues: ['Respire lentement', 'Aucune douleur dans les genoux', 'Gagne un peu à chaque expiration'],
    dose: { sets: 2, reps: 1, work: 60, rest: 20 },
    doseText: '2 × 1 min',
  },
  {
    id: 'pigeon',
    name: 'Pigeon',
    focus: 'mobilite',
    equipment: 'none',
    level: 1,
    goal: 'Fessiers et rotation de hanche, pour les talons et les grands pas',
    how: 'Une jambe pliée devant toi, l’autre tendue derrière, bassin face au sol, descends le buste.',
    cues: ['Bassin droit', 'Relâche les épaules', 'Change de côté'],
    dose: { sets: 1, reps: 1, work: 60, rest: 15, sides: true },
    doseText: '1 min par côté',
  },
  {
    id: 'forearm-stretch',
    name: 'Étirement des avant-bras',
    focus: 'mobilite',
    equipment: 'none',
    level: 1,
    goal: 'Récupération des fléchisseurs après la grimpe',
    how: 'Bras tendu devant, paume vers l’avant, tire doucement les doigts vers toi avec l’autre main. Puis paume vers le bas.',
    cues: ['Doux, jamais forcé', 'Respire', 'Les deux côtés'],
    dose: { sets: 2, reps: 1, work: 30, rest: 10, sides: true },
    doseText: '2 × 30 s par bras',
  },
  {
    id: 'shoulder-dislocates',
    name: 'Passages d’épaules',
    focus: 'mobilite',
    equipment: 'bands',
    level: 1,
    goal: 'Mobilité des épaules pour les mouvements larges',
    how: 'Un bâton ou un élastique tenu large, passe les bras tendus de devant à derrière la tête et reviens.',
    cues: ['Prise large au début', 'Bras tendus', 'Lent'],
    dose: { sets: 2, reps: 12, work: 0, rest: 30 },
    doseText: '2 × 12 passages',
  },
  {
    id: 'wrist-warmup',
    name: 'Poignets et doigts',
    focus: 'mobilite',
    equipment: 'none',
    level: 1,
    goal: 'Échauffer poignets et doigts, le matin ou avant de grimper',
    how: 'Cercles de poignets dans les deux sens, puis ouvre et ferme les mains vite. Termine en tirant doucement chaque doigt vers l’arrière.',
    cues: ['Mouvements amples', 'Aucune douleur', 'Les deux mains'],
    dose: { sets: 1, reps: 1, work: 120, rest: 0 },
    doseText: '2 min',
  },
  {
    id: 'deep-squat',
    name: 'Squat profond',
    focus: 'mobilite',
    equipment: 'none',
    level: 1,
    goal: 'Chevilles et hanches mobiles pour les pieds hauts',
    how: 'Pieds largeur d’épaules, descends le plus bas possible talons au sol, coudes qui poussent les genoux vers l’extérieur, buste droit.',
    cues: ['Talons au sol', 'Dos long', 'Tiens-toi à un meuble au début'],
    dose: { sets: 3, reps: 1, work: 40, rest: 20 },
    doseText: '3 × 40 s',
  },
  {
    id: 'thoracic-open',
    name: 'Ouverture thoracique',
    focus: 'mobilite',
    equipment: 'none',
    level: 1,
    goal: 'Redresser le haut du dos et ouvrir la poitrine, souvent fermés chez les grimpeurs',
    how: 'Allongé sur le côté, genoux pliés, bras tendus devant toi. Ouvre le bras du dessus vers l’arrière en suivant la main des yeux, puis reviens.',
    cues: ['Genoux collés au sol', 'Expire en ouvrant', 'Lent'],
    dose: { sets: 2, reps: 8, work: 0, rest: 15, sides: true },
    doseText: '2 × 8 par côté',
  },
  {
    id: 'straddle',
    name: 'Écart assis',
    focus: 'mobilite',
    equipment: 'none',
    level: 1,
    goal: 'Ouvrir les adducteurs pour les grands écarts de pieds',
    how: 'Assis jambes tendues écartées au maximum, dos droit, penche le buste vers l’avant en gardant les genoux vers le plafond.',
    cues: ['Dos droit plutôt que bas', 'Respire profondément', 'Gagne un peu à chaque expiration'],
    dose: { sets: 2, reps: 1, work: 60, rest: 20 },
    doseText: '2 × 1 min',
  },
  {
    id: 'hamstring-fold',
    name: 'Pince jambes tendues',
    focus: 'mobilite',
    equipment: 'none',
    level: 1,
    goal: 'Ischios souples pour monter les pieds haut',
    how: 'Debout ou assis jambes tendues, plie-toi depuis les hanches, dos long, et descends les mains vers les pieds.',
    cues: ['Plie depuis les hanches', 'Genoux tendus mais pas verrouillés', 'Relâche la nuque'],
    dose: { sets: 2, reps: 1, work: 45, rest: 15 },
    doseText: '2 × 45 s',
  },
  {
    id: 'high-step',
    name: 'Pieds hauts contrôlés',
    focus: 'mobilite',
    equipment: 'none',
    level: 1,
    goal: 'Souplesse active : lever le pied haut sans l’aide des mains',
    how: 'Debout à côté d’un mur, monte un genou le plus haut possible sur le côté, comme pour poser un pied haut. Tiens 3 s, redescends lentement.',
    cues: ['Buste droit', 'Tiens 3 s en haut', 'Lent à la descente'],
    dose: { sets: 2, reps: 8, work: 0, rest: 20, sides: true },
    doseText: '2 × 8 par jambe',
  },
  {
    id: 'dead-hang',
    name: 'Suspension passive',
    focus: 'mobilite',
    equipment: 'bar',
    level: 1,
    goal: 'Décompresser le dos et ouvrir les épaules',
    how: 'Suspendu à la barre bras tendus, relâche tout le corps et respire. Garde les pieds au sol si c’est trop dur.',
    cues: ['Relâche les épaules', 'Respire lentement', 'Descends doucement'],
    dose: { sets: 3, reps: 1, work: 30, rest: 30 },
    doseText: '3 × 30 s',
  },
  /* ---------- Sur le mur ---------- */
  {
    id: 'four-by-four',
    name: '4 × 4',
    focus: 'mur',
    equipment: 'wall',
    level: 2,
    goal: 'Endurance de force : enchaîner sans exploser',
    how: 'Choisis 4 blocs 2 niveaux sous ton max. Fais les 4 à la suite sans repos, c’est une série. Repose-toi 4 min, recommence 4 fois.',
    cues: ['Descends en désescalade ou en sautant vite', 'Si tu tombes, remonte tout de suite', 'La dernière série doit être très dure'],
    dose: { sets: 4, reps: 4, work: 0, rest: 240 },
    doseText: '4 séries de 4 blocs, repos 4 min',
  },
  {
    id: 'limit-boulder',
    name: 'Bloc à ta limite',
    focus: 'mur',
    equipment: 'wall',
    level: 2,
    goal: 'Force et puissance : le meilleur entraînement de bloc',
    how: 'Choisis 3 ou 4 blocs à ton niveau max ou juste au-dessus. Essais courts et intenses, repos complet entre chaque.',
    cues: ['3 à 4 min de repos entre les essais', 'Travaille les mouvements isolés', 'Arrête quand la qualité baisse'],
    dose: { sets: 8, reps: 1, work: 0, rest: 210 },
    doseText: '6 à 10 essais, repos 3–4 min',
  },
  {
    id: 'arc',
    name: 'Continuité (ARC)',
    focus: 'mur',
    equipment: 'wall',
    level: 1,
    goal: 'Endurance de base et récupération active',
    how: 'Grimpe sans t’arrêter sur des prises faciles (traversée ou montées-descentes) en restant à un léger gonflement des avant-bras.',
    cues: ['Tu dois pouvoir parler en grimpant', 'Secoue les bras sur les bonnes prises', 'Travaille ta respiration'],
    dose: { sets: 2, reps: 1, work: 900, rest: 300 },
    doseText: '2 × 15 min, repos 5 min',
  },
  {
    id: 'silent-feet',
    name: 'Pieds silencieux et précis',
    focus: 'mur',
    equipment: 'wall',
    level: 1,
    goal: 'Technique de pieds',
    how: 'Sur des blocs faciles, pose chaque pied sans bruit et sans le réajuster. Regarde ton pied jusqu’à ce qu’il soit posé.',
    cues: ['Lent, regard sur le pied', 'Pointe du chausson', 'Recommence si un pied claque'],
    dose: { sets: 6, reps: 1, work: 0, rest: 60 },
    doseText: '6 blocs faciles',
  },
  {
    id: 'campus-ladders',
    name: 'Pan Güllich : échelles',
    focus: 'mur',
    equipment: 'wall',
    level: 3,
    goal: 'Puissance de contact pour les jetés',
    how: 'Sur un pan Güllich, monte en alternant les mains (1-2-3…) sans les pieds, avec des mouvements rapides et précis.',
    cues: ['Contact franc et rapide', 'Arrête dès que tu ralentis', 'Repos complet'],
    dose: { sets: 5, reps: 1, work: 0, rest: 180 },
    doseText: '5 montées, repos 3 min',
    warning: 'Très traumatisant pour les doigts : réservé aux grimpeurs confirmés, jamais sans échauffement complet.',
  },
];

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id) ?? null;

/* ---------- Séances types ---------- */

export type Step =
  | { kind: 'exercise'; id: string }
  | { kind: 'free'; title: string; detail: string; minutes: number; icon: AndroidSymbol };

export type SessionType = {
  id: string;
  name: string;
  goal: string;
  icon: AndroidSymbol;
  minutes: number;
  intensity: 1 | 2 | 3;
  where: 'salle' | 'maison';
  /** Points faibles (profils, prises, mouvements de Progression) que la séance travaille. */
  targets: string[];
  steps: Step[];
};

export const INTENSITY = ['', 'Légère', 'Moyenne', 'Intense'] as const;

const WARMUP_WALL: Step = {
  kind: 'free',
  title: 'Échauffement',
  detail: '5 min de mobilité (épaules, poignets, hanches), puis 6 à 8 blocs de plus en plus durs, du très facile jusqu’à 2 niveaux sous ton max.',
  minutes: 15,
  icon: 'local_fire_department',
};
const WARMUP_HOME: Step = {
  kind: 'free',
  title: 'Échauffement',
  detail: 'Cercles de bras, rotations de poignets, 20 jumping jacks, 10 pompes faciles et quelques suspensions très légères.',
  minutes: 8,
  icon: 'local_fire_department',
};
const COOLDOWN: Step = {
  kind: 'free',
  title: 'Retour au calme',
  detail: 'Quelques blocs très faciles ou 5 min de marche, puis étirements doux des avant-bras.',
  minutes: 5,
  icon: 'spa',
};

export const SESSIONS: SessionType[] = [
  {
    id: 'limit',
    name: 'Bloc à ta limite',
    goal: 'Gagner en force et en puissance sur des blocs durs',
    icon: 'bolt',
    minutes: 90,
    intensity: 3,
    where: 'salle',
    targets: ['Dynamique', 'Dévers', 'Toit', 'Compression', 'Coordination'],
    steps: [WARMUP_WALL, { kind: 'exercise', id: 'limit-boulder' }, { kind: 'exercise', id: 'finger-extensors' }, COOLDOWN],
  },
  {
    id: 'fingers',
    name: 'Force des doigts',
    goal: 'Tenir les petites prises plus longtemps',
    icon: 'back_hand',
    minutes: 50,
    intensity: 3,
    where: 'maison',
    targets: ['Réglettes', 'Plats', 'Pinces', 'Inversées', 'Trous'],
    steps: [WARMUP_HOME, { kind: 'exercise', id: 'repeaters' }, { kind: 'exercise', id: 'pinch-hold' }, { kind: 'exercise', id: 'external-rotation' }],
  },
  {
    id: 'endurance',
    name: 'Endurance de force',
    goal: 'Enchaîner les mouvements sans « daube »',
    icon: 'repeat',
    minutes: 70,
    intensity: 2,
    where: 'salle',
    targets: ['Résistance', 'Vertical', 'Dièdre'],
    steps: [WARMUP_WALL, { kind: 'exercise', id: 'four-by-four' }, { kind: 'exercise', id: 'forearm-stretch' }],
  },
  {
    id: 'technique',
    name: 'Technique et pieds',
    goal: 'Grimper plus juste, plus léger',
    icon: 'directions_walk',
    minutes: 60,
    intensity: 1,
    where: 'salle',
    targets: ['Dalle', 'Équilibre', 'Pointe', 'Talon', 'Arête', 'Volumes', 'Rétablissement'],
    steps: [
      WARMUP_WALL,
      { kind: 'exercise', id: 'silent-feet' },
      {
        kind: 'free',
        title: 'Dalle et équilibre',
        detail: 'Enchaîne des dalles faciles en cherchant les pieds avant les mains. Puis refais un bloc déjà réussi en changeant ta méthode.',
        minutes: 20,
        icon: 'balance',
      },
      { kind: 'exercise', id: 'arc' },
    ],
  },
  {
    id: 'pull',
    name: 'Renfo haut du corps',
    goal: 'Tirer plus fort et bloquer plus loin',
    icon: 'keyboard_double_arrow_up',
    minutes: 45,
    intensity: 2,
    where: 'maison',
    targets: ['Dévers', 'Toit', 'Statique', 'Bacs'],
    steps: [WARMUP_HOME, { kind: 'exercise', id: 'pullups' }, { kind: 'exercise', id: 'lockoffs' }, { kind: 'exercise', id: 'leg-raises' }, { kind: 'exercise', id: 'pushups' }],
  },
  {
    id: 'core',
    name: 'Gainage',
    goal: 'Garder les pieds au mur en dévers',
    icon: 'accessibility_new',
    minutes: 25,
    intensity: 2,
    where: 'maison',
    targets: ['Dévers', 'Toit', 'Compression'],
    steps: [{ kind: 'exercise', id: 'plank' }, { kind: 'exercise', id: 'side-plank' }, { kind: 'exercise', id: 'hollow' }, { kind: 'exercise', id: 'leg-raises' }],
  },
  {
    id: 'prehab',
    name: 'Épaules et antagonistes',
    goal: 'Prévenir les blessures, rééquilibrer le corps',
    icon: 'shield',
    minutes: 25,
    intensity: 1,
    where: 'maison',
    targets: [],
    steps: [{ kind: 'exercise', id: 'pushups' }, { kind: 'exercise', id: 'ytw' }, { kind: 'exercise', id: 'external-rotation' }, { kind: 'exercise', id: 'finger-extensors' }, { kind: 'exercise', id: 'dips' }],
  },
  {
    id: 'mobility',
    name: 'Mobilité et souplesse',
    goal: 'Ouvrir les hanches et récupérer',
    icon: 'self_improvement',
    minutes: 20,
    intensity: 1,
    where: 'maison',
    targets: ['Talon', 'Dièdre', 'Rétablissement'],
    steps: [{ kind: 'exercise', id: 'frog' }, { kind: 'exercise', id: 'pigeon' }, { kind: 'exercise', id: 'shoulder-dislocates' }, { kind: 'exercise', id: 'forearm-stretch' }],
  },
  {
    id: 'recovery',
    name: 'Récupération active',
    goal: 'Bouger sans se fatiguer, le lendemain d’une grosse séance',
    icon: 'spa',
    minutes: 40,
    intensity: 1,
    where: 'salle',
    targets: [],
    steps: [{ kind: 'exercise', id: 'arc' }, { kind: 'exercise', id: 'forearm-stretch' }, { kind: 'exercise', id: 'frog' }],
  },
];

export const sessionById = (id: string) => SESSIONS.find((s) => s.id === id) ?? null;

/** Matériel nécessaire pour une séance. */
export function sessionEquipment(s: SessionType): Equipment[] {
  const set = new Set<Equipment>();
  for (const st of s.steps) if (st.kind === 'exercise') set.add(exerciseById(st.id)?.equipment ?? 'none');
  if (s.where === 'salle') set.add('wall');
  set.delete('none');
  return [...set];
}

/** Durée d'un exercice au minuteur, en secondes (0 si répétitions comptées). */
export function exerciseSeconds(d: Dose): number {
  const sides = d.sides ? 2 : 1;
  const perSet = d.work > 0 ? d.reps * d.work + (d.reps - 1) * (d.restRep ?? 0) : 0;
  return sides * (d.sets * perSet + (d.sets - 1) * d.rest);
}

export function formatSeconds(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  if (m === 0) return `${r} s`;
  return r ? `${m} min ${String(r).padStart(2, '0')}` : `${m} min`;
}

/** Durée approximative d'un exercice seul, en minutes (pour l'historique). */
export function exerciseMinutes(x: Exercise) {
  const d = x.dose;
  const repTime = d.work > 0 ? 0 : (d.sides ? 2 : 1) * d.sets * d.reps * 4;
  return Math.max(5, Math.round((exerciseSeconds(d) + repTime) / 300) * 5);
}

/* ---------- Routines du quotidien ---------- */

/** De la force à la souplesse. */
export type RoutineKind = 'force' | 'prevention' | 'souplesse';

export const ROUTINE_KINDS: Record<RoutineKind, { label: string; icon: AndroidSymbol }> = {
  force: { label: 'Force', icon: 'fitness_center' },
  prevention: { label: 'Prévention', icon: 'shield' },
  souplesse: { label: 'Souplesse', icon: 'self_improvement' },
};

export type Routine = {
  id: string;
  name: string;
  goal: string;
  icon: AndroidSymbol;
  minutes: number;
  kind: RoutineKind;
  /** Quand la faire, en quelques mots. */
  when: string;
  /** Faisable tous les jours ; sinon un jour sur deux, pour laisser récupérer. */
  daily: boolean;
  /** Exercices, dans l'ordre. */
  items: string[];
};

export const ROUTINES: Routine[] = [
  {
    id: 'tirage',
    name: 'Force de tirage',
    goal: 'Tractions et blocages pour les mouvements durs',
    icon: 'keyboard_double_arrow_up',
    minutes: 15,
    kind: 'force',
    when: 'Un jour sur deux',
    daily: false,
    items: ['scap-pulls', 'pullups', 'lockoffs'],
  },
  {
    id: 'doigts',
    name: 'Doigts en forme',
    goal: 'Des tendons plus solides, petit à petit',
    icon: 'back_hand',
    minutes: 10,
    kind: 'force',
    when: 'Tous les jours, sans fatigue',
    daily: true,
    items: ['wrist-warmup', 'daily-hangs', 'finger-extensors'],
  },
  {
    id: 'gainage',
    name: 'Gainage express',
    goal: 'Garder les pieds sur les prises dans les dévers',
    icon: 'accessibility_new',
    minutes: 10,
    kind: 'force',
    when: 'Un jour sur deux',
    daily: false,
    items: ['plank', 'side-plank', 'hollow', 'dead-bug'],
  },
  {
    id: 'epaules',
    name: 'Épaules solides',
    goal: 'Équilibrer les muscles et éviter les blessures',
    icon: 'shield',
    minutes: 10,
    kind: 'prevention',
    when: 'Tous les jours',
    daily: true,
    items: ['scap-pulls', 'external-rotation', 'ytw', 'pushups'],
  },
  {
    id: 'reveil',
    name: 'Réveil du grimpeur',
    goal: 'Poignets, hanches et dos prêts pour la journée',
    icon: 'wb_sunny',
    minutes: 8,
    kind: 'souplesse',
    when: 'Le matin',
    daily: true,
    items: ['wrist-warmup', 'deep-squat', 'thoracic-open', 'high-step'],
  },
  {
    id: 'hanches',
    name: 'Hanches de grimpeur',
    goal: 'Hanches collées au mur et pieds plus hauts',
    icon: 'self_improvement',
    minutes: 12,
    kind: 'souplesse',
    when: 'Tous les jours',
    daily: true,
    items: ['frog', 'pigeon', 'straddle', 'high-step'],
  },
  {
    id: 'soir',
    name: 'Étirements du soir',
    goal: 'Relâcher avant-bras, dos et jambes, et mieux récupérer',
    icon: 'bedtime',
    minutes: 8,
    kind: 'souplesse',
    when: 'Le soir ou après la grimpe',
    daily: true,
    items: ['forearm-stretch', 'thoracic-open', 'hamstring-fold', 'pigeon'],
  },
];

export const routineById = (id: string) => ROUTINES.find((r) => r.id === id) ?? null;
