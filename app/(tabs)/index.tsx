import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';

import { formatDate } from '@/components/BlockRow';
import { sessionPlace } from '@/components/SessionBanner';
import { DISCIPLINE_SYSTEMS, GRADES, isSent, placeKey, placeOf, type Discipline } from '@/lib/climbing';
import { listBlocks, type Block } from '@/lib/db';
import { getSession, type Session } from '@/lib/session';
import { colors } from '@/lib/theme';

const HERO_HEIGHT = 250;

/** Meilleure réussite d'une discipline, dans le système de cotation le plus utilisé. */
function bestSend(blocks: Block[], d: Discipline): string | null {
  const sent = blocks.filter((b) => b.discipline === d && isSent(b.result));
  const system = [...DISCIPLINE_SYSTEMS[d]].sort(
    (a, b) => sent.filter((x) => x.gradeSystem === b).length - sent.filter((x) => x.gradeSystem === a).length,
  )[0];
  const ladder = GRADES[system];
  const best = sent.filter((b) => b.gradeSystem === system).reduce((m, b) => Math.max(m, ladder.indexOf(b.grade)), -1);
  return best >= 0 ? ladder[best] : null;
}

function mondayIso() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function since(ts: number) {
  const min = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function todayLabel() {
  const d = new Date();
  const day = DAYS[d.getDay()];
  return `${day[0].toUpperCase()}${day.slice(1)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const goClimb = (where: 'gym' | 'outdoor') =>
  router.navigate({ pathname: '/grimper', params: { where, t: String(Date.now()) } });

const SHORTCUTS: {
  label: string;
  sub: string;
  ios: SFSymbol;
  android: AndroidSymbol;
  tint: string;
  soft: string;
  onPress: () => void;
}[] = [
  {
    label: 'En salle',
    sub: 'Salles autour de toi',
    ios: 'figure.climbing',
    android: 'apartment',
    tint: colors.primary,
    soft: '#FFF0E6',
    onPress: () => goClimb('gym'),
  },
  {
    label: 'Dehors',
    sub: 'Séance là où tu es',
    ios: 'mountain.2',
    android: 'landscape',
    tint: '#2F9E44',
    soft: '#EBFBEE',
    onPress: () => goClimb('outdoor'),
  },
  {
    label: 'Progression',
    sub: 'Graphes et grimpes',
    ios: 'chart.bar.fill',
    android: 'monitoring',
    tint: '#1C7ED6',
    soft: '#E7F5FF',
    onPress: () => router.navigate('/progression'),
  },
  {
    label: 'Jeux',
    sub: 'Idées pour varier',
    ios: 'dice',
    android: 'casino',
    tint: '#7048E8',
    soft: '#F3F0FF',
    onPress: () => router.navigate('/jeux'),
  },
];

/** Dégradé orange et silhouettes de montagnes derrière l'en-tête. */
function HeroBackground({ width, height }: { width: number; height: number }) {
  const w = width;
  const h = height;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF8A3D" />
          <Stop offset="1" stopColor="#D9480F" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#sky)" />
      <Polygon
        points={`0,${h} 0,${h * 0.84} ${w * 0.18},${h * 0.74} ${w * 0.32},${h * 0.82} ${w * 0.52},${h * 0.68} ${w * 0.7},${h * 0.8} ${w * 0.86},${h * 0.72} ${w},${h * 0.8} ${w},${h}`}
        fill="#FFFFFF"
        opacity={0.12}
      />
      <Polygon
        points={`0,${h} 0,${h * 0.92} ${w * 0.22},${h * 0.84} ${w * 0.42},${h * 0.91} ${w * 0.62},${h * 0.8} ${w * 0.8},${h * 0.89} ${w},${h * 0.85} ${w},${h}`}
        fill="#FFFFFF"
        opacity={0.18}
      />
    </Svg>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [session, setSession] = useState<Session | null>(null);

  useFocusEffect(
    useCallback(() => {
      setBlocks(listBlocks());
      setSession(getSession());
      // Texte clair sur l'en-tête orange, le temps d'être sur l'accueil.
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  // Dernière séance : les grimpes du dernier jour, au même endroit.
  const last = blocks[0];
  const lastSession = last ? blocks.filter((b) => b.date === last.date && placeKey(b) === placeKey(last)) : [];
  const lastSent = lastSession.filter((b) => isSent(b.result)).length;
  const monday = mondayIso();
  const thisWeek = blocks.filter((b) => b.date >= monday);
  const weekSessions = new Set(thisWeek.map((b) => `${b.date}|${placeKey(b)}`)).size;
  const bestBloc = bestSend(blocks, 'bloc');
  const bestVoie = bestSend(blocks, 'voie');
  const heroHeight = HERO_HEIGHT + insets.top;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={[s.hero, { height: heroHeight, paddingTop: insets.top + 20 }]}>
        <HeroBackground width={width} height={heroHeight} />
        <Text style={s.date}>{todayLabel()}</Text>
        <Text style={s.hello}>Prêt à grimper ?</Text>
        <View style={s.stats}>
          <Stat value={String(weekSessions)} label={`séance${weekSessions > 1 ? 's' : ''} cette semaine`} />
          <Stat value={String(thisWeek.length)} label={`grimpe${thisWeek.length > 1 ? 's' : ''} cette semaine`} />
          <Stat value={bestBloc ?? '–'} label="meilleur bloc" />
        </View>
      </View>

      <View style={s.body}>
        {session && (
          <Pressable style={({ pressed }) => [s.card, s.session, pressed && s.pressed]} onPress={() => router.push('/session')}>
            <View style={s.liveDot} />
            <View style={{ flex: 1 }}>
              <Text style={s.sessionLabel}>Séance en cours</Text>
              <Text style={s.sessionPlace} numberOfLines={1}>
                {sessionPlace(session)}
              </Text>
              <Text style={s.muted}>depuis {since(session.startedAt)}</Text>
            </View>
            <Text style={s.resume}>Reprendre</Text>
          </Pressable>
        )}

        <View style={s.grid}>
          {SHORTCUTS.map((sc) => (
            <Pressable
              key={sc.label}
              style={({ pressed }) => [s.card, s.shortcut, pressed && s.pressed]}
              onPress={sc.onPress}>
              <View style={[s.iconBox, { backgroundColor: sc.soft }]}>
                <SymbolView name={{ ios: sc.ios, android: sc.android, web: sc.android }} tintColor={sc.tint} size={28} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={s.shortcutLabel}>{sc.label}</Text>
                <Text style={s.shortcutSub}>{sc.sub}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {last ? (
          <>
            <Text style={s.sectionTitle}>Ta dernière séance</Text>
            <View style={[s.card, s.lastCard]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.lastPlace} numberOfLines={1}>
                  {placeOf(last)}
                </Text>
                <Text style={s.muted}>{formatDate(last.date)}</Text>
              </View>
              <View style={s.lastNumbers}>
                <Count value={lastSession.length} label={`grimpe${lastSession.length > 1 ? 's' : ''}`} />
                <Count value={lastSent} label={`réussie${lastSent > 1 ? 's' : ''}`} />
              </View>
            </View>

            {(bestBloc || bestVoie) && (
              <>
                <Text style={s.sectionTitle}>Tes records</Text>
                <View style={s.records}>
                  {bestBloc && <Record label="Bloc" value={bestBloc} />}
                  {bestVoie && <Record label="Voie" value={bestVoie} />}
                </View>
              </>
            )}
          </>
        ) : (
          <View style={[s.card, s.empty]}>
            <Text style={s.emptyTitle}>Ta première séance t&apos;attend</Text>
            <Text style={s.emptyText}>
              Choisis une salle, démarre une séance et ajoute tes blocs : ton résumé apparaîtra ici.
            </Text>
            <Pressable style={({ pressed }) => [s.cta, pressed && s.pressed]} onPress={() => goClimb('gym')}>
              <Text style={s.ctaText}>Trouver une salle</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={s.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.number}>{value}</Text>
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

function Record({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.card, s.record]}>
      <Text style={s.muted}>{label}</Text>
      <Text style={s.recordValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F5' },
  hero: { paddingHorizontal: 24, overflow: 'hidden' },
  date: { color: '#FFFFFF', opacity: 0.85, fontSize: 14, fontWeight: '600' },
  hello: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 4 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 22 },
  stat: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#FFFFFF', opacity: 0.9, fontSize: 12, marginTop: 2 },
  body: { paddingHorizontal: 16, marginTop: -28, gap: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  session: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderWidth: 2, borderColor: colors.primary },
  liveDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2F9E44' },
  sessionLabel: { color: colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sessionPlace: { color: colors.text, fontSize: 18, fontWeight: '800' },
  resume: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  shortcut: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 150,
    padding: 18,
    justifyContent: 'space-between',
  },
  iconBox: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 17, fontWeight: '800', color: colors.text },
  shortcutSub: { fontSize: 13, color: colors.muted },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 10 },
  lastCard: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 16 },
  lastPlace: { fontSize: 17, fontWeight: '700', color: colors.text },
  lastNumbers: { flexDirection: 'row', gap: 18 },
  number: { fontSize: 24, fontWeight: '800', color: colors.primary },
  records: { flexDirection: 'row', gap: 14 },
  record: { flex: 1, padding: 18, gap: 4 },
  recordValue: { fontSize: 30, fontWeight: '800', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  empty: { padding: 22, gap: 10, alignItems: 'flex-start' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  cta: { marginTop: 6, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: colors.primary },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
