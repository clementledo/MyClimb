/**
 * Objets de la collection en cartes : l'aperçu de chaque sorte d'objet (costume, contour, fond,
 * titre, célébration, thème) dans une carte à la couleur de sa rareté, le dos des cartes et les
 * packs. Servent dans la collection et à l'ouverture des packs.
 * Les couleurs sont fixes (ce sont des « vraies » cartes) : elles ne suivent pas le thème de l'app.
 */
import type { AndroidSymbol } from 'expo-symbols';
import { Image } from 'expo-image';
import { memo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BackdropLayer, FrameLayer, hsl, SHAPE } from '@/components/cardCosmetics';
import { CARD_RATIO, LOOK, useSvgIds } from '@/components/PlayerCard';
import { Icon } from '@/components/ui';
import { PACKS, PRICE, type Item, type PackKind } from '@/lib/collection';
import { TITLES, type BackdropId, type CelebrationId, type FrameId, type TitleId } from '@/lib/cosmetics';
import type { Tier } from '@/lib/playerCard';
import { rarityOf, type Rarity } from '@/lib/rarity';
import { SKIN_IMAGES } from '@/lib/skinImages';
import type { SkinId } from '@/lib/skins';
import { THEMES, themedStyles, type ThemeId } from '@/lib/theme';

/** Hauteur d'une carte de collection pour sa largeur. */
export const ITEM_RATIO = 1.38;

/** Couleurs des cartes selon la rareté : bord en dégradé, fond intérieur, textes. */
export const CARD_STYLE: Record<Rarity, { edge: [string, string]; inner: [string, string]; ink: string; label: string }> = {
  commun: { edge: ['#B4BEC8', '#6C7A89'], inner: ['#FAFBFC', '#E6EAEE'], ink: '#1D232B', label: '#5C6B7A' },
  rare: { edge: ['#74C0FC', '#1C64D6'], inner: ['#F1F7FF', '#CFE2FF'], ink: '#10223F', label: '#1C64D6' },
  epique: { edge: ['#D0A2FF', '#7B2FC4'], inner: ['#F8F0FF', '#E2CCFF'], ink: '#2B1145', label: '#7B2FC4' },
  legendaire: { edge: ['#FFE066', '#E8590C'], inner: ['#FFFBEA', '#FFE59A'], ink: '#3A2600', label: '#C25E00' },
  mythique: { edge: ['#FF5D8F', '#845EF7'], inner: ['#22124A', '#0D0723'], ink: '#FFFFFF', label: '#FF9BC4' },
};

const abs = { position: 'absolute', left: 0, top: 0 } as const;

/** Hasard reproductible : la même carte se dessine toujours pareil. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/* ---------- Aperçus ---------- */

/** Petite carte joueur sans texte (le nom et les stats en traits), pour montrer un contour ou un fond. */
export const MiniCard = memo(function MiniCard(p: {
  h: number;
  frame?: FrameId;
  backdrop?: BackdropId;
  tier: Tier;
  skin: SkinId;
  t: number;
}) {
  const W = p.h / CARD_RATIO;
  const c = LOOK[p.tier];
  const ids = useSvgIds();
  const portrait = SKIN_IMAGES[p.skin]?.card;
  return (
    <View style={{ width: W, height: p.h }}>
      <Svg width={W} height={p.h} viewBox="0 0 100 142" style={abs}>
        <Defs>
          <LinearGradient id={ids('bg')} x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={c.top} />
            <Stop offset="1" stopColor={c.bottom} />
          </LinearGradient>
        </Defs>
        <Path d={SHAPE} fill={`url(#${ids('bg')})`} />
        {p.backdrop && <BackdropLayer backdrop={p.backdrop} ctx={{ c, id: ids, t: p.t }} />}
        <Rect x={22} y={80} width={56} height={7} rx={3.5} fill={c.text} opacity={0.55} />
        {[0, 1, 2].map((i) => (
          <G key={i} opacity={0.35}>
            <Rect x={17} y={95 + i * 9} width={26} height={4.5} rx={2} fill={c.text} />
            <Rect x={56} y={95 + i * 9} width={26} height={4.5} rx={2} fill={c.text} />
          </G>
        ))}
        <Rect x={10} y={8} width={14} height={12} rx={3} fill={c.text} opacity={0.5} />
        {!p.frame && <Path d={SHAPE} fill="none" stroke={c.line} strokeWidth={1} opacity={0.55} transform="translate(3 4.26) scale(0.94)" />}
      </Svg>
      {portrait && <Image source={portrait} style={{ position: 'absolute', right: W * 0.02, top: W * 0.035, width: W * 0.72, height: W * 0.72 }} contentFit="contain" />}
      {p.frame && (
        <Svg width={W} height={p.h} viewBox="0 0 100 142" style={abs} pointerEvents="none">
          <FrameLayer frame={p.frame} ctx={{ c, id: ids, t: p.t }} />
        </Svg>
      )}
    </View>
  );
});

