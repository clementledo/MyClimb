import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { ExerciseAnim } from '@/components/ExerciseAnim';
import Games from '@/components/Games';
import { Banner, Button, Card, Chip, ListRow, Section, Segmented, Sheet } from '@/components/ui';
import { FEEL_LABELS } from '@/lib/climbing';
import { currentWeek, myLevels, readProgram, setFrequency, setLevel, startProgram, stopProgram, type Program } from '@/lib/coach';
import { deleteTrainingLog, listTrainingLogs, type TrainingLog } from '@/lib/db';
import { HAS_ANIMATION } from '@/lib/exercisePoses';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';
import {
  animOf,
  CATS,
  doseAt,
  doseText,
  EXERCISES,
  LEVELS,
  PHASES,
  PROGRAM_WEEKS,
  SESSIONS,
  sessionMinutes,
  WHERE,
  ZONES,
  type Cat,
  type Lv,
  type Where,
  type Zone,
} from '@/lib/training';

type Tab = 'programme' | 'seances' | 'exercices' | 'souplesse';
const TRAIN_CATS = (Object.keys(CATS) as Cat[]).filter((c) => c !== 'souplesse');

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function TrainingScreen() {
  const [top, setTop] = useState<'train' | 'jeux'>('train');
  const [tab, setTab] = useState<Tab>('programme');
  return (
    <View style={s.container}>
      <View style={s.switcher}>
        <Segmented
          options={[
            { value: 'train', label: 'Entraîner' },
            { value: 'jeux', label: 'Jeux' },
          ]}
          value={top}
          onChange={setTop}
        />
      </View>
      {top === 'jeux' ? (
        <Games />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          <Segmented
            options={[
              { value: 'programme', label: 'Programme' },
              { value: 'seances', label: 'Séances' },
              { value: 'exercices', label: 'Exercices' },
              { value: 'souplesse', label: 'Souplesse' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'programme' && <ProgramTab onStretch={() => setTab('souplesse')} />}
          {tab === 'seances' && <SessionsTab />}
          {tab === 'exercices' && <ExercisesTab />}
          {tab === 'souplesse' && <StretchTab />}
        </ScrollView>
      )}
    </View>
  );
}

/* ---------- Programme ---------- */

function ProgramTab({ onStretch }: { onStretch: () => void }) {
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [levels, setLevels] = useState(myLevels);
  const [freq, setFreq] = useState<3 | 4 | 5>(3);
  const [levelSheet, setLevelSheet] = useState(false);
  const refresh = useCallback(() => {
    setProgram(readProgram());
    setLogs(listTrainingLogs());
    setLevels(myLevels());
  }, []);
  useFocusEffect(refresh);

  const week = program ? currentWeek(program, logs) : null;

  return (
    <>
      {!program || !week ? (
        <Card style={{ gap: space.md }}>
          <Text style={s.cardTitle}>Programme de 8 semaines</Text>
          <Text style={s.body}>Un cycle de grimpeur : 3 semaines de force, 1 de récupération, 3 de puissance et résistance, puis récupération et test sur ton projet. Les séances s’adaptent à ton niveau.</Text>
          {PHASES.map((p) => (
            <View key={p.name} style={s.phaseRow}>
              <Text style={s.phaseWeeks}>S{p.weeks.join('-')}</Text>
              <Text style={[s.small, { flex: 1 }]}>
                <Text style={{ fontWeight: '800' }}>{p.name}</Text> · {p.text}
              </Text>
            </View>
          ))}
          <Text style={s.label}>Séances par semaine (grimpe et renfo)</Text>
          <View style={s.chips}>
            {([3, 4, 5] as const).map((f) => (
              <Chip key={f} label={`${f} séances`} selected={freq === f} onPress={() => setFreq(f)} />
            ))}
          </View>
          <Button
            label="Démarrer le programme"
            icon="play_arrow"
            onPress={() => {
              startProgram(freq);
              refresh();
            }}
          />
        </Card>
      ) : (
        <>
          <Card style={{ gap: space.sm }}>
            <Text style={s.over}>
              SEMAINE {week.week}/{PROGRAM_WEEKS} · {week.phase.name.toUpperCase()}
            </Text>
            <Text style={s.small}>{week.phase.text}</Text>
            <View style={s.weeks}>
              {Array.from({ length: PROGRAM_WEEKS }, (_, i) => (
                <View key={i} style={[s.weekDot, i + 1 < week.week && { backgroundColor: colors.success }, i + 1 === week.week && { backgroundColor: colors.primary }]} />
              ))}
            </View>
          </Card>
          {week.finished && (
            <Banner
              tone="success"
              icon="emoji_events"
              title="Programme terminé !"
              text="Bravo. Recommence un cycle : tes niveaux ont peut-être monté."
              action={{
                label: 'Recommencer',
                onPress: () => {
                  startProgram(program.freq);
                  refresh();
                },
              }}
            />
          )}
          <Section title={`Cette semaine · ${week.sessions.filter((x) => x.doneOn).length}/${week.sessions.length}`}>
            <Card style={{ paddingVertical: 0 }}>
              {week.sessions.map(({ session, doneOn }, i) => (
                <ListRow
                  key={`${session.id}${i}`}
                  icon={doneOn ? 'check_circle' : session.icon}
                  iconColor={doneOn ? colors.success : colors.primary}
                  title={session.name}
                  subtitle={doneOn ? `Faite ${shortDate(doneOn)}` : `${sessionMinutes(session, levels[session.cat])} min · ${WHERE[session.where].label} · ${LEVELS[levels[session.cat]]}`}
                  onPress={() => router.push(`/training/${session.id}`)}
                />
              ))}
              <ListRow icon="self_improvement" title="Souplesse" subtitle="2 routines conseillées cette semaine, après la grimpe" onPress={onStretch} last />
            </Card>
            <Text style={s.muted}>Garde au moins un jour de repos entre deux séances dures (doigts, limite, puissance).</Text>
          </Section>
          <Section title="Réglages du programme">
            <View style={s.chips}>
              {([3, 4, 5] as const).map((f) => (
                <Chip
                  key={f}
                  label={`${f} séances/sem.`}
                  selected={program.freq === f}
                  onPress={() => {
                    setFrequency(f);
                    refresh();
                  }}
                />
              ))}
            </View>
            <Button
              label="Arrêter le programme"
              variant="ghost"
              size="sm"
              icon="stop"
              onPress={() =>
                Alert.alert('Arrêter le programme ?', 'Tu pourras en recommencer un quand tu veux.', [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Arrêter',
                    style: 'destructive',
                    onPress: () => {
                      stopProgram();
                      refresh();
                    },
                  },
                ])
              }
            />
          </Section>
        </>
      )}

      <Section title="Mon niveau" action={{ label: 'Modifier', onPress: () => setLevelSheet(true) }}>
        <Card style={{ paddingVertical: 0 }}>
          {TRAIN_CATS.map((c, i) => (
            <ListRow key={c} icon={CATS[c].icon} title={CATS[c].label} value={LEVELS[levels[c]]} onPress={() => setLevelSheet(true)} last={i === TRAIN_CATS.length - 1} />
          ))}
        </Card>
        <Text style={s.muted}>Ton niveau monte tout seul après deux séances notées « Facile » dans une catégorie.</Text>
      </Section>

      {logs.length > 0 && (
        <Section title="Derniers entraînements">
          <Card style={{ paddingVertical: 0 }}>
            {logs.slice(0, 6).map((l, i, a) => (
              <ListRow
                key={l.id}
                icon="history"
                title={l.name}
                subtitle={`${shortDate(l.date)} · ${l.minutes} min${l.feel ? ` · ${FEEL_LABELS[l.feel]}` : ''}`}
                onPress={() =>
                  Alert.alert(l.name, 'Supprimer cet entraînement de l’historique ?', [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Supprimer',
                      style: 'destructive',
                      onPress: () => {
                        deleteTrainingLog(l.id);
                        refresh();
                      },
                    },
                  ])
                }
                chevron={false}
                last={i === a.length - 1}
              />
            ))}
          </Card>
        </Section>
      )}

      <Sheet visible={levelSheet} onClose={() => setLevelSheet(false)} title="Mon niveau">
        {TRAIN_CATS.map((c) => (
          <View key={c} style={{ gap: space.xs }}>
            <Text style={s.label}>{CATS[c].label}</Text>
            <Segmented
              options={([1, 2, 3] as Lv[]).map((l) => ({ value: String(l), label: LEVELS[l] }))}
              value={String(levels[c])}
              onChange={(v) => {
                setLevel(c, Number(v) as Lv);
                setLevels(myLevels());
              }}
            />
          </View>
        ))}
      </Sheet>
    </>
  );
}

