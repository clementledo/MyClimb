import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HoldTimer, hasTimer } from '@/components/HoldTimer';
import { TrainingDone } from '@/components/TrainingDone';
import { Badge, Banner, Button, Empty, Icon, IconButton, ListRow, Section } from '@/components/ui';
import { listTrainingLogs } from '@/lib/db';
import { todayIso } from '@/lib/stats';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';
import { exerciseById, ROUTINE_KINDS, type Exercise } from '@/lib/training';
import { findRoutine, isCustomRoutine, routineChecks, setRoutineChecks } from '@/lib/trainingPlan';

export default function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const [version, setVersion] = useState(0);
  // Relue à chaque retour sur l'écran : une routine perso a pu être modifiée.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const routine = useMemo(() => findRoutine(String(id)), [id, version]);
  const [timer, setTimer] = useState<Exercise | null>(null);
  const [checked, setChecked] = useState<string[]>(() => routineChecks(String(id)));
  const [sheet, setSheet] = useState(false);
  const [doneToday, setDoneToday] = useState(false);
  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    setDoneToday(listTrainingLogs().some((l) => l.kind === 'routine' && l.ref === String(id) && l.date === todayIso()));
  }, [id]);
  useFocusEffect(refresh);
  if (!routine) return <Empty icon="error" text="Routine introuvable." />;

  const toggle = (x: string) => {
    const next = checked.includes(x) ? checked.filter((c) => c !== x) : [...checked, x];
    setChecked(next);
    setRoutineChecks(routine.id, next);
  };
  const count = routine.items.filter((x) => checked.includes(x)).length;
  const all = count === routine.items.length;

  return (
    <View style={s.container}>
      <Stack.Screen
        options={{
          title: routine.name,
          headerRight: isCustomRoutine(routine.id)
            ? () => (
                <IconButton icon="edit" label="Modifier la routine" onPress={() => router.push(`/training/routine-edit?id=${routine.id}`)} />
              )
            : undefined,
        }}
      />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.head}>
          <View style={s.icon}>
            <Icon name={routine.icon} size={30} color={colors.primary} />
          </View>
          <Text style={s.title}>{routine.name}</Text>
          <Text style={s.goal}>{routine.goal}</Text>
          <View style={s.badges}>
            <Badge label={`${routine.minutes} min`} tone="neutral" />
            <Badge label={ROUTINE_KINDS[routine.kind].label} tone={routine.kind === 'souplesse' ? 'success' : 'primary'} />
            <Badge label={routine.when} tone="neutral" />
          </View>
        </View>

        {doneToday && <Banner tone="success" icon="check_circle" title="Faite aujourd’hui" text="Bravo, à demain !" />}

        <Section title={`Exercices · ${count}/${routine.items.length}`}>
          <View style={s.listCard}>
            {routine.items.map((xid, i, arr) => {
              const x = exerciseById(xid);
              if (!x) return null;
              const on = checked.includes(xid);
              return (
                <ListRow
                  key={xid}
                  left={
                    <Pressable onPress={() => toggle(xid)} hitSlop={10} accessibilityLabel={`Cocher ${x.name}`}>
                      <Icon name={on ? 'check_circle' : 'radio_button_unchecked'} size={28} color={on ? colors.success : colors.muted} />
                    </Pressable>
                  }
                  title={x.name}
                  subtitle={x.doseText}
                  right={
                    hasTimer(x) ? (
                      <IconButton icon="timer" label={`Minuteur ${x.name}`} onPress={() => setTimer(x)} />
                    ) : undefined
                  }
                  onPress={() => router.push(`/training/exercise/${x.id}`)}
                  last={i === arr.length - 1}
                />
              );
            })}
          </View>
          <Text style={s.hint}>Coche chaque exercice fini. Touche son nom pour voir comment le faire, ou le minuteur pour te laisser guider.</Text>
        </Section>
      </ScrollView>
      <View style={[s.bar, { paddingBottom: bottom + space.md }]}>
        <Button
          label={doneToday ? 'Refaite ? L’enregistrer encore' : all ? 'Terminer la routine' : 'Marquer comme faite'}
          icon="check"
          variant={doneToday ? 'secondary' : 'primary'}
          onPress={() => setSheet(true)}
        />
      </View>
      {timer && (
        <HoldTimer
          exercise={timer}
          onClose={() => setTimer(null)}
          onDone={() => {
            if (!checked.includes(timer.id)) toggle(timer.id);
          }}
        />
      )}
      <TrainingDone
        visible={sheet}
        onClose={() => setSheet(false)}
        onSaved={() => {
          setSheet(false);
          setChecked([]);
          setRoutineChecks(routine.id, []);
          refresh();
        }}
        entry={{ kind: 'routine', ref: routine.id, name: routine.name, minutes: routine.minutes, intensity: routine.daily ? 1 : 2 }}
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
  hint: { ...type.subhead, color: colors.muted, marginTop: space.sm },
  bar: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
});
