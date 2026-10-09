import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CARD_RATIO, CardBase, LOOK, useSvgIds } from '@/components/PlayerCard';
import { nameOf, ratingOf, tierOf, TIER_NAMES, type Climber, type Club } from '@/lib/manager';
import { MSTATS, STYLES, type MStat } from '@/lib/managerData';
import { SKIN_IMAGES } from '@/lib/skinImages';
import { themedStyles } from '@/lib/theme';

const SHOWN: MStat[][] = [
  ['force', 'doigts', 'technique'],
  ['endurance', 'puissance', 'mental'],
];

/** Carte d'un grimpeur du Manager, façon FIFA : note, style, drapeau, portrait 3D et 6 stats. */
export const ManagerCard = memo(function ManagerCard({
  climber,
  club,
  width: W,
  onPress,
  dim,
}: {
  climber: Climber;
  club?: Club | null;
  width: number;
  onPress?: () => void;
  dim?: boolean;
}) {
  const r = ratingOf(climber);
  const tier = tierOf(r);
  const c = LOOK[tier];
  const ids = useSvgIds();
  const f = (k: number) => Math.round(W * k);
  const text = { color: c.text };
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${nameOf(climber)}, note ${r}`}
      style={({ pressed }) => [{ width: W, height: W * CARD_RATIO, opacity: dim ? 0.45 : 1 }, pressed && { transform: [{ scale: 0.97 }] }]}>
      <CardBase c={c} W={W} ids={ids} inner />
      <Image source={SKIN_IMAGES[climber.skin]?.card} style={[s.abs, { right: f(0.02), top: f(0.05), width: f(0.68), height: f(0.68) }]} contentFit="contain" />
      <View style={[s.corner, { left: f(0.1), top: f(0.1) }]}>
        <Text style={[s.overall, text, { fontSize: f(0.17), lineHeight: f(0.19) }]}>{r}</Text>
        <Text style={[s.pos, text, { fontSize: f(0.058) }]}>{STYLES[climber.style].short}</Text>
        <Text style={{ fontSize: f(0.09), marginTop: f(0.01) }}>{climber.flag}</Text>
        {club && <View style={[s.club, { width: f(0.1), height: f(0.1), borderRadius: f(0.05), backgroundColor: club.colors[0], borderColor: club.colors[1], borderWidth: Math.max(1.5, f(0.012)) }]} />}
      </View>
      <Text style={[s.name, text, { top: f(0.765), fontSize: f(0.08), paddingHorizontal: f(0.1) }]} numberOfLines={1} adjustsFontSizeToFit>
        {nameOf(climber).toUpperCase()}
      </Text>
      <View style={[s.rule, { top: f(0.885), left: f(0.12), right: f(0.12), backgroundColor: c.line }]} />
      <View style={[s.grid, { top: f(0.915), left: f(0.14), right: f(0.1) }]}>
        {SHOWN.map((col, i) => (
          <View key={i} style={[s.col, i === 1 && { paddingLeft: f(0.05), borderLeftWidth: 1.5, borderLeftColor: c.line }]}>
            {col.map((id) => (
              <View key={id} style={[s.stat, { height: f(0.1) }]}>
                <Text style={[s.value, text, { fontSize: f(0.072), width: f(0.11) }]}>{Math.floor(climber.stats[id])}</Text>
                <Text style={[s.label, text, { fontSize: f(0.056) }]}>{MSTATS.find((m) => m.id === id)!.short}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      <Text style={[s.foot, text, { top: f(1.245), fontSize: f(0.038) }]}>{TIER_NAMES[tier]}</Text>
    </Pressable>
  );
});

const s = themedStyles({
  abs: { position: 'absolute' },
  corner: { position: 'absolute', alignItems: 'center' },
  overall: { fontWeight: '800', letterSpacing: -1 },
  pos: { fontWeight: '800', letterSpacing: 1 },
  club: { marginTop: 4 },
  name: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontWeight: '800', letterSpacing: 0.5 },
  rule: { position: 'absolute', height: 1.5, opacity: 0.5 },
  grid: { position: 'absolute', flexDirection: 'row' },
  col: { flex: 1 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontWeight: '800', textAlign: 'right' },
  label: { fontWeight: '600', opacity: 0.85 },
  foot: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.8 },
});
