import { createContext } from 'react';
import { StyleSheet } from 'react-native';

import { getSetting, setSetting } from './db';
import type { Rarity } from './rarity';

export type Palette = {
  primary: string;
  primarySoft: string;
  text: string;
  muted: string;
  border: string;
  background: string;
  surface: string;
  success: string;
  danger: string;
  /** Texte posé sur la couleur principale. */
  onPrimary: string;
  /** Fond des cartes, posées sur le fond de l'écran. */
  card: string;
  /** Fonds teintés des messages de réussite et d'erreur. */
  successSoft: string;
  dangerSoft: string;
};

export type Theme = {
  name: string;
  /** Une phrase pour le choisir. */
  blurb: string;
  /** Thème sombre : barre d'état claire. */
  dark: boolean;
  /** Les thèmes avec une rareté se gagnent dans les packs ; les autres sont à tout le monde. */
  rarity?: Rarity;
  colors: Palette;
};

export const THEMES = {
  classique: {
    name: 'Classique',
    blurb: 'Le design MyClimb : clair, net, une touche d’orange.',
    dark: false,
    colors: {
      primary: '#EE5A24',
      primarySoft: '#FFF0E8',
      text: '#15171C',
      muted: '#6D727C',
      border: '#E6E8EC',
      background: '#F5F6F8',
      surface: '#ECEEF1',
      success: '#1E9952',
      danger: '#D63A3A',
      onPrimary: '#FEFEFE',
      card: '#FFFFFF',
      successSoft: '#E6F5EC',
      dangerSoft: '#FCEBEB',
    },
  },
  nuit: {
    name: 'Nuit',
    blurb: 'Fond sombre pour les séances du soir.',
    dark: true,
    colors: {
      primary: '#FF8A3D',
      primarySoft: '#3A2518',
      text: '#F1F2F4',
      muted: '#9EA3AB',
      border: '#2B2F35',
      background: '#0F1114',
      surface: '#22262C',
      success: '#51CF66',
      danger: '#FF6B6B',
      onPrimary: '#FEFEFE',
      card: '#181B20',
      successSoft: '#14301E',
      dangerSoft: '#3A1818',
    },
  },
  ocean: {
    name: 'Océan',
    blurb: 'Bleu calme, comme un bloc au bord de l’eau.',
    dark: false,
    colors: {
      primary: '#1C7ED6',
      primarySoft: '#E6F0FB',
      text: '#14213D',
      muted: '#5C6B82',
      border: '#DCE4EE',
      background: '#F3F6FA',
      surface: '#E7EDF5',
      success: '#2B8A3E',
      danger: '#C92A2A',
      onPrimary: '#FEFEFE',
      card: '#FFFFFF',
      successSoft: '#E5F3E8',
      dangerSoft: '#FAE9E9',
    },
  },
  foret: {
    name: 'Forêt',
    blurb: 'Vert sapin, pour les jours de grimpe en extérieur.',
    dark: false,
    colors: {
      primary: '#2F7D4F',
      primarySoft: '#E4F1E8',
      text: '#1C2B22',
      muted: '#5F6F64',
      border: '#DCE5DF',
      background: '#F3F6F2',
      surface: '#E7EDE6',
      success: '#2B8A3E',
      danger: '#C92A2A',
      onPrimary: '#FEFEFE',
      card: '#FFFFFF',
      successSoft: '#E0F0E3',
      dangerSoft: '#FAE9E9',
    },
  },
  magnesie: {
    name: 'Magnésie',
    blurb: 'Noir et blanc, tout en craie.',
    dark: false,
    colors: {
      primary: '#222222',
      primarySoft: '#EDEDED',
      text: '#111112',
      muted: '#777777',
      border: '#E0E0E0',
      background: '#F4F4F4',
      surface: '#E8E8E8',
      success: '#2B8A3E',
      danger: '#C92A2A',
      onPrimary: '#FEFEFE',
      card: '#FFFFFF',
      successSoft: '#E5F3E8',
      dangerSoft: '#FAE9E9',
    },
  },
  banane: {
    name: 'Banane',
    blurb: 'Jaune vif, pour grimper avec la patate.',
    dark: false,
    rarity: 'commun',
    colors: {
      primary: '#7A4B00',
      primarySoft: '#FFE066',
      text: '#3D2600',
      muted: '#8A6A2F',
      border: '#F2D04B',
      background: '#FFF6BF',
      surface: '#FFEC99',
      success: '#2B8A3E',
      danger: '#C92A2A',
      onPrimary: '#FFF9DB',
      card: '#FFFBE3',
      successSoft: '#E2F4D6',
      dangerSoft: '#FFE2DA',
    },
  },
  barbe: {
    name: 'Barbe à papa',
    blurb: 'Rose bonbon et bleu fête foraine.',
    dark: false,
    rarity: 'commun',
    colors: {
      primary: '#E64980',
      primarySoft: '#D0F4FF',
      text: '#5A1E3A',
      muted: '#9C5C7C',
      border: '#FFC9E0',
      background: '#FFF0F6',
      surface: '#FFE3EF',
      success: '#2B8A3E',
      danger: '#C2255C',
      onPrimary: '#FEFEFE',
      card: '#FFFAFC',
      successSoft: '#E2F6E9',
      dangerSoft: '#FFDCE8',
    },
  },
  terminal: {
    name: 'Terminal rétro',
    blurb: 'Vert phosphore sur écran noir, comme en 1985.',
    dark: true,
    rarity: 'rare',
    colors: {
      primary: '#39FF14',
      primarySoft: '#0F2A0B',
      text: '#B6FFA8',
      muted: '#5FAF52',
      border: '#1E4D16',
      background: '#050A04',
      surface: '#0C170A',
      success: '#7CFF5B',
      danger: '#FF3B3B',
      onPrimary: '#031A00',
      card: '#081008',
      successSoft: '#133D0C',
      dangerSoft: '#3A0B0B',
    },
  },
  lave: {
    name: 'Coulée de lave',
    blurb: 'Rouge brûlant : tes avant-bras en fin de séance.',
    dark: true,
    rarity: 'epique',
    colors: {
      primary: '#FF5722',
      primarySoft: '#4A1608',
      text: '#FFE3D6',
      muted: '#D98A6A',
      border: '#5C2412',
      background: '#1E0904',
      surface: '#2E0F07',
      success: '#FFC107',
      danger: '#FF1744',
      onPrimary: '#FEFEFE',
      card: '#26100A',
      successSoft: '#3D2E05',
      dangerSoft: '#4A0A16',
    },
  },
  licorne: {
    name: 'Licorne',
    blurb: 'Violet pailleté, pour les croix magiques.',
    dark: false,
    rarity: 'rare',
    colors: {
      primary: '#9C36B5',
      primarySoft: '#FBE6FF',
      text: '#3B1048',
      muted: '#8A5E97',
      border: '#EBCBF5',
      background: '#FDF5FF',
      surface: '#F6E8FB',
      success: '#0CA678',
      danger: '#E03131',
      onPrimary: '#FEFEFE',
      card: '#FFFFFF',
      successSoft: '#DFF6EE',
      dangerSoft: '#FDE6E6',
    },
  },
  pastis: {
    name: 'Apéro au pied des voies',
    blurb: 'Jaune anis et bleu cigale, accent du Sud compris.',
    dark: false,
    rarity: 'commun',
    colors: {
      primary: '#1864AB',
      primarySoft: '#FFF3BF',
      text: '#10233F',
      muted: '#6B7A8F',
      border: '#F5E3A0',
      background: '#FFFBEA',
      surface: '#FFF3C4',
      success: '#2B8A3E',
      danger: '#C92A2A',
      onPrimary: '#FEFEFE',
      card: '#FFFEF7',
      successSoft: '#E5F3E8',
      dangerSoft: '#FAE9E9',
    },
  },
  menthe: {
    name: 'Menthe à l’eau',
    blurb: 'Vert menthe tout frais, comme un sirop après la séance.',
    dark: false,
    rarity: 'commun',
    colors: {
      primary: '#12A07A',
      primarySoft: '#DDF5EC',
      text: '#123D33',
      muted: '#5E8278',
      border: '#CDE9DF',
      background: '#F1FAF6',
      surface: '#E2F3EC',
      success: '#1F9D55',
      danger: '#D64545',
      onPrimary: '#FBFFFD',
      card: '#FCFFFE',
      successSoft: '#DDF3E5',
      dangerSoft: '#FDE8DE',
    },
  },
  cafe: {
    name: 'Café crème',
    blurb: 'Brun chaud et crème, pour le café avant la grimpe.',
    dark: false,
    rarity: 'commun',
    colors: {
      primary: '#8B5A3C',
      primarySoft: '#F3E6DA',
      text: '#2E1F16',
      muted: '#85715F',
      border: '#E8DACB',
      background: '#FAF5EF',
      surface: '#F1E8DD',
      success: '#3E8E41',
      danger: '#C0392B',
      onPrimary: '#FFFCF8',
      card: '#FFFDF9',
      successSoft: '#E3F1E1',
      dangerSoft: '#F9E3DF',
    },
  },
  glacier: {
    name: 'Glacier',
    blurb: 'Bleu glacé, pour garder la tête froide dans le crux.',
    dark: false,
    rarity: 'commun',
    colors: {
      primary: '#2C8BC9',
      primarySoft: '#E0F1FB',
      text: '#0F2A3D',
      muted: '#5D7A8F',
      border: '#D2E6F2',
      background: '#F2F8FC',
      surface: '#E3EFF7',
      success: '#22936A',
      danger: '#D2404D',
      onPrimary: '#FAFDFF',
      card: '#FDFEFF',
      successSoft: '#DCF2E9',
      dangerSoft: '#FBE4E6',
    },
  },
  sakura: {
    name: 'Sakura',
    blurb: 'Rose cerisier, doux comme une dalle au printemps.',
    dark: false,
    rarity: 'rare',
    colors: {
      primary: '#D6457A',
      primarySoft: '#FCE4EE',
      text: '#3F1828',
      muted: '#94657A',
      border: '#F5D3E0',
      background: '#FFF6F9',
      surface: '#FBE9F0',
      success: '#2F9461',
      danger: '#C8323F',
      onPrimary: '#FFFBFD',
      card: '#FFFDFE',
      successSoft: '#E0F3E8',
      dangerSoft: '#FBE1E4',
    },
  },
  bleau: {
    name: 'Fontainebleau',
    blurb: 'Grès blond et vert forêt, comme un week-end à Bleau.',
    dark: false,
    rarity: 'rare',
    colors: {
      primary: '#3F7D3A',
      primarySoft: '#E6EFD9',
      text: '#2B2A1F',
      muted: '#7C7764',
      border: '#E5DDC6',
      background: '#F7F2E6',
      surface: '#EEE7D3',
      success: '#2D8A4E',
      danger: '#B8432E',
      onPrimary: '#FDFEF9',
      card: '#FFFCF4',
      successSoft: '#DFF0E2',
      dangerSoft: '#F6E1DA',
    },
  },
  coucher: {
    name: 'Coucher de soleil',
    blurb: 'Rose corail et pêche, la lumière du soir sur la falaise.',
    dark: false,
    rarity: 'rare',
    colors: {
      primary: '#EF5B6E',
      primarySoft: '#FFE5E6',
      text: '#3A1E33',
      muted: '#8E6478',
      border: '#F8D7DA',
      background: '#FFF4F1',
      surface: '#FCE6E2',
      success: '#2E9C6A',
      danger: '#C2304A',
      onPrimary: '#FFFAF8',
      card: '#FFFCFB',
      successSoft: '#DCF3E8',
      dangerSoft: '#FADDE3',
    },
  },
  jungle: {
    name: 'Jungle',
    blurb: 'Vert profond et jaune banane, sous la canopée.',
    dark: true,
    rarity: 'rare',
    colors: {
      primary: '#F2C230',
      primarySoft: '#3A3410',
      text: '#E9F5E3',
      muted: '#93AE8C',
      border: '#26402A',
      background: '#0D1A10',
      surface: '#1A2E1D',
      success: '#6BD66B',
      danger: '#FF6B57',
      onPrimary: '#1B1500',
      card: '#132317',
      successSoft: '#183A1C',
      dangerSoft: '#3D1A14',
    },
  },
  synthwave: {
    name: 'Synthwave',
    blurb: 'Violet nuit et rose néon, comme une borne d’arcade.',
    dark: true,
    rarity: 'epique',
    colors: {
      primary: '#FF3EA5',
      primarySoft: '#3B1239',
      text: '#F5E9FF',
      muted: '#A98BC4',
      border: '#3A2457',
      background: '#120A24',
      surface: '#211538',
      success: '#2EF2C7',
      danger: '#FF5470',
      onPrimary: '#FFF7FC',
      card: '#1A1030',
      successSoft: '#0F3A35',
      dangerSoft: '#3E0F1E',
    },
  },
  abysses: {
    name: 'Abysses',
    blurb: 'Bleu des grands fonds et cyan phosphorescent.',
    dark: true,
    rarity: 'epique',
    colors: {
      primary: '#22D3EE',
      primarySoft: '#0C3440',
      text: '#E3F6FB',
      muted: '#7FA5B3',
      border: '#16334A',
      background: '#04121F',
      surface: '#0B2234',
      success: '#3BE38F',
      danger: '#FF6B81',
      onPrimary: '#02222B',
      card: '#081A2A',
      successSoft: '#0B3A2A',
      dangerSoft: '#3C1220',
    },
  },
  prestige: {
    name: 'Prestige',
    blurb: 'Noir profond et or : la salle VIP.',
    dark: true,
    rarity: 'legendaire',
    colors: {
      primary: '#D4AF37',
      primarySoft: '#2E2614',
      text: '#F6F0E1',
      muted: '#A39A86',
      border: '#2E2A22',
      background: '#0B0A08',
      surface: '#1A1814',
      success: '#7DC97D',
      danger: '#E5684F',
      onPrimary: '#1A1405',
      card: '#13120F',
      successSoft: '#1C301C',
      dangerSoft: '#3A1A12',
    },
  },
  aurore: {
    name: 'Aurore boréale',
    blurb: 'Ciel polaire et lueurs vertes, au-dessus du Grand Nord.',
    dark: true,
    rarity: 'legendaire',
    colors: {
      primary: '#5CF2A6',
      primarySoft: '#103A2C',
      text: '#E7F1FF',
      muted: '#8FA3C0',
      border: '#1F2D4D',
      background: '#070C1F',
      surface: '#111B36',
      success: '#8BE8FF',
      danger: '#FF6F91',
      onPrimary: '#04210F',
      card: '#0C1430',
      successSoft: '#123345',
      dangerSoft: '#3A1426',
    },
  },
} satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;
/** Un thème avec tous ses champs (y compris la rareté, absente des thèmes de base). */
export const themeOf = (id: ThemeId): Theme => THEMES[id];

