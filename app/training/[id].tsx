import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TrainingDone } from '@/components/TrainingDone';
import { Badge, Banner, Button, Empty, Icon, ListRow, Section } from '@/components/ui';
import { listTrainingLogs } from '@/lib/db';
import { todayIso } from '@/lib/stats';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';
import { EQUIPMENT, exerciseById, FOCUS, INTENSITY, sessionById, sessionEquipment } from '@/lib/training';
import { scaled } from '@/lib/trainingScale';

export default function SessionTypeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const session = sessionById(String(id));
  const [sheet, setSheet] = useState(false);
  const [doneToday, setDoneToday] = useState(false);
  const refresh = useCallback(() => {
    setDoneToday(listTrainingLogs().some((l) => l.ref === String(id) && l.date === todayIso()));
  }, [id]);
  useFocusEffect(refresh);
  if (!session) return <Empty icon="error" text="Séance introuvable." />;

  const eq = sessionEquipment(session);
  const warnings = session.steps
    .map((st) => (st.kind === 'exercise' ? exerciseById(st.id)?.warning : undefined))
    .filter((w): w is string => !!w);

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: session.name }} />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.head}>
          <View style={s.icon}>
            <Icon name={session.icon} size={30} color={colors.primary} />
          </View>
          <Text style={s.title}>{session.name}</Text>
          <Text style={s.goal}>{session.goal}</Text>
          <View style={s.badges}>
            <Badge label={`${session.minutes} min`} tone="neutral" />
            <Badge label={INTENSITY[session.intensity]} tone={session.intensity === 3 ? 'danger' : session.intensity === 2 ? 'primary' : 'success'} />
            <Badge label={session.where === 'salle' ? 'En salle' : 'À la maison'} tone="neutral" />
            {eq
              .filter((e) => e !== 'wall')
              .map((e) => (
                <Badge key={e} label={EQUIPMENT.find((x) => x.id === e)?.label ?? e} tone="neutral" />
              ))}
          </View>
        </View>

        {doneToday && <Banner tone="success" icon="check_circle" title="Fait aujourd’hui" text="Enregistré dans tes entraînements et dans Progression." />}

        {warnings.map((w) => (
          <Banner key={w} tone="danger" icon="warning" title="Attention" text={w} />
        ))}

        <Section title="Déroulé">
          <View style={s.listCard}>
            {session.steps.map((st, i, arr) => {
              const last = i === arr.length - 1;
              const num = (
                <View style={s.num}>
                  <Text style={s.numText}>{i + 1}</Text>
                </View>
              );
              if (st.kind === 'free') {
                return <ListRow key={i} left={num} title={st.title} subtitle={`${st.minutes} min · ${st.detail}`} last={last} />;
              }
              const found = exerciseById(st.id);
              const x = found ? scaled(found) : null;
              if (!x) return null;
              return (
                <ListRow
                  key={i}
                  left={num}
                  title={x.name}
                  subtitle={`${FOCUS[x.focus].label} · ${x.doseText}`}
                  onPress={() => router.push(`/training/exercise/${x.id}`)}
                  last={last}
                />
              );
            })}
          </View>
        </Section>
      </ScrollView>
      <View style={[s.bar, { paddingBottom: bottom + space.md }]}>
        <Button
          label={doneToday ? 'Refaite ? L’enregistrer encore' : 'Marquer comme faite'}
          icon="check"
          variant={doneToday ? 'secondary' : 'primary'}
          onPress={() => setSheet(true)}
        />
      </View>
      <TrainingDone
        visible={sheet}
        onClose={() => setSheet(false)}
        onSaved={() => {
          setSheet(false);
          refresh();
        }}
        entry={{ kind: 'session', ref: session.id, name: session.name, minutes: session.minutes, intensity: session.intensity }}
      />
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  head: { gap: space.sm },
  icon: { width: 60, height: 60, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, marginBottom: space.xs },
  title: { ...type.title },
  goal: { ...type.body, color: colors.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.xs },
  listCard: { borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  numText: { fontSize: 15, fontWeight: '800', color: colors.primary },
  bar: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
});
