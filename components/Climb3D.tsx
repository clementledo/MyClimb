import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';

import type { SimRoute } from '@/lib/simRoutes';
import { WALL_ANGLES, type Plan } from '@/lib/planner';
import { contactsAt, skeleton, type P3 } from '@/lib/simulation';
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

const DEFAULT_CAM = { yaw: 0.35, pitch: 0.14, zoom: 1 };

type Cam = typeof DEFAULT_CAM;

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
    // Rendu plus doux des couleurs (sans brûler l'orange du t-shirt).
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Fond de la couleur du thème ; le brouillard fond le sol dans le décor (plus de bord visible).
    const scene = new THREE.Scene();
    const bg = new THREE.Color(colors.background).lerp(new THREE.Color(isDark() ? '#000000' : '#d5dae2'), 0.3);
    scene.background = bg;
    const fog = new THREE.Fog(bg, 8, 30);
    scene.fog = fog;
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.05, 200);

    // Lumières : ambiance douce, soleil qui projette l'ombre du grimpeur, et un contre-jour qui détache sa silhouette.
    scene.add(new THREE.HemisphereLight('#ffffff', '#e2ded6', 2.1));
    const sun = new THREE.DirectionalLight('#fff8ef', 1.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    const rim = new THREE.DirectionalLight('#dbe7ff', 0.7);
    scene.add(sun, sun.target, rim, rim.target);

    // Mur : un panneau épais en contreplaqué, la photo sur la face avant.
    const WALL_D = 0.16;
    const wallMat = new THREE.MeshLambertMaterial({ color: '#cfd4da' });
    // La photo garde ses vraies couleurs.
    wallMat.toneMapped = false;
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#c8a57a', roughness: 0.9 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [edgeMat, edgeMat, edgeMat, edgeMat, wallMat, edgeMat]);
    wall.receiveShadow = true;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshLambertMaterial({ color: bg.clone().lerp(new THREE.Color('#7d838c'), 0.18) }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    // Tapis : plusieurs blocs côte à côte, dessus plus clair.
    const pads = new THREE.Group();
    const padSide = new THREE.MeshStandardMaterial({ color: '#2f3d55', roughness: 0.85 });
    const padTop = new THREE.MeshStandardMaterial({ color: '#40557a', roughness: 0.95 });
    const padGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildPads = (W: number) => {
      pads.clear();
      const span = Math.max(2, W * 0.95);
      const n = Math.max(1, Math.round(span / 1.9));
      const each = span / n;
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(padGeo, [padSide, padSide, padTop, padSide, padSide, padSide]);
        m.scale.set(each - 0.05, 0.3, 1.9);
        m.position.set(-span / 2 + each * (i + 0.5), 0.15, 1.0);
        m.receiveShadow = true;
        pads.add(m);
      }
    };
    // Mur incliné (dévers ou dalle) : le mur, les prises et le grimpeur tournent autour du pied du mur.
    const tilt = new THREE.Group();
    scene.add(tilt, floor, pads);
    tilt.add(wall);
    const toWorld = (p: P3) => {
      const { W, H } = live.current.plan;
      return new THREE.Vector3(p.x - W / 2, H - p.y, p.z);
    };

    // Grimpeur : membres effilés et articulations de même diamètre, pour une silhouette lisse.
    const taper = (top: number) => new THREE.CylinderGeometry(top, 1, 1, 18);
    const sphere = new THREE.SphereGeometry(1, 24, 16);
    const torsoGeo = new THREE.CylinderGeometry(1, 0.8, 1, 24);
    const upperGeo = taper(0.82);
    const foreGeo = taper(0.75);
    const thighGeo = taper(0.72);
    const shinGeo = taper(0.66);
    const cylGeo = taper(1);
    const mat = (color: string, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });
    const skin = mat('#E3B18D', 0.6);
    const shirt = mat(colors.primary, 0.75);
    const pants = mat('#323a48', 0.85);
    const hair = mat('#3B2A20', 0.9);
    const bagMat = mat('#262626', 0.9);
    const bagRim = mat('#f4f4f4', 0.8);
    // Une main et un chausson par membre, pour pouvoir éclairer celui qui bouge.
    const handMats = [mat('#E3B18D', 0.6), mat('#E3B18D', 0.6)];
    const shoeMats = [mat('#F0B429', 0.6), mat('#F0B429', 0.6)];
    const glow = new THREE.Color(colors.primary);
    const climber = new THREE.Group();
    const part = (geo: THREE.BufferGeometry, m: THREE.Material) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = true;
      climber.add(mesh);
      return mesh;
    };
    const torso = part(torsoGeo, shirt);
    const shorts = part(sphere, pants);
    const bag = part(cylGeo, bagMat);
    const bagTop = part(cylGeo, bagRim);
    const head = part(sphere, skin);
    const cap = part(sphere, hair);
    const neck = part(cylGeo, skin);
    const arms = [0, 1].map((i) => ({
      shoulder: part(sphere, shirt),
      upper: part(upperGeo, shirt),
      elbow: part(sphere, skin),
      fore: part(foreGeo, skin),
      hand: part(sphere, handMats[i]),
    }));
    const legs = [0, 1].map((i) => ({
      hip: part(sphere, pants),
      thigh: part(thighGeo, pants),
      knee: part(sphere, pants),
      shin: part(shinGeo, pants),
      foot: part(sphere, shoeMats[i]),
    }));
    tilt.add(climber);

    // Repères sur les prises, et un repère animé sur la prise visée par le mouvement en cours.
    const holds = new THREE.Group();
    tilt.add(holds);
    const ringGeo = new THREE.TorusGeometry(1, 0.13, 12, 40);
    const discGeo = new THREE.CircleGeometry(1, 40);
    const FOOT_COLOR = '#1C7ED6';
    const buildHolds = () => {
      holds.clear();
      const p = live.current.plan;
      const ring = (x: number, y: number, color: string, r: number) => {
        const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
        m.position.copy(toWorld({ x, y, z: 0.01 }));
        m.scale.setScalar(r);
        holds.add(m);
      };
      p.hands.forEach((h, i) =>
        ring(h.x, h.y, i === p.hands.length - 1 ? colors.success : colors.primary, p.height * 0.04),
      );
      p.feet.forEach((f) => ring(f.x, f.y, FOOT_COLOR, p.height * 0.028));
    };
    const targetRingMat = new THREE.MeshBasicMaterial({ color: colors.primary, transparent: true, depthWrite: false });
    const targetDiscMat = new THREE.MeshBasicMaterial({ color: colors.primary, transparent: true, depthWrite: false });
    const target = new THREE.Group();
    const targetRing = new THREE.Mesh(ringGeo, targetRingMat);
    const targetDisc = new THREE.Mesh(discGeo, targetDiscMat);
    target.add(targetDisc, targetRing);
    tilt.add(target);

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
      const { c, types, moving, lift, crouch } = contactsAt(p.start, p.startTypes, p.moves, t);
      const s = skeleton(c, hgt, moving, lift, types, crouch);
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
      shorts.scale.set(hgt * 0.088, hgt * 0.062, hgt * 0.056);
      // Sac à magnésie dans le dos, à la ceinture.
      const bagP = pelvis.clone().addScaledVector(zAx, hgt * 0.072).addScaledVector(yAx, hgt * 0.015);
      bag.position.copy(bagP);
      bag.quaternion.copy(torso.quaternion);
      bag.scale.set(hgt * 0.026, hgt * 0.07, hgt * 0.026);
      bagTop.position.copy(bagP).addScaledVector(yAx, hgt * 0.037);
      bagTop.quaternion.copy(torso.quaternion);
      bagTop.scale.set(hgt * 0.028, hgt * 0.008, hgt * 0.028);
      between(neck, chest, neckP, hgt * 0.025);
      const headP = toWorld(s.head);
      ball(head, headP, hgt * 0.062);
      ball(cap, headP.clone().addScaledVector(yAx, hgt * 0.012).add(new THREE.Vector3(0, 0, hgt * 0.008)), hgt * 0.06);

      s.arms.forEach((a, i) => {
        const sh = toWorld(a.shoulder);
        const el = toWorld(a.elbow);
        const ha = toWorld(a.hand);
        ball(arms[i].shoulder, sh, hgt * 0.035);
        between(arms[i].upper, sh, el, hgt * 0.032);
        ball(arms[i].elbow, el, hgt * 0.0265);
        between(arms[i].fore, el, ha, hgt * 0.0265);
        ball(arms[i].hand, ha, hgt * 0.026);
      });
      s.legs.forEach((l, i) => {
        const hi = toWorld(l.hip);
        const kn = toWorld(l.knee);
        const fo = toWorld(l.foot);
        ball(legs[i].hip, hi, hgt * 0.048);
        between(legs[i].thigh, hi, kn, hgt * 0.05);
        ball(legs[i].knee, kn, hgt * 0.036);
        between(legs[i].shin, kn, fo, hgt * 0.036);
        legs[i].foot.position.copy(fo).add(new THREE.Vector3(0, hgt * 0.005, hgt * 0.025));
        legs[i].foot.scale.set(hgt * 0.034, hgt * 0.027, hgt * 0.062);
      });

      // Le membre qui bouge s'allume légèrement.
      const limbs = ['lh', 'rh', 'lf', 'rf'] as const;
      [...handMats, ...shoeMats].forEach((m, i) => {
        m.emissive.copy(glow);
        m.emissiveIntensity = moving === limbs[i] ? 0.55 : 0;
      });
      return pelvis;
    };

    // La caméra suit le grimpeur en douceur.
    const focus = new THREE.Vector3(0, live.current.plan.H / 2, 0);
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
        tilt.rotation.x = (WALL_ANGLES[L.plan.angle].deg * Math.PI) / 180;
        tilt.updateMatrixWorld(true);
        wall.scale.set(W, H, WALL_D);
        wall.position.set(0, H / 2, -WALL_D / 2);
        buildPads(W);
        const span = Math.max(W, H) * 0.8;
        sun.position.set(span * 0.6, H + span * 0.7, span * 1.2);
        sun.target.position.set(0, H / 2, 0);
        rim.position.set(-span * 1.2, H + span * 0.4, span * 0.5);
        rim.target.position.set(0, H * 0.4, 0);
        fog.near = L.plan.height * 2.6 + span;
        fog.far = fog.near + span * 5;
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

      const pelvis = tilt.localToWorld(pose(Math.max(0, t)).clone());

      // Prise visée : un anneau qui respire, orange pour une main, bleu pour un pied.
      const next = t < total ? L.plan.moves[Math.max(0, index)] : undefined;
      target.visible = !!next;
      if (next) {
        const hand = next.limb === 'lh' || next.limb === 'rh';
        const color = hand ? colors.primary : FOOT_COLOR;
        targetRingMat.color.set(color);
        targetDiscMat.color.set(color);
        const beat = (Math.sin(now / 180) + 1) / 2;
        target.position.copy(toWorld({ x: next.to.x, y: next.to.y, z: 0.02 }));
        const r = L.plan.height * (hand ? 0.06 : 0.045);
        targetRing.scale.setScalar(r * (1 + beat * 0.25));
        targetRingMat.opacity = 0.95 - beat * 0.35;
        targetDisc.scale.setScalar(r * 0.9);
        targetDiscMat.opacity = 0.18 + beat * 0.12;
      }

      const follow = new THREE.Vector3(pelvis.x * 0.6, pelvis.y + L.plan.height * 0.15, 0);
      if (first) focus.copy(follow);
      else focus.lerp(follow, 0.06);
      first = false;
      const { yaw, pitch, zoom } = cam;
      const dist = L.plan.height * 2.6 * zoom;
      camera.position.set(
        focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.max(0.2, focus.y + Math.sin(pitch) * dist),
        focus.z + Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      camera.lookAt(focus);

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
