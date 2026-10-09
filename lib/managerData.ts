/** Données fixes du jeu MyClimb Manager : stats, styles, compétences, pays et noms. */
import type { AndroidSymbol } from 'expo-symbols';

export type MStat = 'force' | 'doigts' | 'technique' | 'endurance' | 'souplesse' | 'mental' | 'puissance' | 'agilite' | 'equilibre';

export const MSTATS: { id: MStat; name: string; short: string; icon: AndroidSymbol }[] = [
  { id: 'force', name: 'Force', short: 'FOR', icon: 'fitness_center' },
  { id: 'doigts', name: 'Doigts', short: 'DOI', icon: 'back_hand' },
  { id: 'technique', name: 'Technique', short: 'TEC', icon: 'psychology_alt' },
  { id: 'endurance', name: 'Endurance', short: 'END', icon: 'all_inclusive' },
  { id: 'souplesse', name: 'Souplesse', short: 'SOU', icon: 'self_improvement' },
  { id: 'mental', name: 'Mental', short: 'MEN', icon: 'psychology' },
  { id: 'puissance', name: 'Puissance', short: 'PUI', icon: 'bolt' },
  { id: 'agilite', name: 'Agilité', short: 'AGI', icon: 'sprint' },
  { id: 'equilibre', name: 'Équilibre', short: 'EQU', icon: 'balance' },
];

/** Styles de grimpeurs : stats fortes et faibles, une petite phrase. */
export type StyleId = 'puissant' | 'technicien' | 'endurant' | 'prodige' | 'aerien' | 'mental';

export const STYLES: Record<StyleId, { name: string; short: string; strong: MStat[]; weak: MStat[]; bios: string[] }> = {
  puissant: {
    name: 'Le puissant',
    short: 'PUI',
    strong: ['force', 'puissance', 'doigts'],
    weak: ['souplesse', 'equilibre'],
    bios: ['Arrache les dévers comme personne, mais déteste les dalles.', 'Ancien gymnaste, il campuse les blocs que les autres grimpent.', 'Ses tractions à un bras font le tour des réseaux.'],
  },
  technicien: {
    name: 'Le technicien',
    short: 'TEC',
    strong: ['technique', 'equilibre', 'souplesse'],
    weak: ['puissance', 'force'],
    bios: ['Lit un bloc en dix secondes et trouve toujours la méthode cachée.', 'Pieds silencieux, gestes parfaits : on dirait qu’il danse.', 'A grandi sur le grès de Fontainebleau.'],
  },
  endurant: {
    name: 'L’endurant',
    short: 'END',
    strong: ['endurance', 'mental', 'doigts'],
    weak: ['puissance', 'agilite'],
    bios: ['Ne lâche jamais : plus la voie est longue, plus il est fort.', 'Récupère sur des prises où les autres tombent.', 'Spécialiste des grandes voies du Verdon.'],
  },
  prodige: {
    name: 'Le jeune prodige',
    short: 'PRO',
    strong: ['agilite', 'technique', 'puissance'],
    weak: ['mental'],
    bios: ['Seize ans, et déjà des blocs dont les autres rêvent. Il progresse très vite.', 'Repéré à sa première compétition : tout le monde veut le recruter.', 'Encore fragile dans la tête, mais un talent rare.'],
  },
  aerien: {
    name: 'L’aérien',
    short: 'AER',
    strong: ['agilite', 'puissance', 'souplesse'],
    weak: ['endurance'],
    bios: ['Les jetés et les mouvements de coordination sont son terrain de jeu.', 'Saute de prise en prise comme s’il volait.', 'Vient du parkour, et ça se voit.'],
  },
  mental: {
    name: 'Le mental d’acier',
    short: 'MEN',
    strong: ['mental', 'technique', 'endurance'],
    weak: ['agilite'],
    bios: ['Ne panique jamais, même au dernier essai de la finale.', 'Plus la pression monte, meilleur il est.', 'Ses rivaux disent qu’il n’a pas de nerfs.'],
  },
};

/** Compétences à débloquer : un bonus sur un type de bloc. */
export type SkillId = 'jete' | 'talon' | 'compression' | 'crochet' | 'dalle' | 'reglettes' | 'lolotte' | 'lecture';

export const SKILLS: Record<SkillId, { name: string; icon: AndroidSymbol; text: string }> = {
  jete: { name: 'Jeté', icon: 'rocket_launch', text: '+8 sur les blocs de coordination' },
  talon: { name: 'Talon', icon: 'do_not_step', text: '+8 sur les blocs en dévers' },
  compression: { name: 'Compression', icon: 'compress', text: '+8 sur les blocs de compression' },
  crochet: { name: 'Crochet de pointe', icon: 'hiking', text: '+8 sur les toits' },
  dalle: { name: 'Adhérence', icon: 'landslide', text: '+8 sur les dalles' },
  reglettes: { name: 'Réglettes', icon: 'back_hand', text: '+8 sur les blocs à petites prises' },
  lolotte: { name: 'Lolotte', icon: 'rotate_right', text: '+5 en difficulté' },
  lecture: { name: 'Lecture', icon: 'visibility', text: '+5 partout quand il observe longtemps' },
};

