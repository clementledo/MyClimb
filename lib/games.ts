/** Jeux à faire en salle sur les blocs. */
export type Game = {
  name: string;
  /** Seul, ou à partir de 2 grimpeurs. */
  group: boolean;
  /** Ce que le jeu fait travailler. */
  works: string;
  rules: string;
};

export const GAMES: Game[] = [
  {
    name: 'Pieds silencieux',
    group: false,
    works: 'Précision des pieds',
    rules:
      'Fais un bloc facile sans aucun bruit de pied sur les prises. Si un pied claque ou glisse, redescends et recommence.',
  },
  {
    name: 'Mains collées',
    group: false,
    works: 'Lecture et précision',
    rules:
      'Une prise touchée est une prise prise : interdit de réajuster la main ou le pied une fois posé. Lis bien le bloc avant de partir.',
  },
  {
    name: 'Survol',
    group: false,
    works: 'Gainage et blocages',
    rules:
      'Avant de saisir chaque prise, garde la main 2 secondes juste au-dessus sans la toucher. À faire sur des blocs 2 ou 3 niveaux sous ton max.',
  },
  {
    name: 'Désescalade',
    group: false,
    works: 'Contrôle et endurance',
    rules:
      'Chaque bloc réussi doit être redescendu par ses propres prises jusqu’au départ. Ça compte seulement si tu ne sautes pas.',
  },
  {
    name: 'Flash du jour',
    group: false,
    works: 'Lecture de bloc',
    rules:
      'Choisis 5 blocs que tu n’as jamais essayés, à ton niveau. Une seule tentative chacun, après les avoir bien lus depuis le sol. Compte tes flashs.',
  },
  {
    name: '4×4',
    group: false,
    works: 'Endurance de force',
    rules:
      'Enchaîne 4 blocs faciles sans pause, repose-toi 3 minutes, et fais-le 4 fois. Si tu tombes, remonte tout de suite sur le même bloc.',
  },
  {
    name: 'Rajoute un mouvement',
    group: true,
    works: 'Mémoire et variété',
    rules:
      'Le premier grimpeur fait 2 mouvements sur le mur. Le suivant refait la séquence et ajoute un mouvement, et ainsi de suite. Qui tombe ou se trompe prend une lettre de G-R-I-M-P-E.',
  },
  {
    name: 'G-R-I-M-P-E',
    group: true,
    works: 'Polyvalence',
    rules:
      'Comme le H-O-R-S-E au basket : un grimpeur choisit un bloc ou une contrainte (sans talon, une main dans le dos au départ…). S’il réussit, les autres doivent réussir aussi, sinon ils prennent une lettre. Le dernier sans le mot complet gagne.',
  },
  {
    name: 'Éliminateur',
    group: true,
    works: 'Créativité et force',
    rules:
      'Choisissez un bloc facile. Chacun le réussit, puis le dernier à l’avoir fait interdit une prise. On recommence avec une prise de moins à chaque tour. Qui échoue est éliminé.',
  },
  {
    name: 'Crée ton bloc',
    group: true,
    works: 'Lecture et créativité',
    rules:
      'Sur un mur à prises libres, chacun invente un bloc de 6 à 8 prises. Les autres l’essaient, puis vous votez pour le meilleur.',
  },
  {
    name: 'Twister',
    group: true,
    works: 'Placement et souplesse',
    rules:
      'Le partenaire au sol annonce chaque mouvement : quel membre et quelle prise (« pied gauche sur la jaune »). Le grimpeur n’a pas le droit de choisir.',
  },
  {
    name: 'Grimpe à l’aveugle',
    group: true,
    works: 'Confiance et proprioception',
    rules:
      'Sur un bloc très facile et bas, le grimpeur ferme les yeux et le partenaire le guide à la voix, prise par prise. Le partenaire reste prêt à parer.',
  },
  {
    name: 'Course chrono',
    group: true,
    works: 'Fluidité',
    rules:
      'Choisissez un bloc facile et chronométrez chacun du départ à la dernière prise tenue à deux mains. Meilleur temps sur 3 essais.',
  },
];
