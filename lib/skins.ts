/** Costumes du grimpeur 3D (simulation et carte joueur), tous disponibles. */
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
  | 'licorne';

export const SKINS: { id: SkinId; name: string; wacky?: boolean }[] = [
  { id: 'classique', name: 'Classique' },
  { id: 'competition', name: 'Compétition' },
  { id: 'retro', name: 'Rétro 80' },
  { id: 'astronaute', name: 'Astronaute', wacky: true },
  { id: 'dino', name: 'Dinosaure', wacky: true },
  { id: 'banane', name: 'Banane', wacky: true },
  { id: 'heros', name: 'Super-héros', wacky: true },
  { id: 'ninja', name: 'Ninja', wacky: true },
  { id: 'pirate', name: 'Pirate', wacky: true },
  { id: 'robot', name: 'Robot', wacky: true },
  { id: 'noel', name: 'Père Noël', wacky: true },
  { id: 'licorne', name: 'Licorne', wacky: true },
];

export const DEFAULT_SKIN: SkinId = 'classique';
export const isSkin = (v: string | null | undefined): v is SkinId => SKINS.some((s) => s.id === v);

/** Réglage où est rangé le costume choisi. */
export const SKIN_KEY = 'skin';
