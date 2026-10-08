/**
 * Scène 3D de la simulation : une vraie salle de bloc autour du mur photo (grand mur prolongé
 * avec prises et volumes, pans de côté, tapis épais, plafond et éclairages), les prises de la voie
 * et le grimpeur.
 * Indépendante de React Native (testée aussi dans un navigateur) : le rendu et la boucle restent dans Climb3D.
 */
import * as THREE from 'three';

import { createCelebrations, freeHand, type Mood } from './celebrations';
import { createClimber, type Body3 } from './climber';
import type { CelebrationId } from './cosmetics';
import { WALL_ANGLES, type Plan } from './planner';
import { contactsAt, skeleton, type P3 } from './simulation';
import { DEFAULT_SKIN, type SkinId } from './skins';

export type SceneTheme = { background: string; primary: string; success: string; dark: boolean };
export type Cam = { yaw: number; pitch: number; zoom: number };

const FOOT_COLOR = '#1C7ED6';
/** Couleurs des prises du reste de la salle (décor). */
const DECOR_HOLDS = ['#F03E3E', '#FAB005', '#37B24D', '#1C7ED6', '#AE3EC9', '#F76707', '#212529', '#F1F3F5', '#E64980', '#15AABF'];
const VOLUME_COLORS = ['#F1F3F5', '#ADB5BD', '#C9A77D', '#495057'];
/** Mur de la salle : blanc cassé, comme les murs de bloc. */
const WALL_COLOR = new THREE.Color('#e9e7e2');
/** Largeur d'un panneau de contreplaqué : la texture du mur se répète tous les 1,22 m. */
const TILE = 1.22;

