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
