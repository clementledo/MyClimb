import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseAnim } from '@/components/ExerciseAnim';
import { HoldTimer, hasTimer } from '@/components/HoldTimer';
import { Badge, Banner, Button, Card, Empty, Icon, Section, Segmented } from '@/components/ui';
import { levelOf } from '@/lib/coach';
import { HAS_ANIMATION } from '@/lib/exercisePoses';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';
import { animOf, CATS, doseSeconds, doseText, exerciseById, formatSeconds, LEVELS, levelFor, WHERE, ZONES, type Lv } from '@/lib/training';

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bottom } = useSafeAreaInsets();
  const x = exerciseById(String(id));
  const [level, setLevel] = useState<Lv>(() => (x ? levelFor(x, levelOf(x.cat)) : 1));
  const [timer, setTimer] = useState(false);
  if (!x) return <Empty icon="error" text="Exercice introuvable." />;
  const dose = x.levels[level - 1];
  const note = x.notes?.[level - 1];

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: x.name }} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 100 }]}>
        <View style={s.head}>
          {HAS_ANIMATION(animOf(x)) ? (
            <View style={s.anim} accessibilityLabel={`Animation : ${x.name}`}>
              <ExerciseAnim id={animOf(x)} size={210} />
            </View>
          ) : (
            <View style={s.icon}>
              <Icon name={CATS[x.cat].icon} size={30} color={colors.primary} />
            </View>
          )}
          <Text style={s.title}>{x.name}</Text>
          <Text style={s.goal}>{x.goal}</Text>
          <View style={s.badges}>
            <Badge label={x.zone ? ZONES[x.zone].label : CATS[x.cat].label} />
            <Badge label={WHERE[x.where].label} tone="neutral" />
          </View>
        </View>

        {x.warning && <Banner tone="danger" icon="warning" title="Attention" text={x.warning} />}

        <Section title="Niveau">
          <Segmented
            options={([1, 2, 3] as Lv[]).filter((l) => x.levels[l - 1]).map((l) => ({ value: String(l), label: LEVELS[l] }))}
            value={String(level)}
            onChange={(v) => setLevel(Number(v) as Lv)}
          />
          {dose && (
            <Card style={s.dose}>
              <Text style={s.doseText}>{doseText(dose)}</Text>
              {note ? <Text style={s.muted}>{note}</Text> : null}
              <Text style={s.muted}>Environ {formatSeconds(doseSeconds(dose))} avec les repos</Text>
            </Card>
          )}
        </Section>

        <Section title="Comment faire">
          <Card>
            <Text style={s.body}>{x.how}</Text>
          </Card>
        </Section>

        <Section title="Points clés">
          <Card style={{ gap: space.sm }}>
            {x.cues.map((c) => (
              <View key={c} style={s.cue}>
                <Icon name="check" size={18} color={colors.success} />
                <Text style={[s.body, { flex: 1 }]}>{c}</Text>
              </View>
            ))}
          </Card>
        </Section>
        {x.source && <Text style={s.muted}>Source : {x.source}</Text>}
      </ScrollView>
      {dose && hasTimer(dose) && (
        <View style={[s.footer, { paddingBottom: bottom + space.md }]}>
          <Button label="Lancer le minuteur" icon="timer" onPress={() => setTimer(true)} />
        </View>
      )}
      {timer && dose && <HoldTimer title={x.name} dose={dose} anim={animOf(x)} onClose={() => setTimer(false)} />}
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg },
  head: { alignItems: 'center', gap: space.sm },
  anim: { width: 220, height: 220, borderRadius: radius.lg, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, textAlign: 'center' },
  goal: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  badges: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  dose: { gap: 4, marginTop: space.sm },
  doseText: { fontSize: 18, fontWeight: '800', color: colors.text },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  cue: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
});
