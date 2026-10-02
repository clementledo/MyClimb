import type { Gym } from './db';

/** Tarifs officiels d'une salle, relevés sur son site. Montants en dollars canadiens. */
export type GymPrices = {
  entry: number;
  others: { label: string; amount: number }[];
  /** Mention sur les taxes, quand le site la donne. */
  taxes?: string;
  source: string;
  checkedOn: string;
};

type Brand = { key: string; prices: GymPrices };

const CHECKED_ON = 'octobre 2026';
const BEFORE_TAXES = 'Prix avant taxes';

// Une enseigne a les mêmes tarifs dans toutes ses salles : on reconnaît la salle à son nom.
const BRANDS: Brand[] = [
  {
    key: 'blocshop',
    prices: {
      entry: 19,
      others: [
        { label: 'Entrée heures creuses', amount: 15 },
        { label: '5 entrées', amount: 85 },
        { label: 'Semaine illimitée', amount: 26 },
        { label: 'Mensuel sans engagement', amount: 79 },
        { label: 'Mensuel avec engagement 12 mois', amount: 64 },
      ],
      taxes: BEFORE_TAXES,
      source: 'https://blocshop.com/tarifs/',
      checkedOn: CHECKED_ON,
    },
  },
  {
    key: 'cafebloc',
    prices: {
      entry: 24.75,
      others: [
        { label: 'Semaine illimitée', amount: 34 },
        { label: '5 entrées', amount: 110 },
        { label: '10 entrées', amount: 215 },
        { label: 'Mensuel (prélèvement)', amount: 92 },
        { label: 'Mensuel étudiant (prélèvement)', amount: 81 },
        { label: 'Mensuel matin, lun-ven 7h-14h', amount: 70 },
        { label: '1 mois prépayé', amount: 129.25 },
        { label: '3 mois prépayés', amount: 330.85 },
      ],
      source: 'https://cafebloc.com/tarifs-escalade-bloc-montreal',
      checkedOn: CHECKED_ON,
    },
  },
  {
    key: 'allezup',
    prices: {
      entry: 23.75,
      others: [
        { label: 'Semaine découverte', amount: 26 },
        { label: '10 entrées', amount: 212.5 },
        { label: 'Mensuel (prélèvement)', amount: 95 },
        { label: 'Mensuel étudiant (prélèvement)', amount: 82 },
        { label: '1 mois prépayé', amount: 131.5 },
        { label: '1 mois prépayé étudiant', amount: 115 },
      ],
      source: 'https://allezup.com/en/',
      checkedOn: CHECKED_ON,
    },
  },
  {
    key: 'zerogravite',
    prices: {
      entry: 25,
      others: [
        { label: 'Entrée étudiant', amount: 22.5 },
        { label: 'Entrée heures creuses', amount: 19.75 },
        { label: '10 entrées', amount: 217.4 },
        { label: 'Mensuel (prélèvement)', amount: 97 },
        { label: 'Mensuel étudiant (prélèvement)', amount: 87.3 },
        { label: 'Mensuel heures creuses', amount: 84 },
        { label: '1 mois escalade + yoga', amount: 135 },
        { label: 'Annuel', amount: 989 },
      ],
      taxes: BEFORE_TAXES,
      source: 'https://zero-gravite.ca/en/pricing/',
      checkedOn: CHECKED_ON,
    },
  },
  {
    key: 'shakti',
    prices: {
      entry: 20,
      others: [
        { label: 'Entrée étudiant', amount: 15 },
        { label: 'Entrée lève-tôt, semaine avant 14h', amount: 13.05 },
        { label: '10 entrées', amount: 160 },
        { label: '10 entrées étudiant', amount: 130 },
        { label: 'Mensuel (prélèvement)', amount: 80 },
        { label: 'Mensuel étudiant (prélèvement)', amount: 70 },
        { label: 'Annuel', amount: 850 },
        { label: 'Annuel étudiant', amount: 725 },
      ],
      source: 'https://shaktirockgym.com/rates',
      checkedOn: CHECKED_ON,
    },
  },
  {
    key: 'rosebloc',
    prices: {
      entry: 28,
      others: [
        { label: 'Entrée étudiant', amount: 25 },
        { label: 'Semaine prépayée', amount: 42 },
        { label: '10 entrées', amount: 240 },
        { label: 'Mensuel (+50 $ d’activation)', amount: 98 },
        { label: 'Mensuel étudiant (+50 $ d’activation)', amount: 88 },
        { label: '1 mois prépayé', amount: 134 },
      ],
      taxes: BEFORE_TAXES,
      source: 'https://www.rosebloc.com/tarifs-et-horaires',
      checkedOn: CHECKED_ON,
    },
  },
  {
    key: 'betabloc',
    prices: {
      entry: 24,
      others: [
        { label: 'Entrée lève-tôt, lun-jeu avant 15h', amount: 15 },
        { label: 'Semaine illimitée', amount: 32 },
        { label: '10 entrées', amount: 220 },
        { label: '20 entrées', amount: 410 },
        { label: 'Mensuel (prélèvement, promo jusqu’au 18/10)', amount: 87 },
        { label: 'Mensuel étudiant (promo jusqu’au 18/10)', amount: 75 },
        { label: '1 mois prépayé', amount: 120 },
        { label: '3 mois prépayés', amount: 310 },
        { label: 'Annuel', amount: 949 },
      ],
      taxes: BEFORE_TAXES,
      source: 'https://www.betabloc.ca/escalade/',
      checkedOn: CHECKED_ON,
    },
  },
  {
    key: 'crux',
    prices: {
      entry: 25,
      others: [
        { label: 'Entrée étudiant', amount: 23 },
        { label: 'Entrée lève-tôt, semaine avant 15h', amount: 15 },
        { label: '10 entrées', amount: 225 },
        { label: 'Mensuel (+50 $ d’activation)', amount: 89 },
        { label: 'Mensuel étudiant (+50 $ d’activation)', amount: 79 },
        { label: '3 mois prépayés', amount: 309 },
        { label: 'Annuel', amount: 949 },
      ],
      taxes: BEFORE_TAXES,
      source: 'https://www.lecrux.com/tarifs',
      checkedOn: CHECKED_ON,
    },
  },
  {
    key: 'canyonescalade',
    prices: {
      entry: 24,
      others: [
        { label: 'Soirée week-end, après 16h', amount: 10 },
        { label: '10 entrées', amount: 199 },
        { label: 'Mensuel (+50 $ d’activation)', amount: 85 },
        { label: 'Mensuel étudiant (+50 $ d’activation)', amount: 75 },
        { label: '1 mois prépayé', amount: 125 },
        { label: 'Annuel', amount: 899 },
      ],
      source: 'https://canyonescalade.com/abonnements-et-tarifs/',
      checkedOn: CHECKED_ON,
    },
  },
];

function normalize(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Grand Montréal, Laval, Rive-Sud et Rive-Nord proche. */
function inMontrealArea(gym: Gym) {
  return gym.lat > 45.25 && gym.lat < 45.85 && gym.lng > -74.2 && gym.lng < -73.2;
}

/** Tarifs pré-remplis de la salle, ou null si on ne les connaît pas. */
export function gymPrices(gym: Gym): GymPrices | null {
  if (!inMontrealArea(gym)) return null;
  const name = normalize(gym.name);
  return BRANDS.find((b) => name.includes(b.key))?.prices ?? null;
}
