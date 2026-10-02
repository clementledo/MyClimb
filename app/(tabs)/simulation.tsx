import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Climb3D, type Progress } from '@/components/Climb3D';
import { Button, Chip, Segmented } from '@/components/ui';
import { getSetting, setSetting } from '@/lib/db';
import { HOLD_TYPES, planRoute } from '@/lib/planner';
import { demoRoute, listSimRoutes, pickRoutePhotos, removeSimRoute, saveSimRoutes, type SimRoute } from '@/lib/simRoutes';
import type { HoldType, Pt } from '@/lib/simulation';
import { colors } from '@/lib/theme';

type Mode = 'holds' | '3d';
type Kind = 'hands' | 'feet';

const SPEEDS = [0.5, 1, 2];

export default function SimulationScreen() {
  const [routes, setRoutes] = useState<SimRoute[]>(() => listSimRoutes());
  const [currentId, setCurrentId] = useState<string | null>(() => routes[0]?.id ?? null);
  const [mode, setMode] = useState<Mode>('holds');
  const route = routes.find((r) => r.id === currentId) ?? routes[0] ?? null;

  const update = (next: SimRoute[]) => {
    setRoutes(next);
    saveSimRoutes(next);
  };
  const patch = (changes: Partial<SimRoute>) => {
    if (route) update(routes.map((r) => (r.id === route.id ? { ...r, ...changes } : r)));
  };

  const add = async (source: 'camera' | 'library') => {
    try {
      const added = await pickRoutePhotos(source);
      if (added.length === 0) return;
      update([...routes, ...added]);
      setCurrentId(added[0].id);
      setMode('holds');
    } catch (e) {
      Alert.alert('Photo', e instanceof Error ? e.message : String(e));
    }
  };
  const addDemo = async () => {
    try {
      const demo = await demoRoute();
      update([...routes, demo]);
      setCurrentId(demo.id);
      setMode('holds');
    } catch (e) {
      Alert.alert('Exemple', e instanceof Error ? e.message : String(e));
    }
  };
  const askAdd = () =>
    Alert.alert('Ajouter une voie', undefined, [
      { text: 'Prendre une photo', onPress: () => add('camera') },
      { text: 'Choisir des photos', onPress: () => add('library') },
      { text: 'Voie d’exemple', onPress: addDemo },
    ], { cancelable: true });
  const askRemove = (r: SimRoute) =>
    Alert.alert('Supprimer cette voie ?', 'La photo et les prises placées seront effacées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          const next = removeSimRoute(routes, r.id);
          update(next);
          setCurrentId(next[0]?.id ?? null);
        },
      },
    ]);

  if (!route) {
    return (
      <View style={[s.container, s.emptyWrap]}>
        <View style={s.emptyCard}>
          <Text style={s.emptyTitle}>Simule une voie en 3D</Text>
          <Text style={s.emptyText}>
            Prends en photo une voie ou un bloc, touche les prises dans l&apos;ordre, et regarde un grimpeur la
            monter.
          </Text>
          <Button label="Prendre une photo" onPress={() => add('camera')} />
          <Button label="Choisir des photos" variant="secondary" onPress={() => add('library')} />
          <Pressable onPress={addDemo} hitSlop={8}>
            <Text style={s.demo}>Essayer avec une voie d’exemple</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const ready = route.hands.length >= 2;

  return (
    <View style={s.container}>
      <View style={s.top}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbs}>
          {routes.map((r, i) => (
            <Pressable
              key={r.id}
              onPress={() => setCurrentId(r.id)}
              onLongPress={() => askRemove(r)}
              style={[s.thumb, r.id === route.id && s.thumbActive]}>
              <Image source={{ uri: r.photo }} style={s.thumbImg} contentFit="cover" />
              <Text style={s.thumbNum}>{i + 1}</Text>
            </Pressable>
          ))}
          <Pressable onPress={askAdd} style={[s.thumb, s.thumbAdd]}>
            <Text style={s.thumbAddText}>+</Text>
          </Pressable>
        </ScrollView>
        <Segmented
          options={[
            { value: 'holds', label: 'Prises' },
            { value: '3d', label: 'Méthode 3D' },
          ]}
          value={ready ? mode : 'holds'}
          onChange={(m) => {
            if (m === '3d' && !ready) {
              Alert.alert('Encore quelques prises', 'Place au moins deux prises de main pour lancer la grimpe.');
              return;
            }
            setMode(m);
          }}
        />
      </View>
      {mode === '3d' && ready ? (
        <Player key={route.id} route={route} onSize={(size) => patch({ size })} />
      ) : (
        <HoldsEditor
          route={route}
          onChange={patch}
          onRemove={() => askRemove(route)}
          onPlay={() => setMode('3d')}
        />
      )}
    </View>
  );
}

