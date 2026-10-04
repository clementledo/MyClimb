import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { ClimbList } from '@/components/ClimbList';
import { Legend, LineChart, mix, RateBars, resultColors, StackedBars, StackedColumns } from '@/components/charts';
import { Card, Chip, Empty, Icon, Segmented, Sheet, Stat } from '@/components/ui';
import {
  DISCIPLINE_LABELS,
  DISCIPLINE_SYSTEMS,
  FEEL_LABELS,
  GRADE_SYSTEM_LABELS,
  type Discipline,
  type GradeSystem,
} from '@/lib/climbing';
import { listBlocks, listTrainingLogs, type Block, type TrainingLog } from '@/lib/db';
import { computeStats, periodStart, type Period } from '@/lib/stats';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

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
            { value: 'stats', label: 'Statistiques', icon: 'insights' },
            { value: 'list', label: 'Mes grimpes', icon: 'format_list_bulleted' },
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
  // Largeur des graphiques : écran moins les marges de la page et des cartes.
  const chartW = width - 2 * space.lg - 2 * space.lg;
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [discipline, setDiscipline] = useState<Discipline>('bloc');
  const [where, setWhere] = useState<Where>('all');
  const [period, setPeriod] = useState<Period>('90');
  const [systemChoice, setSystemChoice] = useState<GradeSystem | null>(null);
  const [sheet, setSheet] = useState(false);

  const [logs, setLogs] = useState<TrainingLog[]>([]);
  useFocusEffect(
    useCallback(() => {
      setBlocks(listBlocks());
      setLogs(listTrainingLogs());
    }, []),
  );

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

  const training = <TrainingCard logs={logs} from={period === 'all' ? '' : from} />;

  if (blocks.length === 0) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Empty
          icon="insights"
          title="Pas encore de statistiques"
          text="Note tes grimpes pendant tes séances : ta progression s'affichera ici."
        />
        {training}
      </ScrollView>
    );
  }

  const kind = current === 'bloc' ? 'blocs' : 'voies';
  const unit = st.bucketUnit === 'week' ? 'semaine' : 'mois';
  const hasOutdoor = ofDiscipline.some((b) => b.outdoor);
  const resultLegend = [
    { label: current === 'bloc' ? 'Flash' : 'À vue ou flash', color: resultColors()[0] },
    { label: 'Réussi après essais', color: resultColors()[1] },
    { label: 'Pas encore', color: resultColors()[2] },
  ];
  const feelTotal = st.feel.reduce((a, b) => a + b, 0);
  const ropeTotal = [...st.rope.lead, ...st.rope.toprope].reduce((a, b) => a + b, 0);

  const whereLabel = where === 'all' ? 'partout' : where === 'in' ? 'en salle' : 'en extérieur';
  const summary = `${DISCIPLINE_LABELS[current]}s ${whereLabel} · ${GRADE_SYSTEM_LABELS[system]}`;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.filters}>
        <Pressable style={s.summary} onPress={() => setSheet(true)} accessibilityLabel="Filtres">
          <Icon name="tune" size={18} color={colors.primary} />
          <Text style={s.summaryText} numberOfLines={1}>
            {summary}
          </Text>
          <Icon name="expand_more" size={18} color={colors.muted} />
        </Pressable>
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
      </View>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Filtres">
        <View style={s.group}>
          <Text style={s.groupTitle}>Discipline</Text>
          <View style={s.chips}>
            {(['bloc', 'voie'] as Discipline[]).map((d) => (
              <Chip
                key={d}
                label={`${DISCIPLINE_LABELS[d]}s`}
                selected={current === d}
                onPress={() => disciplines.includes(d) && setDiscipline(d)}
              />
            ))}
          </View>
        </View>
        {hasOutdoor && (
          <View style={s.group}>
            <Text style={s.groupTitle}>Où</Text>
            <View style={s.chips}>
              <Chip label="Partout" selected={where === 'all'} onPress={() => setWhere('all')} />
              <Chip label="En salle" selected={where === 'in'} onPress={() => setWhere('in')} />
              <Chip label="Extérieur" selected={where === 'out'} onPress={() => setWhere('out')} />
            </View>
          </View>
        )}
        {systemsUsed.length > 1 && (
          <View style={s.group}>
            <Text style={s.groupTitle}>Cotation</Text>
            <View style={s.chips}>
              {systemsUsed.map((sys) => (
                <Chip key={sys} label={GRADE_SYSTEM_LABELS[sys]} selected={system === sys} onPress={() => setSystemChoice(sys)} />
              ))}
            </View>
          </View>
        )}
      </Sheet>

      {list.length === 0 ? (
        <>
          <Empty icon="event_busy" text={`Aucune grimpe en ${kind} sur cette période.`} />
          {training}
        </>
      ) : (
        <>
          <View style={s.hero}>
            <View style={s.heroMain}>
              <Text style={s.heroLabel}>Meilleure réussite</Text>
              <Text style={s.heroValue}>{st.best ?? '–'}</Text>
            </View>
            <View style={s.heroSide}>
              <Text style={s.heroLabel}>Niveau moyen</Text>
              <Text style={s.heroSideValue}>{st.avgGrade ?? '–'}</Text>
            </View>
          </View>

          <Card style={s.statsCard}>
            <Stat label={`${kind[0].toUpperCase()}${kind.slice(1)} essayés`} value={String(st.total)} />
            <Stat label={`Réussis · ${pct(st.successRate)}`} value={String(st.sent)} />
            <Stat
              label={`${current === 'bloc' ? 'Flashs' : 'À vue ou flash'} · ${pct(st.firstTryRate)}`}
              value={String(st.firstTry)}
            />
            <Stat label="Essais pour réussir, en moyenne" value={st.avgAttempts === null ? '–' : dec(st.avgAttempts)} />
            <Stat label="Séances" value={String(st.sessions)} />
            <Stat label="Grimpes par séance" value={dec(st.perSession)} />
          </Card>

          {training}

          {st.level.some((l) => l.max !== null) && (
            <ChartCard title={`Évolution du niveau, par ${unit}`}>
              <LineChart
                width={chartW}
                labels={st.bucketLabels}
                series={[
                  { values: st.level.map((l) => l.max), color: colors.primary },
                  { values: st.level.map((l) => l.avg), color: mix(colors.primary, colors.card, 0.45) },
                ]}
                formatY={(v) => st.ladder[Math.round(v)] ?? ''}
              />
              <Legend
                items={[
                  { label: 'Meilleure réussite', color: colors.primary },
                  { label: 'Moyenne des 5 meilleures', color: mix(colors.primary, colors.card, 0.45) },
                ]}
              />
            </ChartCard>
          )}

          <ChartCard title={`Volume, par ${unit}`}>
            <StackedColumns width={chartW} labels={st.bucketLabels} stacks={st.volume} />
            <Legend items={resultLegend} />
          </ChartCard>

          <ChartCard title={`Séances, par ${unit}`}>
            <StackedColumns
              width={chartW}
              height={120}
              labels={st.bucketLabels}
              stacks={st.sessionsPerBucket.map((n) => [n])}
            />
          </ChartCard>

          {st.pyramid.length > 0 && (
            <ChartCard title="Pyramide des cotations">
              <StackedBars rows={st.pyramid} />
              <Legend items={resultLegend} />
            </ChartCard>
          )}

          {st.attemptsByGrade.length > 0 && (
            <ChartCard title="Essais moyens pour réussir, par cotation">
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
            </ChartCard>
          )}

          <RateSection title="Réussite par profil du mur" data={st.profiles} />
          <RateSection title="Réussite par type de prises" data={st.holds} />
          <RateSection title="Réussite par mouvement" data={st.moves} />

          {feelTotal > 0 && (
            <ChartCard title="Cotation ressentie">
              <StackedBars
                labelWidth={56}
                palette={[colors.success]}
                rows={(['soft', 'fair', 'hard'] as const).map((f, i) => ({ label: FEEL_LABELS[f], parts: [st.feel[i]] }))}
              />
            </ChartCard>
          )}

          {current === 'voie' && ropeTotal > 0 && (
            <ChartCard title="En tête ou en moulinette">
              <StackedBars
                labelWidth={88}
                rows={[
                  { label: 'En tête', parts: st.rope.lead },
                  { label: 'Moulinette', parts: st.rope.toprope },
                ]}
              />
              <Legend items={resultLegend} />
            </ChartCard>
          )}

          {st.places.length > 1 && (
            <ChartCard title="Lieux les plus fréquentés">
              <StackedBars labelWidth={120} rows={st.places} />
            </ChartCard>
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
    <ChartCard title={title}>
      <RateBars rows={data.rows} highlight={data.weakest} />
      {data.weakest && (
        <View style={s.weakRow}>
          <Icon name="trending_down" size={16} color={colors.danger} />
          <Text style={s.weak}>Point faible : {data.weakest.toLowerCase()}</Text>
        </View>
      )}
    </ChartCard>
  );
}

/** Entraînements faits sur la période (séances types et renforcement). */
function TrainingCard({ logs, from }: { logs: TrainingLog[]; from: string }) {
  const router = useRouter();
  const list = logs.filter((l) => l.date >= from);
  if (logs.length === 0) return null;
  const minutes = list.reduce((a, l) => a + l.minutes, 0);
  const first = list.reduce((m, l) => (l.date < m ? l.date : m), list[0]?.date ?? '');
  const weeks = first ? Math.max(1, (Date.parse(list[0].date) - Date.parse(first)) / (7 * 86400000) + 1) : 1;
  const counts = new Map<string, number>();
  list.forEach((l) => counts.set(l.name, (counts.get(l.name) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <ChartCard title="Entraînement">
      {list.length === 0 ? (
        <Text style={s.muted}>Aucun entraînement sur cette période.</Text>
      ) : (
        <>
          <View style={s.statsRow}>
            <Stat label="Séances types" value={String(list.filter((l) => l.kind === 'session').length)} />
            <Stat label="Exercices de renforcement" value={String(list.filter((l) => l.kind === 'exercise').length)} />
            <Stat label="Temps total" value={minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`} />
            <Stat label="Entraînements par semaine" value={dec(list.length / Math.ceil(weeks))} />
          </View>
          <StackedBars labelWidth={130} palette={[colors.primary]} rows={top.map(([label, n]) => ({ label, parts: [n] }))} />
        </>
      )}
      <Pressable style={s.link} onPress={() => router.push('/entrainement')} accessibilityLabel="Voir l’entraînement">
        <Text style={s.linkText}>Voir mes entraînements</Text>
        <Icon name="arrow_forward" size={16} color={colors.primary} />
      </Pressable>
    </ChartCard>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card style={s.chartCard}>
      <Text style={s.chartTitle}>{title}</Text>
      {children}
    </Card>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: 40, gap: space.md },
  switcher: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.md },
  filters: { gap: space.sm, marginBottom: space.xs },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  summaryText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  group: { gap: space.sm },
  groupTitle: { ...type.callout },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  heroMain: { flex: 1, gap: 2 },
  heroSide: { alignItems: 'flex-end', gap: 2 },
  heroLabel: { fontSize: 13, fontWeight: '600', color: colors.onPrimary, opacity: 0.85 },
  heroValue: { fontSize: 48, fontWeight: '800', letterSpacing: -1.5, color: colors.onPrimary },
  heroSideValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: colors.onPrimary },
  statsCard: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg, columnGap: space.md },
  chartCard: { gap: space.md },
  chartTitle: { ...type.headline },
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weak: { fontSize: 13, fontWeight: '600', color: colors.danger },
  muted: { ...type.body, color: colors.muted },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg, columnGap: space.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
