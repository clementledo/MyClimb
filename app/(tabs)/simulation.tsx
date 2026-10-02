import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Climb3D, type Progress } from '@/components/Climb3D';
import { Button, Segmented } from '@/components/ui';
import { listSimRoutes, pickRoutePhotos, removeSimRoute, saveSimRoutes, type SimRoute } from '@/lib/simRoutes';
import type { Pt } from '@/lib/simulation';
import { colors } from '@/lib/theme';

type Mode = 'holds' | '3d';
type Kind = 'hands' | 'feet';

const SPEEDS = [0.5, 1, 2];
const SIZES = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.35];

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
  const askAdd = () =>
    Alert.alert('Ajouter une voie', undefined, [
      { text: 'Prendre une photo', onPress: () => add('camera') },
      { text: 'Choisir des photos', onPress: () => add('library') },
      { text: 'Annuler', style: 'cancel' },
    ]);
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
            { value: '3d', label: 'Grimpe en 3D' },
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
  const w = width - 32;
  const h = (w * route.height) / route.width;

  const tap = (x: number, y: number) => {
    // Toucher une prise déjà placée la retire.
    const near = (p: Pt) => Math.hypot(p.x * w - x, p.y * h - y) < 18;
    const hi = route.hands.findIndex(near);
    if (hi >= 0) return onChange({ hands: route.hands.filter((_, i) => i !== hi) });
    const fi = route.feet.findIndex(near);
    if (fi >= 0) return onChange({ feet: route.feet.filter((_, i) => i !== fi) });
    const p = { x: x / w, y: y / h };
    onChange(kind === 'hands' ? { hands: [...route.hands, p] } : { feet: [...route.feet, p] });
  };
  const undo = () =>
    onChange(kind === 'hands' ? { hands: route.hands.slice(0, -1) } : { feet: route.feet.slice(0, -1) });

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
          : 'Touche les prises de pied, dans n’importe quel ordre. Sans pieds, le grimpeur pose les pieds sur le mur.'}
        {' '}Touche une prise placée pour la retirer.
      </Text>
      <Pressable onPress={(e) => tap(e.nativeEvent.locationX, e.nativeEvent.locationY)}>
        <View style={{ width: w, height: h }}>
          <Image source={{ uri: route.photo }} style={[s.photo, { width: w, height: h }]} contentFit="cover" />
          {route.feet.map((p, i) => (
            <View
              key={`f${i}`}
              pointerEvents="none"
              style={[s.foot, { left: p.x * w - 9, top: p.y * h - 9 }]}
            />
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
      <Button label="Lancer la grimpe en 3D" disabled={route.hands.length < 2} onPress={onPlay} />
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={s.remove}>Supprimer cette voie</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ---------- Lecture en 3D ---------- */

function Player({ route, onSize }: { route: SimRoute; onSize: (size: number) => void }) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [restartKey, setRestartKey] = useState(0);
  const [viewKey, setViewKey] = useState(0);
  const [progress, setProgress] = useState<Progress>({ index: 0, total: 0, label: '' });
  const finished = progress.total > 0 && progress.index >= progress.total;

  const sizeIdx = SIZES.reduce((best, v, i) => (Math.abs(v - route.size) < Math.abs(SIZES[best] - route.size) ? i : best), 0);

  return (
    <View style={s.player}>
      <Climb3D
        route={route}
        playing={playing}
        speed={speed}
        restartKey={restartKey}
        viewKey={viewKey}
        onProgress={setProgress}
        onEnd={() => setPlaying(false)}
      />
      <View style={s.caption}>
        <Text style={s.captionText} numberOfLines={1}>
          {progress.label}
        </Text>
        <Text style={s.captionCount}>
          {Math.min(progress.index + 1, progress.total)}/{progress.total}
        </Text>
      </View>
      <View style={s.row}>
        <Ctrl label="⟲ Rejouer" onPress={() => { setRestartKey((k) => k + 1); setPlaying(true); }} />
        <Ctrl
          label={playing ? '❚❚ Pause' : '▶ Lecture'}
          primary
          onPress={() => {
            if (finished && !playing) setRestartKey((k) => k + 1);
            setPlaying(!playing);
          }}
        />
        <Ctrl label={`× ${String(speed).replace('.', ',')}`} onPress={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} />
      </View>
      <View style={s.row}>
        <Text style={s.sizeLabel}>Taille du grimpeur</Text>
        <Ctrl label="−" disabled={sizeIdx === 0} onPress={() => onSize(SIZES[sizeIdx - 1])} />
        <Ctrl label="+" disabled={sizeIdx === SIZES.length - 1} onPress={() => onSize(SIZES[sizeIdx + 1])} />
        <Ctrl label="Vue de face" onPress={() => setViewKey((k) => k + 1)} />
      </View>
      <Text style={s.hint}>Glisse un doigt pour tourner autour du mur, pince pour zoomer.</Text>
    </View>
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
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1C7ED6',
    borderWidth: 2,
    borderColor: '#fff',
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex: { flex: 1 },
  remove: { color: colors.danger, textAlign: 'center', fontWeight: '600', paddingVertical: 8 },
  emptyWrap: { justifyContent: 'center', padding: 24 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, gap: 14 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 6 },
  player: { flex: 1, padding: 16, gap: 10 },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  captionText: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  captionCount: { color: colors.muted, fontWeight: '600' },
  ctrl: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
  },
  ctrlPrimary: { backgroundColor: colors.primary },
  ctrlText: { color: colors.primary, fontWeight: '700' },
  sizeLabel: { flex: 1.4, color: colors.text, fontWeight: '600' },
});
