/**
 * Objets de la collection qui décorent la carte joueur (contours, fonds, titres) et les
 * célébrations 3D au top de la simulation. Les dessins sont dans components/cardCosmetics.tsx
 * et lib/celebrations.ts ; ici, seulement leur nom et leur rareté.
 */
import type { Rarity } from './rarity';

type Entry<Id extends string> = { id: Id; name: string; rarity: Rarity };

/* ---------- Contours de carte ---------- */

export const FRAMES = [
  // Communs
  { id: 'corde', name: 'Corde dynamique', rarity: 'commun' },
  { id: 'corde-fluo', name: 'Corde fluo', rarity: 'commun' },
  { id: 'prises', name: 'Prises en couleurs', rarity: 'commun' },
  { id: 'pixel', name: 'Pixels', rarity: 'commun' },
  { id: 'magnesie', name: 'Pleine de magnésie', rarity: 'commun' },
  { id: 'strap', name: 'Strap', rarity: 'commun' },
  { id: 'pointilles', name: 'Pointillés', rarity: 'commun' },
  { id: 'damier', name: 'Damier', rarity: 'commun' },
  { id: 'bois', name: 'Poutre en bois', rarity: 'commun' },
  { id: 'bronze', name: 'Bronze ciselé', rarity: 'commun' },
  { id: 'bulles', name: 'Bulles', rarity: 'commun' },
  { id: 'vagues', name: 'Vagues', rarity: 'commun' },
  // Rares
  { id: 'lianes', name: 'Lianes', rarity: 'rare' },
  { id: 'cerisier', name: 'Cerisier en fleurs', rarity: 'rare' },
  { id: 'automne', name: 'Feuilles d’automne', rarity: 'rare' },
  { id: 'neon', name: 'Néon', rarity: 'rare' },
  { id: 'neon-acide', name: 'Néon acide', rarity: 'rare' },
  { id: 'glace', name: 'Glace', rarity: 'rare' },
  { id: 'arcenciel', name: 'Arc-en-ciel', rarity: 'rare' },
  { id: 'degaines', name: 'Dégaines', rarity: 'rare' },
  { id: 'toile', name: 'Toile d’araignée', rarity: 'rare' },
  { id: 'argent', name: 'Argent poli', rarity: 'rare' },
  { id: 'arcade', name: 'Arcade', rarity: 'rare' },
  // Épiques
  { id: 'eclair', name: 'Éclairs', rarity: 'epique' },
  { id: 'orage', name: 'Orage violet', rarity: 'epique' },
  { id: 'feu', name: 'Feu', rarity: 'epique' },
  { id: 'feu-bleu', name: 'Feu bleu', rarity: 'epique' },
  { id: 'cosmos', name: 'Cosmos', rarity: 'epique' },
  { id: 'circuit', name: 'Circuit', rarity: 'epique' },
  { id: 'plumes', name: 'Plumes', rarity: 'epique' },
  { id: 'rubis', name: 'Rubis', rarity: 'epique' },
  { id: 'emeraude', name: 'Émeraude', rarity: 'epique' },
  // Légendaires
  { id: 'or', name: 'Or massif', rarity: 'legendaire' },
  { id: 'diamant', name: 'Diamant', rarity: 'legendaire' },
  { id: 'ecailles', name: 'Écailles de dragon', rarity: 'legendaire' },
  { id: 'couronne', name: 'Couronne royale', rarity: 'legendaire' },
  { id: 'ailes', name: 'Ailes d’ange', rarity: 'legendaire' },
  // Mythiques (animés)
  { id: 'comete', name: 'Comète', rarity: 'mythique' },
  { id: 'prisme', name: 'Prisme', rarity: 'mythique' },
  { id: 'lave', name: 'Lave vivante', rarity: 'mythique' },
  { id: 'aurore', name: 'Aurore', rarity: 'mythique' },
] as const satisfies readonly Entry<string>[];

export type FrameId = (typeof FRAMES)[number]['id'];

/* ---------- Fonds de carte ---------- */

