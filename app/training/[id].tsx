import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseAnim } from '@/components/ExerciseAnim';
import { Badge, Banner, Button, Card, Empty, Icon, ListRow, Section, Segmented } from '@/components/ui';
import { levelOf } from '@/lib/coach';
import { listTrainingLogs } from '@/lib/db';
import { HAS_ANIMATION } from '@/lib/exercisePoses';
import { todayIso } from '@/lib/stats';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';
import { animOf, CATS, doseText, isStretch, LEVELS, sessionById, sessionItems, sessionMinutes, WHERE, ZONES, type Lv } from '@/lib/training';

const STRETCH_LEVELS = ['', 'Doux', 'Normal', 'Profond'];

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const session = sessionById(String(id));
  const [level, setLevel] = useState<Lv>(() => (session ? levelOf(session.cat) : 2));
  const [doneToday, setDoneToday] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setDoneToday(listTrainingLogs().some((l) => l.ref === String(id) && l.date === todayIso()));
    }, [id]),
  );
  if (!session) return <Empty icon="error" text="Séance introuvable." />;
  const stretch = isStretch(session);
  const items = sessionItems(session, level);
  const names = stretch ? STRETCH_LEVELS : LEVELS;

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: stretch ? 'Routine' : 'Séance' }} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 100 }]}>
        <View style={s.head}>
          <View style={s.icon}>
            <Icon name={session.icon} size={30} color={colors.primary} />
          </View>
          <Text style={s.title}>{session.name}</Text>
          <Text style={s.goal}>{session.goal}</Text>
          <View style={s.badges}>
            <Badge label={`${sessionMinutes(session, level)} min`} />
            <Badge label={session.zone && session.zone !== 'tout' ? ZONES[session.zone].label : CATS[session.cat].label} tone="neutral" />
            <Badge label={WHERE[session.where].label} tone="neutral" />
          </View>
        </View>

        {doneToday && <Banner tone="success" icon="check_circle" title="Faite aujourd’hui" text="Enregistrée dans tes entraînements." />}

        <Section title={stretch ? 'Intensité' : 'Niveau'}>
          <Segmented options={([1, 2, 3] as Lv[]).map((l) => ({ value: String(l), label: names[l] }))} value={String(level)} onChange={(v) => setLevel(Number(v) as Lv)} />
          {!stretch && level === levelOf(session.cat) && <Text style={s.muted}>C’est ton niveau actuel en {CATS[session.cat].label.toLowerCase()}. Il monte après deux séances notées « Facile ».</Text>}
        </Section>

        <Section title={`Déroulé · ${items.length} étapes`}>
          <Card style={{ paddingVertical: 0 }}>
            {items.map((it, i) =>
              it.kind === 'free' ? (
                <ListRow key={`f${i}`} icon={it.icon} title={it.title} subtitle={`${it.minutes} min · ${it.detail}`} last={i === items.length - 1} />
              ) : (
                <ListRow
                  key={`${it.exercise.id}${i}`}
                  left={HAS_ANIMATION(animOf(it.exercise)) ? <ExerciseAnim id={animOf(it.exercise)} size={44} playing={false} /> : undefined}
                  icon={CATS[it.exercise.cat].icon}
                  title={it.exercise.name}
                  subtitle={`${doseText(it.dose)}${it.note ? ` · ${it.note}` : ''}`}
                  onPress={() => router.push(`/training/exercise/${it.exercise.id}`)}
                  last={i === items.length - 1}
                />
              ),
            )}
          </Card>
        </Section>
        {session.source && <Text style={s.muted}>Inspiré de : {session.source}</Text>}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: bottom + space.md }]}>
        <Button label={stretch ? 'Commencer la routine' : 'Commencer la séance'} icon="play_arrow" onPress={() => router.push(`/training/play?id=${session.id}&level=${level}`)} />
      </View>
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg },
  head: { alignItems: 'center', gap: space.sm },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, textAlign: 'center' },
  goal: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  badges: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: space.sm },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border, borderRadius: radius.sm },
});