/** Couleurs d'un titre : dégradé de sa rareté, arc-en-ciel qui défile pour un mythique. */
function titleStops(rarity: Rarity, t: number) {
  if (rarity === 'mythique') return [0, 0.25, 0.5, 0.75, 1].map((k) => ({ k, color: hsl(k * 0.7 + t * 0.2, 0.85, 0.55) }));
  const r = rarityOf(rarity);
  return [
    { k: 0, color: r.color },
    { k: 1, color: r.dark },
  ];
}

/** Titre sur une plaque (dans les cartes de la collection, où il a la place de passer à la ligne). */
export const TitlePlate = memo(function TitlePlate({ title, w, t }: { title: TitleId; w: number; t: number }) {
  const item = TITLES.find((x) => x.id === title)!;
  const ids = useSvgIds();
  return (
    <View style={[s.plate, { width: w, minHeight: w * 0.62, borderRadius: w * 0.1, padding: w * 0.07 }]}>
      <Svg style={abs} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={ids('plate')} x1="0" y1="0" x2="1" y2="1">
            {titleStops(item.rarity, t).map((x) => (
              <Stop key={x.k} offset={x.k} stopColor={x.color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${ids('plate')})`} />
        <Rect x="0" y="0" width="100%" height="42%" fill="#FFFFFF" opacity={0.16} />
      </Svg>
      <Icon name="military_tech" size={Math.round(w * 0.2)} color="#FFFFFF" />
      <Text style={[s.plateText, { fontSize: Math.max(9, w * 0.105) }]} numberOfLines={3}>
        {item.name}
      </Text>
    </View>
  );
});

/** Aperçu d'un thème de l'app : fond, une carte avec du texte, un bouton. */
export function ThemePreview({ id, w, h }: { id: ThemeId; w: number; h: number }) {
  const c = THEMES[id].colors;
  return (
    <View style={[s.theme, { width: w, height: h, backgroundColor: c.background, borderColor: c.border, padding: w * 0.09, gap: h * 0.08 }]}>
      <View style={[s.themeCard, { backgroundColor: c.card, borderColor: c.border, padding: w * 0.08, gap: h * 0.05 }]}>
        <View style={[s.themeLine, { backgroundColor: c.text, width: '75%', height: h * 0.06 }]} />
        <View style={[s.themeLine, { backgroundColor: c.muted, width: '50%', height: h * 0.05 }]} />
        <View style={s.themeDots}>
          <View style={[s.themeDot, { backgroundColor: c.success, width: h * 0.09, height: h * 0.09 }]} />
          <View style={[s.themeDot, { backgroundColor: c.danger, width: h * 0.09, height: h * 0.09 }]} />
        </View>
      </View>
      <View style={[s.themeButton, { backgroundColor: c.primary, height: h * 0.16 }]}>
        <View style={[s.themeLine, { backgroundColor: c.onPrimary, width: '40%', height: h * 0.045, opacity: 0.9 }]} />
      </View>
    </View>
  );
}

/* ---------- Célébrations (aperçu animé en 2D) ---------- */

type Shape = 'spark' | 'dot' | 'puff' | 'ring' | 'note' | 'rect' | 'balloon' | 'heart' | 'flake' | 'star' | 'bolt' | 'coin';
type Motion = 'burst' | 'rise' | 'fall' | 'orbit' | 'flash' | 'fireworks' | 'twinkle';
type Fx = {
  icon?: AndroidSymbol;
  bg: [string, string];
  ink: string;
  colors: string[];
  shape: Shape;
  motion: Motion;
  n: number;
  /** Durée d'une boucle, en secondes. */
  period: number;
  special?: 'rainbow' | 'beam' | 'nova';
};

const RAINBOW = ['#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#4DABF7', '#9775FA'];

const FX: Record<CelebrationId, Fx> = {
  poing: { icon: 'sports_mma', bg: ['#FFF4E6', '#FFC078'], ink: '#D9480F', colors: ['#FF922B', '#FFD43B', '#E8590C'], shape: 'spark', motion: 'burst', n: 14, period: 1.3 },
  coucou: { icon: 'waving_hand', bg: ['#E7F5FF', '#A5D8FF'], ink: '#1971C2', colors: ['#74C0FC', '#FFFFFF', '#4DABF7'], shape: 'dot', motion: 'rise', n: 12, period: 3 },
  magnesie: { icon: 'cloud', bg: ['#F1F3F5', '#CED4DA'], ink: '#868E96', colors: ['#FFFFFF'], shape: 'puff', motion: 'burst', n: 11, period: 2.2 },
  bulles: { icon: 'bubble_chart', bg: ['#E3FAFC', '#99E9F2'], ink: '#0C8599', colors: ['#3BC9DB', '#B197FC', '#74C0FC'], shape: 'ring', motion: 'rise', n: 13, period: 4 },
  notes: { icon: 'music_note', bg: ['#F3F0FF', '#D0BFFF'], ink: '#6741D9', colors: ['#845EF7', '#F06595', '#339AF0'], shape: 'note', motion: 'rise', n: 10, period: 3.4 },
  confettis: { icon: 'celebration', bg: ['#FFF9DB', '#FFE066'], ink: '#E67700', colors: ['#FF6B6B', '#FCC419', '#51CF66', '#339AF0', '#CC5DE8', '#FF922B'], shape: 'rect', motion: 'fall', n: 26, period: 2.6 },
  ballons: { bg: ['#E7F5FF', '#C5F6FA'], ink: '#1C7ED6', colors: ['#FF6B6B', '#FCC419', '#51CF66', '#339AF0', '#CC5DE8'], shape: 'balloon', motion: 'rise', n: 7, period: 4.5 },
  coeurs: { icon: 'favorite', bg: ['#FFF0F6', '#FCC2D7'], ink: '#D6336C', colors: ['#F06595', '#FF8787', '#E64980'], shape: 'heart', motion: 'rise', n: 12, period: 3.4 },
  flocons: { icon: 'ac_unit', bg: ['#1C3B6E', '#4C6EF5'], ink: '#FFFFFF', colors: ['#FFFFFF', '#D0EBFF'], shape: 'flake', motion: 'fall', n: 18, period: 5 },
  artifice: { bg: ['#0B1026', '#2C2470'], ink: '#FFFFFF', colors: ['#FF6B6B', '#FCC419', '#51CF66', '#4DABF7', '#F783AC'], shape: 'spark', motion: 'fireworks', n: 16, period: 2.2 },
  etoiles: { icon: 'auto_awesome', bg: ['#2B1B5A', '#5F3DC4'], ink: '#FFD43B', colors: ['#FFD43B', '#FFF3BF', '#FAB005'], shape: 'star', motion: 'orbit', n: 14, period: 6 },
  eclairs: { icon: 'bolt', bg: ['#141526', '#364FC7'], ink: '#FFE066', colors: ['#FFE066', '#E7F5FF'], shape: 'bolt', motion: 'flash', n: 5, period: 1.6 },
  or: { icon: 'paid', bg: ['#3D2C00', '#946C00'], ink: '#FFD43B', colors: ['#FFD43B', '#FAB005', '#FFE066'], shape: 'coin', motion: 'fall', n: 16, period: 2.4 },
  arcenciel: { bg: ['#D0EBFF', '#FFF9DB'], ink: '#FFFFFF', colors: ['#FFFFFF', '#FFF3BF'], shape: 'star', motion: 'twinkle', n: 12, period: 2, special: 'rainbow' },
  ascension: { bg: ['#0B0F2A', '#3B2F8F'], ink: '#FFFFFF', colors: ['#FFF3BF', '#FFD43B', '#FFFFFF'], shape: 'spark', motion: 'rise', n: 22, period: 2.2, special: 'beam' },
  supernova: { bg: ['#05010F', '#3A0C66'], ink: '#FFFFFF', colors: ['#FFFFFF', '#E5DBFF', '#74C0FC', '#F783AC'], shape: 'star', motion: 'burst', n: 26, period: 2.4, special: 'nova' },
};

/** Une particule de forme `shape`, centrée en (x, y), de taille r. */
function particle(shape: Shape, x: number, y: number, r: number, color: string, rot: number, key: number, opacity = 1): ReactNode {
  const tr = `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${r.toFixed(2)})`;
  switch (shape) {
    case 'dot':
      return <Circle key={key} cx={x} cy={y} r={r * 0.5} fill={color} opacity={opacity} />;
    case 'puff':
      return <Circle key={key} cx={x} cy={y} r={r} fill={color} opacity={opacity * 0.85} />;
    case 'ring':
      return (
        <G key={key} opacity={opacity}>
          <Circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={Math.max(0.8, r * 0.14)} />
          <Circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.22} fill="#FFFFFF" opacity={0.8} />
        </G>
      );
    case 'spark':
      return <Path key={key} d="M0 -1L0.22 -0.22L1 0L0.22 0.22L0 1L-0.22 0.22L-1 0L-0.22 -0.22Z" transform={tr} fill={color} opacity={opacity} />;
    case 'star':
      return <Path key={key} d="M0 -1L0.29 -0.4L0.95 -0.31L0.48 0.15L0.59 0.81L0 0.5L-0.59 0.81L-0.48 0.15L-0.95 -0.31L-0.29 -0.4Z" transform={tr} fill={color} opacity={opacity} />;
    case 'rect':
      return <Rect key={key} x={-0.5} y={-0.25} width={1} height={0.5} transform={tr} fill={color} opacity={opacity} />;
    case 'heart':
      return (
        <Path key={key} d="M0 0.95C-0.35 0.65 -1 0.25 -1 -0.25C-1 -0.75 -0.35 -0.95 0 -0.45C0.35 -0.95 1 -0.75 1 -0.25C1 0.25 0.35 0.65 0 0.95Z" transform={tr} fill={color} opacity={opacity} />
      );
    case 'note':
      return (
        <G key={key} transform={tr} opacity={opacity}>
          <Ellipse cx={-0.25} cy={0.7} rx={0.38} ry={0.28} fill={color} />
          <Rect x={0.06} y={-0.9} width={0.16} height={1.6} fill={color} />
          <Path d="M0.22 -0.9C0.6 -0.7 0.8 -0.45 0.65 -0.1C0.6 -0.35 0.45 -0.5 0.22 -0.55Z" fill={color} />
        </G>
      );
    case 'flake':
      return (
        <G key={key} transform={tr} opacity={opacity}>
          {[0, 60, 120].map((a) => (
            <Line key={a} x1={0} y1={-1} x2={0} y2={1} stroke={color} strokeWidth={0.16} strokeLinecap="round" transform={`rotate(${a})`} />
          ))}
        </G>
      );
    case 'bolt':
      return <Path key={key} d="M0.15 -1L-0.55 0.12L-0.05 0.12L-0.2 1L0.6 -0.25L0.08 -0.25Z" transform={tr} fill={color} opacity={opacity} />;
    case 'coin':
      return (
        <G key={key} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(r * Math.max(0.15, Math.abs(Math.cos((rot * Math.PI) / 180)))).toFixed(2)} ${r.toFixed(2)})`} opacity={opacity}>
          <Circle r={1} fill="#E8A400" />
          <Circle r={0.78} fill={color} />
          <Rect x={-0.12} y={-0.45} width={0.24} height={0.9} rx={0.1} fill="#E8A400" />
        </G>
      );
    case 'balloon':
      return (
        <G key={key} opacity={opacity}>
          <Path d={`M${x} ${y + r * 1.15}Q${x - r * 0.4} ${y + r * 1.8} ${x + r * 0.1} ${y + r * 2.6}`} stroke="#868E96" strokeWidth={0.8} fill="none" />
          <Ellipse cx={x} cy={y} rx={r * 0.85} ry={r * 1.05} fill={color} />
          <Path d={`M${x - r * 0.15} ${y + r * 1.02}L${x + r * 0.15} ${y + r * 1.02}L${x} ${y + r * 1.22}Z`} fill={color} />
          <Ellipse cx={x - r * 0.3} cy={y - r * 0.4} rx={r * 0.18} ry={r * 0.3} fill="#FFFFFF" opacity={0.55} />
        </G>
      );
  }
}

/** Aperçu animé d'une célébration au top : ses particules et son symbole. */
export const CelebrationArt = memo(function CelebrationArt({ id, w, h, t }: { id: CelebrationId; w: number; h: number; t: number }) {
  const fx = FX[id];
  const ids = useSvgIds();
  const rand = seeded(id.length * 7919 + id.charCodeAt(0) * 31 + 7);
  const cx = w / 2;
  const cy = h * 0.46;
  const R = Math.min(w, h);
  const parts: ReactNode[] = [];
  for (let i = 0; i < fx.n; i++) {
    const [r1, r2, r3, r4] = [rand(), rand(), rand(), rand()];
    const color = fx.colors[i % fx.colors.length];
    const size = R * (0.035 + r3 * 0.035) * (fx.shape === 'balloon' ? 2.4 : fx.shape === 'puff' ? 3 : 1);
    const k = (t / fx.period + r2) % 1;
    switch (fx.motion) {
      case 'fall':
        parts.push(particle(fx.shape, r1 * w, -R * 0.1 + k * h * 1.2, size, color, t * 160 * (r4 - 0.5) + r4 * 360, i, Math.min(1, (1 - k) * 4)));
        break;
      case 'rise': {
        const sway = Math.sin(t * 2 + r4 * 6) * R * 0.04;
        const x = fx.special === 'beam' ? cx + (r1 - 0.5) * w * 0.28 : r1 * w;
        parts.push(particle(fx.shape, x + sway, h * 1.08 - k * h * 1.2, size, color, (r4 - 0.5) * 40, i, Math.min(1, k * 5, (1 - k) * 3)));
        break;
      }
      case 'burst': {
        const a = r1 * Math.PI * 2;
        const d = (1 - (1 - k) ** 2) * R * (0.25 + r4 * 0.3);
        parts.push(particle(fx.shape, cx + Math.cos(a) * d, cy + Math.sin(a) * d, size * (fx.shape === 'puff' ? 0.4 + k : 1), color, a * 57 + t * 90, i, 1 - k));
        break;
      }
      case 'orbit': {
        const a = r1 * Math.PI * 2 + t * (0.8 + r2 * 0.8);
        const d = R * (0.22 + r3 * 0.22);
        parts.push(particle(fx.shape, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75, size * (0.8 + 0.4 * Math.sin(t * 3 + i)), color, t * 60, i, 0.6 + 0.4 * Math.sin(t * 4 + i)));
        break;
      }
      case 'twinkle':
        parts.push(particle(fx.shape, r1 * w, r4 * h * 0.9, size * 0.8, color, 0, i, 0.25 + 0.75 * Math.max(0, Math.sin(t * 3 + i * 1.7))));
        break;
      case 'flash': {
        const on = (t / fx.period + r2) % 1;
        const x = w * (0.15 + r1 * 0.7);
        if (on < 0.18) parts.push(particle('bolt', x, h * (0.25 + r4 * 0.3), R * 0.16, color, (r3 - 0.5) * 30, i, 1 - on / 0.18));
        break;
      }
      case 'fireworks':
        break;
    }
  }
  // Feu d'artifice : trois gerbes qui éclatent l'une après l'autre.
  if (fx.motion === 'fireworks') {
    [0, 0.33, 0.66].forEach((off, b) => {
      const k = (t / fx.period + off) % 1;
      const bx = w * [0.3, 0.68, 0.5][b];
      const by = h * [0.32, 0.26, 0.48][b];
      const color = fx.colors[(b * 2 + Math.floor(t / fx.period)) % fx.colors.length];
      if (k < 0.25) {
        // La fusée monte.
        const y = h * 1.05 - (h * 1.05 - by) * (k / 0.25);
        parts.push(<Circle key={`r${b}`} cx={bx} cy={y} r={R * 0.018} fill="#FFF3BF" />);
        return;
      }
      const e = (k - 0.25) / 0.75;
      for (let i = 0; i < fx.n; i++) {
        const a = (i / fx.n) * Math.PI * 2;
        const d = (1 - (1 - e) ** 3) * R * 0.26;
        parts.push(particle('spark', bx + Math.cos(a) * d, by + Math.sin(a) * d + e * e * R * 0.08, R * 0.03, color, a * 57, b * 100 + i, 1 - e));
      }
    });
  }
  const beam = 0.75 + 0.25 * Math.sin(t * 4);
  const nova = (t / fx.period) % 1;
  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} style={abs}>
        <Defs>
          <LinearGradient id={ids('bg')} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fx.bg[0]} />
            <Stop offset="1" stopColor={fx.bg[1]} />
          </LinearGradient>
          <LinearGradient id={ids('beam')} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFF3BF" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#FFF9DB" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#FFF3BF" stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id={ids('core')} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="0.4" stopColor="#E5DBFF" stopOpacity={0.8} />
            <Stop offset="1" stopColor="#845EF7" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} rx={R * 0.08} fill={`url(#${ids('bg')})`} />
        {fx.special === 'rainbow' &&
          RAINBOW.map((c, i) => (
            <Path
              key={c}
              d={`M${w * 0.08 + i * R * 0.035} ${h * 0.82}A${w * 0.42 - i * R * 0.035} ${h * 0.5 - i * R * 0.035} 0 0 1 ${w * 0.92 - i * R * 0.035} ${h * 0.82}`}
              stroke={c}
              strokeWidth={R * 0.04}
              fill="none"
              opacity={0.55 + 0.45 * Math.min(1, ((t * 0.8) % 2) * 1.5 - i * 0.12)}
            />
          ))}
        {fx.special === 'beam' && (
          <Rect x={cx - w * 0.17 * beam} y={0} width={w * 0.34 * beam} height={h} fill={`url(#${ids('beam')})`} opacity={0.85} />
        )}
        {fx.special === 'nova' && (
          <G>
            {[0, 0.33, 0.66].map((off) => {
              const k = (nova + off) % 1;
              return <Circle key={off} cx={cx} cy={cy} r={R * (0.06 + k * 0.5)} stroke="#B197FC" strokeWidth={R * 0.025 * (1 - k)} fill="none" opacity={1 - k} />;
            })}
            <Circle cx={cx} cy={cy} r={R * (0.16 + 0.05 * Math.sin(t * 6))} fill={`url(#${ids('core')})`} />
          </G>
        )}
        {parts}
      </Svg>
      {fx.icon && (
        <View style={[abs, s.fxIcon, { width: w, height: h }]} pointerEvents="none">
          <Icon name={fx.icon} size={Math.round(R * 0.34)} color={fx.ink} />
        </View>
      )}
    </View>
  );
});

