import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TrainingDone } from '@/components/TrainingDone';
import { Badge, Banner, Button, Card, Empty, Icon, Section } from '@/components/ui';
import { listTrainingLogs } from '@/lib/db';
import { todayIso } from '@/lib/stats';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';
import { EQUIPMENT, exerciseById, exerciseMinutes, exerciseSeconds, FOCUS, formatSeconds, LEVELS } from '@/lib/training';

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bottom } = useSafeAreaInsets();
  const x = exerciseById(String(id));
  const [sheet, setSheet] = useState(false);
  const [doneToday, setDoneToday] = useState(false);
  const refresh = useCallback(() => {
    setDoneToday(listTrainingLogs().some((l) => l.ref === String(id) && l.date === todayIso()));
  }, [id]);
  useFocusEffect(refresh);
  if (!x) return <Empty icon="error" text="Exercice introuvable." />;
  const secs = exerciseSeconds(x.dose);

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: x.name }} />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.head}>
          <View style={s.icon}>
            <Icon name={FOCUS[x.focus].icon} size={30} color={colors.primary} />
          </View>
          <Text style={s.title}>{x.name}</Text>
          <Text style={s.goal}>{x.goal}</Text>
          <View style={s.badges}>
            <Badge label={FOCUS[x.focus].label} />
            <Badge label={LEVELS[x.level]} tone={x.level === 3 ? 'danger' : x.level === 2 ? 'primary' : 'success'} />
            <Badge label={EQUIPMENT.find((e) => e.id === x.equipment)?.label ?? ''} tone="neutral" />
          </View>
        </View>

        {doneToday && <Banner tone="success" icon="check_circle" title="Fait aujourd’hui" text="Enregistré dans tes entraînements et dans Progression." />}

        {x.warning && <Banner tone="danger" icon="warning" title="Attention" text={x.warning} />}

        <Card style={s.dose}>
          <Icon name="timer" size={22} color={colors.primary} />
          <View style={s.doseBody}>
            <Text style={s.doseText}>{x.doseText}</Text>
            {x.dose.sides && <Text style={s.muted}>De chaque côté</Text>}
            {secs > 0 && <Text style={s.muted}>Environ {formatSeconds(secs)} avec les repos</Text>}
          </View>
        </Card>

        <Section title="Comment faire">
          <Card>
            <Text style={s.body}>{x.how}</Text>
          </Card>
        </Section>

        <Section title="Points clés">
          <Card style={s.cues}>
            {x.cues.map((c) => (
              <View key={c} style={s.cue}>
                <Icon name="check_circle" size={18} color={colors.success} />
                <Text style={s.cueText}>{c}</Text>
              </View>
            ))}
          </Card>
        </Section>
      </ScrollView>
      <View style={[s.bar, { paddingBottom: bottom + space.md }]}>
        <Button
          label={doneToday ? 'Refait ? L’enregistrer encore' : 'Marquer comme fait'}
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
        entry={{ kind: 'exercise', ref: x.id, name: x.name, minutes: exerciseMinutes(x), intensity: Math.min(3, x.level) }}
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
  dose: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  doseBody: { flex: 1, gap: 2 },
  doseText: { ...type.headline },
  muted: { ...type.subhead, color: colors.muted },
  body: { ...type.body },
  cues: { gap: space.md },
  cue: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  cueText: { flex: 1, ...type.body },
  bar: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
});
