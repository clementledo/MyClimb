import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Icon } from '@/components/ui';
import { avgTeam, LEAGUES, loadClub, standings, type Club } from '@/lib/manager';
import { space, themedStyles } from '@/lib/theme';

/** Onglet Jeux : MyClimb Manager, et Carrière (bientôt). */
export default function GamesHub() {
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);
  useFocusEffect(useCallback(() => setClub(loadClub()), []));
  const rank = club ? standings(club).findIndex((r) => r.mine) + 1 : 0;

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Pressable onPress={() => router.push('/manager')} accessibilityRole="button" accessibilityLabel="MyClimb Manager" style={({ pressed }) => [s.card, pressed && s.pressed]}>
        <Svg style={s.fill} viewBox="0 0 340 220" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <LinearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#1B2559" />
              <Stop offset="1" stopColor="#0B1030" />
            </LinearGradient>
            <LinearGradient id="mo" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FF8A4C" />
              <Stop offset="1" stopColor="#E8642C" />
            </LinearGradient>
          </Defs>
          <Rect width="340" height="220" fill="url(#mg)" />
          {/* Projecteurs et silhouette de mur de compétition. */}
          <Path d="M40 -10 L110 220 L-30 220 Z" fill="#FFFFFF" opacity={0.05} />
          <Path d="M300 -10 L370 220 L230 220 Z" fill="#FFFFFF" opacity={0.05} />
          <Path d="M170 220 L210 60 L260 40 L320 120 L340 220 Z" fill="url(#mo)" opacity={0.9} />
          {[
            [222, 80],
            [248, 70],
            [270, 98],
            [290, 128],
            [262, 150],
            [300, 175],
            [236, 120],
          ].map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={i % 2 ? 5 : 7} fill={['#FFD43B', '#51CF66', '#339AF0', '#F06595'][i % 4]} />
          ))}
        </Svg>
        <View style={s.cardBody}>
          <Text style={s.over}>NOUVEAU</Text>
          <Text style={s.title}>MyClimb{'\n'}Manager</Text>
          <Text style={s.text}>{club ? `${club.name} · ${LEAGUES[club.league].short} · ${rank}ᵉ` : 'Crée ton club, recrute, entraîne et gagne la Coupe du monde.'}</Text>
          <View style={s.cta}>
            <Text style={s.ctaText}>{club ? 'Continuer' : 'Créer mon club'}</Text>
            <Icon name="arrow_forward" size={18} color="#0B1030" />
          </View>
          {club && <Text style={s.small}>Équipe {Math.round(avgTeam(club))} de moyenne</Text>}
        </View>
      </Pressable>

      <Pressable
        onPress={() => Alert.alert('Bientôt disponible', 'Carrière : vis la vie d’un grimpeur, de la salle du quartier jusqu’aux Jeux olympiques. On y travaille !')}
        accessibilityRole="button"
        accessibilityLabel="Carrière, bientôt disponible"
        style={({ pressed }) => [s.card, s.small2, pressed && s.pressed]}>
        <Svg style={s.fill} viewBox="0 0 340 140" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <LinearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#3A2B6B" />
              <Stop offset="1" stopColor="#140D2E" />
            </LinearGradient>
          </Defs>
          <Rect width="340" height="140" fill="url(#cg)" />
          <Path d="M200 140 L250 50 L280 80 L310 30 L360 140 Z" fill="#9580FF" opacity={0.35} />
        </Svg>
        <View style={s.cardBody}>
          <View style={s.soonRow}>
            <Text style={s.title2}>Carrière</Text>
            <View style={s.soon}>
              <Icon name="lock" size={14} color="#140D2E" />
              <Text style={s.soonText}>Bientôt disponible</Text>
            </View>
          </View>
          <Text style={s.text}>Deviens toi-même un grimpeur pro.</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const s = themedStyles({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  card: { height: 240, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0B1030' },
  small2: { height: 140 },
  pressed: { transform: [{ scale: 0.98 }] },
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  cardBody: { flex: 1, padding: space.xl, gap: 6, justifyContent: 'flex-end' },
  over: { color: '#FFD43B', fontWeight: '800', fontSize: 12, letterSpacing: 1.5 },
  title: { color: '#FFFFFF', fontSize: 32, lineHeight: 34, fontWeight: '900', letterSpacing: -0.5 },
  title2: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  text: { color: '#FFFFFF', opacity: 0.85, fontSize: 14, maxWidth: '62%' },
  small: { color: '#FFFFFF', opacity: 0.6, fontSize: 12 },
  cta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 8, paddingHorizontal: 16, height: 38, borderRadius: 19, backgroundColor: '#FFD43B' },
  ctaText: { color: '#0B1030', fontWeight: '800', fontSize: 15 },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  soon: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: '#FFE08A' },
  soonText: { color: '#140D2E', fontWeight: '800', fontSize: 12 },
});