/** Aperçu d'un objet, quelle que soit sa sorte, dans un cadre w × h. */
export function ItemPreview({ item, w, h, tier = 'argent', skin = 'classique', t = 0 }: { item: Item; w: number; h: number; tier?: Tier; skin?: SkinId; t?: number }) {
  switch (item.kind) {
    case 'costume': {
      const img = SKIN_IMAGES[item.ref as SkinId]?.full;
      return img ? <Image source={img} style={{ width: w, height: h }} contentFit="contain" /> : <Icon name="checkroom" size={w * 0.5} />;
    }
    case 'contour':
      return <MiniCard h={h} frame={item.ref as FrameId} tier={tier} skin={skin} t={t} />;
    case 'fond':
      return <MiniCard h={h} backdrop={item.ref as BackdropId} tier={tier} skin={skin} t={t} />;
    case 'titre':
      return <TitlePlate title={item.ref as TitleId} w={w} t={t} />;
    case 'celebration':
      return <CelebrationArt id={item.ref as CelebrationId} w={w} h={h} t={t} />;
    case 'theme':
      return <ThemePreview id={item.ref as ThemeId} w={w * 0.9} h={h * 0.8} />;
  }
}

/* ---------- Cartes ---------- */

/** Fond d'une carte de collection : bord en dégradé et intérieur, à la couleur de la rareté. */
function CardFace({ rarity, w, h, t }: { rarity: Rarity; w: number; h: number; t: number }) {
  const st = CARD_STYLE[rarity];
  const ids = useSvgIds();
  const r = w * 0.09;
  const b = Math.max(2.5, w * 0.03);
  const edge = rarity === 'mythique' ? [0, 0.25, 0.5, 0.75, 1].map((k) => hsl(k * 0.8 + t * 0.25, 0.9, 0.6)) : st.edge;
  const rand = seeded(rarity.length * 131);
  return (
    <Svg width={w} height={h} style={abs}>
      <Defs>
        <LinearGradient id={ids('edge')} x1="0" y1="0" x2="1" y2="1">
          {edge.map((c, i) => (
            <Stop key={i} offset={i / (edge.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
        <LinearGradient id={ids('inner')} x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={st.inner[0]} />
          <Stop offset="1" stopColor={st.inner[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} rx={r} fill={`url(#${ids('edge')})`} />
      <Rect x={b} y={b} width={w - 2 * b} height={h - 2 * b} rx={r - b * 0.6} fill={`url(#${ids('inner')})`} />
      {/* Reflet en biais sur les cartes rares et mieux ; étoiles sur les mythiques. */}
      {rarity !== 'commun' && <Path d={`M${w * 0.55} ${b}L${w * 0.75} ${b}L${w * 0.3} ${h - b}L${w * 0.1} ${h - b}Z`} fill="#FFFFFF" opacity={rarity === 'mythique' ? 0.05 : 0.22} />}
      {rarity === 'mythique' &&
        Array.from({ length: 14 }, (_, i) => (
          <Circle key={i} cx={b + rand() * (w - 2 * b)} cy={b + rand() * (h - 2 * b)} r={0.6 + rand() * 1.1} fill="#FFFFFF" opacity={0.3 + 0.5 * Math.abs(Math.sin(t * 2 + i))} />
        ))}
    </Svg>
  );
}

/** Carte d'un objet : aperçu, nom et rareté ; grisée avec un cadenas tant qu'on ne l'a pas. */
export const ItemCard = memo(function ItemCard({
  item,
  width: w,
  owned = true,
  fresh,
  equipped,
  tier,
  skin,
  t = 0,
  onPress,
}: {
  item: Item;
  width: number;
  owned?: boolean;
  fresh?: boolean;
  equipped?: boolean;
  tier?: Tier;
  skin?: SkinId;
  t?: number;
  onPress?: () => void;
}) {
  const h = Math.round(w * ITEM_RATIO);
  const st = CARD_STYLE[item.rarity];
  const r = rarityOf(item.rarity);
  const pw = w * 0.8;
  const ph = h * 0.6;
  const big = w >= 150;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${item.name}, ${r.name}${owned ? '' : ', pas encore obtenu'}`}
      style={({ pressed }) => [{ width: w, height: h }, pressed && { transform: [{ scale: 0.97 }] }]}>
      <CardFace rarity={item.rarity} w={w} h={h} t={t} />
      <View style={[s.preview, { top: h * 0.07, height: ph }, !owned && s.locked]}>
        <ItemPreview item={item} w={pw} h={ph} tier={tier} skin={skin} t={t} />
      </View>
      {!owned && (
        <View style={[s.lockWrap, { top: h * 0.07, height: ph }]} pointerEvents="none">
          <View style={[s.lock, { width: w * 0.3, height: w * 0.3, borderRadius: w * 0.15 }]}>
            <Icon name="lock" size={Math.round(w * 0.17)} color="#FFFFFF" />
          </View>
        </View>
      )}
      <View style={[s.footer, { top: h * 0.7, paddingHorizontal: w * 0.07 }]}>
        <Text style={[s.name, { color: st.ink, fontSize: big ? 15 : Math.max(10.5, w * 0.098) }]} numberOfLines={2}>
          {item.name}
        </Text>
        {owned ? (
          <Text style={[s.rarity, { color: st.label, fontSize: big ? 11 : Math.max(8, w * 0.072) }]}>{r.name}</Text>
        ) : (
          <View style={s.price}>
            <Icon name="water_drop" size={Math.round(Math.max(10, w * 0.09))} color={st.label} />
            <Text style={[s.rarity, { color: st.label, fontSize: big ? 11 : Math.max(8, w * 0.072) }]}>{PRICE[item.rarity]}</Text>
          </View>
        )}
      </View>
      {fresh && (
        <View style={[s.fresh, { top: -4, left: -4 }]}>
          <Text style={s.freshText}>NOUVEAU</Text>
        </View>
      )}
      {equipped && (
        <View style={[s.equipped, { top: -6, right: -6 }]}>
          <Icon name="check" size={14} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
});

/** Dos d'une carte encore cachée : motif MyClimb ; un halo trahit les cartes Épiques et mieux. */
export function CardBack({ w, rarity, t }: { w: number; rarity: Rarity; t: number }) {
  const h = Math.round(w * ITEM_RATIO);
  const ids = useSvgIds();
  const r = w * 0.09;
  const glow = rarity === 'epique' || rarity === 'legendaire' || rarity === 'mythique';
  const color = rarityOf(rarity).color;
  const pulse = 0.55 + 0.45 * Math.sin(t * 4);
  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} style={abs}>
        <Defs>
          <LinearGradient id={ids('back')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF8A3D" />
            <Stop offset="1" stopColor="#C2410C" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} rx={r} fill={`url(#${ids('back')})`} />
        {Array.from({ length: 7 }, (_, i) => (
          <Path key={i} d={`M${-w + i * w * 0.4} ${h}L${i * w * 0.4} 0`} stroke="#FFFFFF" strokeWidth={w * 0.05} opacity={0.07} />
        ))}
        <Rect x={w * 0.06} y={w * 0.06} width={w * 0.88} height={h - w * 0.12} rx={r * 0.7} fill="none" stroke="#FFE8D6" strokeWidth={1.2} opacity={0.7} />
        <Circle cx={w / 2} cy={h / 2} r={w * 0.24} fill="#FFFFFF" opacity={0.95} />
        {/* La montagne de MyClimb. */}
        <Path
          d={`M${w * 0.34} ${h / 2 + w * 0.09}L${w * 0.45} ${h / 2 - w * 0.08}L${w * 0.51} ${h / 2}L${w * 0.56} ${h / 2 - w * 0.04}L${w * 0.67} ${h / 2 + w * 0.09}Z`}
          fill="#EE5A24"
        />
        {glow && <Rect x={1.5} y={1.5} width={w - 3} height={h - 3} rx={r} fill="none" stroke={color} strokeWidth={3} opacity={pulse} />}
      </Svg>
    </View>
  );
}

/* ---------- Packs ---------- */

/** Pack de cartes en papier brillant : bords dentelés, dégradé de son type, reflet qui passe. */
export const PackArt = memo(function PackArt({ kind, w, t = 0, count }: { kind: PackKind; w: number; t?: number; count?: number }) {
  const p = PACKS[kind];
  const h = w * 1.42;
  const ids = useSvgIds();
  const teeth = 12;
  const tooth = w / teeth;
  const a = tooth * 0.45;
  let body = `M0 ${a}`;
  for (let i = 0; i < teeth; i++) body += `L${(i + 0.5) * tooth} 0L${(i + 1) * tooth} ${a}`;
  body += `L${w} ${h - a}`;
  for (let i = teeth - 1; i >= 0; i--) body += `L${(i + 0.5) * tooth} ${h}L${i * tooth} ${h - a}`;
  body += 'Z';
  // Reflet : une bande de lumière en biais qui traverse le pack.
  const sweep = ((t * 0.45) % 1.6) - 0.3;
  const x0 = sweep * w * 1.6 - w * 0.3;
  const short = { bienvenue: 'BIENVENUE', seance: 'SÉANCE', entrainement: 'ENTRAÎNEMENT', exploit: 'EXPLOIT' }[kind];
  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} style={abs}>
        <Defs>
          <LinearGradient id={ids('pk')} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={p.colors[0]} />
            <Stop offset="1" stopColor={p.colors[1]} />
          </LinearGradient>
          <LinearGradient id={ids('sweep')} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={body} fill={`url(#${ids('pk')})`} />
        {/* Papier métallisé : fines rayures, bandes soudées en haut et en bas. */}
        {Array.from({ length: 9 }, (_, i) => (
          <Path key={i} d={`M${-w * 0.4 + i * w * 0.22} ${h}L${i * w * 0.22 + w * 0.2} 0`} stroke="#FFFFFF" strokeWidth={w * 0.025} opacity={0.08} />
        ))}
        <Rect x={0} y={a} width={w} height={h * 0.07} fill="#000000" opacity={0.12} />
        <Rect x={0} y={h - a - h * 0.07} width={w} height={h * 0.07} fill="#000000" opacity={0.12} />
        <Circle cx={w / 2} cy={h * 0.45} r={w * 0.25} fill={p.accent} opacity={0.95} />
        <Circle cx={w / 2} cy={h * 0.45} r={w * 0.25} fill="none" stroke="#FFFFFF" strokeWidth={w * 0.015} opacity={0.9} />
        <Path
          d={`M${w * 0.33} ${h * 0.45 + w * 0.1}L${w * 0.45} ${h * 0.45 - w * 0.1}L${w * 0.52} ${h * 0.45}L${w * 0.57} ${h * 0.45 - w * 0.05}L${w * 0.68} ${h * 0.45 + w * 0.1}Z`}
          fill={p.colors[1]}
        />
        <Path
          d={`M${w * 0.41} ${h * 0.45 - w * 0.035}L${w * 0.45} ${h * 0.45 - w * 0.1}L${w * 0.49} ${h * 0.45 - w * 0.035}L${w * 0.47} ${h * 0.45 - w * 0.02}L${w * 0.45} ${h * 0.45 - w * 0.045}L${w * 0.43} ${h * 0.45 - w * 0.02}Z`}
          fill="#FFFFFF"
        />
        <Path d={`M${x0} 0L${x0 + w * 0.35} 0L${x0 - w * 0.25} ${h}L${x0 - w * 0.6} ${h}Z`} fill={`url(#${ids('sweep')})`} />
      </Svg>
      {w >= 60 && (
      <View style={[abs, s.packText, { width: w, height: h }]} pointerEvents="none">
        <Text style={[s.packBrand, { fontSize: Math.max(7, w * 0.075), marginTop: h * 0.11 }]}>MYCLIMB</Text>
        <View style={{ flex: 1 }} />
        <Text style={[s.packKind, { fontSize: Math.max(7, w * (short.length > 9 ? 0.085 : 0.11)), marginBottom: h * 0.16 }]} numberOfLines={1}>
          {short}
        </Text>
      </View>
      )}
      {count !== undefined && count > 1 && (
        <View style={[s.count, { top: -6, right: -6 }]}>
          <Text style={s.countText}>×{count}</Text>
        </View>
      )}
    </View>
  );
});

const s = themedStyles({
  plate: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 2 },
  plateText: { color: '#FFFFFF', fontWeight: '800', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },
  theme: { borderRadius: 10, borderWidth: 1, justifyContent: 'space-between' },
  themeCard: { borderRadius: 7, borderWidth: 1 },
  themeLine: { borderRadius: 3 },
  themeDots: { flexDirection: 'row', gap: 4 },
  themeDot: { borderRadius: 99 },
  themeButton: { borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  fxIcon: { alignItems: 'center', justifyContent: 'center' },
  preview: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  locked: { opacity: 0.3 },
  lockWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  lock: { backgroundColor: 'rgba(20,24,31,0.72)', alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 6, alignItems: 'center', justifyContent: 'center', gap: 1 },
  name: { fontWeight: '800', textAlign: 'center', letterSpacing: -0.1 },
  rarity: { fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  price: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fresh: { position: 'absolute', backgroundColor: '#2B8A3E', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, transform: [{ rotate: '-8deg' }] },
  freshText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  equipped: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2B8A3E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packText: { alignItems: 'center' },
  packBrand: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 2, opacity: 0.9 },
  packKind: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 1.2, textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  count: { position: 'absolute', backgroundColor: '#E03131', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 2, borderColor: '#FFFFFF' },
  countText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
