import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ClimbList } from '@/components/ClimbList';
import { Legend, LineChart, RateBars, RESULT_COLORS, StackedBars, StackedColumns } from '@/components/charts';
import { Empty, Section, Segmented } from '@/components/ui';
import {
  DISCIPLINE_LABELS,
  DISCIPLINE_SYSTEMS,
  FEEL_LABELS,
  GRADE_SYSTEM_LABELS,
  type Discipline,
  type GradeSystem,
} from '@/lib/climbing';
import { listBlocks, type Block } from '@/lib/db';
import { computeStats, periodStart, type Period } from '@/lib/stats';
import { colors } from '@/lib/theme';

type Where = 'all' | 'in' | 'out';

const pct = (r: number) => `${Math.round(r * 100)} %`;
const dec = (n: number) => n.toFixed(1).replace('.', ',').replace(',0', '');

type Mode = 'stats' | 'list';

export default function ProgressionScreen() {
  const [view, setView] = useState<Mode>('stats');
  return (
    <View style={s.container}>
      <View style={s.switcher}>
        <Segmented
          options={[
            { value: 'stats', label: 'Statistiques' },
            { value: 'list', label: 'Mes grimpes' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>
      {view === 'stats' ? <StatsView /> : <ClimbList />}
    </View>
  );
}

function StatsView() {
  const { width } = useWindowDimensions();
  const chartW = width - 32;
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [discipline, setDiscipline] = useState<Discipline>('bloc');
  const [where, setWhere] = useState<Where>('all');
  const [period, setPeriod] = useState<Period>('90');
  const [systemChoice, setSystemChoice] = useState<GradeSystem | null>(null);

  useFocusEffect(useCallback(() => setBlocks(listBlocks()), []));

  const disciplines = (['bloc', 'voie'] as Discipline[]).filter((d) => blocks.some((b) => b.discipline === d));
  const current = disciplines.includes(discipline) ? discipline : (disciplines[0] ?? 'bloc');
  const ofDiscipline = blocks.filter((b) => b.discipline === current);
  const from = periodStart(period, ofDiscipline);
  const list = ofDiscipline.filter((b) => b.date >= from && (where === 'all' || b.outdoor === (where === 'out')));

  // Système de cotation : celui choisi, sinon le plus utilisé dans la discipline.
  const systemsUsed = DISCIPLINE_SYSTEMS[current].filter((sys) => ofDiscipline.some((b) => b.gradeSystem === sys));
  const count = (sys: GradeSystem) => ofDiscipline.filter((b) => b.gradeSystem === sys).length;
  const mostUsed = [...systemsUsed].sort((a, b) => count(b) - count(a))[0] ?? DISCIPLINE_SYSTEMS[current][0];
  const system = systemChoice && systemsUsed.includes(systemChoice) ? systemChoice : mostUsed;

  const st = computeStats(list, system, from);

  if (blocks.length === 0) {
    return (
      <View style={s.container}>
        <Empty
          text={'Pas encore de progression à afficher.\nDémarre une séance depuis l\'onglet Grimper.'}
        />
      </View>
    );
  }

  const kind = current === 'bloc' ? 'blocs' : 'voies';
  const unit = st.bucketUnit === 'week' ? 'semaine' : 'mois';
  const hasOutdoor = ofDiscipline.some((b) => b.outdoor);
  const resultLegend = [
    { label: current === 'bloc' ? 'Flash' : 'À vue ou flash', color: RESULT_COLORS[0] },
    { label: 'Réussi après essais', color: RESULT_COLORS[1] },
    { label: 'Pas encore', color: RESULT_COLORS[2] },
  ];
  const feelTotal = st.feel.reduce((a, b) => a + b, 0);
  const ropeTotal = [...st.rope.lead, ...st.rope.toprope].reduce((a, b) => a + b, 0);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.filters}>
        {disciplines.length > 1 && (
          <Segmented
            options={disciplines.map((d) => ({ value: d, label: `${DISCIPLINE_LABELS[d]}s` }))}
            value={current}
            onChange={setDiscipline}
          />
        )}
        {hasOutdoor && (
          <Segmented
            options={[
              { value: 'all', label: 'Partout' },
              { value: 'in', label: 'En salle' },
              { value: 'out', label: 'Extérieur' },
            ]}
            value={where}
            onChange={setWhere}
          />
        )}
        <Segmented
          options={[
            { value: '30', label: '1 mois' },
            { value: '90', label: '3 mois' },
            { value: '365', label: '1 an' },
            { value: 'all', label: 'Tout' },
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
      </View>

      {list.length === 0 ? (
        <Empty text={`Aucune grimpe en ${kind} sur cette période.`} />
      ) : (
        <>
          <View style={s.tiles}>
            <Tile label="Meilleure réussite" value={st.best ?? '–'} highlight />
            <Tile label="Niveau moyen réussi" value={st.avgGrade ?? '–'} />
            <Tile label={`${kind[0].toUpperCase()}${kind.slice(1)} essayés`} value={String(st.total)} />
            <Tile label="Réussis" value={`${st.sent} (${pct(st.successRate)})`} />
            <Tile label={current === 'bloc' ? 'Flashs' : 'À vue ou flash'} value={`${st.firstTry} (${pct(st.firstTryRate)})`} />
            <Tile label="Essais pour réussir" value={st.avgAttempts === null ? '–' : `${dec(st.avgAttempts)} en moy.`} />
            <Tile label="Séances" value={String(st.sessions)} />
            <Tile label="Grimpes par séance" value={dec(st.perSession)} />
          </View>

          {st.level.some((l) => l.max !== null) && (
            <Section title={`Évolution du niveau, par ${unit}`}>
              <LineChart
                width={chartW}
                labels={st.bucketLabels}
                series={[
                  { values: st.level.map((l) => l.max), color: colors.primary },
                  { values: st.level.map((l) => l.avg), color: '#F7A072' },
                ]}
                formatY={(v) => st.ladder[Math.round(v)] ?? ''}
              />
              <Legend
                items={[
                  { label: 'Meilleure réussite', color: colors.primary },
                  { label: 'Moyenne des 5 meilleures', color: '#F7A072' },
                ]}
              />
            </Section>
          )}

          <Section title={`Volume, par ${unit}`}>
            <StackedColumns width={chartW} labels={st.bucketLabels} stacks={st.volume} />
            <Legend items={resultLegend} />
          </Section>

          <Section title={`Séances, par ${unit}`}>
            <StackedColumns
              width={chartW}
              height={120}
              labels={st.bucketLabels}
              stacks={st.sessionsPerBucket.map((n) => [n])}
            />
          </Section>

          {st.pyramid.length > 0 && (
            <Section title="Pyramide des cotations">
              <StackedBars rows={st.pyramid} />
              <Legend items={resultLegend} />
            </Section>
          )}

          {st.attemptsByGrade.length > 0 && (
            <Section title="Essais moyens pour réussir, par cotation">
              <RateBars
                labelWidth={44}
                rows={(() => {
                  const max = Math.max(...st.attemptsByGrade.map((r) => r.avg));
                  return st.attemptsByGrade.map((r) => ({
                    label: r.label,
                    rate: r.avg / max,
                    detail: `${dec(r.avg)} essai${r.avg >= 2 ? 's' : ''}`,
                  }));
                })()}
              />
            </Section>
          )}

          <RateSection title="Réussite par profil du mur" data={st.profiles} />
          <RateSection title="Réussite par type de prises" data={st.holds} />
          <RateSection title="Réussite par mouvement" data={st.moves} />

          {feelTotal > 0 && (
            <Section title="Cotation ressentie">
              <StackedBars
                labelWidth={56}
                palette={['#2B8A3E']}
                rows={(['soft', 'fair', 'hard'] as const).map((f, i) => ({ label: FEEL_LABELS[f], parts: [st.feel[i]] }))}
              />
            </Section>
          )}

          {current === 'voie' && ropeTotal > 0 && (
            <Section title="En tête ou en moulinette">
              <StackedBars
                labelWidth={88}
                rows={[
                  { label: 'En tête', parts: st.rope.lead },
                  { label: 'Moulinette', parts: st.rope.toprope },
                ]}
              />
              <Legend items={resultLegend} />
            </Section>
          )}

          {st.places.length > 1 && (
            <Section title="Lieux les plus fréquentés">
              <StackedBars labelWidth={120} rows={st.places} />
            </Section>
          )}
        </>
      )}
    </ScrollView>
  );
}

function RateSection({
  title,
  data,
}: {
  title: string;
  data: { rows: { label: string; rate: number; detail: string }[]; weakest: string | null };
}) {
  if (data.rows.length === 0) return null;
  return (
    <Section title={title}>
      <RateBars rows={data.rows} highlight={data.weakest} />
      {data.weakest && <Text style={s.weak}>Point faible : {data.weakest.toLowerCase()}</Text>}
    </Section>
  );
}

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[s.tile, highlight && s.tileHighlight]}>
      <Text style={[s.tileValue, highlight && { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 24, paddingBottom: 40 },
  filters: { gap: 8 },
  switcher: { paddingHorizontal: 16, paddingTop: 12 },
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
  tileValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  tileLabel: { color: colors.muted, fontSize: 13 },
  weak: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
