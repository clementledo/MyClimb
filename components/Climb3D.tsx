import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';

import type { SimRoute } from '@/lib/simRoutes';
import type { Plan } from '@/lib/planner';
import { contactsAt, skeleton, type P3 } from '@/lib/simulation';
import { colors } from '@/lib/theme';

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

const DEFAULT_CAM = { yaw: 0.4, pitch: 0.12, zoom: 1 };

type Cam = typeof DEFAULT_CAM;

/** Un doigt fait tourner la caméra autour du mur, deux doigts zooment. */
function orbitGestures(cam: Cam) {
  let start = { ...cam };
  let pinch: number | null = null;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
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

export function Climb3D({ route, plan, playing, speed, restartKey, viewKey, seek, step, onProgress, onEnd }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // Erreur du moteur 3D : affichée au lieu de faire planter l'app.
  const [failure, setFailure] = useState<string | null>(null);
  const live = useRef({ playing, speed, onProgress, onEnd, plan, t: -0.6, dirty: true, stopAt: null as number | null });
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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#E9EDF2');
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.05, 200);

    // Lumières : ambiance douce + soleil qui projette l'ombre du grimpeur sur le mur.
    scene.add(new THREE.HemisphereLight('#ffffff', '#e2ded6', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 1.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

    // Mur, sol et tapis.
    const wallMat = new THREE.MeshLambertMaterial({ color: '#cfd4da' });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wallMat);
    wall.receiveShadow = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: '#d9dde3' }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.25, 1.4),
      new THREE.MeshLambertMaterial({ color: '#34507F' }),
    );
    pad.position.set(0, 0.125, 0.75);
    pad.receiveShadow = true;
    scene.add(wall, floor, pad);
    const toWorld = (p: P3) => {
      const { W, H } = live.current.plan;
      return new THREE.Vector3(p.x - W / 2, H - p.y, p.z);
    };

    // Bonhomme : formes unitaires, redimensionnées à chaque image.
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
    const sphere = new THREE.SphereGeometry(1, 20, 14);
    const torsoGeo = new THREE.CylinderGeometry(1, 0.78, 1, 20);
    const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
    const skin = mat('#E2AE8C');
    const shirt = mat(colors.primary);
    const pants = mat('#2F3E5C');
    const shoe = mat('#2B2B2B');
    const hair = mat('#3B2A20');
    const climber = new THREE.Group();
    const part = (geo: THREE.BufferGeometry, m: THREE.Material) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = true;
      climber.add(mesh);
      return mesh;
    };
    const torso = part(torsoGeo, shirt);
    const shorts = part(sphere, pants);
    const head = part(sphere, skin);
    const cap = part(sphere, hair);
    const neck = part(cyl, skin);
    const arms = [0, 1].map(() => ({
      shoulder: part(sphere, shirt),
      upper: part(cyl, shirt),
      elbow: part(sphere, skin),
      fore: part(cyl, skin),
      hand: part(sphere, skin),
    }));
    const legs = [0, 1].map(() => ({
      thigh: part(cyl, pants),
      knee: part(sphere, pants),
      shin: part(cyl, pants),
      foot: part(sphere, shoe),
    }));
    scene.add(climber);

    // Repères sur les prises touchées.
    const holds = new THREE.Group();
    scene.add(holds);
    const ringGeo = new THREE.TorusGeometry(1, 0.16, 10, 28);
    const buildHolds = () => {
      holds.clear();
      const p = live.current.plan;
      const ring = (x: number, y: number, color: string, r: number) => {
        const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color }));
        m.position.copy(toWorld({ x, y, z: 0.01 }));
        m.scale.setScalar(r);
        holds.add(m);
      };
      p.hands.forEach((h, i) =>
        ring(h.x, h.y, i === p.hands.length - 1 ? colors.success : colors.primary, p.height * 0.045),
      );
      p.feet.forEach((f) => ring(f.x, f.y, '#1C7ED6', p.height * 0.03));
    };

    const Y = new THREE.Vector3(0, 1, 0);
    const between = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, r: number) => {
      const d = b.clone().sub(a);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.scale.set(r, d.length(), r);
      mesh.quaternion.setFromUnitVectors(Y, d.normalize());
    };
    const ball = (mesh: THREE.Mesh, at: THREE.Vector3, r: number) => {
      mesh.position.copy(at);
      mesh.scale.setScalar(r);
    };
    const basis = new THREE.Matrix4();

    const pose = (t: number) => {
      const p = live.current.plan;
      const hgt = p.height;
      const { c, types, moving, lift } = contactsAt(p.start, p.startTypes, p.moves, t);
      const s = skeleton(c, hgt, moving, lift, types);
      const chest = toWorld(s.chest);
      const pelvis = toWorld(s.pelvis);
      const neckP = toWorld(s.neck);

      // Buste aplati, face au mur.
      const yAx = chest.clone().sub(pelvis).normalize();
      const zAx = new THREE.Vector3(0, 0, 1).addScaledVector(yAx, -yAx.z).normalize();
      const xAx = new THREE.Vector3().crossVectors(yAx, zAx);
      basis.makeBasis(xAx, yAx, zAx);
      const top = chest.clone().addScaledVector(yAx, hgt * 0.02);
      torso.position.copy(top).add(pelvis).multiplyScalar(0.5);
      torso.quaternion.setFromRotationMatrix(basis);
      torso.scale.set(hgt * 0.095, top.distanceTo(pelvis), hgt * 0.055);
      shorts.position.copy(pelvis);
      shorts.quaternion.copy(torso.quaternion);
      shorts.scale.set(hgt * 0.085, hgt * 0.06, hgt * 0.055);
      between(neck, chest, neckP, hgt * 0.025);
      const headP = toWorld(s.head);
      ball(head, headP, hgt * 0.062);
      ball(cap, headP.clone().addScaledVector(yAx, hgt * 0.012).add(new THREE.Vector3(0, 0, hgt * 0.008)), hgt * 0.06);

      s.arms.forEach((a, i) => {
        const sh = toWorld(a.shoulder);
        const el = toWorld(a.elbow);
        const ha = toWorld(a.hand);
        ball(arms[i].shoulder, sh, hgt * 0.04);
        between(arms[i].upper, sh, el, hgt * 0.03);
        ball(arms[i].elbow, el, hgt * 0.024);
        between(arms[i].fore, el, ha, hgt * 0.022);
        ball(arms[i].hand, ha, hgt * 0.028);
      });
      s.legs.forEach((l, i) => {
        const hi = toWorld(l.hip);
        const kn = toWorld(l.knee);
        const fo = toWorld(l.foot);
        between(legs[i].thigh, hi, kn, hgt * 0.042);
        ball(legs[i].knee, kn, hgt * 0.034);
        between(legs[i].shin, kn, fo, hgt * 0.03);
        legs[i].foot.position.copy(fo).add(new THREE.Vector3(0, hgt * 0.005, hgt * 0.025));
        legs[i].foot.scale.set(hgt * 0.035, hgt * 0.028, hgt * 0.06);
      });
      return pelvis;
    };

    // La caméra suit le grimpeur en douceur.
    const target = new THREE.Vector3(0, live.current.plan.H / 2, 0);
    let first = true;
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
        buildHolds();
        const { W, H } = L.plan;
        wall.scale.set(W, H, 1);
        wall.position.set(0, H / 2, 0);
        pad.scale.set(Math.max(2, W * 0.9), 1, 1);
        const span = Math.max(W, H) * 0.8;
        sun.position.set(span * 0.6, H + span * 0.7, span * 1.2);
        sun.target.position.set(0, H / 2, 0);
        Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.1, far: span * 5 });
        sun.shadow.camera.updateProjectionMatrix();
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

      const pelvis = pose(Math.max(0, t));
      const follow = new THREE.Vector3(pelvis.x * 0.6, pelvis.y + L.plan.height * 0.15, 0);
      if (first) target.copy(follow);
      else target.lerp(follow, 0.06);
      first = false;
      const { yaw, pitch, zoom } = cam;
      const dist = L.plan.height * 2.6 * zoom;
      camera.position.set(
        target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.max(0.2, target.y + Math.sin(pitch) * dist),
        target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      camera.lookAt(target);

      renderer.render(scene, camera);
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
        wallMat.map = tex;
        wallMat.color.set('#ffffff');
        wallMat.needsUpdate = true;
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

const s = StyleSheet.create({
  container: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E9EDF2' },
  gl: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(233,237,242,0.6)',
  },
  failTitle: { color: colors.danger, fontWeight: '700', fontSize: 16 },
  failText: { color: colors.muted, fontSize: 12, paddingHorizontal: 20, textAlign: 'center' },
  overlayText: { color: colors.muted, fontWeight: '600' },
  error: { position: 'absolute', top: 12, alignSelf: 'center', color: colors.danger, fontWeight: '600' },
});