/* ---------- Polices ---------- */

export const FONTS = {
  inter: { name: 'Inter', blurb: 'Nette et professionnelle.', family: 'Inter', fun: false },
  manrope: { name: 'Manrope', blurb: 'Plus ronde et moderne.', family: 'Manrope', fun: false },
  systeme: { name: 'Celle du téléphone', blurb: 'La police d’Android.', family: 'sans-serif', fun: false },
  mono: { name: 'Machine à écrire', blurb: 'Pour noter tes croix comme en 1970.', family: 'SpaceMono', fun: true },
} satisfies Record<string, { name: string; blurb: string; family: string; fun: boolean }>;

export type FontId = keyof typeof FONTS;

const KEY = 'theme';
const FONT_KEY = 'font';

const read = <T extends string>(key: string, all: Record<string, unknown>, fallback: T): T => {
  try {
    const v = getSetting(key);
    return v && v in all ? (v as T) : fallback;
  } catch {
    return fallback;
  }
};

let current: ThemeId = read<ThemeId>(KEY, THEMES, 'classique');
let currentFontId: FontId = read<FontId>(FONT_KEY, FONTS, 'inter');

/** Couleurs du thème choisi. L'objet est modifié sur place quand on change de thème. */
export const colors: Palette = { ...THEMES[current].colors };
/** Police choisie. Ajoutée toute seule aux styles de texte créés avec `themedStyles`. */
export const font = { family: FONTS[currentFontId].family };

