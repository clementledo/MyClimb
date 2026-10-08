import { Image } from 'expo-image';
import { memo, useId, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ANIMATED_BACKDROPS, ANIMATED_FRAMES, BackdropLayer, FrameLayer, hsl, SHAPE, type Look } from '@/components/cardCosmetics';
import { TITLES, type BackdropId, type FrameId, type TitleId } from '@/lib/cosmetics';
import { STATS, TIERS, type PlayerCard, type StatId, type Tier } from '@/lib/playerCard';
import { rarityOf } from '@/lib/rarity';
import { SKIN_IMAGES } from '@/lib/skinImages';
import type { SkinId } from '@/lib/skins';
import { themedStyles } from '@/lib/theme';
import { useTicker } from '@/lib/useTicker';

/** Couleurs de chaque carte (fixes : elles ne suivent pas le thème de l'app). */
export const LOOK: Record<Tier, Look> = {
  bronze: { top: '#F2CDA6', bottom: '#A5693E', shine: '#FFE9D2', text: '#3B2210', line: '#7A4A26' },
  argent: { top: '#F8FAFC', bottom: '#A3AEBB', shine: '#FFFFFF', text: '#212A34', line: '#5F7083' },
  or: { top: '#FFF4B8', bottom: '#D6A11C', shine: '#FFFBE3', text: '#382700', line: '#966F00' },
  legende: { top: '#4A3594', bottom: '#120C2E', shine: '#9580FF', text: '#FFE08A', line: '#D4AF37' },
};
const UP = '#2B8A3E';
const DOWN = '#C92A2A';

export const CARD_RATIO = 1.42;

type Props = {
  card: PlayerCard;
  name: string;
  skin: SkinId;
  /** Contour, fond et titre gagnés dans les packs. */
  frame?: FrameId | null;
  backdrop?: BackdropId | null;
  title?: TitleId | null;
  /** Anime les objets mythiques ; à couper quand la carte n'est pas à l'écran. */
  animate?: boolean;
  /** Points gagnés ou perdus par stat (parties entières), affichés à côté de chaque valeur. */
  changes?: Partial<Record<StatId, number>>;
  width: number;
  onPress?: () => void;
};

/** Identifiants SVG propres à chaque dessin : sur le web, ils sont communs à toute la page. */
export function useSvgIds() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return useMemo(() => (k: string) => `${k}-${uid}`, [uid]);
}

/** Fond de la carte : dégradé, reflets, et le filet intérieur quand il n'y a pas de contour. */
const CardBase = memo(function CardBase({ c, W, ids, inner }: { c: Look; W: number; ids: (k: string) => string; inner: boolean }) {
  return (
    <Svg width={W} height={W * CARD_RATIO} viewBox="0 0 100 142" style={s.fill}>
      <Defs>
        <LinearGradient id={ids('bg')} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={c.top} />
          <Stop offset="1" stopColor={c.bottom} />
        </LinearGradient>
        <RadialGradient id={ids('shine')} cx="0.3" cy="0.12" r="0.75">
          <Stop offset="0" stopColor={c.shine} stopOpacity="0.85" />
          <Stop offset="1" stopColor={c.shine} stopOpacity="0" />
        </RadialGradient>
        <ClipPath id={ids('clip')}>
          <Path d={SHAPE} />
        </ClipPath>
      </Defs>
      <Path d={SHAPE} fill={`url(#${ids('bg')})`} />
      <G clipPath={`url(#${ids('clip')})`}>
        <Rect x="0" y="0" width="100" height="142" fill={`url(#${ids('shine')})`} />
        {/* Reflets en biais, comme sur les cartes brillantes. */}
        {[10, 34, 70].map((x, i) => (
          <Path key={x} d={`M${x} -5L${x + 14 + i * 4} -5L${x - 46 + i * 4} 150L${x - 60} 150Z`} fill={c.shine} opacity={0.12} />
        ))}
      </G>
      {inner && <Path d={SHAPE} fill="none" stroke={c.line} strokeWidth={0.8} opacity={0.55} transform="translate(3 4.26) scale(0.94)" />}
    </Svg>
  );
});

const BackdropSvg = memo(function BackdropSvg(p: { backdrop: BackdropId; c: Look; W: number; ids: (k: string) => string; t: number }) {
  return (
    <Svg width={p.W} height={p.W * CARD_RATIO} viewBox="0 0 100 142" style={s.fill} pointerEvents="none">
      <BackdropLayer backdrop={p.backdrop} ctx={{ c: p.c, id: p.ids, t: p.t }} />
    </Svg>
  );
});

const FrameSvg = memo(function FrameSvg(p: { frame: FrameId; c: Look; W: number; ids: (k: string) => string; t: number }) {
  return (
    <Svg width={p.W} height={p.W * CARD_RATIO} viewBox="0 0 100 142" style={s.fill} pointerEvents="none">
      <FrameLayer frame={p.frame} ctx={{ c: p.c, id: p.ids, t: p.t }} />
    </Svg>
  );
});