/* ---------- Séances ---------- */

function SessionsTab() {
  const router = useRouter();
  const [cat, setCat] = useState<Cat | null>(null);
  const levels = myLevels();
  const list = SESSIONS.filter((x) => x.cat !== 'souplesse' && (!cat || x.cat === cat));
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="Toutes" selected={!cat} onPress={() => setCat(null)} />
        {TRAIN_CATS.map((c) => (
          <Chip key={c} label={CATS[c].label} icon={CATS[c].icon} selected={cat === c} onPress={() => setCat(cat === c ? null : c)} />
        ))}
      </ScrollView>
      {cat && <Text style={s.muted}>{CATS[cat].text}</Text>}
      <Card style={{ paddingVertical: 0 }}>
        {list.map((x, i) => (
          <ListRow
            key={x.id}
            icon={x.icon}
            title={x.name}
            subtitle={`${sessionMinutes(x, levels[x.cat])} min · ${WHERE[x.where].label} · ${x.goal}`}
            onPress={() => router.push(`/training/${x.id}`)}
            last={i === list.length - 1}
          />
        ))}
      </Card>
    </>
  );
}

/* ---------- Exercices ---------- */

function ExercisesTab() {
  const router = useRouter();
  const [cat, setCat] = useState<Cat | null>(null);
  const [where, setWhere] = useState<Where | null>(null);
  const levels = myLevels();
  const list = EXERCISES.filter((x) => (!cat || x.cat === cat) && (!where || x.where === where));
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="Tous" selected={!cat} onPress={() => setCat(null)} />
        {(Object.keys(CATS) as Cat[]).map((c) => (
          <Chip key={c} label={CATS[c].label} icon={CATS[c].icon} selected={cat === c} onPress={() => setCat(cat === c ? null : c)} />
        ))}
      </ScrollView>
      <View style={s.chips}>
        {(Object.keys(WHERE) as Where[]).map((w) => (
          <Chip key={w} label={WHERE[w].label} icon={WHERE[w].icon} selected={where === w} onPress={() => setWhere(where === w ? null : w)} />
        ))}
      </View>
      <Text style={s.muted}>{list.length} exercices · doses à ton niveau</Text>
      <Card style={{ paddingVertical: 0 }}>
        {list.map((x, i) => (
          <ListRow
            key={x.id}
            left={HAS_ANIMATION(animOf(x)) ? <ExerciseAnim id={animOf(x)} size={44} playing={false} /> : undefined}
            icon={CATS[x.cat].icon}
            title={x.name}
            subtitle={`${x.zone ? ZONES[x.zone].label : CATS[x.cat].label} · ${doseText(doseAt(x, levels[x.cat]))}`}
            onPress={() => router.push(`/training/exercise/${x.id}`)}
            last={i === list.length - 1}
          />
        ))}
      </Card>
    </>
  );
}

