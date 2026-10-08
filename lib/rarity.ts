/** Raretés des objets de la collection, de la plus courante à la plus rare. */
export type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire' | 'mythique';

export const RARITIES: {
  id: Rarity;
  name: string;
  /** Couleur de la rareté (texte, pastilles, halo). */
  color: string;
  /** Dégradé du cadre des cartes : clair en haut, foncé en bas. */
  light: string;
  dark: string;
}[] = [
  { id: 'commun', name: 'Commun', color: '#7D8A97', light: '#EEF1F4', dark: '#9AA6B2' },
  { id: 'rare', name: 'Rare', color: '#2F80ED', light: '#DDEBFF', dark: '#2F6FD6' },
  { id: 'epique', name: 'Épique', color: '#9B45E4', light: '#F1E1FF', dark: '#7B2FC4' },
  { id: 'legendaire', name: 'Légendaire', color: '#E9A100', light: '#FFF3C4', dark: '#D98A00' },
  { id: 'mythique', name: 'Mythique', color: '#F2357F', light: '#FFE0EE', dark: '#C21D63' },
];

export const rarityOf = (id: Rarity) => RARITIES.find((r) => r.id === id)!;
export const rarityRank = (id: Rarity) => RARITIES.findIndex((r) => r.id === id);

/** Couleurs de l'arc-en-ciel des objets mythiques (animés). */
export const MYTHIC_COLORS = ['#FF5D8F', '#FF9F43', '#FFD43B', '#51CF66', '#339AF0', '#845EF7', '#F06595'];