export const BACKDROPS = [
  // Communs
  { id: 'pois', name: 'Pois', rarity: 'commun' },
  { id: 'confettis', name: 'Confettis', rarity: 'commun' },
  { id: 'rayons', name: 'Rayons', rarity: 'commun' },
  { id: 'rayures', name: 'Rayures', rarity: 'commun' },
  { id: 'carreaux', name: 'Carreaux', rarity: 'commun' },
  { id: 'hexagones', name: 'Nid d’abeille', rarity: 'commun' },
  { id: 'topo', name: 'Courbes de niveau', rarity: 'commun' },
  { id: 'montagnes', name: 'Montagnes', rarity: 'commun' },
  { id: 'nuages', name: 'Nuages', rarity: 'commun' },
  { id: 'mer', name: 'Mer calme', rarity: 'commun' },
  { id: 'mur', name: 'Mur de bloc', rarity: 'commun' },
  // Rares
  { id: 'etoiles', name: 'Étoiles', rarity: 'rare' },
  { id: 'soleil', name: 'Soleil rétro', rarity: 'rare' },
  { id: 'rayons-or', name: 'Rayons dorés', rarity: 'rare' },
  { id: 'coucher', name: 'Coucher de soleil', rarity: 'rare' },
  { id: 'foret', name: 'Forêt de sapins', rarity: 'rare' },
  { id: 'ville', name: 'Ville la nuit', rarity: 'rare' },
  { id: 'neige', name: 'Flocons', rarity: 'rare' },
  { id: 'desert', name: 'Désert', rarity: 'rare' },
  { id: 'bleau', name: 'Fontainebleau', rarity: 'rare' },
  { id: 'abysses', name: 'Grand bleu', rarity: 'rare' },
  // Épiques
  { id: 'holo', name: 'Holographique', rarity: 'epique' },
  { id: 'flammes', name: 'Flammes', rarity: 'epique' },
  { id: 'flammes-bleues', name: 'Flammes bleues', rarity: 'epique' },
  { id: 'synthwave', name: 'Synthwave', rarity: 'epique' },
  { id: 'orage', name: 'Orage', rarity: 'epique' },
  { id: 'cristaux', name: 'Cristaux', rarity: 'epique' },
  { id: 'jungle', name: 'Jungle', rarity: 'epique' },
  // Légendaires
  { id: 'galaxie', name: 'Galaxie', rarity: 'legendaire' },
  { id: 'dragon', name: 'Dragon', rarity: 'legendaire' },
  { id: 'temple', name: 'Temple d’or', rarity: 'legendaire' },
  { id: 'volcan', name: 'Volcan', rarity: 'legendaire' },
  // Mythiques (animés)
  { id: 'aurore', name: 'Aurore boréale', rarity: 'mythique' },
  { id: 'filantes', name: 'Étoiles filantes', rarity: 'mythique' },
  { id: 'code', name: 'Code secret', rarity: 'mythique' },
] as const satisfies readonly Entry<string>[];

export type BackdropId = (typeof BACKDROPS)[number]['id'];

/* ---------- Titres sous le nom ---------- */

export const TITLES = [
  // Communs
  { id: 'dimanche', name: 'Grimpeur du dimanche', rarity: 'commun' },
  { id: 'accro', name: 'Accro à la magnésie', rarity: 'commun' },
  { id: 'chaussons', name: 'Chaussons qui puent', rarity: 'commun' },
  { id: 'tapis', name: 'Roi du tapis', rarity: 'commun' },
  { id: 'bacs', name: 'Mangeur de bacs', rarity: 'commun' },
  { id: 'essai', name: 'Encore un essai', rarity: 'commun' },
  { id: 'echauffement', name: 'Pro de l’échauffement', rarity: 'commun' },
  { id: 'bleus', name: 'Collectionneur de bleus', rarity: 'commun' },
  { id: 'volumes', name: 'Ami des volumes', rarity: 'commun' },
  { id: 'beta', name: 'Lecteur de bêta', rarity: 'commun' },
  { id: 'moulinette', name: 'Fan de moulinette', rarity: 'commun' },
  { id: 'brosse', name: 'Brosse à prises', rarity: 'commun' },
  { id: 'cuir', name: 'Mains de cuir', rarity: 'commun' },
  { id: 'beton', name: 'Bras en béton', rarity: 'commun' },
  { id: 'avantbras', name: 'Avant-bras en feu', rarity: 'commun' },
  { id: 'pied', name: 'Pied précis', rarity: 'commun' },
  { id: 'repos', name: 'Spécialiste du repos', rarity: 'commun' },
  { id: 'gardien', name: 'Gardien du tapis', rarity: 'commun' },
  { id: 'pof', name: 'Sac à pof', rarity: 'commun' },
  { id: 'salle', name: 'Rat de salle', rarity: 'commun' },
  { id: 'blocbloc', name: 'Bloc après bloc', rarity: 'commun' },
  { id: 'dalle', name: 'Ça passe en dalle', rarity: 'commun' },
  { id: 'flashrate', name: 'Flash raté', rarity: 'commun' },
  { id: 'croix', name: 'Chasseur de croix', rarity: 'commun' },
  // Rares
  { id: 'reglette', name: 'Roi de la réglette', rarity: 'rare' },
  { id: 'danseur', name: 'Danseur de dalle', rarity: 'rare' },
  { id: 'talon', name: 'Spécialiste du talon', rarity: 'rare' },
  { id: 'jete', name: 'Pro du jeté', rarity: 'rare' },
  { id: 'ninja', name: 'Ninja du dévers', rarity: 'rare' },
  { id: 'crochet', name: 'Maître du crochet', rarity: 'rare' },
  { id: 'crabe', name: 'Pince de crabe', rarity: 'rare' },
  { id: 'lezard', name: 'Lézard de la paroi', rarity: 'rare' },
  { id: 'funambule', name: 'Funambule', rarity: 'rare' },
  { id: 'bloqueur', name: 'Bloqueur fou', rarity: 'rare' },
  { id: 'plats', name: 'Seigneur des plats', rarity: 'rare' },
  { id: 'ecureuil', name: 'Écureuil du mur', rarity: 'rare' },
  { id: 'machine', name: 'Machine à croix', rarity: 'rare' },
  { id: 'lynx', name: 'Œil de lynx', rarity: 'rare' },
  { id: 'inarretable', name: 'Inarrêtable', rarity: 'rare' },
  { id: 'aube', name: 'Grimpeur de l’aube', rarity: 'rare' },
  { id: 'velours', name: 'Pieds de velours', rarity: 'rare' },
  // Épiques
  { id: 'fer', name: 'Main de fer', rarity: 'epique' },
  { id: 'acier', name: 'Doigts d’acier', rarity: 'epique' },
  { id: 'araignee', name: 'Araignée humaine', rarity: 'epique' },
  { id: 'gecko', name: 'Gecko', rarity: 'epique' },
  { id: 'fleau', name: 'Fléau des cotations', rarity: 'epique' },
  { id: 'briseur', name: 'Briseur de crux', rarity: 'epique' },
  { id: 'tempete', name: 'Tempête de magnésie', rarity: 'epique' },
  { id: 'devers', name: 'Roi du dévers', rarity: 'epique' },
  { id: 'flasheur', name: 'Flasheur fou', rarity: 'epique' },
  { id: 'maitrevolumes', name: 'Maître des volumes', rarity: 'epique' },
  { id: 'lion', name: 'Cœur de lion', rarity: 'epique' },
  // Légendaires
  { id: 'crux', name: 'Maître du crux', rarity: 'legendaire' },
  { id: 'legende', name: 'Légende de la salle', rarity: 'legendaire' },
  { id: 'seigneur', name: 'Seigneur du 7A', rarity: 'legendaire' },
  { id: 'patron', name: 'Le patron du bloc', rarity: 'legendaire' },
  { id: 'dompteur', name: 'Dompteur de murs', rarity: 'legendaire' },
  { id: 'bleau', name: 'Héros de Bleau', rarity: 'legendaire' },
  // Mythiques (animés)
  { id: 'vivante', name: 'Légende vivante', rarity: 'mythique' },
  { id: 'dieu', name: 'Dieu de la grimpe', rarity: 'mythique' },
  { id: 'elu', name: 'L’élu de la magnésie', rarity: 'mythique' },
] as const satisfies readonly Entry<string>[];

