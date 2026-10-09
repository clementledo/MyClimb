import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import Games from '@/components/Games';
import { Badge, Button, Card, Chip, Empty, Icon, IconButton, ListRow, Section, Segmented, Sheet } from '@/components/ui';
import { FEEL_LABELS } from '@/lib/climbing';
import { deleteTrainingLog, listBlocks, listTrainingLogs, type TrainingLog } from '@/lib/db';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';
import {
  EQUIPMENT,
  EXERCISES,
  FOCUS,
  INTENSITY,
  LEVELS,
  ROUTINE_KINDS,
  ROUTINES,
  sessionEquipment,
  SESSIONS,
  type Equipment,
  type Focus,
  type Routine,
  type RoutineKind,
  type SessionType,
} from '@/lib/training';
import {
  canDoExercise,
  canDoRoutine,
  canDoSession,
  customRoutines,
  myEquipment,
  routineOfDay,
  routineStreak,
  routineWeek,
  setMyEquipment,
  suggest,
  type RoutinePick,
  type Suggestion,
} from '@/lib/trainingPlan';
import { applyReminder, formatTime, readReminder, type Reminder } from '@/lib/reminder';
import { todayIso } from '@/lib/stats';

type Mode = 'routines' | 'sessions' | 'exercises' | 'jeux';

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function TrainingScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('routines');
  const scroll = useRef<ScrollView>(null);
  const [equipment, setEquipment] = useState<Equipment[]>(myEquipment);
  const [sheet, setSheet] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [daily, setDaily] = useState<RoutinePick | null>(null);
  const [allLogs, setAllLogs] = useState(false);
  const [mine, setMine] = useState<Routine[]>([]);
  const [reminder, setReminder] = useState<Reminder>(readReminder);
  const [draft, setDraft] = useState<Reminder | null>(null);

  const reload = useCallback(() => {
    const l = listTrainingLogs();
    const b = listBlocks();
    setLogs(l);
    setSuggestion(suggest(b, l, myEquipment()));
    setDaily(routineOfDay(b, l, myEquipment()));
    setMine(customRoutines());
  }, []);

  const saveReminder = async (r: Reminder) => {
    setDraft(null);
    try {
      const ok = await applyReminder(r);
      setReminder(ok ? r : { ...r, on: false });
      if (!ok) Alert.alert('Notifications refusées', 'Autorise les notifications de MyClimb dans les réglages d’Android pour recevoir le rappel.');
    } catch (e) {
      Alert.alert('Rappel', e instanceof Error ? e.message : String(e));
    }
  };
  useFocusEffect(reload);

  const openLog = (l: TrainingLog) =>
    Alert.alert(l.name, `${shortDate(l.date)} · ${l.minutes} min`, [
      { text: 'Fermer', style: 'cancel' },
      {
        text: 'Voir la fiche',
        onPress: () =>
          router.push(
            l.kind === 'session' ? `/training/${l.ref}` : l.kind === 'routine' ? `/training/routine/${l.ref}` : `/training/exercise/${l.ref}`,
          ),
      },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deleteTrainingLog(l.id);
          reload();
        },
      },
    ]);

  const toggle = (e: Equipment) => {
    const next = equipment.includes(e) ? equipment.filter((x) => x !== e) : [...equipment, e];
    setEquipment(next);
    setMyEquipment(next);
    setSuggestion(suggest(listBlocks(), logs, next));
    setDaily(routineOfDay(listBlocks(), logs, next));
  };

  const all = equipment.length === EQUIPMENT.length;
  const summary = all ? 'Tout le matériel' : equipment.length === 0 ? 'Poids du corps seulement' : EQUIPMENT.filter((e) => equipment.includes(e.id)).map((e) => e.label).join(', ');
  const sessions = SESSIONS.filter((x) => canDoSession(x, equipment));
  const exercises = EXERCISES.filter((x) => canDoExercise(x, equipment) && (!focus || x.focus === focus));
  const focuses = (Object.keys(FOCUS) as Focus[]).filter((f) => exercises.some((x) => x.focus === f));
  const routines = ROUTINES.filter((r) => canDoRoutine(r, equipment));
  const today = todayIso();
  const doneToday = new Set(logs.filter((l) => l.kind === 'routine' && l.date === today).map((l) => l.ref));
  const week = routineWeek(logs);
  const streak = routineStreak(logs);

  return (
    <View style={s.container}>
      <View style={s.switcher}>
        <Segmented
          options={[
            { value: 'routines', label: 'Routines' },
            { value: 'sessions', label: 'Séances' },
            { value: 'exercises', label: 'Renfo' },
            { value: 'jeux', label: 'Jeux' },
          ]}
          value={mode}
          onChange={(m) => {
            // Chaque onglet s'ouvre en haut (filtres et matériel visibles), pas au milieu de la liste précédente.
            setMode(m);
            scroll.current?.scrollTo({ y: 0, animated: false });
          }}
        />
      </View>
      {mode === 'jeux' ? (
        <Games />
      ) : (
      <ScrollView ref={scroll} contentContainerStyle={s.content}>
        <Pressable style={s.summary} onPress={() => setSheet(true)} accessibilityLabel="Matériel">
          <Icon name="tune" size={18} color={colors.primary} />
          <Text style={s.summaryText} numberOfLines={1}>
            {summary}
          </Text>
          <Icon name="expand_more" size={18} color={colors.muted} />
        </Pressable>

        <Sheet visible={draft !== null} onClose={() => setDraft(null)} title="Rappel quotidien">
          {draft && (
            <>
              <View style={s.switchRow}>
                <Text style={s.switchText}>Me rappeler ma routine chaque jour</Text>
                <Switch
                  value={draft.on}
                  onValueChange={(on) => setDraft({ ...draft, on })}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.card}
                  accessibilityLabel="Activer le rappel"
                />
              </View>
              <View style={[s.timeRow, !draft.on && s.dim]}>
                <IconButton icon="remove" label="Plus tôt" onPress={() => setDraft(shift(draft, -15))} />
                <Text style={s.time}>{formatTime(draft)}</Text>
                <IconButton icon="add" label="Plus tard" onPress={() => setDraft(shift(draft, 15))} />
              </View>
              <Button label="Enregistrer" icon="check" onPress={() => saveReminder(draft)} />
            </>
          )}
        </Sheet>

        <Sheet visible={sheet} onClose={() => setSheet(false)} title="Mon matériel">
          <Text style={s.sheetText}>Les séances et exercices s’adaptent à ce que tu as sous la main.</Text>
          <View style={s.chips}>
            {EQUIPMENT.filter((e) => e.id !== 'none').map((e) => (
              <Chip key={e.id} label={e.label} icon={e.icon} selected={equipment.includes(e.id)} onPress={() => toggle(e.id)} />
            ))}
          </View>
        </Sheet>

        {mode === 'routines' ? (
          <>
            {daily && (
              <Pressable onPress={() => router.push(`/training/routine/${daily.routine.id}`)} style={({ pressed }) => [s.hero, pressed && s.pressed]}>
                <Text style={s.heroOver}>ROUTINE DU JOUR</Text>
                <View style={s.heroHead}>
                  <View style={s.heroIcon}>
                    <Icon name={daily.routine.icon} size={26} color={colors.primary} />
                  </View>
                  <View style={s.heroBody}>
                    <Text style={s.heroTitle}>{daily.routine.name}</Text>
                    <Text style={s.heroMeta}>
                      {daily.routine.minutes} min · {daily.routine.items.length} exercices · {ROUTINE_KINDS[daily.routine.kind].label}
                    </Text>
                  </View>
                </View>
                <Text style={s.heroReason}>{doneToday.has(daily.routine.id) ? 'Faite aujourd’hui, bravo !' : daily.reason}</Text>
                <View style={s.heroCta}>
                  <Text style={s.heroCtaText}>{doneToday.has(daily.routine.id) ? 'Revoir la routine' : 'Commencer'}</Text>
                  <Icon name="arrow_forward" size={18} color={colors.onPrimary} />
                </View>
              </Pressable>
            )}

            <Card style={s.weekCard}>
              <View style={s.weekHead}>
                <Text style={s.weekTitle}>Ma semaine</Text>
                {streak > 0 && (
                  <View style={s.streak}>
                    <Icon name="local_fire_department" size={16} color={colors.primary} />
                    <Text style={s.streakText}>
                      {streak} jour{streak > 1 ? 's' : ''} d’affilée
                    </Text>
                  </View>
                )}
              </View>
              <View style={s.week}>
                {week.map((d) => (
                  <View key={d.date} style={s.day}>
                    <View style={[s.dayDot, d.done && s.dayDone, d.today && !d.done && s.dayToday]}>
                      {d.done && <Icon name="check" size={16} color={colors.onPrimary} />}
                    </View>
                    <Text style={[s.dayLetter, d.today && s.dayLetterToday]}>{d.letter}</Text>
                  </View>
                ))}
              </View>
              <Pressable style={s.reminder} onPress={() => setDraft(reminder)} accessibilityLabel="Rappel quotidien">
                <Icon name={reminder.on ? 'notifications_active' : 'notifications_off'} size={20} color={reminder.on ? colors.primary : colors.muted} />
                <Text style={s.reminderText}>Rappel quotidien</Text>
                <Text style={[s.reminderValue, reminder.on && { color: colors.primary }]}>{reminder.on ? formatTime(reminder) : 'Désactivé'}</Text>
                <Icon name="chevron_right" size={18} color={colors.muted} />
              </Pressable>
            </Card>

            <Section title="Mes routines">
              {mine.length > 0 && (
                <View style={s.listCard}>
                  {mine.map((r, i, arr) => (
                    <ListRow
                      key={r.id}
                      icon="star"
                      title={r.name}
                      subtitle={`${r.minutes} min · ${r.items.length} exercices`}
                      right={doneToday.has(r.id) ? <Badge label="Faite" tone="success" /> : undefined}
                      onPress={() => router.push(`/training/routine/${r.id}`)}
                      last={i === arr.length - 1}
                    />
                  ))}
                </View>
              )}
              <Button
                label="Créer ma routine"
                icon="add"
                variant="secondary"
                style={mine.length > 0 ? s.createBtn : undefined}
                onPress={() => router.push('/training/routine-edit')}
              />
            </Section>

            {(Object.keys(ROUTINE_KINDS) as RoutineKind[]).map((k) => {
              const list = routines.filter((r) => r.kind === k);
              if (list.length === 0) return null;
              return (
                <Section key={k} title={ROUTINE_KINDS[k].label}>
                  <View style={s.listCard}>
                    {list.map((r, i, arr) => (
                      <ListRow
                        key={r.id}
                        icon={r.icon}
                        title={r.name}
                        subtitle={`${r.minutes} min · ${r.when}`}
                        right={doneToday.has(r.id) ? <Badge label="Faite" tone="success" /> : undefined}
                        onPress={() => router.push(`/training/routine/${r.id}`)}
                        last={i === arr.length - 1}
                      />
                    ))}
                  </View>
                </Section>
              );
            })}
            {routines.length === 0 && <Empty icon="fitness_center" text="Aucune routine avec ce matériel." />}
          </>
        ) : mode === 'sessions' ? (
          <>
            {suggestion && (
              <Pressable onPress={() => router.push(`/training/${suggestion.session.id}`)} style={({ pressed }) => [s.hero, pressed && s.pressed]}>
                <Text style={s.heroOver}>POUR TOI AUJOURD’HUI</Text>
                <View style={s.heroHead}>
                  <View style={s.heroIcon}>
                    <Icon name={suggestion.session.icon} size={26} color={colors.primary} />
                  </View>
                  <View style={s.heroBody}>
                    <Text style={s.heroTitle}>{suggestion.session.name}</Text>
                    <Text style={s.heroMeta}>
                      {suggestion.session.minutes} min · {INTENSITY[suggestion.session.intensity]} · {suggestion.session.where === 'salle' ? 'En salle' : 'À la maison'}
                    </Text>
                  </View>
                </View>
                <Text style={s.heroReason}>{suggestion.reason}</Text>
                <View style={s.heroCta}>
                  <Text style={s.heroCtaText}>Voir la séance</Text>
                  <Icon name="arrow_forward" size={18} color={colors.onPrimary} />
                </View>
              </Pressable>
            )}

            <Section title="Séances types">
              {sessions.length === 0 ? (
                <Empty icon="fitness_center" text="Aucune séance avec ce matériel. Ajoute du matériel avec le bouton du haut." />
              ) : (
                sessions.map((x) => <SessionCard key={x.id} session={x} onPress={() => router.push(`/training/${x.id}`)} />)
              )}
            </Section>

            <Section title="Mes entraînements">
              {logs.length === 0 ? (
                <Card>
                  <Text style={s.muted}>Termine une routine, une séance ou un exercice avec « Marquer comme fait » : il apparaîtra ici et dans Progression.</Text>
                </Card>
              ) : (
                <View style={s.listCard}>
                  {(allLogs ? logs : logs.slice(0, 5)).map((l, i, arr) => (
                    <ListRow
                      key={l.id}
                      icon={l.kind === 'session' ? 'event_available' : l.kind === 'routine' ? 'repeat' : 'fitness_center'}
                      title={l.name}
                      subtitle={`${shortDate(l.date)} · ${l.minutes} min${l.feel ? ` · ${FEEL_LABELS[l.feel]}` : ''}`}
                      onPress={() => openLog(l)}
                      chevron={false}
                      last={i === arr.length - 1}
                    />
                  ))}
                </View>
              )}
              {logs.length > 5 && (
                <Button
                  label={allLogs ? 'Voir moins' : `Voir tout (${logs.length})`}
                  variant="ghost"
                  onPress={() => setAllLogs(!allLogs)}
                />
              )}
            </Section>
          </>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.focusRow}>
              <Chip label="Tous" selected={!focus} onPress={() => setFocus(null)} />
              {(Object.keys(FOCUS) as Focus[]).map((f) => (
                <Chip key={f} label={FOCUS[f].label} selected={focus === f} onPress={() => setFocus(f)} />
              ))}
            </ScrollView>
            {exercises.length === 0 && <Empty icon="fitness_center" text="Aucun exercice avec ce matériel." />}
            {focuses.map((f) => (
              <Section key={f} title={FOCUS[f].label}>
                <View style={s.listCard}>
                  {exercises
                    .filter((x) => x.focus === f)
                    .map((x, i, arr) => (
                      <ListRow
                        key={x.id}
                        icon={FOCUS[f].icon}
                        title={x.name}
                        subtitle={`${x.doseText} · ${LEVELS[x.level]}`}
                        onPress={() => router.push(`/training/exercise/${x.id}`)}
                        last={i === arr.length - 1}
                      />
                    ))}
                </View>
              </Section>
            ))}
          </>
        )}
      </ScrollView>
      )}
    </View>
  );
}

