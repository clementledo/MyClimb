import { Image } from 'expo-image';
import type { AndroidSymbol } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';

import { Climb3D, type Progress } from '@/components/Climb3D';
import { Badge, Button, Chip, Icon, IconButton, Segmented, Sheet } from '@/components/ui';
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
  const [routes, setRoutes] = useState<SimRoute[]>(() => {
    resetAnglesOnce();
    return listSimRoutes();
  });
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
          ? 'Touche les prises de main dans l’ordre, du départ au top.'
          : 'Touche les prises de pied, dans n’importe quel ordre.'}
        {' '}Touche une prise placée pour la modifier.
      </Text>
      <Pressable onPress={(e) => tap(e.nativeEvent.locationX, e.nativeEvent.locationY)}>
        <View style={{ width: w, height: h }}>
          <Image source={{ uri: route.photo }} style={[s.photo, { width: w, height: h }]} contentFit="cover" />
          {route.hands.length > 1 && (
            // Le trajet des mains, dans l'ordre : on voit d'un coup d'œil la ligne de la voie.
            <Svg pointerEvents="none" width={w} height={h} style={s.path}>
              <Polyline
                points={route.hands.map((p) => `${p.x * w},${p.y * h}`).join(' ')}
                fill="none"
                stroke="rgba(0,0,0,0.3)"
                strokeWidth={5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Polyline
                points={route.hands.map((p) => `${p.x * w},${p.y * h}`).join(' ')}
                fill="none"
                stroke="#fff"
                strokeWidth={2.5}
                strokeDasharray="2 7"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </Svg>
          )}
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
      <Button label="Voir la méthode en 3D" icon="view_in_ar" disabled={route.hands.length < 2} onPress={onPlay} />
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
/**
 * Une seule fois : les voies déjà créées repassent en mur vertical (l'inclinaison avait souvent
 * été changée en essayant le réglage). Le choix reste possible dans Réglages.
 */
const resetAnglesOnce = () => {
  if (getSetting('anglesReset') === '1') return;
  setSetting(ANGLE_KEY, 'vertical');
  saveSimRoutes(listSimRoutes().map((r) => ({ ...r, angle: undefined })));
  setSetting('anglesReset', '1');
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
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [restartKey, setRestartKey] = useState(0);
  const [viewKey, setViewKey] = useState(0);
  const [seek, setSeek] = useState({ t: -0.6, n: 0 });
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<Progress>({ index: 0, total: 0 });
  const [settings, setSettings] = useState(false);
  const [full, setFull] = useState(false);
  const insets = useSafeAreaInsets();
  // La 3D prend toute la place laissée par les commandes (mesurées une fois).
  const [box, setBox] = useState(0);
  const [below, setBelow] = useState(0);
  const glHeight = Math.round(Math.max(260, box - below - space.md * 2 - space.lg));

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
    setSettings(false);
  };
  /** Passe en plein écran (ou en sort) en gardant l'étape en cours. */
  const openFull = (on: boolean) => {
    setPlaying(false);
    setSeek((x) => ({ t: Math.max(0, Math.min(total, index)), n: x.n + 1 }));
    setFull(on);
  };
  const togglePlay = () => {
    if (finished && !playing) setRestartKey((k) => k + 1);
    setPlaying(!playing);
  };

  const fmt = (v: number, d: number) => v.toFixed(d).replace('.', ',');
  const title = finished ? 'Top !' : index === 0 && progress.total === 0 ? 'Départ' : (move?.title ?? '');
  const level = !finished && move ? LEVELS[move.level] : null;

  const strip = (
    <View style={s.strip}>
      {plan.moves.map((m, i) => (
        <Pressable
          key={i}
          onPress={() => goTo(i)}
          hitSlop={{ top: 10, bottom: 10 }}
          style={[
            s.seg,
            { backgroundColor: LEVELS[m.level].color, opacity: i < index ? 0.3 : 1 },
            i === index && !finished && s.segActive,
          ]}>
          {m.crux && <View style={s.cruxDot} />}
        </Pressable>
      ))}
    </View>
  );
  const info = (
    <>
      <View style={s.stepRow}>
        <View style={[s.levelDot, { backgroundColor: level?.color ?? colors.success }]} />
        <Text style={s.stepTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={s.stepCount}>
          {Math.min(index + 1, total)}/{total}
        </Text>
      </View>
      <View style={s.tags}>
        {finished ? (
          <Text style={s.tagMuted}>Voie enchaînée en {total} mouvements</Text>
        ) : (
          <>
            {level && <Text style={[s.tag, { color: level.color }]}>{level.label}</Text>}
            {move?.crux && <Text style={[s.tag, s.tagStrong]}>Crux</Text>}
            {move?.alerts.slice(0, 2).map((a) => (
              <Text key={a} style={[s.tag, s.tagAlert]} numberOfLines={1}>
                {a}
              </Text>
            ))}
            {move?.corrected && <Icon name="edit" size={14} color={colors.muted} />}
          </>
        )}
        <View style={s.flex} />
        {!finished && move?.fix && (
          <Pressable
            onPress={correct}
            accessibilityLabel="Corriger l’étape"
            hitSlop={6}
            style={({ pressed }) => [s.fixBtn, pressed && { opacity: 0.6 }]}>
            <Icon name="swap_horiz" size={16} color={colors.primary} />
            <Text style={s.fixText}>
              {move.fix.kind === 'hand'
                ? `Main ${move.limb === 'lh' ? 'droite' : 'gauche'}`
                : `Pied ${move.limb === 'lf' ? 'droit' : 'gauche'}`}
            </Text>
          </Pressable>
        )}
      </View>
    </>
  );
  const controls = (
    <View style={s.controls}>
      <RoundButton icon="restart_alt" label="Recommencer" onPress={() => { setPlaying(false); setRestartKey((k) => k + 1); }} />
      <RoundButton icon="skip_previous" label="Étape précédente" onPress={() => goTo(index - 1)} disabled={index === 0} />
      <Pressable
        onPress={togglePlay}
        accessibilityLabel={playing ? 'Pause' : 'Lecture'}
        style={({ pressed }) => [s.play, pressed && { opacity: 0.8 }]}>
        <Icon name={playing ? 'pause' : 'play_arrow'} size={34} color={colors.onPrimary} />
      </Pressable>
      <RoundButton
        icon="skip_next"
        label="Étape suivante"
        disabled={finished}
        onPress={() => {
          setPlaying(false);
          setStep((k) => k + 1);
        }}
      />
      <Pressable
        onPress={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
        accessibilityLabel="Vitesse"
        style={({ pressed }) => [s.speed, pressed && { opacity: 0.6 }]}>
        <Text style={s.speedText}>×{fmt(speed, speed % 1 ? 1 : 0)}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={s.flex} onLayout={(e) => setBox(e.nativeEvent.layout.height)}>
      <ScrollView style={s.flex} contentContainerStyle={s.player}>
        <View style={[s.glWrap, { height: glHeight }]}>
          {box > 0 && below > 0 && !full && (
            <Climb3D
              key={glHeight}
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
          )}
          <Pressable
            onPress={() => setViewKey((k) => k + 1)}
            accessibilityLabel="Vue de face"
            hitSlop={6}
            style={({ pressed }) => [s.glButton, pressed && { opacity: 0.6 }]}>
            <Icon name="center_focus_strong" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => openFull(true)}
            accessibilityLabel="Plein écran"
            hitSlop={6}
            style={({ pressed }) => [s.glButton, s.glButton2, pressed && { opacity: 0.6 }]}>
            <Icon name="fullscreen" size={22} color={colors.text} />
          </Pressable>
          {computing && (
            <View style={s.glBadge} pointerEvents="none">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={s.glBadgeText}>Recalcul…</Text>
            </View>
          )}
        </View>

        <View style={s.below} onLayout={(e) => setBelow(e.nativeEvent.layout.height)}>
          {strip}

          {info}

          {controls}

          <Pressable style={s.summary} onPress={() => setSettings(true)} accessibilityLabel="Réglages">
            <Icon name="tune" size={18} color={colors.primary} />
            <Text style={s.summaryText} numberOfLines={1}>
              {fmt(height, 2)} m · mur {fmt(plan.H, 1)} m · {WALL_ANGLES[plan.angle].label}
            </Text>
            <Icon name="expand_more" size={18} color={colors.muted} />
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={full} animationType="fade" onRequestClose={() => openFull(false)} statusBarTranslucent>
        <View style={s.full}>
          {full && (
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
          )}
          <View style={[s.fullTop, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
            <RoundButton icon="close" label="Quitter le plein écran" onPress={() => openFull(false)} glass />
            <View style={s.flex} />
            <RoundButton icon="center_focus_strong" label="Vue de face" onPress={() => setViewKey((k) => k + 1)} glass />
          </View>
          <View style={[s.fullPanel, { paddingBottom: insets.bottom + space.md }]}>
            {strip}
            {info}
            {controls}
          </View>
        </View>
      </Modal>

      <Sheet visible={settings} onClose={() => setSettings(false)} title="Réglages">
        <Stepper label="Ta taille" value={`${fmt(height, 2)} m`} onMinus={() => changeHeight(-0.05)} onPlus={() => changeHeight(0.05)} />
        <Stepper label="Hauteur du mur" value={`${fmt(plan.H, 1)} m`} onMinus={() => changeWall(-0.5)} onPlus={() => changeWall(0.5)} />
        <Text style={s.sheetLabel}>Inclinaison</Text>
        <View style={s.chips}>
          {(Object.keys(WALL_ANGLES) as WallAngle[]).map((a) => (
            <Chip key={a} label={WALL_ANGLES[a].label} selected={plan.angle === a} onPress={() => changeAngle(a)} />
          ))}
        </View>
        {hasFixes && <Button label="Annuler mes corrections" icon="undo" variant="secondary" onPress={resetFixes} />}
        {learnedCount > 0 && (
          <View style={s.learnRow}>
            <Text style={s.learnText}>
              Le moteur a appris de {learnedCount === 1 ? 'ta correction' : `tes ${learnedCount} corrections`}.
            </Text>
            <Pressable onPress={onForget} hitSlop={6}>
              <Text style={s.link}>Oublier</Text>
            </Pressable>
          </View>
        )}
        <Text style={s.hint}>
          La hauteur du mur est celle visible sur la photo. Un doigt fait tourner la caméra, deux doigts zooment.
        </Text>
      </Sheet>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  disabled,
  glass,
}: {
  icon: AndroidSymbol;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Sur la 3D : fond de carte légèrement transparent. */
  glass?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [s.round, glass && s.roundGlass, (pressed || disabled) && { opacity: 0.4 }]}>
      <Icon name={icon} size={24} color={colors.text} />
    </Pressable>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={s.stepper}>
      <View style={s.flex}>
        <Text style={s.sheetLabel}>{label}</Text>
        <Text style={s.stepperValue}>{value}</Text>
      </View>
      <IconButton icon="remove" label={`${label} moins`} onPress={onMinus} />
      <IconButton icon="add" label={`${label} plus`} onPress={onPlus} />
    </View>
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
  path: { position: 'absolute', left: 0, top: 0 },
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
    elevation: 3,
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
    elevation: 2,
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
  computing: { alignItems: 'center', justifyContent: 'center', gap: 10 },
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
  player: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, gap: space.md },
  glWrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  glButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    opacity: 0.92,
  },
  glButton2: { top: 56 },
  full: { flex: 1, backgroundColor: colors.background },
  fullTop: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', paddingHorizontal: space.lg },
  fullPanel: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: 0,
    gap: space.md,
    padding: space.lg,
    paddingBottom: space.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.card,
    opacity: 0.96,
  },
  roundGlass: { backgroundColor: colors.card, opacity: 0.92 },
  glBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
  },
  glBadgeText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  below: { gap: space.md },
  strip: { flexDirection: 'row', gap: 3, height: 14, alignItems: 'center' },
  seg: { flex: 1, height: 6, borderRadius: 3, alignItems: 'center' },
  segActive: { height: 12, borderRadius: 4 },
  cruxDot: { position: 'absolute', top: -8, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.text },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: -space.xs },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  stepTitle: { flex: 1, ...type.headline },
  stepCount: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  tags: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 30, marginTop: -space.sm, overflow: 'hidden' },
  tag: { fontSize: 13, fontWeight: '700' },
  tagStrong: { color: colors.text },
  tagAlert: { color: colors.danger, flexShrink: 1 },
  tagMuted: { fontSize: 13, fontWeight: '500', color: colors.muted },
  fixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  fixText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  play: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, elevation: 3 },
  speed: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  speedText: { fontSize: 15, fontWeight: '800', color: colors.text },
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
  sheetLabel: { ...type.callout },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepperValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  learnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  learnText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '400' },
  link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