export type TitleId = (typeof TITLES)[number]['id'];

/* ---------- Célébrations au top (simulation 3D) ---------- */

export const CELEBRATIONS = [
  { id: 'poing', name: 'Poing levé', rarity: 'commun', blurb: 'Une main lâche la prise pour un poing vainqueur.' },
  { id: 'coucou', name: 'Coucou', rarity: 'commun', blurb: 'Un petit signe de la main vers le tapis.' },
  { id: 'magnesie', name: 'Nuage de magnésie', rarity: 'commun', blurb: 'Le sac explose en un gros nuage blanc.' },
  { id: 'bulles', name: 'Bulles', rarity: 'commun', blurb: 'Des bulles de savon montent autour du mur.' },
  { id: 'notes', name: 'Musique', rarity: 'commun', blurb: 'Des notes de musique s’envolent.' },
  { id: 'confettis', name: 'Confettis', rarity: 'rare', blurb: 'Une pluie de confettis de toutes les couleurs.' },
  { id: 'ballons', name: 'Ballons', rarity: 'rare', blurb: 'Des ballons s’envolent depuis les tapis.' },
  { id: 'coeurs', name: 'Cœurs', rarity: 'rare', blurb: 'Des cœurs flottent jusqu’au plafond.' },
  { id: 'flocons', name: 'Flocons', rarity: 'rare', blurb: 'La neige tombe doucement sur la salle.' },
  { id: 'artifice', name: 'Feu d’artifice', rarity: 'epique', blurb: 'Des fusées éclatent au-dessus du mur.' },
  { id: 'etoiles', name: 'Pluie d’étoiles', rarity: 'epique', blurb: 'Des étoiles dorées tournent autour de toi.' },
  { id: 'eclairs', name: 'Éclairs', rarity: 'epique', blurb: 'La foudre frappe le haut du mur.' },
  { id: 'or', name: 'Pluie d’or', rarity: 'legendaire', blurb: 'Des pièces d’or tombent du plafond.' },
  { id: 'arcenciel', name: 'Arc-en-ciel', rarity: 'legendaire', blurb: 'Un arc-en-ciel se lève au-dessus du mur.' },
  { id: 'ascension', name: 'Ascension', rarity: 'mythique', blurb: 'Un rayon de lumière, des étincelles et un feu d’artifice final.' },
  { id: 'supernova', name: 'Supernova', rarity: 'mythique', blurb: 'Une explosion d’étoiles et des ondes de lumière.' },
] as const satisfies readonly (Entry<string> & { blurb: string })[];

export type CelebrationId = (typeof CELEBRATIONS)[number]['id'];

/** Réglages où sont rangés les objets portés. */
export const FRAME_KEY = 'cardFrame';
export const BACKDROP_KEY = 'cardBackdrop';
export const TITLE_KEY = 'cardTitle';
export const CELEBRATION_KEY = 'celebration';
