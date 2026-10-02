import { router, useFocusEffect } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDate } from '@/components/BlockRow';
import { sessionPlace } from '@/components/SessionBanner';
import { Button } from '@/components/ui';
import { DISCIPLINE_SYSTEMS, GRADES, isSent, placeKey, placeOf, type Discipline } from '@/lib/climbing';
import { listBlocks, type Block } from '@/lib/db';
import { getSession, type Session } from '@/lib/session';
import { colors } from '@/lib/theme';

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

const goClimb = (where: 'gym' | 'outdoor') =>
  router.navigate({ pathname: '/grimper', params: { where, t: String(Date.now()) } });

export default function HomeScreen() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [session, setSession] = useState<Session | null>(null);

  useFocusEffect(
    useCallback(() => {
      setBlocks(listBlocks());
      setSession(getSession());
    }, []),
  );

  // Dernière séance : les grimpes du dernier jour, au même endroit.
  const last = blocks[0];
  const lastSession = last ? blocks.filter((b) => b.date === last.date && placeKey(b) === placeKey(last)) : [];
  const monday = mondayIso();
  const thisWeek = blocks.filter((b) => b.date >= monday);
  const weekSessions = new Set(thisWeek.map((b) => `${b.date}|${placeKey(b)}`)).size;
  const bestBloc = bestSend(blocks, 'bloc');
  const bestVoie = bestSend(blocks, 'voie');

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {session && (
        <View style={s.session}>
          <Text style={s.sessionTitle}>Séance en cours</Text>
          <Text style={s.sessionText}>
            {sessionPlace(session)} · depuis {since(session.startedAt)}
          </Text>
          <Button label="Reprendre la séance" variant="secondary" onPress={() => router.push('/session')} />
        </View>
      )}

      <View style={s.grid}>
        <Shortcut icon="fitness_center" ios="figure.climbing" label="Grimper en salle" onPress={() => goClimb('gym')} />
        <Shortcut icon="landscape" ios="mountain.2" label="Grimper dehors" onPress={() => goClimb('outdoor')} />
        <Shortcut icon="bar_chart" ios="chart.bar.fill" label="Progression" onPress={() => router.navigate('/progression')} />
        <Shortcut icon="casino" ios="dice" label="Jeux" onPress={() => router.navigate('/jeux')} />
      </View>

      {blocks.length === 0 ? (
        <Text style={s.muted}>
          Choisis une salle dans Grimper en salle et démarre ta première séance : ton résumé apparaîtra ici.
        </Text>
      ) : (
        <View style={s.summary}>
          <Text style={s.title}>Résumé</Text>
          {last && (
            <Line
              label="Dernière séance"
              value={`${formatDate(last.date)} · ${placeOf(last)} · ${lastSession.length} grimpe${
                lastSession.length > 1 ? 's' : ''
              }, ${lastSession.filter((b) => isSent(b.result)).length} réussie${
                lastSession.filter((b) => isSent(b.result)).length > 1 ? 's' : ''
              }`}
            />
          )}
          <Line
            label="Cette semaine"
            value={`${weekSessions} séance${weekSessions > 1 ? 's' : ''} · ${thisWeek.length} grimpe${
              thisWeek.length > 1 ? 's' : ''
            }`}
          />
          {bestBloc && <Line label="Meilleur bloc réussi" value={bestBloc} />}
          {bestVoie && <Line label="Meilleure voie réussie" value={bestVoie} />}
        </View>
      )}
    </ScrollView>
  );
}

function Shortcut({
  icon,
  ios,
  label,
  onPress,
}: {
  icon: AndroidSymbol;
  ios: SFSymbol;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [s.shortcut, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <SymbolView name={{ ios, android: icon, web: icon }} tintColor={colors.primary} size={34} />
      <Text style={s.shortcutLabel}>{label}</Text>
    </Pressable>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.line}>
      <Text style={s.lineLabel}>{label}</Text>
      <Text style={s.lineValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  session: { padding: 16, gap: 6, borderRadius: 14, backgroundColor: colors.primary },
  sessionTitle: { color: '#fff', fontSize: 13, fontWeight: '600', opacity: 0.9 },
  sessionText: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  shortcut: {
    flexBasis: '46%',
    flexGrow: 1,
    aspectRatio: 1.3,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  shortcutLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  summary: { gap: 10 },
  title: { fontWeight: '700', fontSize: 15, color: colors.text },
  line: { padding: 12, borderRadius: 10, backgroundColor: colors.surface, gap: 2 },
  lineLabel: { color: colors.muted, fontSize: 13 },
  lineValue: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, lineHeight: 20 },
});
