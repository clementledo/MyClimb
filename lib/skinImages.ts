import type { ImageSourcePropType } from 'react-native';

import type { SkinId } from './skins';

/**
 * Images des costumes, dessinées avec le grimpeur 3D par scripts/skins/render.mjs :
 * en pied (choix du costume) et en buste, bras croisés (carte joueur).
 */
export const SKIN_IMAGES: Record<SkinId, { full: ImageSourcePropType; card: ImageSourcePropType }> = {
  classique: { full: require('../assets/skins/classique.webp'), card: require('../assets/skins/classique_carte.webp') },
  competition: { full: require('../assets/skins/competition.webp'), card: require('../assets/skins/competition_carte.webp') },
  retro: { full: require('../assets/skins/retro.webp'), card: require('../assets/skins/retro_carte.webp') },
  astronaute: { full: require('../assets/skins/astronaute.webp'), card: require('../assets/skins/astronaute_carte.webp') },
  dino: { full: require('../assets/skins/dino.webp'), card: require('../assets/skins/dino_carte.webp') },
  banane: { full: require('../assets/skins/banane.webp'), card: require('../assets/skins/banane_carte.webp') },
  heros: { full: require('../assets/skins/heros.webp'), card: require('../assets/skins/heros_carte.webp') },
  ninja: { full: require('../assets/skins/ninja.webp'), card: require('../assets/skins/ninja_carte.webp') },
  pirate: { full: require('../assets/skins/pirate.webp'), card: require('../assets/skins/pirate_carte.webp') },
  robot: { full: require('../assets/skins/robot.webp'), card: require('../assets/skins/robot_carte.webp') },
  noel: { full: require('../assets/skins/noel.webp'), card: require('../assets/skins/noel_carte.webp') },
  licorne: { full: require('../assets/skins/licorne.webp'), card: require('../assets/skins/licorne_carte.webp') },
};
