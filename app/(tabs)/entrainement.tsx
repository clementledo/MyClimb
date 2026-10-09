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
  exerciseById,
  exerciseMinutes,
  FOCUS,
  INTENSITY,
  LEVELS,
  levelTone,
  ROUTINE_KINDS,
  routineLevel,
  ROUTINES,
  sessionExercises,
  sessionLevel,
  SESSIONS,
  type Equipment,
  type Focus,
  type Level,
  type Routine,
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
import { scaled } from '@/lib/trainingScale';
import { applyReminder, formatTime, readReminder, type Reminder } from '@/lib/reminder';
import { todayIso } from '@/lib/stats';

type Kind = 'routine' | 'session' | 'exercise';
type Length = 'short' | 'mid' | 'long';
type Filters = { kind: Kind | null; level: Level | null; length: Length | null; where: 'maison' | 'salle' | null };
const NO_FILTERS: Filters = { kind: null, level: null, length: null, where: null };

const KINDS: { value: Kind; label: string; title: string }[] = [
  { value: 'routine', label: 'Routines', title: 'Routines' },
  { value: 'session', label: 'Séances', title: 'Séances complètes' },
  { value: 'exercise', label: 'Exercices', title: 'Exercices' },
];
const LENGTHS: { value: Length; label: string }[] = [
  { value: 'short', label: '15 min ou moins' },
  { value: 'mid', label: '15 à 45 min' },
  { value: 'long', label: 'Plus de 45 min' },
];
const lengthOf = (m: number): Length => (m <= 15 ? 'short' : m <= 45 ? 'mid' : 'long');

/** Une ligne de la liste unique : routine, séance ou exercice. */
type Item = {
  key: string;
  kind: Kind;
  name: string;
  icon: Parameters<typeof Icon>[0]['name'];
  minutes: number;
  level: Level;
  focuses: Focus[];
  where: 'maison' | 'salle';
  subtitle: string;
  href: string;
  mine?: boolean;
};

const focusesOf = (ids: string[]) => [...new Set(ids.flatMap((id) => (exerciseById(id) ? [exerciseById(id)!.focus] : [])))];
const whereOf = (ids: string[]) => (ids.some((id) => exerciseById(id)?.equipment === 'wall') ? 'salle' : 'maison');