/* ---------- Placement des prises ---------- */

type Selected = { kind: Kind; index: number } | null;

function HoldsEditor({
  route,
  onChange,
  onRemove,
  onPlay,
}: {
  route: SimRoute;
  onChange: (c: Partial<SimRoute>) => void;
  onRemove: () => void;
  onPlay: () => void;
}) {
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<Kind>('hands');
  const [selected, setSelected] = useState<Selected>(null);
  const w = width - 32;
  const h = (w * route.height) / route.width;

  const tap = (x: number, y: number) => {
    // Toucher une prise déjà placée ouvre ses réglages.
    const near = (p: Pt) => Math.hypot(p.x * w - x, p.y * h - y) < 18;
    const hi = route.hands.findIndex(near);
    if (hi >= 0) return setSelected({ kind: 'hands', index: hi });
    const fi = route.feet.findIndex(near);
    if (fi >= 0) return setSelected({ kind: 'feet', index: fi });
    const p = { x: x / w, y: y / h };
    onChange(kind === 'hands' ? { hands: [...route.hands, p] } : { feet: [...route.feet, p] });
  };
  const undo = () =>
    onChange(kind === 'hands' ? { hands: route.hands.slice(0, -1) } : { feet: route.feet.slice(0, -1) });

  const setType = (type: HoldType | undefined) => {
    if (selected?.kind !== 'hands') return;
    onChange({ hands: route.hands.map((p, i) => (i === selected.index ? { x: p.x, y: p.y, type } : p)) });
    setSelected(null);
  };
  const removeSelected = () => {
    if (!selected) return;
    if (selected.kind === 'hands') onChange({ hands: route.hands.filter((_, i) => i !== selected.index) });
    else onChange({ feet: route.feet.filter((_, i) => i !== selected.index) });
    setSelected(null);
  };
  const selectedHold = selected?.kind === 'hands' ? route.hands[selected.index] : null;

  return (
    <ScrollView contentContainerStyle={s.editor}>
      <Segmented
        options={[
          { value: 'hands', label: `Mains (${route.hands.length})` },
          { value: 'feet', label: `Pieds (${route.feet.length})` },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Text style={s.hint}>
        {kind === 'hands'
          ? 'Touche les prises de main dans l’ordre : la 1re est le départ, la dernière le top.'
          : 'Touche les prises de pied, dans n’importe quel ordre. Les prises de main déjà dépassées servent aussi de pieds.'}
        {' '}Touche une prise placée pour choisir son type (facultatif) ou la retirer.
      </Text>
      <Pressable onPress={(e) => tap(e.nativeEvent.locationX, e.nativeEvent.locationY)}>
        <View style={{ width: w, height: h }}>
          <Image source={{ uri: route.photo }} style={[s.photo, { width: w, height: h }]} contentFit="cover" />
          {route.feet.map((p, i) => (
            <View
              key={`f${i}`}
              pointerEvents="none"
              style={[s.foot, { left: p.x * w - 11, top: p.y * h - 11 }]}>
              <Text style={s.footText}>{i + 1}</Text>
            </View>
          ))}
          {route.hands.map((p, i) => (
            <View
              key={`h${i}`}
              pointerEvents="none"
              style={[
                s.hand,
                i === route.hands.length - 1 && route.hands.length > 1 && s.handTop,
                { left: p.x * w - 14, top: p.y * h - 14 },
              ]}>
              <Text style={s.handText}>{i + 1}</Text>
              {p.type && (
                <View style={s.typeBadge}>
                  <Text style={s.typeBadgeText}>{HOLD_TYPES[p.type].short}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </Pressable>
      <View style={s.row}>
        <Button label="Retirer la dernière" variant="secondary" style={s.flex} onPress={undo} />
        <Button
          label="Tout effacer"
          variant="secondary"
          style={s.flex}
          onPress={() => onChange({ hands: [], feet: [] })}
        />
      </View>
      <Button label="Voir la méthode en 3D" disabled={route.hands.length < 2} onPress={onPlay} />
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={s.remove}>Supprimer cette voie</Text>
      </Pressable>

      <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={s.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>
              {selected?.kind === 'hands' ? `Prise de main ${selected.index + 1}` : `Prise de pied ${(selected?.index ?? 0) + 1}`}
            </Text>
            {selected?.kind === 'hands' && (
              <>
                <Text style={s.hint}>Type de prise (facultatif) : le grimpeur se place en conséquence.</Text>
                <View style={s.chips}>
                  <Chip label="Aucun" selected={!selectedHold?.type} onPress={() => setType(undefined)} />
                  {(Object.keys(HOLD_TYPES) as HoldType[]).map((t) => (
                    <Chip key={t} label={HOLD_TYPES[t].label} selected={selectedHold?.type === t} onPress={() => setType(t)} />
                  ))}
                </View>
              </>
            )}
            <Button label="Retirer cette prise" variant="danger" onPress={removeSelected} />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

/* ---------- Méthode en 3D ---------- */

const HEIGHT_KEY = 'climberHeight';
const readHeight = () => {
  const v = Number(getSetting(HEIGHT_KEY));
  return v >= 1.2 && v <= 2.2 ? v : 1.75;
};

function Player({ route, onSize }: { route: SimRoute; onSize: (size: number) => void }) {
  const { height: windowHeight } = useWindowDimensions();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [restartKey, setRestartKey] = useState(0);
  const [viewKey, setViewKey] = useState(0);
  const [seek, setSeek] = useState({ t: -0.6, n: 0 });
  const [step, setStep] = useState(0);
  const [height, setHeight] = useState(readHeight);
  const [progress, setProgress] = useState<Progress>({ index: 0, total: 0 });

  const plan = planRoute(route, height);
  const total = plan.moves.length;
  const index = Math.min(progress.index, total);
  const finished = index >= total;
  const move = plan.moves[index];

  const changeHeight = (d: number) => {
    const v = Math.round(Math.min(2.2, Math.max(1.2, height + d)) * 100) / 100;
    setHeight(v);
    setSetting(HEIGHT_KEY, String(v));
  };
  const goTo = (i: number) => {
    setPlaying(false);
    setSeek((x) => ({ t: Math.max(0, Math.min(total, i)), n: x.n + 1 }));
  };

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.player}>
      <View style={[s.glWrap, { height: Math.max(240, Math.min(420, windowHeight * 0.42)) }]}>
        <Climb3D
          route={route}
          plan={plan}
          playing={playing}
          speed={speed}
          restartKey={restartKey}
          viewKey={viewKey}
          seek={seek}
          step={step}
          onProgress={setProgress}
          onEnd={() => setPlaying(false)}
        />
      </View>

      <View style={s.stepCard}>
        <View style={s.stepHead}>
          <Text style={s.stepTitle} numberOfLines={2}>
            {finished ? 'Top !' : index === 0 && progress.total === 0 ? 'Départ' : move?.title}
          </Text>
          <Text style={s.stepCount}>
            {Math.min(index + 1, total)}/{total}
          </Text>
        </View>
        {index === 0 && <Text style={s.stepStart}>{plan.startText}</Text>}
        {!finished &&
          move?.alerts.map((a) => (
            <View key={a} style={s.alert}>
              <Text style={s.alertText}>⚠ {a}</Text>
            </View>
          ))}
        {!finished &&
          move?.tips.map((t) => (
            <Text key={t} style={s.tip}>
              • {t}
            </Text>
          ))}
      </View>

      <View style={s.row}>
        <Ctrl label="⏮" onPress={() => goTo(index - 1)} disabled={index === 0} />
        <Ctrl
          label={playing ? '❚❚ Pause' : '▶ Tout jouer'}
          primary
          onPress={() => {
            if (finished && !playing) setRestartKey((k) => k + 1);
            setPlaying(!playing);
          }}
        />
        <Ctrl
          label="Étape ⏭"
          disabled={finished}
          onPress={() => {
            setPlaying(false);
            setStep((k) => k + 1);
          }}
        />
      </View>
      <View style={s.row}>
        <Ctrl label="⟲" onPress={() => { setPlaying(false); setRestartKey((k) => k + 1); }} />
        <Ctrl
          label={`× ${String(speed).replace('.', ',')}`}
          onPress={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
        />
        <Ctrl label="Vue de face" onPress={() => setViewKey((k) => k + 1)} />
      </View>
      <View style={s.row}>
        <Text style={s.sizeLabel}>Ta taille : {String(height.toFixed(2)).replace('.', ',')} m</Text>
        <Ctrl label="−" onPress={() => changeHeight(-0.05)} />
        <Ctrl label="+" onPress={() => changeHeight(0.05)} />
      </View>
      <View style={s.row}>
        <Text style={s.sizeLabel}>Mur : {plan.H.toFixed(1).replace('.', ',')} m</Text>
        <Ctrl label="−" onPress={() => onSize(Math.min(2, route.size * 1.1))} />
        <Ctrl label="+" onPress={() => onSize(Math.max(0.5, route.size / 1.1))} />
      </View>
      <Text style={s.hint}>
        La hauteur du mur est estimée d’après l’écart entre les prises ; corrige-la si le grimpeur paraît trop grand
        ou trop petit. Un doigt fait tourner la caméra, deux doigts zooment.
      </Text>
    </ScrollView>
  );
}

function Ctrl({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.ctrl, primary && s.ctrlPrimary, (pressed || disabled) && { opacity: 0.45 }]}>
      <Text style={[s.ctrlText, primary && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  thumbs: { gap: 8 },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: colors.primary },
  thumbImg: { width: '100%', height: '100%' },
  thumbNum: {
    position: 'absolute',
    right: 4,
    bottom: 2,
    color: '#fff',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  thumbAdd: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  thumbAddText: { color: colors.primary, fontSize: 28, fontWeight: '600', marginTop: -2 },
  editor: { padding: 16, gap: 12, paddingBottom: 40 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  photo: { borderRadius: 12 },
  hand: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handTop: { backgroundColor: colors.success },
  handText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  foot: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C7ED6',
    borderWidth: 2,
    borderColor: '#fff',
  },
  footText: { color: '#fff', fontWeight: '800', fontSize: 10 },
  typeBadge: {
    position: 'absolute',
    right: -10,
    top: -8,
    minWidth: 18,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
  },
  typeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, padding: 20, paddingBottom: 32, gap: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  glWrap: { borderRadius: 16, overflow: 'hidden' },
  stepCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 6 },
  stepHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stepTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  stepCount: { color: colors.muted, fontWeight: '600' },
  stepStart: { color: colors.text, fontSize: 13, lineHeight: 18 },
  tip: { color: colors.text, fontSize: 13, lineHeight: 18 },
  alert: { alignSelf: 'flex-start', backgroundColor: '#FFF3BF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  alertText: { color: '#8A5A00', fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex: { flex: 1 },
  demo: { color: colors.primary, textAlign: 'center', fontWeight: '600', paddingTop: 4 },
  remove: { color: colors.danger, textAlign: 'center', fontWeight: '600', paddingVertical: 8 },
  emptyWrap: { justifyContent: 'center', padding: 24 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, gap: 14 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 6 },
  player: { padding: 12, gap: 8, paddingBottom: 32 },
  ctrl: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
  },
  ctrlPrimary: { backgroundColor: colors.primary },
  ctrlText: { color: colors.primary, fontWeight: '700' },
  sizeLabel: { flex: 1.4, color: colors.text, fontWeight: '600' },
});