/** Titre gagné dans un pack : une plaque à la couleur de sa rareté (arc-en-ciel qui défile si mythique). */
export const TitleBadge = memo(function TitleBadge({ title, size, t = 0 }: { title: TitleId; size: number; t?: number }) {
  const item = TITLES.find((x) => x.id === title)!;
  const r = rarityOf(item.rarity);
  const ids = useSvgIds();
  const mythic = item.rarity === 'mythique';
  const stops = mythic
    ? [0, 0.25, 0.5, 0.75, 1].map((k) => ({ k, color: hsl(k * 0.7 + t * 0.2, 0.85, 0.55) }))
    : [
        { k: 0, color: r.color },
        { k: 1, color: r.dark },
      ];
  return (
    <View style={[s.badge, { height: size * 1.8, paddingHorizontal: size * 0.85, borderRadius: size }]}>
      <Svg style={s.fill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={ids('title')} x1="0" y1="0" x2="1" y2="1">
            {stops.map((x) => (
              <Stop key={x.k} offset={x.k} stopColor={x.color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${ids('title')})`} />
        <Rect x="0" y="0" width="100%" height="45%" fill="#FFFFFF" opacity={0.18} />
      </Svg>
      <Text style={[s.badgeText, { fontSize: size }]} numberOfLines={1}>
        {item.name}
      </Text>
    </View>
  );
});

/** Carte joueur façon FIFA : note, poste, grimpeur en costume, nom, titre et six stats. */
export function PlayerCardView({ card, name, skin, frame, backdrop, title, animate = true, changes, width: W, onPress }: Props) {
  const c = LOOK[card.tier];
  const f = (k: number) => Math.round(W * k);
  const text = { color: c.text };
  const ids = useSvgIds();
  const moving = {
    frame: !!frame && ANIMATED_FRAMES.has(frame),
    backdrop: !!backdrop && ANIMATED_BACKDROPS.has(backdrop),
    title: !!title && TITLES.find((x) => x.id === title)?.rarity === 'mythique',
  };
  const t = useTicker(animate && (moving.frame || moving.backdrop || moving.title));
  const stat = (id: StatId) => {
    const st = STATS.find((x) => x.id === id)!;
    const d = changes?.[id] ?? 0;
    return (
      <View key={id} style={[s.stat, { height: f(0.1) }]} accessibilityLabel={`${st.name} ${Math.floor(card.stats[id])}`}>
        <Text style={[s.statValue, text, { fontSize: f(0.072), width: f(0.11) }]}>{Math.floor(card.stats[id])}</Text>
        <Text style={[s.statLabel, text, { fontSize: f(0.056) }]}>{st.short}</Text>
        {d !== 0 && (
          <Text style={[s.change, { fontSize: f(0.04), color: d > 0 ? UP : DOWN }]}>
            {d > 0 ? `+${d}` : `−${-d}`}
          </Text>
        )}
      </View>
    );
  };
  const tier = TIERS.find((x) => x.id === card.tier)!;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Carte joueur ${tier.name}, note ${Math.floor(card.overall)}`}
      style={({ pressed }) => [{ width: W, height: W * CARD_RATIO }, pressed && { transform: [{ scale: 0.98 }] }]}>
      <CardBase c={c} W={W} ids={ids} inner={!frame} />
      {backdrop && <BackdropSvg backdrop={backdrop} c={c} W={W} ids={ids} t={moving.backdrop ? t : 0} />}

      <Image source={SKIN_IMAGES[skin].card} style={[s.photo, { right: f(0.02), top: f(0.035), width: f(0.72), height: f(0.72) }]} contentFit="contain" />

      {frame && <FrameSvg frame={frame} c={c} W={W} ids={ids} t={moving.frame ? t : 0} />}

      <View style={[s.corner, { left: f(0.1), top: f(0.1) }]}>
        <Text style={[s.overall, text, { fontSize: f(0.17), lineHeight: f(0.19) }]}>{Math.floor(card.overall)}</Text>
        <Text style={[s.position, text, { fontSize: f(0.058) }]}>{card.position}</Text>
        <View style={[s.rule, { backgroundColor: c.line, width: f(0.12), marginVertical: f(0.022) }]} />
        <Text style={[s.tier, text, { fontSize: f(0.036) }]}>{tier.name}</Text>
      </View>

      <Text
        style={[s.name, text, { top: f(title ? 0.748 : 0.765), fontSize: f(0.085), paddingHorizontal: f(0.1) }]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {name.trim().toUpperCase() || 'MOI'}
      </Text>
      {title ? (
        <View style={[s.titleRow, { top: f(0.846), paddingHorizontal: f(0.1) }]} pointerEvents="none">
          <TitleBadge title={title} size={f(0.034)} t={moving.title ? t : 0} />
        </View>
      ) : (
        <View style={[s.nameRule, { top: f(0.885), left: f(0.12), right: f(0.12), backgroundColor: c.line }]} />
      )}

      <View style={[s.grid, { top: f(0.915), left: f(0.14), right: f(0.1) }]}>
        <View style={s.col}>{(['force', 'doigts', 'technique'] as StatId[]).map(stat)}</View>
        <View style={[s.colRule, { backgroundColor: c.line }]} />
        <View style={[s.col, { paddingLeft: f(0.05) }]}>{(['endurance', 'souplesse', 'mental'] as StatId[]).map(stat)}</View>
      </View>

      <Text style={[s.playstyle, text, { top: f(1.245), fontSize: f(0.038) }]}>★ {card.playstyle}</Text>
    </Pressable>
  );
}

const s = themedStyles({
  fill: { position: 'absolute', left: 0, top: 0 },
  photo: { position: 'absolute' },
  corner: { position: 'absolute', alignItems: 'center' },
  overall: { fontWeight: '800', letterSpacing: -1 },
  position: { fontWeight: '800', letterSpacing: 1 },
  rule: { height: 1.5, opacity: 0.6 },
  tier: { fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85 },
  name: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontWeight: '800', letterSpacing: 0.5 },
  nameRule: { position: 'absolute', height: 1.5, opacity: 0.5 },
  titleRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  badge: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', maxWidth: '100%' },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  grid: { position: 'absolute', flexDirection: 'row' },
  col: { flex: 1 },
  colRule: { width: 1.5, opacity: 0.45, marginVertical: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontWeight: '800', textAlign: 'right' },
  statLabel: { fontWeight: '600', opacity: 0.85 },
  change: { fontWeight: '800' },
  playstyle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', opacity: 0.8 },
});