/** Avance ou recule l'heure du rappel par pas de 15 min, sur 24 h. */
function shift(r: Reminder, minutes: number): Reminder {
  const total = (r.hour * 60 + r.minute + minutes + 24 * 60) % (24 * 60);
  return { ...r, hour: Math.floor(total / 60), minute: total % 60 };
}

function SessionCard({ session, onPress }: { session: SessionType; onPress: () => void }) {
  const eq = sessionEquipment(session).filter((e) => e !== 'wall');
  return (
    <Card onPress={onPress} style={s.sessionCard}>
      <View style={s.sessionIcon}>
        <Icon name={session.icon} size={24} color={colors.primary} />
      </View>
      <View style={s.sessionBody}>
        <Text style={s.sessionName}>{session.name}</Text>
        <Text style={s.sessionGoal}>{session.goal}</Text>
        <View style={s.badges}>
          <Badge label={`${session.minutes} min`} tone="neutral" />
          <Badge label={INTENSITY[session.intensity]} tone={session.intensity === 3 ? 'danger' : session.intensity === 2 ? 'primary' : 'success'} />
          <Badge label={session.where === 'salle' ? 'En salle' : 'À la maison'} tone="neutral" />
          {eq.map((e) => (
            <Badge key={e} label={EQUIPMENT.find((x) => x.id === e)?.label ?? e} tone="neutral" />
          ))}
        </View>
      </View>
      <Icon name="chevron_right" size={20} color={colors.muted} />
    </Card>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  switcher: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.md },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.lg },
  pressed: { opacity: 0.85 },
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
  sheetText: { ...type.body, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  hero: { padding: space.xl, gap: space.md, borderRadius: radius.lg, backgroundColor: colors.primary },
  heroOver: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: colors.onPrimary, opacity: 0.85 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  heroBody: { flex: 1, gap: 2 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.onPrimary },
  heroMeta: { fontSize: 14, fontWeight: '600', color: colors.onPrimary, opacity: 0.85 },
  heroReason: { fontSize: 15, lineHeight: 21, color: colors.onPrimary },
  heroCta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroCtaText: { fontSize: 15, fontWeight: '700', color: colors.onPrimary },
  muted: { ...type.body, color: colors.muted },
  listCard: { borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  focusRow: { gap: space.sm, paddingRight: space.lg },
  sessionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  sessionIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  sessionBody: { flex: 1, gap: 4 },
  sessionName: { ...type.headline },
  sessionGoal: { ...type.subhead, color: colors.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  weekCard: { gap: space.md },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  reminderText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  reminderValue: { fontSize: 15, fontWeight: '700', color: colors.muted },
  createBtn: { marginTop: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switchText: { flex: 1, ...type.body },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  dim: { opacity: 0.4 },
  time: { fontSize: 28, fontWeight: '800', color: colors.text },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekTitle: { ...type.headline },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 6 },
  dayDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  dayDone: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 2, borderColor: colors.primary },
  dayLetter: { fontSize: 12, fontWeight: '600', color: colors.muted },
  dayLetterToday: { color: colors.text, fontWeight: '800' },
});
