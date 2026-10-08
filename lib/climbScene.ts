/**
 * Scène 3D de la simulation : une vraie salle de bloc autour du mur photo (grand mur prolongé
 * avec prises et volumes, pans de côté, tapis épais, plafond et éclairages), les prises de la voie
 * et le grimpeur.
 * Indépendante de React Native (testée aussi dans un navigateur) : le rendu et la boucle restent dans Climb3D.
 */
import * as THREE from 'three';

import { WALL_ANGLES, type Plan } from './planner';
import { contactsAt, skeleton, type P3 } from './simulation';

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

/** Silhouette du buste (rayon selon la hauteur, du bassin aux épaules) : taille marquée, poitrine large. */
function torsoGeometry() {
  const profile: [number, number][] = [
    [0.0, -0.5],
    [0.8, -0.5],
    [0.88, -0.4],
    [0.84, -0.22],
    [0.78, -0.08],
    [0.86, 0.1],
    [0.98, 0.26],
    [1.0, 0.36],
    [0.9, 0.46],
    [0.58, 0.5],
    [0.0, 0.5],
  ];
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    32,
  );
}

/** Membre galbé : rayon le long de l'os (de -0,5 à l'attache à 0,5 au bout), extrémités fermées. */
function limbGeometry(profile: [number, number][]) {
  const pts = [new THREE.Vector2(0, -0.5), ...profile.map(([y, r]) => new THREE.Vector2(r, y)), new THREE.Vector2(0, 0.5)];
  return new THREE.LatheGeometry(pts, 20);
}

