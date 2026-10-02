import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Empty, Section, Segmented } from '@/components/ui';
import { GRADE_SYSTEM_LABELS, GRADES, STYLES, type GradeSystem } from '@/lib/climbing';
import { listBlocks, type Block } from '@/lib/db';
import { colors } from '@/lib/theme';

type Period = '30' | 'all';

const isSent = (b: Block) => b.result !== 'project';

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function ProgressionScreen() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [period, setPeriod] = useState<Period>('30');
  const [systemChoice, setSystemChoice] = useState<GradeSystem | null>(null);

  useFocusEffect(useCallback(() => setBlocks(listBlocks()), []));

  const inPeriod = useMemo(() => {
    if (period === 'all') return blocks;
    const from = daysAgoIso(30);
    return blocks.filter((b) => b.date >= from);
  }, [blocks, period]);

  // Système de cotation : celui choisi, sinon le plus utilisé.
  const systemsUsed = (Object.keys(GRADES) as GradeSystem[]).filter((sys) =>
    blocks.some((b) => b.gradeSystem === sys),
  );
  const mostUsed =
    systemsUsed.length > 1 &&
    blocks.filter((b) => b.gradeSystem === 'v').length > blocks.filter((b) => b.gradeSystem === 'font').length
      ? 'v'
      : (systemsUsed[0] ?? 'font');
  const system = systemChoice ?? mostUsed;

  const stats = useMemo(() => {
    const ladder = GRADES[system];
    const sent = inPeriod.filter(isSent);
    const inSystem = sent.filter((b) => b.gradeSystem === system);
    const best = inSystem.reduce<number>((m, b) => Math.max(m, ladder.indexOf(b.grade)), -1);
    const counts = ladder.map((g) => inSystem.filter((b) => b.grade === g).length);
    const first = counts.findIndex((n) => n > 0);
    const last = counts.length - 1 - [...counts].reverse().findIndex((n) => n > 0);
    const pyramid =
      first === -1 ? [] : ladder.slice(first, last + 1).map((g, i) => ({ grade: g, n: counts[first + i] }));
    const profiles = STYLES.map((st) => {
      const all = inPeriod.filter((b) => b.styles.includes(st));
      return { name: st, total: all.length, sent: all.filter(isSent).length };
    }).filter((p) => p.total > 0);
    return {
      sent: sent.length,
      flash: inPeriod.filter((b) => b.result === 'flash').length,
      projects: inPeriod.filter((b) => b.result === 'project').length,
      best: best >= 0 ? ladder.at(best)! : '–',
      pyramid: [...pyramid].reverse(),
      maxCount: Math.max(1, ...pyramid.map((p) => p.n)),
      profiles,
    };
  }, [inPeriod, system]);

  if (blocks.length === 0) {
    return (
      <View style={s.container}>
        <Empty text={'Pas encore de progression à afficher.\nAjoute tes blocs dans l\'onglet Blocs.'} />
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Segmented
        options={[
          { value: '30', label: '30 derniers jours' },
          { value: 'all', label: 'Depuis le début' },
        ]}
        value={period}
        onChange={setPeriod}
      />
      {systemsUsed.length > 1 && (
        <Segmented
          options={systemsUsed.map((sys) => ({ value: sys, label: GRADE_SYSTEM_LABELS[sys] }))}
          value={system}
          onChange={setSystemChoice}
        />
      )}

      <View style={s.tiles}>
        <Tile label="Meilleur bloc" value={stats.best} highlight />
        <Tile label="Réussis" value={String(stats.sent)} />
        <Tile label="Flashs" value={String(stats.flash)} />
        <Tile label="En projet" value={String(stats.projects)} />
      </View>

      <Section title="Blocs réussis par cotation">
        {stats.pyramid.length === 0 ? (
          <Text style={s.muted}>Aucun bloc réussi sur cette période.</Text>
        ) : (
          stats.pyramid.map((p) => (
            <View key={p.grade} style={s.barRow}>
              <Text style={s.barLabel}>{p.grade}</Text>
              <View style={s.barTrack}>
                {p.n > 0 && <View style={[s.bar, { width: `${(p.n / stats.maxCount) * 100}%` }]} />}
              </View>
              <Text style={s.barValue}>{p.n}</Text>
            </View>
          ))
        )}
      </Section>

      {stats.profiles.length > 0 && (
        <Section title="Réussite par profil">
          {stats.profiles.map((p) => (
            <View key={p.name} style={s.barRow}>
              <Text style={[s.barLabel, { width: 72 }]}>{p.name}</Text>
              <View style={s.barTrack}>
                <View style={[s.bar, { width: `${(p.sent / p.total) * 100}%` }]} />
              </View>
              <Text style={[s.barValue, { width: 64 }]}>
                {p.sent}/{p.total}
              </Text>
            </View>
          ))}
        </Section>
      )}
    </ScrollView>
  );
}

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[s.tile, highlight && s.tileHighlight]}>
      <Text style={[s.tileValue, highlight && { color: colors.primary }]}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  muted: { color: colors.muted },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    gap: 2,
  },
  tileHighlight: { backgroundColor: colors.primarySoft },
  tileValue: { fontSize: 26, fontWeight: '800', color: colors.text },
  tileLabel: { color: colors.muted, fontSize: 13 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 40, fontWeight: '700', color: colors.text },
  barTrack: { flex: 1, height: 18, borderRadius: 9, backgroundColor: colors.surface, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 9, backgroundColor: colors.primary },
  barValue: { width: 28, textAlign: 'right', color: colors.muted, fontVariant: ['tabular-nums'] },
});
