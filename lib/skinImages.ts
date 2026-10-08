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
  bucheron: { full: require('../assets/skins/bucheron.webp'), card: require('../assets/skins/bucheron_carte.webp') },
  cowboy: { full: require('../assets/skins/cowboy.webp'), card: require('../assets/skins/cowboy_carte.webp') },
  pompier: { full: require('../assets/skins/pompier.webp'), card: require('../assets/skins/pompier_carte.webp') },
  abeille: { full: require('../assets/skins/abeille.webp'), card: require('../assets/skins/abeille_carte.webp') },
  chat: { full: require('../assets/skins/chat.webp'), card: require('../assets/skins/chat_carte.webp') },
  momie: { full: require('../assets/skins/momie.webp'), card: require('../assets/skins/momie_carte.webp') },
  viking: { full: require('../assets/skins/viking.webp'), card: require('../assets/skins/viking_carte.webp') },
  requin: { full: require('../assets/skins/requin.webp'), card: require('../assets/skins/requin_carte.webp') },
  panda: { full: require('../assets/skins/panda.webp'), card: require('../assets/skins/panda_carte.webp') },
  sorcier: { full: require('../assets/skins/sorcier.webp'), card: require('../assets/skins/sorcier_carte.webp') },
  chevalier: { full: require('../assets/skins/chevalier.webp'), card: require('../assets/skins/chevalier_carte.webp') },
  yeti: { full: require('../assets/skins/yeti.webp'), card: require('../assets/skins/yeti_carte.webp') },
  samourai: { full: require('../assets/skins/samourai.webp'), card: require('../assets/skins/samourai_carte.webp') },
  dragon: { full: require('../assets/skins/dragon.webp'), card: require('../assets/skins/dragon_carte.webp') },
  golem: { full: require('../assets/skins/golem.webp'), card: require('../assets/skins/golem_carte.webp') },
  cosmique: { full: require('../assets/skins/cosmique.webp'), card: require('../assets/skins/cosmique_carte.webp') },
};
