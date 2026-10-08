import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';

import type { SimRoute } from '@/lib/simRoutes';
import { createClimbScene, type Cam } from '@/lib/climbScene';
import type { CelebrationId } from '@/lib/cosmetics';
import type { Plan } from '@/lib/planner';
import type { SkinId } from '@/lib/skins';
import { colors, isDark, themedStyles } from '@/lib/theme';

/** Mouvements par seconde à la vitesse normale. */
const MOVES_PER_S = 0.8;

export type Progress = { index: number; total: number };

/** Photo réduite, décodée en pixels pour servir de texture au mur. */
async function loadWallTexture(route: SimRoute) {
  const ctx = ImageManipulator.manipulate(route.photo);
  if (Math.max(route.width, route.height) > 1024) {
    ctx.resize(route.width >= route.height ? { width: 1024 } : { height: 1024 });
  }
  const img = await ctx.renderAsync();
  const saved = await img.saveAsync({ base64: true, compress: 0.9, format: SaveFormat.JPEG });
  const bin = atob(saved.base64 ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const raw = decode(bytes, { useTArray: true, formatAsRGBA: true });
  // Les lignes de la texture partent du bas : on retourne l'image.
  const row = raw.width * 4;
  const data = new Uint8Array(raw.data.length);
  for (let y = 0; y < raw.height; y++) {
    data.set(raw.data.subarray(y * row, (y + 1) * row), (raw.height - 1 - y) * row);
  }
  const tex = new THREE.DataTexture(data, raw.width, raw.height, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

type Props = {
  route: SimRoute;
  plan: Plan;
  /** Costume du grimpeur. */
  skin: SkinId;
  /** Célébration jouée en 3D à l'arrivée au top (null : aucune). */
  celebration: CelebrationId | null;
  playing: boolean;
  speed: number;
  /** Change pour relancer la grimpe depuis le début. */
  restartKey: number;
  /** Change pour remettre la caméra de face. */
  viewKey: number;
  /** Aller à un mouvement précis (`n` change à chaque demande). */
  seek: { t: number; n: number };
  /** Jouer un seul mouvement puis s'arrêter (`n` change à chaque demande). */
  step: number;
  onProgress: (p: Progress) => void;
  onEnd: () => void;
};

const DEFAULT_CAM: Cam = { yaw: 0.35, pitch: 0.14, zoom: 1 };

/** Un doigt fait tourner la caméra autour du mur, deux doigts zooment. */
function orbitGestures(cam: Cam) {
  let start = { ...cam };
  let pinch: number | null = null;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // La page défile autour : le geste reste à la 3D une fois commencé.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      start = { ...cam };
      pinch = null;
    },
    onPanResponderMove: (e, g) => {
      const t = e.nativeEvent.touches;
      if (t.length >= 2) {
        const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
        if (pinch === null) {
          pinch = d;
          start = { ...cam };
        }
        cam.zoom = Math.min(3, Math.max(0.35, (start.zoom * pinch) / Math.max(d, 1)));
      } else if (pinch === null) {
        cam.yaw = Math.min(1.4, Math.max(-1.4, start.yaw - g.dx * 0.008));
        cam.pitch = Math.min(1.2, Math.max(-0.25, start.pitch + g.dy * 0.006));
      }
    },
  });
}

