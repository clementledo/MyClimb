import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Climb3D, type Progress } from '@/components/Climb3D';
import { Badge, Button, Chip, Icon, Segmented } from '@/components/ui';
import { getSetting, setSetting } from '@/lib/db';
import {
  DEFAULT_WALL,
  HOLD_TYPES,
  LEVELS,
  learnFrom,
  planRoute,
  WALL_ANGLES,
  type Plan,
  type WallAngle,
  type Weights,
} from '@/lib/planner';
import { demoRoute, listSimRoutes, pickRoutePhotos, removeSimRoute, saveSimRoutes, type SimRoute } from '@/lib/simRoutes';
import type { HoldType, Pt } from '@/lib/simulation';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

type Mode = 'holds' | '3d';
type Kind = 'hands' | 'feet';

const SPEEDS = [0.5, 1, 2, 4];

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
    if (!route) return;
    // Ajouter ou retirer une prise décale les numéros : les corrections ne s'appliquent plus.
    const renumbered =
      (changes.hands && changes.hands.length !== route.hands.length) ||
      (changes.feet && changes.feet.length !== route.feet.length);
    const next = renumbered ? { ...changes, fix: undefined } : changes;
    update(routes.map((r) => (r.id === route.id ? { ...r, ...next } : r)));
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
          <View style={s.emptyIcon}>
            <Icon name="view_in_ar" size={30} color={colors.primary} />
          </View>
          <View style={s.emptyHead}>
            <Text style={s.emptyTitle}>Simule une voie en 3D</Text>
            <Badge label="Bêta" />
          </View>
          <Text style={s.emptyText}>
            Prends en photo une voie ou un bloc, touche les prises dans l&apos;ordre, et regarde un grimpeur à ta taille la
            monter, mouvement par mouvement.
          </Text>
          <Button label="Prendre une photo" icon="photo_camera" onPress={() => add('camera')} />
          <Button label="Choisir des photos" icon="photo_library" variant="secondary" onPress={() => add('library')} />
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
          <Pressable onPress={askAdd} style={[s.thumb, s.thumbAdd]} accessibilityLabel="Ajouter une voie">
            <Icon name="add" size={26} color={colors.primary} />
          </Pressable>
        </ScrollView>
        <Segmented
          options={[
            { value: 'holds', label: 'Prises', icon: 'touch_app' },
            { value: '3d', label: 'Méthode 3D', icon: 'view_in_ar' },
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
        <Player key={route.id} route={route} onChange={patch} />
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
const WALL_KEY = 'wallHeight';
/** Hauteur de mur des nouvelles voies : la dernière réglée, sinon 6 m. */
const readWall = () => {
  const v = Number(getSetting(WALL_KEY));
  return v >= 1.5 && v <= 20 ? v : DEFAULT_WALL;
};
const ANGLE_KEY = 'wallAngle';
const readAngle = (): WallAngle => {
  const v = getSetting(ANGLE_KEY);
  return v && v in WALL_ANGLES ? (v as WallAngle) : 'vertical';
};
const WEIGHTS_KEY = 'plannerWeights';
const LEARNED_KEY = 'plannerLearned';
const readWeights = (): Weights => {
  try {
    return JSON.parse(getSetting(WEIGHTS_KEY) ?? '{}');
  } catch {
    return {};
  }
};
const readHeight = () => {
  const v = Number(getSetting(HEIGHT_KEY));
  // 1,75 était l'ancienne valeur par défaut : Clement mesure 1,80 m.
  return v >= 1.2 && v <= 2.2 && v !== 1.75 ? v : 1.8;
};

type PlayerProps = { route: SimRoute; onChange: (c: Partial<SimRoute>) => void };

/** Calcule la méthode hors du rendu (quelques dixièmes de seconde) puis affiche le lecteur. */
function Player({ route, onChange }: PlayerProps) {
  const [height, setHeight] = useState(readHeight);
  const [learned, setLearned] = useState(readWeights);
  const [learnedCount, setLearnedCount] = useState(() => Number(getSetting(LEARNED_KEY) ?? 0) || 0);
  const input = useMemo(
    () => ({ ...route, wallHeight: route.wallHeight ?? readWall(), angle: route.angle ?? readAngle() }),
    [route],
  );
  const key = JSON.stringify([input, height, learned]);
  const [result, setResult] = useState<{ key: string; plan: Plan } | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setResult({ key, plan: planRoute(input, height, learned) }), 30);
    return () => clearTimeout(id);
  }, [key, input, height, learned]);

  if (!result) {
    return (
      <View style={[s.flex, s.computing]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={s.hint}>Calcul de la méthode…</Text>
      </View>
    );
  }
  const learn = (fix: SimRoute['fix']) => {
    // Apprentissage : la méthode corrigée devient moins coûteuse pour le moteur.
    const after = planRoute({ ...input, fix }, height, learned);
    const next = learnFrom(result.plan.features, after.features, learned);
    setLearned(next);
    setSetting(WEIGHTS_KEY, JSON.stringify(next));
    setLearnedCount(learnedCount + 1);
    setSetting(LEARNED_KEY, String(learnedCount + 1));
  };
  const forget = () => {
    setLearned({});
    setSetting(WEIGHTS_KEY, '{}');
    setLearnedCount(0);
    setSetting(LEARNED_KEY, '0');
  };
  return (
    <PlayerView
      route={route}
      onChange={onChange}
      plan={result.plan}
      computing={result.key !== key}
      height={height}
      setHeight={setHeight}
      learnedCount={learnedCount}
      onLearn={learn}
      onForget={forget}
    />
  );
}