/** Types de blocs en compétition : stats utiles et compétence qui aide. */
export type BlockType = 'devers' | 'dalle' | 'coordination' | 'compression' | 'reglettes' | 'toit';

export const BLOCKS: Record<BlockType, { name: string; stats: MStat[]; skill: SkillId }> = {
  devers: { name: 'Dévers', stats: ['force', 'puissance', 'doigts'], skill: 'talon' },
  dalle: { name: 'Dalle', stats: ['equilibre', 'technique', 'souplesse'], skill: 'dalle' },
  coordination: { name: 'Coordination', stats: ['agilite', 'puissance', 'mental'], skill: 'jete' },
  compression: { name: 'Compression', stats: ['force', 'souplesse', 'technique'], skill: 'compression' },
  reglettes: { name: 'Réglettes', stats: ['doigts', 'mental', 'technique'], skill: 'reglettes' },
  toit: { name: 'Toit', stats: ['force', 'endurance', 'puissance'], skill: 'crochet' },
};

/** Pays : drapeau, prénoms et noms. */
export const COUNTRIES: { code: string; flag: string; first: string[]; last: string[] }[] = [
  { code: 'CA', flag: '🇨🇦', first: ['Félix', 'Léa', 'Olivier', 'Rosalie', 'Samuel', 'Florence'], last: ['Tremblay', 'Gagnon', 'Roy', 'Côté', 'Bouchard', 'Lavoie'] },
  { code: 'FR', flag: '🇫🇷', first: ['Hugo', 'Camille', 'Théo', 'Manon', 'Lucas', 'Inès'], last: ['Martin', 'Durand', 'Lefèvre', 'Moreau', 'Girard', 'Fournier'] },
  { code: 'US', flag: '🇺🇸', first: ['Jake', 'Emma', 'Tyler', 'Madison', 'Ryan', 'Ashley'], last: ['Miller', 'Walker', 'Hayes', 'Brooks', 'Carter', 'Reed'] },
  { code: 'JP', flag: '🇯🇵', first: ['Haruto', 'Yui', 'Sota', 'Hina', 'Ren', 'Aoi'], last: ['Tanaka', 'Suzuki', 'Sato', 'Nakamura', 'Ito', 'Kobayashi'] },
  { code: 'SI', flag: '🇸🇮', first: ['Luka', 'Nina', 'Jan', 'Eva', 'Žan', 'Lara'], last: ['Novak', 'Kranjc', 'Horvat', 'Zupan', 'Kovač', 'Golob'] },
  { code: 'AT', flag: '🇦🇹', first: ['Jakob', 'Anna', 'Felix', 'Lena', 'Elias', 'Sophie'], last: ['Gruber', 'Huber', 'Bauer', 'Wagner', 'Pichler', 'Steiner'] },
  { code: 'ES', flag: '🇪🇸', first: ['Pablo', 'Lucía', 'Álvaro', 'Carmen', 'Diego', 'Paula'], last: ['García', 'López', 'Navarro', 'Ruiz', 'Ortega', 'Serrano'] },
  { code: 'IT', flag: '🇮🇹', first: ['Marco', 'Giulia', 'Matteo', 'Chiara', 'Luca', 'Sara'], last: ['Rossi', 'Bianchi', 'Ferrari', 'Esposito', 'Romano', 'Colombo'] },
  { code: 'GB', flag: '🇬🇧', first: ['Oliver', 'Amelia', 'Harry', 'Isla', 'Jack', 'Poppy'], last: ['Smith', 'Taylor', 'Davies', 'Evans', 'Wright', 'Hughes'] },
  { code: 'KR', flag: '🇰🇷', first: ['Min-jun', 'Seo-yeon', 'Ji-ho', 'Ha-eun', 'Do-yun', 'Ji-woo'], last: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang'] },
  { code: 'CZ', flag: '🇨🇿', first: ['Adam', 'Tereza', 'Jakub', 'Eliška', 'Tomáš', 'Klára'], last: ['Novák', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý'] },
  { code: 'DE', flag: '🇩🇪', first: ['Leon', 'Mia', 'Paul', 'Hannah', 'Ben', 'Emilia'], last: ['Müller', 'Schmidt', 'Fischer', 'Weber', 'Becker', 'Hoffmann'] },
];

/** Noms des clubs rivaux. */
export const RIVAL_CLUBS = [
  'Granite Rouge', 'Les Arquées', 'Crux Club', 'Vertical Lynx', 'Magnésie Team', 'Les Dévers', 'Bloc Party', 'Altitude 6C',
  'Les Réglettes', 'Club du Toit', 'Dyno Kings', 'Les Lolottes', 'Grès d’Or', 'Pan Güllich', 'Les Chaussons', 'Team Flash',
  'Prise de Tête', 'Les Coinceurs', 'Big Wall', 'Crimp Nation', 'Les Dalleux', 'Calcaire FC', 'Vortex', 'Les Jetés',
];

export const CLUB_COLORS = ['#E8642C', '#E53935', '#D81B60', '#8E24AA', '#3949AB', '#1E88E5', '#00ACC1', '#00897B', '#43A047', '#C0CA33', '#FDD835', '#212121', '#ECEFF1'];