export function createClimbScene(renderer: THREE.WebGLRenderer, w: number, h: number, theme: SceneTheme, getPlan: () => Plan) {
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
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9b2a6', 2.0));
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

  // Grimpeur : buste galbé, membres musclés et articulations de même diamètre, mains et chaussons détaillés.
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 20);
  const sleeveGeo = new THREE.CylinderGeometry(0.88, 1, 1, 20, 1, true);
  const torsoGeo = torsoGeometry();
  const upperGeo = limbGeometry([
    [-0.47, 0.8],
    [-0.34, 0.98],
    [-0.1, 1],
    [0.16, 0.9],
    [0.38, 0.74],
    [0.47, 0.64],
  ]);
  const foreGeo = limbGeometry([
    [-0.47, 0.84],
    [-0.3, 1],
    [-0.05, 0.92],
    [0.25, 0.72],
    [0.47, 0.56],
  ]);
  const thighGeo = limbGeometry([
    [-0.47, 0.96],
    [-0.3, 1],
    [0, 0.94],
    [0.3, 0.8],
    [0.47, 0.68],
  ]);
  const shinGeo = limbGeometry([
    [-0.47, 0.74],
    [-0.3, 0.95],
    [-0.12, 1],
    [0.18, 0.74],
    [0.4, 0.5],
    [0.47, 0.46],
  ]);
  const mat = (color: string, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });
  const skin = mat('#DDA683', 0.5);
  const shirt = mat(theme.primary, 0.85);
  const pants = mat('#2f405e', 0.9);
  const hair = mat('#3a2a20', 0.95);
  const band = mat('#f4f4f4', 0.7);
  const bagMat = mat('#24272c', 0.9);
  const rubber = mat('#1b1c1f', 0.75);
  // Une main et un chausson par membre, pour éclairer celui qui bouge.
  const handMats = [mat('#E3B596', 0.6), mat('#E3B596', 0.6)];
  const shoeMats = [mat('#F0B429', 0.55), mat('#F0B429', 0.55)];
  const glow = new THREE.Color(theme.primary);

  const climber = new THREE.Group();
  const part = (geo: THREE.BufferGeometry, m: THREE.Material) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    climber.add(mesh);
    return mesh;
  };
  const torso = part(torsoGeo, shirt);
  const hem = part(cylGeo, shirt);
  const belt = part(cylGeo, bagMat);
  const seat = part(sphere, pants);
  const bag = part(cylGeo, bagMat);
  const bagTop = part(cylGeo, band);
  const neck = part(cylGeo, skin);
  // Tête dans son propre repère, qui regarde la prise visée (avant = +z local).
  const headGroup = new THREE.Group();
  climber.add(headGroup);
  const headPart = (m: THREE.Material) => {
    const mesh = new THREE.Mesh(sphere, m);
    mesh.castShadow = true;
    headGroup.add(mesh);
    return mesh;
  };
  const head = headPart(skin);
  const cap = headPart(hair);
  const nose = headPart(skin);
  const ears = [headPart(skin), headPart(skin)];
  const arms = [0, 1].map((i) => ({
    shoulder: part(sphere, shirt),
    sleeve: part(sleeveGeo, shirt),
    upper: part(upperGeo, skin),
    elbow: part(sphere, skin),
    fore: part(foreGeo, skin),
    wrist: part(sphere, skin),
    palm: part(sphere, handMats[i]),
    fingers: part(sphere, handMats[i]),
    thumb: part(sphere, handMats[i]),
  }));
  const legs = [0, 1].map((i) => ({
    hip: part(sphere, pants),
    thigh: part(thighGeo, pants),
    knee: part(sphere, pants),
    shin: part(shinGeo, pants),
    cuff: part(cylGeo, pants),
    shoe: part(sphere, shoeMats[i]),
    toe: part(sphere, rubber),
    heel: part(sphere, rubber),
    sole: part(sphere, rubber),
    strap: part(cylGeo, band),
  }));
  tilt.add(climber);

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
  /** Ellipsoïde orienté selon une direction (mains, chaussons). */
  const oval = (mesh: THREE.Mesh, at: THREE.Vector3, dir: THREE.Vector3, rx: number, len: number, rz: number) => {
    mesh.position.copy(at);
    mesh.quaternion.setFromUnitVectors(Y, dir.clone().normalize());
    mesh.scale.set(rx, len, rz);
  };
  const basis = new THREE.Matrix4();
  const limbs = ['lh', 'rh', 'lf', 'rf'] as const;

  const lookAt = new THREE.Vector3();
  const pose = (t: number, look: THREE.Vector3 | null) => {
    const p = getPlan();
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
    const top = chest.clone().addScaledVector(yAx, hgt * 0.035);
    const bottom = pelvis.clone().addScaledVector(yAx, -hgt * 0.005);
    torso.position.copy(top).add(bottom).multiplyScalar(0.5);
    torso.quaternion.setFromRotationMatrix(basis);
    torso.scale.set(hgt * 0.1, top.distanceTo(bottom), hgt * 0.058);
    // Bas du t-shirt, ceinture et fesses dans le pantalon.
    hem.position.copy(pelvis).addScaledVector(yAx, hgt * 0.04);
    hem.quaternion.copy(torso.quaternion);
    hem.scale.set(hgt * 0.088, hgt * 0.03, hgt * 0.058);
    belt.position.copy(pelvis).addScaledVector(yAx, hgt * 0.018);
    belt.quaternion.copy(torso.quaternion);
    belt.scale.set(hgt * 0.085, hgt * 0.014, hgt * 0.055);
    seat.position.copy(pelvis).addScaledVector(yAx, -hgt * 0.012).addScaledVector(zAx, hgt * 0.006);
    seat.quaternion.copy(torso.quaternion);
    seat.scale.set(hgt * 0.09, hgt * 0.06, hgt * 0.058);
    // Sac à magnésie dans le dos, à la ceinture.
    const bagP = pelvis.clone().addScaledVector(zAx, hgt * 0.072).addScaledVector(yAx, hgt * 0.01);
    bag.position.copy(bagP);
    bag.quaternion.copy(torso.quaternion);
    bag.scale.set(hgt * 0.026, hgt * 0.062, hgt * 0.026);
    bagTop.position.copy(bagP).addScaledVector(yAx, hgt * 0.033);
    bagTop.quaternion.copy(torso.quaternion);
    bagTop.scale.set(hgt * 0.028, hgt * 0.008, hgt * 0.028);
    between(neck, chest, neckP, hgt * 0.024);
    // Tête un peu ovale qui regarde la prise visée (sinon le mur), cheveux sur le dessus et
    // l'arrière (on la voit surtout de dos), oreilles et nez.
    const headP = toWorld(s.head);
    headGroup.position.copy(headP);
    headGroup.up.copy(yAx);
    // Le visage reste tourné vers le mur et pivote seulement en partie vers la prise visée,
    // comme le permet le cou.
    const gaze = new THREE.Vector3(0, 0, -1);
    if (look) gaze.multiplyScalar(0.7).addScaledVector(look.clone().sub(headP).normalize(), 0.45);
    lookAt.copy(headP).add(gaze.normalize());
    headGroup.lookAt(tilt.localToWorld(lookAt.clone()));
    head.scale.set(hgt * 0.054, hgt * 0.064, hgt * 0.058);
    cap.position.set(0, hgt * 0.013, -hgt * 0.012);
    cap.scale.set(hgt * 0.058, hgt * 0.06, hgt * 0.058);
    nose.position.set(0, -hgt * 0.004, hgt * 0.056);
    nose.scale.set(hgt * 0.008, hgt * 0.013, hgt * 0.01);
    ears.forEach((ear, i) => {
      ear.position.set((i ? 1 : -1) * hgt * 0.053, -hgt * 0.002, -hgt * 0.004);
      ear.scale.set(hgt * 0.008, hgt * 0.016, hgt * 0.012);
    });

    s.arms.forEach((a, i) => {
      const sh = toWorld(a.shoulder);
      const el = toWorld(a.elbow);
      const ha = toWorld(a.hand);
      const arm = arms[i];
      ball(arm.shoulder, sh, hgt * 0.036);
      // Manche courte sur le haut du bras, peau en dessous.
      between(arm.sleeve, sh, sh.clone().lerp(el, 0.45), hgt * 0.036);
      between(arm.upper, sh, el, hgt * 0.03);
      ball(arm.elbow, el, hgt * 0.022);
      between(arm.fore, el, ha, hgt * 0.027);
      // Main sur la prise : paume, doigts repliés sur la prise, pouce sur le côté.
      const dir = ha.clone().sub(el).normalize();
      const wrist = ha.clone().addScaledVector(dir, -hgt * 0.018);
      ball(arm.wrist, wrist, hgt * 0.015);
      oval(arm.palm, ha, dir, hgt * 0.022, hgt * 0.026, hgt * 0.012);
      const tip = ha.clone().addScaledVector(dir, hgt * 0.022).add(new THREE.Vector3(0, 0, -hgt * 0.006));
      oval(arm.fingers, tip, dir.clone().add(new THREE.Vector3(0, 0, -0.8)), hgt * 0.021, hgt * 0.016, hgt * 0.011);
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
      const thumb = ha.clone().addScaledVector(side, (i ? -1 : 1) * hgt * 0.02).addScaledVector(dir, hgt * 0.004);
      oval(arm.thumb, thumb, dir, hgt * 0.007, hgt * 0.015, hgt * 0.007);
    });
    s.legs.forEach((l, i) => {
      const hi = toWorld(l.hip);
      const kn = toWorld(l.knee);
      const fo = toWorld(l.foot);
      const leg = legs[i];
      ball(leg.hip, hi, hgt * 0.05);
      between(leg.thigh, hi, kn, hgt * 0.052);
      ball(leg.knee, kn, hgt * 0.037);
      between(leg.shin, kn, fo, hgt * 0.04);
      // Bas du pantalon resserré à la cheville.
      const ankle = fo.clone().lerp(kn, 0.1);
      between(leg.cuff, ankle, fo.clone().lerp(kn, 0.02), hgt * 0.026);
      // Chausson d'escalade : pointe vers le mur, gomme noire à la pointe, au talon et dessous, scratch blanc.
      const toeDir = new THREE.Vector3(0, -0.2, -1).normalize();
      const shoeP = fo.clone().add(new THREE.Vector3(0, hgt * 0.004, hgt * 0.024));
      oval(leg.shoe, shoeP, toeDir, hgt * 0.03, hgt * 0.062, hgt * 0.027);
      oval(leg.toe, shoeP.clone().addScaledVector(toeDir, hgt * 0.036).add(new THREE.Vector3(0, -hgt * 0.004, 0)), toeDir, hgt * 0.027, hgt * 0.03, hgt * 0.022);
      oval(leg.heel, shoeP.clone().addScaledVector(toeDir, -hgt * 0.04), toeDir, hgt * 0.024, hgt * 0.02, hgt * 0.023);
      oval(leg.sole, shoeP.clone().add(new THREE.Vector3(0, -hgt * 0.014, 0)), toeDir, hgt * 0.028, hgt * 0.06, hgt * 0.012);
      const strapP = shoeP.clone().addScaledVector(toeDir, -hgt * 0.004).add(new THREE.Vector3(0, hgt * 0.02, 0));
      leg.strap.position.copy(strapP);
      leg.strap.quaternion.setFromUnitVectors(Y, new THREE.Vector3(1, 0, 0));
      leg.strap.scale.set(hgt * 0.009, hgt * 0.05, hgt * 0.022);
    });

    // Le membre qui bouge s'allume légèrement.
    [...handMats, ...shoeMats].forEach((m, i) => {
      m.emissive.copy(glow);
      m.emissiveIntensity = moving === limbs[i] ? 0.5 : 0;
    });
    return pelvis;
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
    // Prise visée : anneau qui respire et halo, orange pour une main, bleu pour un pied.
    const next = t < total ? p.moves[index] : undefined;
    const pelvis = tilt.localToWorld(pose(Math.max(0, t), next ? toWorld({ x: next.to.x, y: next.to.y, z: 0 }) : null).clone());

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
    renderer.render(scene, camera);
  };

  const setWallTexture = (tex: THREE.Texture) => {
    wallMat.map = tex;
    wallMat.color.set('#ffffff');
    wallMat.needsUpdate = true;
  };

  return { rebuild, frame, setWallTexture };
}