export const currentTheme = () => current;
export const currentFont = () => currentFontId;
export const isDark = () => THEMES[current].dark;

/** Arrondis et espacements communs à toute l'app. */
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Échelle typographique (à étaler dans les styles : `{ ...type.title }`). */
export const type = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, color: colors.text },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: colors.text },
  headline: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, color: colors.text },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21, color: colors.text },
  callout: { fontSize: 15, fontWeight: '600', color: colors.text },
  subhead: { fontSize: 14, fontWeight: '500', color: colors.muted },
  caption: { fontSize: 13, fontWeight: '500', color: colors.muted },
  overline: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
} as const;

/* Feuilles de style à recolorer quand on change de thème ou de police. */
const sheets: Record<string, object>[] = [];

const TEXT_KEYS = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'];

/**
 * Comme StyleSheet.create, mais les couleurs et la police suivent les changements de thème.
 * Chaque style de texte (qui a une taille ou une graisse) reçoit la police choisie.
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  const withFont = {} as Record<string, object>;
  for (const [name, style] of Object.entries(styles as unknown as Record<string, Record<string, unknown>>)) {
    const isText = TEXT_KEYS.some((k) => k in style);
    withFont[name] = isText && !('fontFamily' in style) ? { fontFamily: font.family, ...style } : style;
  }
  const sheet = StyleSheet.create(withFont as unknown as T);
  sheets.push(sheet as Record<string, object>);
  return sheet;
}

/** Remplace dans toutes les feuilles de style les valeurs de `swap` (insensible à la casse). */
function restyle(swap: Map<string, string>) {
  for (const sheet of sheets) {
    for (const name of Object.keys(sheet)) {
      const style = sheet[name] as Record<string, unknown>;
      let changed: Record<string, unknown> | null = null;
      for (const [prop, value] of Object.entries(style)) {
        if (typeof value !== 'string') continue;
        const next = swap.get(value.toLowerCase());
        if (next) (changed ??= { ...style })[prop] = next;
      }
      // Les styles sont figés en développement : on remplace l'objet au lieu de le modifier.
      if (changed) sheet[name] = changed;
    }
  }
}

/** Change de thème : met à jour les couleurs et toutes les feuilles de style, puis il faut redessiner l'app. */
export function applyTheme(id: ThemeId) {
  const to = THEMES[id].colors;
  const swap = new Map<string, string>();
  for (const k of Object.keys(to) as (keyof Palette)[]) swap.set(colors[k].toLowerCase(), to[k]);
  restyle(swap);
  Object.assign(colors, to);
  current = id;
  setSetting(KEY, id);
}

/** Change de police partout, puis il faut redessiner l'app. */
export function applyFont(id: FontId) {
  const family = FONTS[id].family;
  restyle(new Map([[font.family.toLowerCase(), family]]));
  font.family = family;
  currentFontId = id;
  setSetting(FONT_KEY, id);
}

/** Changement de thème ou de police depuis n'importe quel écran (fourni par la mise en page racine). */
/** Change le thème ou la police : redessine toute l'app, puis rouvre `back` (par défaut, l'écran en cours). */
export const ThemeSwitch = createContext<{ theme: (id: ThemeId, back?: string) => void; font: (id: FontId) => void }>({
  theme: () => {},
  font: () => {},
});