function PlayerView({
  route,
  onChange,
  plan,
  computing,
  height,
  setHeight,
  learnedCount,
  onLearn,
  onForget,
}: PlayerProps & {
  plan: Plan;
  computing: boolean;
  height: number;
  setHeight: (h: number) => void;
  learnedCount: number;
  onLearn: (fix: SimRoute['fix']) => void;
  onForget: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [restartKey, setRestartKey] = useState(0);
  const [viewKey, setViewKey] = useState(0);
  const [seek, setSeek] = useState({ t: -0.6, n: 0 });
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<Progress>({ index: 0, total: 0 });

  const total = plan.moves.length;
  const index = Math.min(progress.index, total);
  const finished = index >= total;
  const move = plan.moves[index];

  const changeHeight = (d: number) => {
    const v = Math.round(Math.min(2.2, Math.max(1.2, height + d)) * 100) / 100;
    setHeight(v);
    setSetting(HEIGHT_KEY, String(v));
  };
  const changeAngle = (angle: WallAngle) => {
    onChange({ angle });
    setSetting(ANGLE_KEY, angle);
  };
  const changeWall = (d: number) => {
    const v = Math.min(20, Math.max(1.5, plan.H + d));
    onChange({ wallHeight: v });
    setSetting(WALL_KEY, String(v));
  };
  const goTo = (i: number) => {
    setPlaying(false);
    setSeek((x) => ({ t: Math.max(0, Math.min(total, i)), n: x.n + 1 }));
  };
  const fixes = route.fix ?? {};
  const hasFixes = Object.keys(fixes.hands ?? {}).length + Object.keys(fixes.feet ?? {}).length > 0;
  /** Corrige l'étape affichée : l'autre main (ou l'autre pied) prend la prise, et la suite se recalcule. */
  const correct = () => {
    if (!move?.fix) return;
    const f = move.fix;
    const fix =
      f.kind === 'hand'
        ? { ...fixes, hands: { ...fixes.hands, [f.hold]: move.limb === 'lh' ? ('rh' as const) : ('lh' as const) } }
        : { ...fixes, feet: { ...fixes.feet, [f.label]: move.limb === 'lf' ? ('rf' as const) : ('lf' as const) } };
    onLearn(fix);
    onChange({ fix });
    goTo(index);
  };
  const resetFixes = () => {
    onChange({ fix: undefined });
    goTo(0);
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

      {computing && <Text style={s.recompute}>Recalcul de la méthode…</Text>}
      <View style={s.strip}>
        {plan.moves.map((m, i) => (
          <Pressable
            key={i}
            onPress={() => goTo(i)}
            hitSlop={{ top: 8, bottom: 8 }}
            style={[
              s.seg,
              { backgroundColor: LEVELS[m.level].color, opacity: i < index ? 0.35 : 1 },
              i === index && !finished && s.segActive,
            ]}>
            {m.crux && <View style={s.cruxDot} />}
          </Pressable>
        ))}
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
        {!finished && move && (
          <View style={s.badges}>
            <View style={[s.badge, { backgroundColor: LEVELS[move.level].color }]}>
              <Text style={s.badgeText}>{LEVELS[move.level].label}</Text>
            </View>
            {move.crux && (
              <View style={[s.badge, { backgroundColor: '#1A1A1A' }]}>
                <Text style={s.badgeText}>Crux</Text>
              </View>
            )}
            {move.corrected && <Text style={s.corrected}>✎ corrigé par toi</Text>}
          </View>
        )}
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
        {!finished && move?.fix && (
          <Pressable onPress={correct} style={({ pressed }) => [s.fixBtn, pressed && { opacity: 0.5 }]}>
            <Text style={s.fixText}>
              {move.fix.kind === 'hand'
                ? `↔ Prendre avec la main ${move.limb === 'lh' ? 'droite' : 'gauche'}`
                : `↔ Mettre le pied ${move.limb === 'lf' ? 'droit' : 'gauche'} ici`}
            </Text>
          </Pressable>
        )}
        {hasFixes && (
          <Pressable onPress={resetFixes} hitSlop={6}>
            <Text style={s.resetFix}>Annuler mes corrections</Text>
          </Pressable>
        )}
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
        <Ctrl label="−" onPress={() => changeWall(-0.5)} />
        <Ctrl label="+" onPress={() => changeWall(0.5)} />
      </View>
      <View style={s.chips}>
        {(Object.keys(WALL_ANGLES) as WallAngle[]).map((a) => (
          <Chip key={a} label={WALL_ANGLES[a].label} selected={plan.angle === a} onPress={() => changeAngle(a)} />
        ))}
      </View>
      {learnedCount > 0 && (
        <View style={s.learnRow}>
          <Text style={s.learnText}>
            Le moteur a appris de {learnedCount === 1 ? 'ta correction' : `tes ${learnedCount} corrections`}.
          </Text>
          <Pressable onPress={onForget} hitSlop={6}>
            <Text style={s.resetFix}>Oublier</Text>
          </Pressable>
        </View>
      )}
      <Text style={s.hint}>
        « Mur » est la hauteur du mur visible sur la photo, du sol au sommet (6 m par défaut) ; « Ta taille » est
        la tienne, et choisis l’inclinaison du mur (dalle, vertical, dévers). La barre de couleur montre la difficulté de chaque étape (touche-la pour y aller). Si une étape
        ne te convient pas, change la main ou le pied : la suite se recalcule. Un doigt fait tourner la caméra, deux
        doigts zooment.
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
      <Text style={[s.ctrlText, primary && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  top: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.md },
  thumbs: { gap: 8 },
  thumb: { width: 60, height: 60, borderRadius: radius.md, overflow: 'hidden', borderWidth: 2.5, borderColor: 'transparent' },
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
  thumbAdd: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: colors.primary, borderWidth: 1.5 },
  thumbAddText: { color: colors.primary, fontSize: 28, fontWeight: '600', marginTop: -2 },
  editor: { padding: space.lg, gap: space.md, paddingBottom: 40 },
  hint: { color: colors.muted, fontSize: 13, fontWeight: '400', lineHeight: 19 },
  photo: { borderRadius: radius.lg },
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
  handText: { color: colors.onPrimary, fontWeight: '800', fontSize: 12 },
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
    backgroundColor: '#111111',
    alignItems: 'center',
  },
  typeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, padding: 20, paddingBottom: 32, gap: 14, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetTitle: { ...type.title },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  glWrap: { borderRadius: radius.lg, overflow: 'hidden' },
  stepCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.border },
  stepHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stepTitle: { flex: 1, ...type.headline },
  stepCount: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  stepStart: { color: colors.text, fontSize: 14, fontWeight: '400', lineHeight: 20 },
  tip: { color: colors.text, fontSize: 14, fontWeight: '400', lineHeight: 20 },
  computing: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  recompute: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  learnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  learnText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '400' },
  strip: { flexDirection: 'row', gap: 2, paddingVertical: 4 },
  seg: { flex: 1, height: 8, borderRadius: 4, alignItems: 'center' },
  segActive: { height: 14, marginTop: -3, borderWidth: 2, borderColor: colors.text },
  cruxDot: { position: 'absolute', top: -9, width: 6, height: 6, borderRadius: 3, backgroundColor: '#1A1A1A' },
  badges: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  corrected: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  fixBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  fixText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  resetFix: { color: colors.primary, fontSize: 13, fontWeight: '700', paddingTop: 2 },
  alert: { alignSelf: 'flex-start', backgroundColor: colors.dangerSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  alertText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex: { flex: 1 },
  demo: { color: colors.primary, textAlign: 'center', fontSize: 15, fontWeight: '700', paddingTop: 4 },
  remove: { color: colors.danger, textAlign: 'center', fontSize: 14, fontWeight: '700', paddingVertical: 8 },
  emptyWrap: { justifyContent: 'center', padding: space.lg },
  emptyCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.xl, gap: space.md, borderWidth: 1, borderColor: colors.border },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  emptyHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  emptyTitle: { ...type.title, flexShrink: 1 },
  emptyText: { color: colors.muted, fontSize: 15, fontWeight: '400', lineHeight: 22, marginBottom: 6 },
  player: { padding: space.lg, gap: space.md, paddingBottom: 40 },
  ctrl: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  ctrlPrimary: { backgroundColor: colors.primary },
  ctrlText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  sizeLabel: { flex: 1.4, color: colors.text, fontSize: 14, fontWeight: '600' },
});