export function Climb3D({ route, plan, skin, celebration, playing, speed, restartKey, viewKey, seek, step, onProgress, onEnd }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // Erreur du moteur 3D : affichée au lieu de faire planter l'app.
  const [failure, setFailure] = useState<string | null>(null);
  const live = useRef({
    playing,
    speed,
    onProgress,
    onEnd,
    plan,
    skin,
    celebration,
    t: -0.6,
    dirty: true,
    skinDirty: false,
    celebrationDirty: false,
    stopAt: null as number | null,
  });
  // Caméra : objet modifié par les gestes et lu par la boucle de rendu.
  const [cam] = useState(() => ({ ...DEFAULT_CAM }));
  const [pan] = useState(() => orbitGestures(cam));

  useEffect(() => {
    Object.assign(live.current, { playing, speed, onProgress, onEnd });
  }, [playing, speed, onProgress, onEnd]);
  useEffect(() => {
    Object.assign(live.current, { plan, dirty: true });
  }, [plan]);
  useEffect(() => {
    if (live.current.skin !== skin) Object.assign(live.current, { skin, skinDirty: true });
  }, [skin]);
  useEffect(() => {
    if (live.current.celebration !== celebration) Object.assign(live.current, { celebration, celebrationDirty: true });
  }, [celebration]);
  useEffect(() => {
    if (seek.n > 0) Object.assign(live.current, { t: seek.t, stopAt: null });
  }, [seek]);
  useEffect(() => {
    if (step > 0) {
      const L = live.current;
      L.stopAt = Math.min(L.plan.moves.length, Math.floor(Math.max(0, L.t) + 1e-6) + 1);
      if (L.t < 0) L.t = 0;
    }
  }, [step]);
  useEffect(() => {
    live.current.t = -0.6;
  }, [restartKey]);
  useEffect(() => {
    Object.assign(cam, DEFAULT_CAM);
  }, [viewKey, cam]);

  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      setup(gl);
    } catch (e) {
      cleanup.current();
      setFailure(e instanceof Error ? e.message : String(e));
    }
  };

  const setup = (gl: ExpoWebGLRenderingContext) => {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    if (Platform.OS !== 'web') {
      // expo-gl ne gère que ces deux réglages ; les autres ne font qu'écrire des avertissements.
      const pixelStorei = gl.pixelStorei.bind(gl);
      gl.pixelStorei = (pname: number, param: number | boolean) => {
        if (pname === gl.UNPACK_FLIP_Y_WEBGL || pname === gl.UNPACK_ALIGNMENT) pixelStorei(pname, param as number);
      };
    }
    const canvas = {
      width: w,
      height: h,
      clientWidth: w,
      clientHeight: h,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => gl,
    };
    // Le contexte passe par canvas.getContext et non par l'option `context` : sur Android,
    // le contexte d'expo-gl est aussi un WebGLRenderingContext et three.js le refuserait (WebGL 1).
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas as unknown as HTMLCanvasElement,
      antialias: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    const world = createClimbScene(
      renderer,
      w,
      h,
      { background: colors.background, primary: colors.primary, success: colors.success, dark: isDark() },
      () => live.current.plan,
      live.current.skin,
      live.current.celebration,
    );

    let last = Date.now();
    let lastIndex = -1;
    let ended = false;
    let frame = 0;
    let disposed = false;

    const loop = () => {
      if (disposed) return;
      try {
        step();
      } catch (e) {
        disposed = true;
        setFailure(e instanceof Error ? e.message : String(e));
      }
    };

    const step = () => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const L = live.current;
      if (L.dirty) {
        L.dirty = false;
        world.rebuild();
      }
      if (L.skinDirty) {
        L.skinDirty = false;
        world.setSkin(L.skin);
      }
      if (L.celebrationDirty) {
        L.celebrationDirty = false;
        world.setCelebration(L.celebration);
      }
      const total = L.plan.moves.length;
      if (L.playing || L.stopAt !== null) L.t += dt * MOVES_PER_S * L.speed;
      if (L.stopAt !== null && L.t >= L.stopAt) {
        L.t = L.stopAt;
        L.stopAt = null;
      }
      if (L.t < -0.6) L.t = -0.6;
      const t = Math.min(L.t, total);
      const index = Math.max(0, Math.min(total, Math.floor(t)));
      if (index !== lastIndex) {
        lastIndex = index;
        L.onProgress({ index, total });
      }
      if (L.t >= total + 0.6 && L.playing && !ended) {
        ended = true;
        L.onEnd();
      }
      if (L.t < total) ended = false;

      world.frame(Math.max(0, t), now, cam);
      gl.endFrameEXP();
      frame = requestAnimationFrame(loop);
    };
    loop();

    cleanup.current = () => {
      disposed = true;
      cancelAnimationFrame(frame);
      renderer.dispose();
    };

    loadWallTexture(route)
      .then((tex) => {
        if (disposed) return;
        world.setWallTexture(tex);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };

  return (
    <View style={s.container}>
      <GLView style={s.gl} onContextCreate={onContextCreate} {...pan.panHandlers} />
      {failure !== null && (
        <View style={s.overlay}>
          <Text style={s.failTitle}>La 3D n’a pas pu démarrer</Text>
          <Text style={s.failText} selectable>
            {failure}
          </Text>
        </View>
      )}
      {failure === null && status === 'loading' && (
        <View style={s.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
          <Text style={s.overlayText}>Préparation du mur…</Text>
        </View>
      )}
      {status === 'error' && (
        <Text style={s.error} pointerEvents="none">
          Photo impossible à afficher sur le mur.
        </Text>
      )}
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface },
  gl: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
  },
  failTitle: { color: colors.danger, fontWeight: '700', fontSize: 16 },
  failText: { color: colors.muted, fontSize: 12, paddingHorizontal: 20, textAlign: 'center' },
  overlayText: { color: colors.muted, fontWeight: '600' },
  error: { position: 'absolute', top: 12, alignSelf: 'center', color: colors.danger, fontWeight: '600' },
});