/** Petit générateur pseudo-aléatoire : le décor est le même à chaque ouverture. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function dataTexture(n: number, fill: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const [r, g, b, a] = fill(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Halo rond et doux (texture calculée, pas d'image à charger). */
function glowTexture() {
  const n = 64;
  const tex = dataTexture(n, (x, y) => {
    const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
    return [255, 255, 255, Math.round(Math.max(0, 1 - d) ** 2 * 255)];
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Peinture grainée en niveaux de gris, trous de vis tous les 20 cm et joint du panneau (un panneau = une tuile). */
function wallTexture() {
  const n = 256;
  const step = n / 6;
  const rand = seeded(11);
  const tex = dataTexture(n, (x, y) => {
    let v = 236 + (rand() - 0.5) * 12;
    const d = Math.hypot((x % step) - step / 2, (y % step) - step / 2);
    if (d < 1.7) v = 80;
    else if (d < 2.8) v -= 30;
    if (x < 1 || y < 1) v -= 40;
    return [v, v, v, 255];
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dégradé d'ombre (opaque en bas, transparent en haut) : ombre de contact au pied du mur. */
function shadeTexture() {
  const tex = dataTexture(32, (_, y) => [0, 0, 0, Math.round((1 - y / 31) ** 2 * 255)]);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Béton du sol : gris tacheté. */
function concreteTexture() {
  const rand = seeded(5);
  const tex = dataTexture(128, () => {
    const v = 150 + (rand() - 0.5) * 26;
    return [v, v, v, 255];
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Morceau de mur plat (dans le plan z = 0 du groupe), avec la texture calée sur les mètres. */
function wallPiece(x0: number, x1: number, y0: number, y1: number) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / TILE, pos.getY(i) / TILE);
  return g;
}

/** Tapis de chute : bloc aux arêtes arrondies, de `len` de long, `depth` de profondeur depuis le mur. */
function matGeometry(len: number, depth: number, height: number) {
  const r = 0.04;
  const shape = new THREE.Shape();
  shape.moveTo(r, r);
  shape.lineTo(depth - r, r);
  shape.lineTo(depth - r, height - r);
  shape.lineTo(r, height - r);
  shape.lineTo(r, r);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: len - 2 * r,
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: 3,
    curveSegments: 4,
  });
  // Profil dans le plan (profondeur, hauteur), extrudé le long du mur.
  g.rotateY(-Math.PI / 2);
  g.translate(len / 2 - r, 0, 0);
  return g;
}

export function createClimbScene(
  renderer: THREE.WebGLRenderer,
  w: number,
  h: number,
  theme: SceneTheme,
  getPlan: () => Plan,
  skin: SkinId = DEFAULT_SKIN,
  celebration: CelebrationId | null = null,
) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Rendu plus doux des couleurs (sans brûler l'orange du t-shirt).
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const haze = new THREE.Color('#c9c8c3');
  scene.background = new THREE.Color('#2a2d33');
  const fog = new THREE.Fog(haze, 14, 45);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(38, w / h, 0.05, 300);

  // Lumières : ambiance de salle (plafonniers), une lumière principale qui projette l'ombre
  // du grimpeur sur le mur, et un contre-jour qui détache sa silhouette.
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9b2a6', 2.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff6ea', 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  const rim = new THREE.DirectionalLight('#d6e4ff', 0.8);
  scene.add(sun, sun.target, rim, rim.target);

  // Mur de la voie : panneau épais, la photo sur la face avant, cerclé d'un profilé alu.
  const WALL_D = 0.16;
  const wallMat = new THREE.MeshLambertMaterial({ color: '#cfd4da' });
  wallMat.toneMapped = false;
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#8d939b', roughness: 0.45, metalness: 0.6 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const wall = new THREE.Mesh(box, [edgeMat, edgeMat, edgeMat, edgeMat, wallMat, edgeMat]);
  wall.receiveShadow = true;

  // Reste de la salle, recalculé à chaque changement de voie.
  const room = new THREE.Group();
  const wallTex = wallTexture();
  const roomWallMat = new THREE.MeshLambertMaterial({ color: WALL_COLOR, map: wallTex });
  roomWallMat.toneMapped = false;
  const plainWallMat = new THREE.MeshLambertMaterial({ color: WALL_COLOR.clone().multiplyScalar(0.92), side: THREE.DoubleSide });
  plainWallMat.toneMapped = false;
  const concrete = concreteTexture();
  const floorMat = new THREE.MeshLambertMaterial({ color: '#d2d0cb', map: concrete });
  const matTop = new THREE.MeshStandardMaterial({ color: '#2d4b80', roughness: 0.75 });
  const matSeam = new THREE.MeshStandardMaterial({ color: '#284473', roughness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#25282d', roughness: 0.8 });
  const ceilingMat = new THREE.MeshLambertMaterial({ color: '#33363c' });
  const lightMat = new THREE.MeshBasicMaterial({ color: '#fffdf4' });
  lightMat.toneMapped = false;
  const sideMat = new THREE.MeshLambertMaterial({ color: '#d9d8d4' });
  const shadeMat = new THREE.MeshBasicMaterial({ color: '#000000', map: shadeTexture(), transparent: true, opacity: 0.32, depthWrite: false });
  const holdGeo = new THREE.IcosahedronGeometry(1, 1);
  const volumeGeo = new THREE.CylinderGeometry(1, 1, 1, 3);
  const decorHoldMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
  const volumeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 });

  const tilt = new THREE.Group();
  scene.add(tilt, room);
  tilt.add(wall);

  const toWorld = (p: P3) => {
    const { W, H } = getPlan();
    return new THREE.Vector3(p.x - W / 2, H - p.y, p.z);
  };

  const buildRoom = (W: number, H: number, deg: number) => {
    room.clear();
    const rand = seeded(7);
    const th = (deg * Math.PI) / 180;
    // Haut du panneau photo une fois incliné, et avancée de ce haut vers le grimpeur.
    const top = H * Math.cos(th);
    const reach = H * Math.sin(th);
    const E = Math.max(3, W * 1.1);
    const X = W / 2 + E;
    const Hw = Math.max(H + 0.5, 4.2);
    const Hc = Hw + 1.5;
    const back = -0.03;

    // Grand mur de la salle, autour de la photo, très légèrement en retrait.
    const main = new THREE.Group();
    main.position.z = back;
    for (const g of [wallPiece(-X, -W / 2, 0, Hw), wallPiece(W / 2, X, 0, Hw), wallPiece(-W / 2, W / 2, Math.max(0, top), Hw)]) {
      const m = new THREE.Mesh(g, roomWallMat);
      m.receiveShadow = true;
      main.add(m);
    }
    room.add(main);
    // Joues et dessus du pan incliné (dévers ou dalle), comme un vrai pan rapporté sur le mur.
    if (Math.abs(th) > 0.01) {
      for (const s of [-1, 1]) {
        const g = new THREE.BufferGeometry();
        const x = (s * W) / 2;
        g.setAttribute('position', new THREE.Float32BufferAttribute([x, 0, back, x, top, reach, x, top, back], 3));
        g.computeVertexNormals();
        room.add(new THREE.Mesh(g, plainWallMat));
      }
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, Math.abs(reach - back)), plainWallMat);
      roof.rotation.x = -Math.PI / 2;
      roof.position.set(0, top, (reach + back) / 2);
      room.add(roof);
    }
    // Liseré sombre en haut du mur.
    const cap = new THREE.Mesh(box, darkMat);
    cap.scale.set(2 * X, 0.12, 0.3);
    cap.position.set(0, Hw + 0.06, back - 0.1);
    room.add(cap);

    // Pans de côté, tournés vers le fond : ils encadrent sans jamais cacher la voie.
    const panelW = 2.8;
    const sides = [-1, 1].map((s) => {
      const g = new THREE.Group();
      g.position.set(s * X, 0, back);
      g.rotation.y = s * 0.65;
      const m = new THREE.Mesh(wallPiece(s > 0 ? 0 : -panelW, s > 0 ? panelW : 0, 0, Hw), roomWallMat);
      m.receiveShadow = true;
      g.add(m);
      room.add(g);
      return g;
    });

    // Prises et volumes du décor, en une seule passe de dessin par sorte.
    type Item = { m: THREE.Matrix4; c: THREE.Color };
    const holdsList: Item[] = [];
    const volumes: Item[] = [];
    const q = new THREE.Quaternion();
    const addHold = (parent: THREE.Object3D, x: number, y: number) => {
      const r = 0.035 + rand() * 0.07;
      const sx = r * (0.8 + rand() * 0.9);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, r * 0.25),
        q.setFromEuler(new THREE.Euler(0, 0, rand() * Math.PI)),
        new THREE.Vector3(sx, r, r * 0.55),
      );
      parent.updateMatrixWorld(true);
      holdsList.push({ m: m.premultiply(parent.matrixWorld), c: new THREE.Color(DECOR_HOLDS[Math.floor(rand() * DECOR_HOLDS.length)]) });
    };
    const addVolume = (parent: THREE.Object3D, x: number, y: number) => {
      const r = 0.25 + rand() * 0.3;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, r * 0.18),
        q.setFromEuler(new THREE.Euler(Math.PI / 2, rand() * Math.PI, 0)),
        new THREE.Vector3(r, r * 0.36, r * (0.7 + rand() * 0.4)),
      );
      parent.updateMatrixWorld(true);
      volumes.push({ m: m.premultiply(parent.matrixWorld), c: new THREE.Color(VOLUME_COLORS[Math.floor(rand() * VOLUME_COLORS.length)]) });
    };
    const scatter = (parent: THREE.Object3D, x0: number, x1: number, skip: (x: number, y: number) => boolean) => {
      const count = Math.round((x1 - x0) * Hw * 2.6);
      for (let i = 0; i < count; i++) {
        const x = x0 + 0.15 + rand() * (x1 - x0 - 0.3);
        const y = 0.45 + rand() * (Hw - 0.7);
        if (!skip(x, y)) addHold(parent, x, y);
      }
      for (let i = 0; i < Math.round((x1 - x0) / 1.6); i++) {
        const x = x0 + 0.5 + rand() * (x1 - x0 - 1);
        const y = 0.9 + rand() * (Hw - 1.6);
        if (!skip(x, y)) addVolume(parent, x, y);
      }
    };
    // Pas de décor sur la photo ni juste autour.
    const onPhoto = (x: number, y: number) => Math.abs(x) < W / 2 + 0.3 && y < Math.max(0, top) + 0.3;
    scatter(main, -X, X, onPhoto);
    sides.forEach((g, i) => scatter(g, i === 0 ? -panelW : 0, i === 0 ? 0 : panelW, () => false));
    for (const [list, geo, material] of [
      [holdsList, holdGeo, decorHoldMat],
      [volumes, volumeGeo, volumeMat],
    ] as const) {
      if (!list.length) continue;
      const inst = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((it, i) => {
        inst.setMatrixAt(i, it.m);
        inst.setColorAt(i, it.c);
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      room.add(inst);
    }

    // Sol en béton et tapis de chute épais sur toute la longueur, devant les pans de côté aussi.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
    concrete.repeat.set(200 / 1.5, 200 / 1.5);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    room.add(floor);
    const span = 2 * X + 2;
    const count = Math.max(2, Math.round(span / 2));
    const each = span / count;
    const depth = 2.6;
    const matGeo = matGeometry(each - 0.03, depth, 0.32);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(matGeo, matTop);
      m.position.set(-span / 2 + each * (i + 0.5), 0, back + 0.02);
      m.receiveShadow = true;
      room.add(m);
      // Bande de liaison entre deux tapis.
      if (i > 0) {
        const seam = new THREE.Mesh(box, matSeam);
        seam.scale.set(0.14, 0.01, depth + 0.06);
        seam.position.set(-span / 2 + each * i, 0.325, back + 0.02 + depth / 2);
        room.add(seam);
      }
    }

    // Ombre douce là où les tapis touchent le mur.
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(2 * X, 0.6), shadeMat);
    shade.position.set(0, 0.32 + 0.3, 0.004);
    room.add(shade);

    // Murs de la salle, plafond sombre, poutres et plafonniers.
    const RX = X + 8;
    const RZ = 30;
    for (const [x, ry] of [
      [-RX, Math.PI / 2],
      [RX, -Math.PI / 2],
    ] as const) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(RZ + 4, Hc), sideMat);
      m.rotation.y = ry;
      m.position.set(x, Hc / 2, RZ / 2 - 2);
      room.add(m);
    }
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(2 * RX, Hc), sideMat);
    backWall.rotation.y = Math.PI;
    backWall.position.set(0, Hc / 2, RZ);
    room.add(backWall);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(2 * RX, RZ + 4), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, Hc, RZ / 2 - 2);
    room.add(ceiling);
    for (let x = -RX + 1.2; x < RX; x += 2.4) {
      const beam = new THREE.Mesh(box, darkMat);
      beam.scale.set(0.14, 0.28, RZ + 4);
      beam.position.set(x, Hc - 0.14, RZ / 2 - 2);
      room.add(beam);
    }
    for (let x = -RX + 2.4; x < RX - 1; x += 2.4) {
      for (const z of [1.4, 4.2, 7.5, 11]) {
        const lamp = new THREE.Mesh(box, lightMat);
        lamp.scale.set(1.1, 0.04, 0.28);
        lamp.position.set(x, Hc - 0.3, z);
        room.add(lamp);
      }
    }
  };

  // Grimpeur, dans le costume choisi (t-shirt du costume classique aux couleurs du thème).
  const climber = createClimber();
  climber.setGlow(theme.primary);
  climber.setSkin(skin);
  tilt.add(climber.group);

  // Célébration au top : elle part à la première arrivée en haut (`since`, en ms) et repart si on
  // redescend. La main libre (`free`) est choisie à l'arrivée.
  const party = createCelebrations(scene);
  party.set(celebration);
  let since: number | null = null;
  let free: 0 | 1 = 1;
  /** Verticale et caméra (image précédente) dans le repère du mur, pour le geste et le regard. */
  const wallUp = new THREE.Vector3(0, 1, 0);
  const camLocal = new THREE.Vector3();
  // Lumières de départ, pour l'ambiance de la fête (salle dans le noir, éclairs) et le retour à la normale.
  const lights = { hemi: hemi.intensity, sun: sun.intensity, rim: rim.intensity, sunColor: sun.color.clone() };
  let moody = false;
  const applyMood = (m: Mood | null) => {
    if (!m && !moody) return;
    moody = !!m;
    const night = m?.night ?? 0;
    const flash = m?.flash ?? 0;
    hemi.intensity = lights.hemi * (1 - 0.75 * night) + 2.4 * flash;
    sun.intensity = lights.sun * (1 - 0.6 * night) + 1.2 * flash;
    rim.intensity = lights.rim * (1 - 0.3 * night) + 0.8 * flash;
    hemi.color.set('#ffffff');
    sun.color.copy(lights.sunColor);
    if (m) {
      hemi.color.lerp(m.tint, night).lerp(m.flashColor, Math.min(1, flash));
      sun.color.lerp(m.tint, night * 0.5);
    }
  };

  // Repères des prises : anneau fin et pastille translucide ; repère animé et trajet pour le mouvement en cours.
  const holds = new THREE.Group();
  tilt.add(holds);
  const ringGeo = new THREE.TorusGeometry(1, 0.09, 10, 48);
  const discGeo = new THREE.CircleGeometry(1, 40);
  const glowMap = glowTexture();
  const buildHolds = () => {
    holds.clear();
    const p = getPlan();
    const marker = (x: number, y: number, color: string, r: number) => {
      const at = toWorld({ x, y, z: 0.012 });
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
      ring.position.copy(at);
      ring.scale.setScalar(r);
      const disc = new THREE.Mesh(
        discGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }),
      );
      disc.position.copy(at);
      disc.scale.setScalar(r);
      holds.add(disc, ring);
    };
    p.hands.forEach((hd, i) => marker(hd.x, hd.y, i === p.hands.length - 1 ? theme.success : theme.primary, p.height * 0.04));
    p.feet.forEach((f) => marker(f.x, f.y, FOOT_COLOR, p.height * 0.028));
  };
  const targetRingMat = new THREE.MeshBasicMaterial({ color: theme.primary, transparent: true, depthWrite: false });
  const targetGlowMat = new THREE.MeshBasicMaterial({
    color: theme.primary,
    map: glowMap,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const target = new THREE.Group();
  const targetGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), targetGlowMat);
  const targetRing = new THREE.Mesh(ringGeo, targetRingMat);
  target.add(targetGlow, targetRing);
  tilt.add(target);
  // Trajet du membre qui bouge : une courbe de petits points qui s'éloigne du mur.
  const DOTS = 9;
  const dotGeo = new THREE.SphereGeometry(1, 10, 8);
  const dots = Array.from({ length: DOTS }, () => {
    const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: theme.primary, transparent: true, depthWrite: false }));
    tilt.add(m);
    return m;
  });

  // Nuages de magnésie : quand une main attrape une prise ou plonge dans le sac.
  const PUFFS = 14;
  const puffMat = new THREE.SpriteMaterial({ map: glowMap, color: '#ffffff', transparent: true, depthWrite: false });
  const puffs = Array.from({ length: PUFFS }, () => {
    const sp = new THREE.Sprite(puffMat.clone());
    sp.visible = false;
    tilt.add(sp);
    return { sp, born: -1e9, from: new THREE.Vector3(), dir: new THREE.Vector3() };
  });
  let nextPuff = 0;
  const puff = (at: THREE.Vector3, now: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const p = puffs[nextPuff++ % PUFFS];
      p.born = now;
      p.from.copy(at);
      p.dir.set(Math.sin(i * 2.4) * 0.6, 0.4 + ((i * 37) % 10) / 20, 0.5 + ((i * 53) % 10) / 25);
    }
  };
  const drawPuffs = (now: number, hgt: number) => {
    for (const p of puffs) {
      const age = (now - p.born) / 900;
      p.sp.visible = age >= 0 && age < 1;
      if (!p.sp.visible) continue;
      p.sp.position.copy(p.from).addScaledVector(p.dir, hgt * 0.09 * Math.sqrt(age));
      p.sp.scale.setScalar(hgt * (0.03 + 0.07 * age));
      (p.sp.material as THREE.SpriteMaterial).opacity = 0.55 * (1 - age) ** 2;
    }
  };

  let lastIndex = -1;
  let lastChalk = 0;
  const toBody = (s: ReturnType<typeof skeleton>): Body3 => ({
    head: toWorld(s.head),
    neck: toWorld(s.neck),
    chest: toWorld(s.chest),
    pelvis: toWorld(s.pelvis),
    arms: s.arms.map((a) => ({ shoulder: toWorld(a.shoulder), elbow: toWorld(a.elbow), hand: toWorld(a.hand), grip: toWorld(a.grip) })),
    legs: s.legs.map((l) => ({ hip: toWorld(l.hip), knee: toWorld(l.knee), foot: toWorld(l.foot), toe: toWorld(l.toe) })),
  });
  const pose = (t: number, look: THREE.Vector3 | null, now: number, age: number) => {
    const p = getPlan();
    const f = contactsAt(p.start, p.startTypes, p.moves, t);
    const sk = skeleton(f.c, p.height, f.moving, f.lift, f.types, f.crouch, {
      body: f.body,
      shift: f.shift,
      chalk: f.chalk,
      angle: WALL_ANGLES[p.angle].deg,
    });
    const b = toBody(sk);
    // Pendant la célébration, la main libre lâche la prise pour faire le geste.
    const g = party.pose(age, b, free, p.height, f.types, wallUp, camLocal);
    climber.update(b, {
      height: p.height,
      types: g?.types ?? f.types,
      moving: f.moving,
      chalk: f.chalk,
      look: g?.look ?? look,
      now,
      fists: g?.fists,
    });
    // Magnésie : la main qui vient d'attraper sa prise, ou qui plonge dans le sac.
    const done = p.moves[f.index - 1];
    if (f.index === lastIndex + 1 && done && !done.rest && (done.limb === 'lh' || done.limb === 'rh')) {
      puff(b.arms[done.limb === 'lh' ? 0 : 1].grip, now, 5);
    }
    if (f.chalk >= 0.3 && lastChalk < 0.3 && f.moving) puff(b.arms[f.moving === 'lh' ? 0 : 1].grip, now, 4);
    lastIndex = f.index;
    lastChalk = f.chalk;
    drawPuffs(now, p.height);
    return b;
  };

  const focus = new THREE.Vector3(0, getPlan().H / 2, 0);
  let first = true;
  /** Limites de la salle, pour que la caméra reste dedans (sous le plafond, devant le mur du fond). */
  const bounds = { x: 10, y: 6, z: 28 };

  const rebuild = () => {
    const p = getPlan();
    const { W, H } = p;
    const deg = WALL_ANGLES[p.angle].deg;
    buildHolds();
    wall.scale.set(W, H, WALL_D);
    wall.position.set(0, H / 2, -WALL_D / 2);
    tilt.rotation.x = (deg * Math.PI) / 180;
    tilt.updateMatrixWorld(true);
    wallUp.set(0, Math.cos(tilt.rotation.x), -Math.sin(tilt.rotation.x));
    buildRoom(W, H, deg);
    const X = W / 2 + Math.max(3, W * 1.1);
    Object.assign(bounds, { x: X + 7.5, y: Math.max(H + 0.5, 4.2) + 1.1, z: 29 });
    const span = Math.max(W, H) * 0.8;
    sun.position.set(span * 0.6, H + span * 0.7, span * 1.2);
    sun.target.position.set(0, H / 2, 0);
    rim.position.set(-span * 1.2, H + span * 0.4, span * 0.5);
    rim.target.position.set(0, H * 0.4, 0);
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.1, far: span * 5 });
    sun.shadow.camera.updateProjectionMatrix();
  };

  /** Dessine la scène au temps `t` (en mouvements). `now` en ms sert aux animations des repères. */
  const frame = (t: number, now: number, cam: Cam) => {
    const p = getPlan();
    const total = p.moves.length;
    const index = Math.max(0, Math.min(total, Math.floor(t)));
    // Célébration : part à la première arrivée au top, repart si on redescend (relance, retour en arrière).
    if (total > 0 && t >= total) {
      if (since === null) {
        since = now;
        const end = contactsAt(p.start, p.startTypes, p.moves, total);
        free = freeHand(end.c, p.hands[p.hands.length - 1] ?? end.c.lh, cam.yaw);
      }
    } else since = null;
    const age = since === null ? -1 : now - since;
    tilt.worldToLocal(camLocal.copy(camera.position));
    // Prise visée : anneau qui respire et halo, orange pour une main, bleu pour un pied.
    const move = t < total ? p.moves[index] : undefined;
    const body = pose(Math.max(0, t), move && !move.rest ? toWorld({ x: move.to.x, y: move.to.y, z: 0 }) : null, now, age);
    const pelvis = tilt.localToWorld(body.pelvis.clone());
    // Pas de prise visée pendant un repos.
    const next = move && !move.rest ? move : undefined;

    target.visible = !!next;
    dots.forEach((d) => (d.visible = !!next));
    if (next) {
      const hand = next.limb === 'lh' || next.limb === 'rh';
      const color = hand ? theme.primary : FOOT_COLOR;
      targetRingMat.color.set(color);
      targetGlowMat.color.set(color);
      const beat = (Math.sin(now / 180) + 1) / 2;
      const r = p.height * (hand ? 0.058 : 0.044);
      target.position.copy(toWorld({ x: next.to.x, y: next.to.y, z: 0.02 }));
      targetRing.scale.setScalar(r * (1 + beat * 0.22));
      targetRingMat.opacity = 0.95 - beat * 0.3;
      targetGlow.scale.setScalar(r * 4.2);
      targetGlowMat.opacity = 0.35 + beat * 0.25;
      // Trajet : de la prise de départ à la prise visée, en arc, les points avancent doucement.
      const from = toWorld({ x: next.from.x, y: next.from.y, z: 0.03 });
      const to = toWorld({ x: next.to.x, y: next.to.y, z: 0.03 });
      const lift = from.distanceTo(to) * 0.18;
      const flow = (now / 900) % 1;
      dots.forEach((d, i) => {
        const k = (i + flow) / DOTS;
        const at = from.clone().lerp(to, k);
        at.z += Math.sin(Math.PI * k) * lift;
        d.position.copy(at);
        d.scale.setScalar(p.height * 0.009 * (0.6 + k * 0.6));
        const m = d.material as THREE.MeshBasicMaterial;
        m.color.set(color);
        m.opacity = 0.2 + 0.7 * k;
      });
    }

    const follow = new THREE.Vector3(pelvis.x * 0.6, pelvis.y + p.height * 0.12, 0);
    if (first) focus.copy(follow);
    else focus.lerp(follow, 0.06);
    first = false;
    // Écran étroit (plein écran en portrait) : on recule pour garder le grimpeur entier en largeur.
    const dist = p.height * 2.9 * cam.zoom * Math.max(1, 0.85 / camera.aspect);
    camera.position.set(
      THREE.MathUtils.clamp(focus.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist, -bounds.x, bounds.x),
      THREE.MathUtils.clamp(focus.y + Math.sin(cam.pitch) * dist, 0.6, bounds.y),
      Math.min(bounds.z, focus.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist),
    );
    camera.lookAt(focus);
    // Effets de la fête (après la caméra : les particules lui font face) et ambiance de la salle.
    applyMood(party.frame(age, body, free, p.height, tilt, camera));
    renderer.render(scene, camera);
  };

  const setWallTexture = (tex: THREE.Texture) => {
    wallMat.map = tex;
    wallMat.color.set('#ffffff');
    wallMat.needsUpdate = true;
  };

  /** Change le costume du grimpeur. */
  const setSkin = (id: SkinId) => climber.setSkin(id);

  /** Change la célébration au top (null : aucune) ; si le grimpeur y est déjà, la nouvelle se joue. */
  const setCelebration = (id: CelebrationId | null) => {
    party.set(id);
    since = null;
  };

  return { rebuild, frame, setWallTexture, setSkin, setCelebration };
}