function routineItem(r: Routine, mine = false): Item {
  return {
    key: `r:${r.id}`,
    kind: 'routine',
    name: r.name,
    icon: mine ? 'star' : r.icon,
    minutes: r.minutes,
    level: routineLevel(r),
    focuses: focusesOf(r.items),
    where: whereOf(r.items),
    subtitle: `${r.minutes} min · ${mine ? `${r.items.length} exercices` : r.when}`,
    href: `/training/routine/${r.id}`,
    mine,
  };
}

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function TrainingScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'train' | 'jeux'>('train');
  const scroll = useRef<ScrollView>(null);
  const [equipment, setEquipment] = useState<Equipment[]>(myEquipment);
  const [sheet, setSheet] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
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
  useFocusEffect(reload);

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
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: f[k] === v ? null : v }));

  // La liste unique : mes routines, routines, séances et exercices faisables avec mon matériel.
  const items: Item[] = [
    ...mine.map((r) => routineItem(r, true)),
    ...ROUTINES.filter((r) => canDoRoutine(r, equipment)).map((r) => routineItem(r)),
    ...SESSIONS.filter((x) => canDoSession(x, equipment)).map(
      (x): Item => ({
        key: `s:${x.id}`,
        kind: 'session',
        name: x.name,
        icon: x.icon,
        minutes: x.minutes,
        level: sessionLevel(x),
        focuses: [...focusesOf(sessionExercises(x)), ...(x.where === 'salle' ? (['mur'] as Focus[]) : [])],
        where: x.where,
        subtitle: `${x.minutes} min · ${INTENSITY[x.intensity]} · ${x.where === 'salle' ? 'En salle' : 'À la maison'}`,
        href: `/training/${x.id}`,
      }),
    ),
    ...EXERCISES.filter((x) => canDoExercise(x, equipment)).map(
      (x): Item => ({
        key: `e:${x.id}`,
        kind: 'exercise',
        name: x.name,
        icon: FOCUS[x.focus].icon,
        minutes: exerciseMinutes(x),
        level: x.level,
        focuses: [x.focus],
        where: x.equipment === 'wall' ? 'salle' : 'maison',
        subtitle: scaled(x).doseText,
        href: `/training/exercise/${x.id}`,
      }),
    ),
  ];
  const shown = items.filter(
    (i) =>
      (!focus || i.focuses.includes(focus)) &&
      (!filters.kind || i.kind === filters.kind) &&
      (!filters.level || i.level === filters.level) &&
      (!filters.length || lengthOf(i.minutes) === filters.length) &&
      (!filters.where || i.where === filters.where),
  );
  const filterCount = Object.values(filters).filter(Boolean).length;
  const filtered = filterCount > 0 || focus !== null;

  const allEq = equipment.length === EQUIPMENT.length;
  const eqSummary = allEq ? 'Tout le matériel' : equipment.length === 0 ? 'Poids du corps seulement' : EQUIPMENT.filter((e) => equipment.includes(e.id)).map((e) => e.label).join(', ');
  const today = todayIso();
  const doneToday = new Set(logs.filter((l) => l.date === today).map((l) => `${l.kind === 'routine' ? 'r' : l.kind === 'session' ? 's' : 'e'}:${l.ref}`));
  const week = routineWeek(logs);
  const streak = routineStreak(logs);

  return (
    <View style={s.container}>
      <View style={s.switcher}>
        <Segmented
          options={[
            { value: 'train', label: 'Entraîner' },
            { value: 'jeux', label: 'Jeux' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {tab === 'jeux' ? (
        <Games />
      ) : (
        <ScrollView ref={scroll} contentContainerStyle={s.content}>
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

          <Sheet visible={sheet} onClose={() => setSheet(false)} title="Filtres">
            <Text style={s.filterTitle}>Type</Text>
            <View style={s.chips}>
              {KINDS.map((k) => (
                <Chip key={k.value} label={k.label} selected={filters.kind === k.value} onPress={() => setFilter('kind', k.value)} />
              ))}
            </View>
            <Text style={s.filterTitle}>Niveau</Text>
            <View style={s.chips}>
              {([1, 2, 3, 4, 5] as Level[]).map((l) => (
                <Chip key={l} label={LEVELS[l]} selected={filters.level === l} onPress={() => setFilter('level', l)} />
              ))}
            </View>
            <Text style={s.filterTitle}>Durée</Text>
            <View style={s.chips}>
              {LENGTHS.map((l) => (
                <Chip key={l.value} label={l.label} selected={filters.length === l.value} onPress={() => setFilter('length', l.value)} />
              ))}
            </View>
            <Text style={s.filterTitle}>Lieu</Text>
            <View style={s.chips}>
              <Chip label="À la maison" icon="home" selected={filters.where === 'maison'} onPress={() => setFilter('where', 'maison')} />
              <Chip label="En salle" icon="landscape" selected={filters.where === 'salle'} onPress={() => setFilter('where', 'salle')} />
            </View>
            <Text style={s.filterTitle}>Mon matériel</Text>
            <Text style={s.sheetText}>{eqSummary}</Text>
            <View style={s.chips}>
              {EQUIPMENT.filter((e) => e.id !== 'none').map((e) => (
                <Chip key={e.id} label={e.label} icon={e.icon} selected={equipment.includes(e.id)} onPress={() => toggle(e.id)} />
              ))}
            </View>
            <View style={s.sheetButtons}>
              {filterCount > 0 && <Button label="Effacer" variant="secondary" style={s.flex} onPress={() => setFilters(NO_FILTERS)} />}
              <Button label={`Voir ${shown.length} résultat${shown.length > 1 ? 's' : ''}`} style={s.flex} onPress={() => setSheet(false)} />
            </View>
          </Sheet>

          {!filtered && daily && (
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
              <Text style={s.heroReason}>{doneToday.has(`r:${daily.routine.id}`) ? 'Faite aujourd’hui, bravo !' : daily.reason}</Text>
              <View style={s.heroCta}>
                <Text style={s.heroCtaText}>{doneToday.has(`r:${daily.routine.id}`) ? 'Revoir la routine' : 'Commencer'}</Text>
                <Icon name="arrow_forward" size={18} color={colors.onPrimary} />
              </View>
            </Pressable>
          )}

          {!filtered && (
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
              {suggestion && (
                <Pressable style={s.reminder} onPress={() => router.push(`/training/${suggestion.session.id}`)} accessibilityLabel="Voir la séance">
                  <Icon name={suggestion.session.icon} size={20} color={colors.primary} />
                  <View style={s.flex}>
                    <Text style={s.reminderText}>Séance conseillée : {suggestion.session.name}</Text>
                    <Text style={s.suggestReason} numberOfLines={2}>
                      {suggestion.reason}
                    </Text>
                  </View>
                  <Icon name="chevron_right" size={18} color={colors.muted} />
                </Pressable>
              )}
              <Pressable style={s.reminder} onPress={() => setDraft(reminder)} accessibilityLabel="Rappel quotidien">
                <Icon name={reminder.on ? 'notifications_active' : 'notifications_off'} size={20} color={reminder.on ? colors.primary : colors.muted} />
                <Text style={[s.reminderText, s.flex]}>Rappel quotidien</Text>
                <Text style={[s.reminderValue, reminder.on && { color: colors.primary }]}>{reminder.on ? formatTime(reminder) : 'Désactivé'}</Text>
                <Icon name="chevron_right" size={18} color={colors.muted} />
              </Pressable>
            </Card>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.focusRow}>
            <Pressable
              onPress={() => setSheet(true)}
              accessibilityLabel="Filtres"
              style={({ pressed }) => [s.filterBtn, filterCount > 0 && s.filterBtnOn, pressed && s.pressed]}>
              <Icon name="tune" size={18} color={filterCount > 0 ? colors.onPrimary : colors.primary} />
              <Text style={[s.filterBtnText, filterCount > 0 && { color: colors.onPrimary }]}>Filtres{filterCount > 0 ? ` (${filterCount})` : ''}</Text>
            </Pressable>
            <Chip label="Tout" selected={!focus} onPress={() => setFocus(null)} />
            {(Object.keys(FOCUS) as Focus[]).map((f) => (
              <Chip key={f} label={FOCUS[f].label} selected={focus === f} onPress={() => setFocus(focus === f ? null : f)} />
            ))}
          </ScrollView>

          {filtered && (
            <View style={s.resultRow}>
              <Text style={s.muted}>
                {shown.length} résultat{shown.length > 1 ? 's' : ''}
              </Text>
              <Button
                label="Tout effacer"
                variant="ghost"
                onPress={() => {
                  setFocus(null);
                  setFilters(NO_FILTERS);
                }}
              />
            </View>
          )}

          {shown.length === 0 && <Empty icon="fitness_center" text="Rien ne correspond. Change un filtre ou ajoute du matériel." />}

          {KINDS.map((k) => {
            const list = shown.filter((i) => i.kind === k.value).sort((a, b) => Number(!!b.mine) - Number(!!a.mine) || a.level - b.level);
            if (list.length === 0 && !(k.value === 'routine' && !filtered)) return null;
            return (
              <Section key={k.value} title={`${k.title} (${list.length})`}>
                {list.length > 0 && (
                  <View style={s.listCard}>
                    {list.map((i, n) => (
                      <ListRow
                        key={i.key}
                        icon={i.icon}
                        title={i.name}
                        subtitle={i.subtitle}
                        right={doneToday.has(i.key) ? <Badge label="Fait" tone="success" /> : <Badge label={LEVELS[i.level]} tone={levelTone(i.level)} />}
                        onPress={() => router.push(i.href as never)}
                        last={n === list.length - 1}
                      />
                    ))}
                  </View>
                )}
                {k.value === 'routine' && !filtered && (
                  <Button label="Créer ma routine" icon="add" variant="secondary" style={list.length > 0 ? s.createBtn : undefined} onPress={() => router.push('/training/routine-edit')} />
                )}
              </Section>
            );
          })}

          {!filtered && (
            <Section title="Mes entraînements">
              {logs.length === 0 ? (
                <Card>
                  <Text style={s.muted}>Termine une routine, une séance ou un exercice avec « Marquer comme fait » : il apparaîtra ici et dans Progression.</Text>
                </Card>
              ) : (
                <View style={s.listCard}>
                  {(allLogs ? logs : logs.slice(0, 3)).map((l, i, arr) => (
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
              {logs.length > 3 && <Button label={allLogs ? 'Voir moins' : `Voir tout (${logs.length})`} variant="ghost" onPress={() => setAllLogs(!allLogs)} />}
            </Section>
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
  focusRow: { gap: space.sm, paddingRight: space.lg, alignItems: 'center' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  filterBtnOn: { backgroundColor: colors.primary },
  filterBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  filterTitle: { ...type.headline, marginTop: space.sm },
  sheetButtons: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  flex: { flex: 1 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -space.sm },
  suggestReason: { fontSize: 13, lineHeight: 18, color: colors.muted },
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
