import { createContext } from 'react';
import { StyleSheet } from 'react-native';

import { getSetting, setSetting } from './db';

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
};

export type Theme = {
  name: string;
  /** Une phrase pour le choisir. */
  blurb: string;
  /** Thème sombre : barre d'état claire. */
  dark: boolean;
  /** Classique ou loufoque. */
  fun: boolean;
  colors: Palette;
};

export const THEMES = {
  classique: {
    name: 'Classique',
    blurb: 'L’orange de MyClimb, sobre et lisible.',
    dark: false,
    fun: false,
    colors: {
      primary: '#E8590C',
      primarySoft: '#FFF0E6',
      text: '#1A1A1A',
      muted: '#6B6B6B',
      border: '#E2E2E2',
      background: '#FFFFFF',
      surface: '#F6F6F6',
      success: '#2B8A3E',
      danger: '#C92A2A',
      onPrimary: '#FEFEFE',
    },
  },
  nuit: {
    name: 'Nuit',
    blurb: 'Fond sombre pour les séances du soir.',
    dark: true,
    fun: false,
    colors: {
      primary: '#FF8A3D',
      primarySoft: '#3A2A20',
      text: '#F1F1F1',
      muted: '#A0A0A0',
      border: '#33363B',
      background: '#15171A',
      surface: '#22252A',
      success: '#51CF66',
      danger: '#FF6B6B',
      onPrimary: '#FEFEFE',
    },
  },
  ocean: {
    name: 'Océan',
    blurb: 'Bleu calme, comme un bloc au bord de l’eau.',
    dark: false,
    fun: false,
    colors: {
      primary: '#1C7ED6',
      primarySoft: '#E7F1FC',
      text: '#14213D',
      muted: '#5C6B82',
      border: '#DCE4EE',
      background: '#FFFFFF',
      surface: '#F2F6FB',
      success: '#2B8A3E',
      danger: '#C92A2A',
      onPrimary: '#FEFEFE',
    },
  },
  foret: {
    name: 'Forêt',
    blurb: 'Vert sapin, pour les jours de grimpe en extérieur.',
    dark: false,
    fun: false,
    colors: {
      primary: '#2F7D4F',
      primarySoft: '#E6F2EA',
      text: '#1C2B22',
      muted: '#5F6F64',
      border: '#DCE5DF',
      background: '#FCFDFB',
      surface: '#F1F5F0',
      success: '#2B8A3E',
      danger: '#C92A2A',
      onPrimary: '#FEFEFE',
    },
  },
  magnesie: {
    name: 'Magnésie',
    blurb: 'Noir et blanc, tout en craie.',
    dark: false,
    fun: false,
    colors: {
      primary: '#222222',
      primarySoft: '#EDEDED',
      text: '#111111',
      muted: '#777777',
      border: '#E0E0E0',
      background: '#FFFFFF',
      surface: '#F5F5F5',
      success: '#2B8A3E',
      danger: '#C92A2A',
      onPrimary: '#FEFEFE',
    },
  },
  banane: {
    name: 'Banane',
    blurb: 'Jaune vif, pour grimper avec la patate.',
    dark: false,
    fun: true,
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
    },
  },
  barbe: {
    name: 'Barbe à papa',
    blurb: 'Rose bonbon et bleu fête foraine.',
    dark: false,
    fun: true,
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
    },
  },
  terminal: {
    name: 'Terminal rétro',
    blurb: 'Vert phosphore sur écran noir, comme en 1985.',
    dark: true,
    fun: true,
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
    },
  },
  lave: {
    name: 'Coulée de lave',
    blurb: 'Rouge brûlant : tes avant-bras en fin de séance.',
    dark: true,
    fun: true,
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
    },
  },
  licorne: {
    name: 'Licorne',
    blurb: 'Violet pailleté, pour les croix magiques.',
    dark: false,
    fun: true,
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
    },
  },
  pastis: {
    name: 'Apéro au pied des voies',
    blurb: 'Jaune anis et bleu cigale, accent du Sud compris.',
    dark: false,
    fun: true,
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
    },
  },
} satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;

const KEY = 'theme';

const saved = (): ThemeId => {
  try {
    const v = getSetting(KEY);
    return v && v in THEMES ? (v as ThemeId) : 'classique';
  } catch {
    return 'classique';
  }
};

let current: ThemeId = saved();

/** Couleurs du thème choisi. L'objet est modifié sur place quand on change de thème. */
export const colors: Palette = { ...THEMES[current].colors };

export const currentTheme = () => current;
export const isDark = () => THEMES[current].dark;

/* Feuilles de style à recolorer quand on change de thème. */
const sheets: Record<string, object>[] = [];

/** Comme StyleSheet.create, mais les couleurs du thème suivent les changements de thème. */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  const sheet = StyleSheet.create(styles);
  sheets.push(sheet as Record<string, object>);
  return sheet;
}

/** Change de thème : met à jour les couleurs et toutes les feuilles de style, puis il faut redessiner l'app. */
export function applyTheme(id: ThemeId) {
  const from = colors;
  const to = THEMES[id].colors;
  const swap = new Map<string, string>();
  for (const k of Object.keys(to) as (keyof Palette)[]) swap.set(from[k].toLowerCase(), to[k]);
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
  Object.assign(colors, to);
  current = id;
  setSetting(KEY, id);
}

/** Changement de thème depuis n'importe quel écran (fourni par la mise en page racine). */
export const ThemeSwitch = createContext<(id: ThemeId) => void>(() => {});
