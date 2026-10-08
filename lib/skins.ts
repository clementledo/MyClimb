import type { Rarity } from './rarity';

/** Costumes du grimpeur 3D (simulation et carte joueur). */
export type SkinId =
  | 'classique'
  | 'competition'
  | 'retro'
  | 'astronaute'
  | 'dino'
  | 'banane'
  | 'heros'
  | 'ninja'
  | 'pirate'
  | 'robot'
  | 'noel'
  | 'licorne'
  | 'bucheron'
  | 'cowboy'
  | 'pompier'
  | 'abeille'
  | 'chat'
  | 'momie'
  | 'viking'
  | 'requin'
  | 'panda'
  | 'sorcier'
  | 'chevalier'
  | 'yeti'
  | 'samourai'
  | 'dragon'
  | 'golem'
  | 'cosmique';

/** Les costumes sans rareté sont à tout le monde ; les autres se gagnent dans les packs. */
export const SKINS: { id: SkinId; name: string; rarity?: Rarity }[] = [
  { id: 'classique', name: 'Classique' },
  { id: 'competition', name: 'Compétition' },
  { id: 'retro', name: 'Rétro 80' },
  { id: 'ninja', name: 'Ninja', rarity: 'commun' },
  { id: 'pirate', name: 'Pirate', rarity: 'commun' },
  { id: 'noel', name: 'Père Noël', rarity: 'commun' },
  { id: 'bucheron', name: 'Bûcheron', rarity: 'commun' },
  { id: 'cowboy', name: 'Cow-boy', rarity: 'commun' },
  { id: 'pompier', name: 'Pompier', rarity: 'commun' },
  { id: 'abeille', name: 'Abeille', rarity: 'commun' },
  { id: 'heros', name: 'Super-héros', rarity: 'rare' },
  { id: 'robot', name: 'Robot', rarity: 'rare' },
  { id: 'banane', name: 'Banane', rarity: 'rare' },
  { id: 'chat', name: 'Chat', rarity: 'rare' },
  { id: 'momie', name: 'Momie', rarity: 'rare' },
  { id: 'viking', name: 'Viking', rarity: 'rare' },
  { id: 'requin', name: 'Requin', rarity: 'rare' },
  { id: 'panda', name: 'Panda', rarity: 'rare' },
  { id: 'dino', name: 'Dinosaure', rarity: 'epique' },
  { id: 'astronaute', name: 'Astronaute', rarity: 'epique' },
  { id: 'sorcier', name: 'Magicien', rarity: 'epique' },
  { id: 'chevalier', name: 'Chevalier', rarity: 'epique' },
  { id: 'yeti', name: 'Yéti', rarity: 'epique' },
  { id: 'licorne', name: 'Licorne', rarity: 'legendaire' },
  { id: 'samourai', name: 'Samouraï', rarity: 'legendaire' },
  { id: 'dragon', name: 'Dragon', rarity: 'legendaire' },
  { id: 'golem', name: 'Golem de lave', rarity: 'mythique' },
  { id: 'cosmique', name: 'Esprit cosmique', rarity: 'mythique' },
];

export const DEFAULT_SKIN: SkinId = 'classique';
export const isSkin = (v: string | null | undefined): v is SkinId => SKINS.some((s) => s.id === v);

/** Réglage où est rangé le costume choisi. */
export const SKIN_KEY = 'skin';