/* ---------- Souplesse ---------- */

function StretchTab() {
  const router = useRouter();
  const routines = SESSIONS.filter((x) => x.cat === 'souplesse');
  return (
    <>
      <Text style={s.muted}>Des routines de 5 à 15 min. Après la grimpe, les muscles sont chauds : c’est le meilleur moment.</Text>
      <Section title="Routines">
        <Card style={{ paddingVertical: 0 }}>
          {routines.map((x, i) => (
            <ListRow
              key={x.id}
              icon={x.icon}
              title={x.name}
              subtitle={`${sessionMinutes(x, 2)} min · ${x.goal}`}
              onPress={() => router.push(`/training/${x.id}`)}
              last={i === routines.length - 1}
            />
          ))}
        </Card>
      </Section>
      {(Object.keys(ZONES) as Zone[]).map((z) => {
        const list = EXERCISES.filter((x) => x.zone === z);
        return (
          <Section key={z} title={ZONES[z].label}>
            <Card style={{ paddingVertical: 0 }}>
              {list.map((x, i) => (
                <ListRow
                  key={x.id}
                  left={HAS_ANIMATION(animOf(x)) ? <ExerciseAnim id={animOf(x)} size={44} playing={false} /> : undefined}
                  icon="self_improvement"
                  title={x.name}
                  subtitle={x.goal}
                  onPress={() => router.push(`/training/exercise/${x.id}`)}
                  last={i === list.length - 1}
                />
              ))}
            </Card>
          </Section>
        );
      })}
    </>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  switcher: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.lg },
  cardTitle: { ...type.headline },
  body: { ...type.body },
  small: { fontSize: 14, color: colors.text, lineHeight: 20 },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  label: { ...type.overline },
  over: { ...type.overline, color: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  phaseRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  phaseWeeks: { width: 44, fontWeight: '800', color: colors.primary },
  weeks: { flexDirection: 'row', gap: 4, marginTop: space.xs },
  weekDot: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.surface },
});
