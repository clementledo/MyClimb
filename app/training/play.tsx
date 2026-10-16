import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseAnim } from '@/components/ExerciseAnim';
import { hasTimer, TimerView } from '@/components/HoldTimer';
import { TrainingDone } from '@/components/TrainingDone';
import { Button, Card, Empty, Icon } from '@/components/ui';
import { afterSession } from '@/lib/coach';
import { HAS_ANIMATION } from '@/lib/exercisePoses';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';
import { animOf, CATS, doseText, isStretch, LEVELS, sessionById, sessionItems, sessionMinutes, type Lv } from '@/lib/training';

/** Lecteur de séance : une étape à la fois, avec l'animation et le minuteur. */
export default function PlayScreen() {
  const p = useLocalSearchParams<{ id: string; level?: string }>();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const session = sessionById(String(p.id));
  const level = (Math.min(3, Math.max(1, Number(p.level) || 2)) as Lv);
  const [index, setIndex] = useState(0);
  const [timing, setTiming] = useState(false);
  const [finish, setFinish] = useState(false);
  if (!session) return <Empty icon="error" text="Séance introuvable." />;
  const items = sessionItems(session, level);
  const it = items[index];
  const last = index === items.length - 1;
  const go = (i: number) => {
    setTiming(false);
    if (i >= items.length) setFinish(true);
    else setIndex(Math.max(0, i));
  };

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: session.name }} />
      <View style={s.progress}>
        {items.map((_, i) => (
          <View key={i} style={[s.seg, i <= index && { backgroundColor: colors.primary }]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 120 }]}>
        <Text style={s.over}>
          ÉTAPE {index + 1}/{items.length}
        </Text>
        {it.kind === 'free' ? (
          <>
            <View style={s.iconBig}>
              <Icon name={it.icon} size={44} color={colors.primary} />
            </View>
            <Text style={s.title}>{it.title}</Text>
            <Text style={s.dose}>{it.minutes} min</Text>
            <Card>
              <Text style={s.body}>{it.detail}</Text>
            </Card>
          </>
        ) : timing && hasTimer(it.dose) ? (
          <>
            <Text style={s.title}>{it.exercise.name}</Text>
            <TimerView title={it.exercise.name} dose={it.dose} anim={animOf(it.exercise)} closeLabel={last ? 'Terminer' : 'Exercice suivant'} onClose={() => go(index + 1)} />
          </>
        ) : (
          <>
            {HAS_ANIMATION(animOf(it.exercise)) && (
              <View style={s.anim}>
                <ExerciseAnim id={animOf(it.exercise)} size={200} />
              </View>
            )}
            <Text style={s.title}>{it.exercise.name}</Text>
            <Text style={s.dose}>{doseText(it.dose)}</Text>
            {(it.note || it.exercise.notes?.[it.level - 1]) && <Text style={s.note}>{it.note ?? it.exercise.notes?.[it.level - 1]}</Text>}
            <Card style={{ gap: space.sm }}>
              <Text style={s.body}>{it.exercise.how}</Text>
              {it.exercise.cues.map((c) => (
                <View key={c} style={s.cue}>
                  <Icon name="check" size={16} color={colors.success} />
                  <Text style={[s.small, { flex: 1 }]}>{c}</Text>
                </View>
              ))}
            </Card>
            {it.exercise.warning && <Text style={[s.small, { color: colors.danger }]}>{it.exercise.warning}</Text>}
          </>
        )}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: bottom + space.md }]}>
        {it.kind === 'ex' && hasTimer(it.dose) && !timing ? (
          <Button label="Lancer le minuteur" icon="timer" onPress={() => setTiming(true)} />
        ) : (
          !timing && <Button label={last ? 'Terminer la séance' : it.kind === 'free' ? 'Suivant' : 'C’est fait, suivant'} icon={last ? 'flag' : 'arrow_forward'} onPress={() => go(index + 1)} />
        )}
        <View style={s.row}>
          <Button label="Précédent" variant="ghost" size="sm" icon="arrow_back" disabled={index === 0} onPress={() => go(index - 1)} style={{ flex: 1 }} />
          <Button label="Passer" variant="ghost" size="sm" icon="skip_next" onPress={() => go(index + 1)} style={{ flex: 1 }} />
        </View>
      </View>
      <TrainingDone
        visible={finish}
        onClose={() => setFinish(false)}
        entry={{ kind: isStretch(session) ? 'routine' : 'session', ref: session.id, name: session.name, minutes: sessionMinutes(session, level), intensity: session.intensity }}
        onSaved={(feel) => {
          setFinish(false);
          const up = isStretch(session) ? null : afterSession(session.cat, level, feel);
          if (up) Alert.alert('Niveau supérieur !', `Deux séances faciles de suite : tu passes au niveau ${LEVELS[up]} en ${CATS[session.cat].label.toLowerCase()}.`);
          router.back();
        }}
      />
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1, backgroundColor: colors.background },
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: space.lg, paddingTop: space.md },
  seg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.surface },
  content: { padding: space.lg, gap: space.md, alignItems: 'stretch' },
  over: { ...type.overline, textAlign: 'center' },
  iconBig: { alignSelf: 'center', width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  anim: { alignSelf: 'center', width: 210, height: 210, borderRadius: radius.lg, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, textAlign: 'center' },
  dose: { fontSize: 18, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  note: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  small: { fontSize: 14, color: colors.text, lineHeight: 20 },
  cue: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row', gap: space.sm },
});
