import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { STATS, TIERS, type PlayerCard, type StatId, type Tier } from '@/lib/playerCard';
import { SKIN_IMAGES } from '@/lib/skinImages';
import type { SkinId } from '@/lib/skins';
import { themedStyles } from '@/lib/theme';

/** Couleurs de chaque carte (fixes : elles ne suivent pas le thème de l'app). */
const LOOK: Record<Tier, { top: string; bottom: string; shine: string; text: string; line: string }> = {
  bronze: { top: '#F2CDA6', bottom: '#A5693E', shine: '#FFE9D2', text: '#3B2210', line: '#7A4A26' },
  argent: { top: '#F8FAFC', bottom: '#A3AEBB', shine: '#FFFFFF', text: '#212A34', line: '#5F7083' },
  or: { top: '#FFF4B8', bottom: '#D6A11C', shine: '#FFFBE3', text: '#382700', line: '#966F00' },
  legende: { top: '#4A3594', bottom: '#120C2E', shine: '#9580FF', text: '#FFE08A', line: '#D4AF37' },
};
const UP = '#2B8A3E';
const DOWN = '#C92A2A';

/** Silhouette de la carte, un bouclier, dans un repère de 100 × 142. */
const SHAPE = 'M14 2H86L98 14V108C98 118 92 124 84 128L52.5 141C50.9 141.7 49.1 141.7 47.5 141L16 128C8 124 2 118 2 108V14Z';
export const CARD_RATIO = 1.42;

type Props = {
  card: PlayerCard;
  name: string;
  skin: SkinId;
  /** Points gagnés ou perdus par stat (parties entières), affichés à côté de chaque valeur. */
  changes?: Partial<Record<StatId, number>>;
  width: number;
  onPress?: () => void;
};

/** Carte joueur façon FIFA : note, poste, grimpeur en costume, nom et six stats. */
export function PlayerCardView({ card, name, skin, changes, width: W, onPress }: Props) {
  const c = LOOK[card.tier];
  const f = (k: number) => Math.round(W * k);
  const text = { color: c.text };
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
  const tier = TIERS.find((t) => t.id === card.tier)!;
  // Identifiants propres à chaque carte : sur le web, ils sont communs à toute la page.
  const id = (k: string) => `${k}-${card.tier}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Carte joueur ${tier.name}, note ${Math.floor(card.overall)}`}
      style={({ pressed }) => [{ width: W, height: W * CARD_RATIO }, pressed && { transform: [{ scale: 0.98 }] }]}>
      <Svg width={W} height={W * CARD_RATIO} viewBox="0 0 100 142" style={s.fill}>
        <Defs>
          <LinearGradient id={id('bg')} x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={c.top} />
            <Stop offset="1" stopColor={c.bottom} />
          </LinearGradient>
          <RadialGradient id={id('shine')} cx="0.3" cy="0.12" r="0.75">
            <Stop offset="0" stopColor={c.shine} stopOpacity="0.85" />
            <Stop offset="1" stopColor={c.shine} stopOpacity="0" />
          </RadialGradient>
          <ClipPath id={id('clip')}>
            <Path d={SHAPE} />
          </ClipPath>
        </Defs>
        <Path d={SHAPE} fill={`url(#${id('bg')})`} />
        <G clipPath={`url(#${id('clip')})`}>
          <Rect x="0" y="0" width="100" height="142" fill={`url(#${id('shine')})`} />
          {/* Reflets en biais, comme sur les cartes brillantes. */}
          {[10, 34, 70].map((x, i) => (
            <Path key={x} d={`M${x} -5L${x + 14 + i * 4} -5L${x - 46 + i * 4} 150L${x - 60} 150Z`} fill={c.shine} opacity={0.12} />
          ))}
        </G>
        <Path d={SHAPE} fill="none" stroke={c.line} strokeWidth={0.8} opacity={0.55} transform="translate(3 4.26) scale(0.94)" />
      </Svg>

      <Image source={SKIN_IMAGES[skin].card} style={[s.photo, { right: f(0.02), top: f(0.035), width: f(0.72), height: f(0.72) }]} contentFit="contain" />

      <View style={[s.corner, { left: f(0.1), top: f(0.1) }]}>
        <Text style={[s.overall, text, { fontSize: f(0.17), lineHeight: f(0.19) }]}>{Math.floor(card.overall)}</Text>
        <Text style={[s.position, text, { fontSize: f(0.058) }]}>{card.position}</Text>
        <View style={[s.rule, { backgroundColor: c.line, width: f(0.12), marginVertical: f(0.022) }]} />
        <Text style={[s.tier, text, { fontSize: f(0.036) }]}>{tier.name}</Text>
      </View>

      <Text style={[s.name, text, { top: f(0.765), fontSize: f(0.085), paddingHorizontal: f(0.1) }]} numberOfLines={1} adjustsFontSizeToFit>
        {name.trim().toUpperCase() || 'MOI'}
      </Text>
      <View style={[s.nameRule, { top: f(0.885), left: f(0.12), right: f(0.12), backgroundColor: c.line }]} />

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
  grid: { position: 'absolute', flexDirection: 'row' },
  col: { flex: 1 },
  colRule: { width: 1.5, opacity: 0.45, marginVertical: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontWeight: '800', textAlign: 'right' },
  statLabel: { fontWeight: '600', opacity: 0.85 },
  change: { fontWeight: '800' },
  playstyle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', opacity: 0.8 },
});
