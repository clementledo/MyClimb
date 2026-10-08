/**
 * Grimpeur en 3D : corps galbé, mains qui prennent la forme de la prise, vrais chaussons
 * d'escalade, visage, et costumes (dont des farfelus).
 * Indépendant de React Native : utilisé par la simulation et pour dessiner les portraits
 * des costumes (carte joueur, choix du costume).
 */
import * as THREE from 'three';

import type { HandTypes, HoldType, Limb } from './simulation';
import { DEFAULT_SKIN, SKINS, type SkinId } from './skins';

type V = THREE.Vector3;

/** Squelette en coordonnées de la scène (y vers le haut), face au mur (vers -z). */
export type Body3 = {
  head: V;
  neck: V;
  chest: V;
  pelvis: V;
  /** Gauche puis droite. `hand` : le poignet ; `grip` : le milieu des doigts. */
  arms: { shoulder: V; elbow: V; hand: V; grip: V }[];
  /** Gauche puis droite. `foot` : la cheville ; `toe` : ce qui touche la prise. */
  legs: { hip: V; knee: V; foot: V; toe: V }[];
};

export type PoseInfo = {
  /** Taille du grimpeur, en mètres. */
  height: number;
  /** Type de prise de chaque main et façon dont chaque pied est posé. */
  types: HandTypes;
  /** Membre qui bouge : main ouverte en l'air, et légère lueur. */
  moving: Limb | null;
  /** Repos de la main `moving` (sac à magnésie, bras secoué). */
  chalk?: number;
  /** Point regardé, dans le repère du grimpeur ; sinon droit devant (le mur). */
  look: V | null;
  /** Temps en ms : respiration, cape, queue. */
  now: number;
  /** Mains en poing (portrait). */
  fists?: [boolean, boolean];
};

/* ---------- Géométries ---------- */

/** Assemble plusieurs morceaux en une seule géométrie (un groupe de matière par morceau si `mats`). */
function merge(parts: THREE.BufferGeometry[], mats?: number[]) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const out = new THREE.BufferGeometry();
  let start = 0;
  parts.forEach((g0, i) => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const u = g.getAttribute('uv');
    for (let k = 0; k < p.count; k++) {
      pos.push(p.getX(k), p.getY(k), p.getZ(k));
      nor.push(n.getX(k), n.getY(k), n.getZ(k));
      uv.push(u ? u.getX(k) : 0, u ? u.getY(k) : 0);
    }
    if (mats) out.addGroup(start, p.count, mats[i]);
    start += p.count;
  });
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

const UP = new THREE.Vector3(0, 1, 0);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Ovale (sphère étirée) centré en `c`. */
function ellipsoid(c: V, r: V, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  g.scale(r.x, r.y, r.z);
  g.translate(c.x, c.y, c.z);
  return g;
}

/** Os arrondi (gélule) de `a` à `b`. */
function bone(a: V, b: V, r: number) {
  const d = b.clone().sub(a);
  const g = new THREE.CapsuleGeometry(r, Math.max(1e-4, d.length()), 3, 8);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

/** Façons de tenir : pliure des doigts (deux phalanges) et direction du pouce. */
type Grip = 'crimp' | 'open' | 'jug' | 'mid' | 'pinch' | 'relaxed' | 'fist';
const GRIP_OF: Record<HoldType, Grip> = {
  bac: 'jug',
  reglette: 'crimp',
  plat: 'open',
  pince: 'pinch',
  inversee: 'jug',
  lat_g: 'jug',
  lat_d: 'jug',
};
const CURL: Record<Grip, { f: [number, number]; thumb: [number, number, number] }> = {
  crimp: { f: [0.25, 1.55], thumb: [-0.5, 0.55, 0.65] },
  open: { f: [0.3, 0.35], thumb: [0.65, 0.75, 0.2] },
  jug: { f: [0.95, 1.15], thumb: [0.15, 0.55, 0.8] },
  mid: { f: [0.6, 0.85], thumb: [0.35, 0.7, 0.55] },
  pinch: { f: [0.55, 0.65], thumb: [-0.15, 0.5, 0.85] },
  relaxed: { f: [0.35, 0.45], thumb: [0.5, 0.75, 0.4] },
  fist: { f: [1.6, 1.75], thumb: [-0.7, 0.35, 0.6] },
};

/**
 * Main (pour une taille de 1 m) : origine au poignet, doigts vers +y, paume vers +z.
 * `side` = 1 : pouce vers +x (main droite vue du dos), -1 pour la main gauche.
 */
function handGeometry(grip: Grip, side: number) {
  const parts: THREE.BufferGeometry[] = [ellipsoid(v(0, 0.03, 0), v(0.0245, 0.032, 0.0105))];
  const { f, thumb } = CURL[grip];
  const fingers: [number, number, number][] = [
    [0.0165, 0.041, 0.0057],
    [0.0055, 0.045, 0.006],
    [-0.0055, 0.042, 0.0057],
    [-0.016, 0.034, 0.0051],
  ];
  for (const [x, L, r] of fingers) {
    const base = v(x * side, 0.058 - Math.abs(x) * 0.3, 0.001);
    const p1 = base.clone().addScaledVector(v(0, Math.cos(f[0]), Math.sin(f[0])), L * 0.55);
    const p2 = p1.clone().addScaledVector(v(0, Math.cos(f[0] + f[1]), Math.sin(f[0] + f[1])), L * 0.45);
    parts.push(bone(base, p1, r), bone(p1, p2, r * 0.9));
  }
  const t0 = v(0.02 * side, 0.014, 0.005);
  const d1 = v(thumb[0] * side, thumb[1], thumb[2]).normalize();
  const t1 = t0.clone().addScaledVector(d1, 0.025);
  const t2 = t1.clone().addScaledVector(d1.clone().add(v(0, 0, 0.6)).normalize(), 0.02);
  parts.push(bone(t0, t1, 0.0068), bone(t1, t2, 0.0062));
  return merge(parts);
}

/**
 * Chausson d'escalade (pour une taille de 1 m) : origine à la cheville, pointe vers +y,
 * dessus du pied vers +z. Matières : 0 dessus, 1 gomme, 2 scratch.
 */
function shoeGeometry() {
  const strap = new THREE.TorusGeometry(0.025, 0.0042, 6, 18, Math.PI);
  strap.rotateX(Math.PI / 2);
  strap.scale(1.08, 1, 1);
  strap.translate(0, 0.032, -0.013);
  const strap2 = strap.clone().translate(0, 0.022, -0.004);
  const collar = new THREE.TorusGeometry(0.02, 0.0045, 6, 18);
  collar.translate(0, 0.002, -0.004);
  return merge(
    [
      ellipsoid(v(0, 0.035, -0.015), v(0.026, 0.07, 0.022), 18),
      ellipsoid(v(0, 0.087, -0.024), v(0.025, 0.031, 0.016)),
      ellipsoid(v(0, -0.022, -0.018), v(0.022, 0.02, 0.021)),
      ellipsoid(v(0, 0.034, -0.034), v(0.0265, 0.08, 0.0065), 18),
      strap,
      strap2,
      collar,
    ],
    [0, 1, 1, 1, 2, 2, 0],
  );
}

/**
 * Cheveux en bataille (rayon 1, face vers +z) : calotte qui s'arrête au front devant, au-dessus
 * des oreilles sur les côtés et à la nuque derrière ; longs : une masse qui tombe dans le dos.
 */
function hairGeometry(style: 'short' | 'long') {
  const W = 36;
  const R = 18;
  const cap = new THREE.SphereGeometry(1, W, R, 0, Math.PI * 2, 0, Math.PI * 0.99);
  const pos = cap.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const phi = ((i % (W + 1)) / W) * Math.PI * 2;
    // 1 devant, -1 derrière : front dégagé avec une frange en mèches, nuque couverte.
    const c = Math.sin(phi);
    const back = Math.min(1, -c * 1.5);
    const edge =
      c >= 0
        ? 1.52 - 0.845 * c + 0.285 * c * c + (c > 0.3 ? 0.07 * c * Math.sin(phi * 11) : 0)
        : 1.52 + 1.13 * back * back * (3 - 2 * back);
    const theta = (Math.floor(i / (W + 1)) / R) * edge;
    const x = -Math.cos(phi) * Math.sin(theta);
    const y = Math.cos(theta);
    const z = Math.sin(phi) * Math.sin(theta);
    const k = 1 + 0.02 * (1 + Math.sin(x * 13 + z * 7) * Math.sin(y * 11 + x * 5)) + 0.03 * Math.max(0, y);
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  cap.computeVertexNormals();
  const parts: THREE.BufferGeometry[] = [cap];
  if (style === 'long') parts.push(ellipsoid(v(0, -0.62, -0.5), v(0.84, 0.75, 0.46), 18));
  return merge(parts);
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
  // Le milieu de la texture (u = 0,5) tombe au milieu du dos.
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    32,
    Math.PI,
  );
}

/** Membre galbé : rayon le long de l'os (de -0,5 à l'attache à 0,5 au bout), extrémités fermées. */
function limbGeometry(profile: [number, number][]) {
  const pts = [new THREE.Vector2(0, -0.5), ...profile.map(([y, r]) => new THREE.Vector2(r, y)), new THREE.Vector2(0, 0.5)];
  return new THREE.LatheGeometry(pts, 20);
}

/* ---------- Textures calculées ---------- */

function dataTexture(w: number, h: number, fill: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b] = fill(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const rgb = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)].map((x) =>
    Math.round(Math.pow(x / 255, 1 / 2.2) * 255),
  ) as [number, number, number];
};

/** Rayures horizontales (marinière de pirate). */
function stripesTexture(a: string, b: string, n: number) {
  const A = rgb(a);
  const B = rgb(b);
  return dataTexture(4, 64, (_, y) => (Math.floor((y / 64) * n * 2) % 2 ? A : B));
}

/** Motif fluo en zigzag (legging rétro). */
function zigzagTexture() {
  const cols = ['#ff3cac', '#00e5ff', '#ffe600', '#7c3aed'].map(rgb);
  return dataTexture(64, 64, (x, y) => {
    const k = Math.floor(((y + Math.abs(((x % 16) - 8) * 2)) / 10) % 4);
    return cols[k];
  });
}

/** Dossard « 7A » (segments comme un afficheur), bandes rouges en haut et en bas. */
function bibTexture() {
  const W = 96;
  const H = 64;
  const red = rgb('#e03131');
  const ink = rgb('#1b1c1f');
  const paper = rgb('#f8f9fa');
  // Segments de chaque caractère : a (haut), b, c (droite), d (bas), e, f (gauche), g (milieu).
  const glyphs: Record<string, string> = { '7': 'abc', A: 'abcefg' };
  const seg = (ch: string, x0: number, x: number, y: number) => {
    const s = glyphs[ch];
    const w = 22;
    const t = 4;
    const top = 16;
    const mid = 32;
    const bot = 48;
    const lx = x - x0;
    const inH = (yy: number) => Math.abs(y - yy) <= t / 2 && lx >= 0 && lx <= w;
    const inV = (xx: number, y1: number, y2: number) => Math.abs(lx - xx) <= t / 2 && y >= y1 && y <= y2;
    return (
      (s.includes('a') && inH(top)) ||
      (s.includes('g') && inH(mid)) ||
      (s.includes('d') && inH(bot)) ||
      (s.includes('f') && inV(0, top, mid)) ||
      (s.includes('b') && inV(w, top, mid)) ||
      (s.includes('e') && inV(0, mid, bot)) ||
      (s.includes('c') && inV(w, mid, bot))
    );
  };
  return dataTexture(W, H, (x, y0) => {
    const y = H - 1 - y0;
    if (y < 7 || y > H - 8) return red;
    if (seg('7', 18, x, y) || seg('A', 56, x, y)) return ink;
    return paper;
  });
}

/** Spirale dorée de la corne de licorne. */
function hornTexture() {
  const a = rgb('#ffd43b');
  const b = rgb('#fff3bf');
  return dataTexture(32, 32, (x, y) => (Math.floor((x + y * 1.5) / 6) % 2 ? a : b));
}

/* ---------- Costumes ---------- */

type Look = {
  skin: string;
  top: string;
  topMap?: 'stripes';
  sleeves: 'short' | 'long' | 'none';
  bottom: string;
  bottomMap?: 'zigzag';
  legs: 'long' | 'shorts';
  shoe: string;
  rubber: string;
  strap: string;
  hair: 'short' | 'long' | 'none';
  hairColor: string;
  /** Couleur des mains (gants) ; sinon la peau. */
  gloves?: string;
  bag: string;
  belt: string;
  /** Visage caché (casque, cagoule de robot). */
  noFace?: boolean;
  metal?: boolean;
};

const BASE_LOOK: Look = {
  skin: '#DDA683',
  top: '#EE5A24',
  sleeves: 'short',
  bottom: '#2f405e',
  legs: 'long',
  shoe: '#F0B429',
  rubber: '#1b1c1f',
  strap: '#f4f4f4',
  hair: 'short',
  hairColor: '#3a2a20',
  bag: '#24272c',
  belt: '#24272c',
};

const LOOKS: Record<SkinId, Partial<Look>> = {
  classique: {},
  competition: {
    top: '#f8f9fa',
    sleeves: 'none',
    bottom: '#212529',
    legs: 'shorts',
    shoe: '#E03131',
    strap: '#212529',
    bag: '#E03131',
  },
  retro: {
    top: '#ffe600',
    sleeves: 'none',
    bottom: '#ff3cac',
    bottomMap: 'zigzag',
    shoe: '#7950F2',
    strap: '#ffe600',
    hair: 'long',
    hairColor: '#7a4b2a',
    bag: '#00e5ff',
  },
  astronaute: {
    top: '#eef0f2',
    sleeves: 'long',
    bottom: '#eef0f2',
    shoe: '#eef0f2',
    rubber: '#8d939b',
    strap: '#EE5A24',
    gloves: '#eef0f2',
    hair: 'none',
    noFace: true,
    bag: '#8d939b',
    belt: '#8d939b',
  },
  dino: {
    top: '#5fb04e',
    sleeves: 'long',
    bottom: '#5fb04e',
    shoe: '#3b7d2f',
    rubber: '#2b2f26',
    strap: '#f59f00',
    hair: 'none',
    bag: '#f59f00',
    belt: '#3b7d2f',
  },
  banane: {
    top: '#ffe135',
    sleeves: 'none',
    bottom: '#1b1c1f',
    shoe: '#ffe135',
    strap: '#6b4f2a',
    hair: 'none',
    bag: '#6b4f2a',
    belt: '#ffe135',
  },
  heros: {
    top: '#1c4fd8',
    sleeves: 'long',
    bottom: '#1c4fd8',
    shoe: '#e03131',
    rubber: '#a51d1d',
    strap: '#ffd43b',
    hairColor: '#1b1c1f',
    bag: '#ffd43b',
    belt: '#ffd43b',
  },
  ninja: {
    top: '#1d1f24',
    sleeves: 'long',
    bottom: '#1d1f24',
    shoe: '#2c2f36',
    rubber: '#111214',
    strap: '#e03131',
    gloves: '#1d1f24',
    hair: 'none',
    bag: '#e03131',
    belt: '#e03131',
  },
  pirate: {
    top: '#f8f9fa',
    topMap: 'stripes',
    sleeves: 'long',
    bottom: '#6b4f2a',
    legs: 'shorts',
    shoe: '#1b1c1f',
    rubber: '#3a2a20',
    strap: '#c9a227',
    hair: 'long',
    hairColor: '#1b1c1f',
    bag: '#6b4f2a',
    belt: '#3a2a20',
  },
  robot: {
    skin: '#aeb6bf',
    top: '#c3cbd3',
    sleeves: 'long',
    bottom: '#8d959e',
    shoe: '#5c636b',
    rubber: '#2b2f33',
    strap: '#40c057',
    gloves: '#8d959e',
    hair: 'none',
    noFace: true,
    metal: true,
    bag: '#40c057',
    belt: '#5c636b',
  },
  noel: {
    top: '#c92a2a',
    sleeves: 'long',
    bottom: '#c92a2a',
    shoe: '#1b1c1f',
    rubber: '#111214',
    strap: '#f8f9fa',
    hair: 'short',
    hairColor: '#f1f3f5',
    bag: '#f8f9fa',
    belt: '#1b1c1f',
  },
  licorne: {
    top: '#fff0f6',
    sleeves: 'long',
    bottom: '#fff0f6',
    shoe: '#f783ac',
    strap: '#cc5de8',
    hair: 'none',
    bag: '#cc5de8',
    belt: '#f783ac',
  },
};

const RAINBOW = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];

/* ---------- Le grimpeur ---------- */

export function createClimber() {
  const group = new THREE.Group();
  const mat = (color: string, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });
  const M = {
    skin: mat(BASE_LOOK.skin, 0.55),
    top: mat(BASE_LOOK.top, 0.85),
    bottom: mat(BASE_LOOK.bottom, 0.9),
    hair: new THREE.MeshStandardMaterial({ color: BASE_LOOK.hairColor, roughness: 0.95, side: THREE.DoubleSide }),
    shoe: [mat(BASE_LOOK.shoe, 0.55), mat(BASE_LOOK.shoe, 0.55)],
    rubber: mat(BASE_LOOK.rubber, 0.75),
    strap: mat(BASE_LOOK.strap, 0.7),
    hands: [mat(BASE_LOOK.skin, 0.6), mat(BASE_LOOK.skin, 0.6)],
    bag: mat(BASE_LOOK.bag, 0.9),
    band: mat('#f4f4f4', 0.7),
    belt: mat(BASE_LOOK.belt, 0.8),
    eyeWhite: mat('#fbfbfb', 0.3),
    eye: mat('#2b2118', 0.25),
    brow: mat('#3a2a20', 0.9),
    lips: mat('#b5655a', 0.6),
  };
  const textures = { stripes: stripesTexture('#e03131', '#f8f9fa', 7), zigzag: zigzagTexture() };

  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 20);
  const sleeveGeo = new THREE.CylinderGeometry(0.9, 1, 1, 20, 1, true);
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
    [0.47, 0.6],
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
  const grips = Object.keys(CURL) as Grip[];
  // Une forme de main par façon de tenir, pour chaque main (pouce de chaque côté).
  const handGeos = [-1, 1].map((side) => Object.fromEntries(grips.map((g) => [g, handGeometry(g, side)])) as Record<Grip, THREE.BufferGeometry>);
  const shoeGeo = shoeGeometry();
  const hairGeos = { short: hairGeometry('short'), long: hairGeometry('long') };

  const add = (geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], parent: THREE.Object3D = group) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const torso = add(torsoGeo, M.top);
  const hem = add(cylGeo, M.top);
  const belt = add(cylGeo, M.belt);
  const seat = add(sphere, M.bottom);
  const bag = add(cylGeo, M.bag);
  const bagTop = add(cylGeo, M.band);
  const neck = add(cylGeo, M.skin);
  // Repères qui suivent le buste et le bassin (x : vers la droite, y : vers la tête, z : le dos).
  const chestFrame = new THREE.Group();
  const pelvisFrame = new THREE.Group();
  group.add(chestFrame, pelvisFrame);
  // Tête dans son propre repère, qui regarde la prise visée (avant = +z local).
  const headGroup = new THREE.Group();
  group.add(headGroup);
  const head = add(sphere, M.skin, headGroup);
  const hair = add(hairGeos.short, M.hair, headGroup);
  const nose = add(sphere, M.skin, headGroup);
  const ears = [add(sphere, M.skin, headGroup), add(sphere, M.skin, headGroup)];
  const face = new THREE.Group();
  headGroup.add(face);
  [-1, 1].forEach((s) => {
    const white = add(sphere, M.eyeWhite, face);
    white.position.set(s * 0.02, 0.008, 0.0495);
    white.scale.set(0.0095, 0.011, 0.0065);
    const iris = add(sphere, M.eye, face);
    iris.position.set(s * 0.019, 0.007, 0.0545);
    iris.scale.setScalar(0.0056);
    const brow = add(new THREE.CapsuleGeometry(0.0024, 0.013, 2, 6), M.brow, face);
    brow.position.set(s * 0.021, 0.024, 0.0505);
    brow.rotation.set(0, 0, Math.PI / 2 + s * 0.12);
  });
  const mouth = add(new THREE.TorusGeometry(0.0115, 0.0021, 6, 16, 1.9), M.lips, face);
  mouth.position.set(0, -0.013, 0.0535);
  mouth.rotation.z = -Math.PI / 2 - 0.95;

  const arms = [0, 1].map((i) => ({
    shoulder: add(sphere, M.top),
    sleeve: add(sleeveGeo, M.top),
    upper: add(upperGeo, M.skin),
    elbow: add(sphere, M.skin),
    fore: add(foreGeo, M.skin),
    wrist: add(sphere, M.skin),
    hand: add(handGeos[i].mid, M.hands[i]),
  }));
  const legs = [0, 1].map((i) => ({
    hip: add(sphere, M.bottom),
    thigh: add(thighGeo, M.bottom),
    shorts: add(sleeveGeo, M.bottom),
    knee: add(sphere, M.bottom),
    shin: add(shinGeo, M.bottom),
    cuff: add(cylGeo, M.bottom),
    shoe: add(shoeGeo, [M.shoe[i], M.rubber, M.strap]),
  }));

  /* ----- Costumes : accessoires ----- */

  type Extra = { update?: (b: Body3, info: PoseInfo, f: Frames) => void };
  type Frames = { yAx: V; zAx: V; xAx: V; hgt: number };
  let extras: Extra[] = [];
  const extraRoot = new THREE.Group();
  group.add(extraRoot);
  const headExtras = new THREE.Group();
  const chestExtras = new THREE.Group();
  const pelvisExtras = new THREE.Group();
  headGroup.add(headExtras);
  chestFrame.add(chestExtras);
  pelvisFrame.add(pelvisExtras);
  let look: Look = BASE_LOOK;
  const owned: THREE.Material[] = [];
  const own = <T extends THREE.Material>(m: T) => {
    owned.push(m);
    return m;
  };

  /** Accessoire posé dans un repère (tête : unités en fraction de la taille, face vers +z). */
  const piece = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, p: V, s: V | number, r?: THREE.Euler) => {
    const mesh = add(geo, m, parent);
    mesh.position.copy(p);
    if (typeof s === 'number') mesh.scale.setScalar(s);
    else mesh.scale.copy(s);
    if (r) mesh.rotation.copy(r);
    return mesh;
  };

  /** Queue du bas du dos vers le sol, qui se balance : chaîne de cônes, ou touffue (boules). */
  const tail = (colors: string[], len: number, r0: number, puffy = false) => {
    const n = puffy ? 9 : 7;
    const segs = Array.from({ length: n }, (_, i) =>
      add(puffy ? sphere : new THREE.CylinderGeometry(1, 1, 1, 10), own(mat(colors[i % colors.length], 0.85)), extraRoot),
    );
    return {
      update: (b: Body3, info: PoseInfo, f: Frames) => {
        let at = b.pelvis.clone().addScaledVector(f.zAx, 0.06 * f.hgt).addScaledVector(f.yAx, -0.03 * f.hgt);
        const step = (len * f.hgt) / n;
        for (let i = 0; i < n; i++) {
          const k = i / (n - 1);
          const sway = Math.sin(info.now / 420 + i * 0.6) * 0.35 * k;
          const dir = f.zAx
            .clone()
            .multiplyScalar(0.9 - k * 0.6)
            .addScaledVector(f.yAx, -0.6 - k * 0.5)
            .addScaledVector(f.xAx, sway)
            .normalize();
          const next = at.clone().addScaledVector(dir, step);
          const r = r0 * f.hgt * (puffy ? 1 - k * 0.4 : 1 - k * 0.75);
          const m = segs[i];
          m.position.copy(at).add(next).multiplyScalar(0.5);
          m.quaternion.setFromUnitVectors(UP, dir);
          m.scale.set(r, step * (puffy ? 0.8 : 1.15), r);
          at = next;
        }
      },
    };
  };

  /** Cape : attachée en haut des épaules, jusqu'au milieu des cuisses, qui flotte un peu. */
  const cape = (color: string) => {
    const cols = 8;
    const rows = 10;
    const geo = new THREE.PlaneGeometry(1, 1, cols, rows);
    const m = own(new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
    const mesh = add(geo, m, extraRoot);
    mesh.frustumCulled = false;
    const pos = geo.getAttribute('position');
    return {
      update: (b: Body3, info: PoseInfo, f: Frames) => {
        const h = f.hgt;
        const top = b.chest.clone().addScaledVector(f.zAx, 0.062 * h).addScaledVector(f.yAx, 0.034 * h);
        const down = f.yAx.clone().negate().lerp(v(0, -1, 0), 0.5).normalize();
        for (let j = 0; j <= rows; j++) {
          const k = j / rows;
          for (let i = 0; i <= cols; i++) {
            const u = i / cols - 0.5;
            const width = (0.16 + 0.15 * Math.sqrt(k)) * h;
            const flutter = Math.sin(info.now / 260 + k * 4 + u * 3) * 0.03 * h * k;
            const p = top
              .clone()
              .addScaledVector(f.xAx, u * width)
              .addScaledVector(down, k * 0.45 * h)
              .addScaledVector(f.zAx, (0.012 + 0.07 * k) * h * (1 - 1.4 * u * u) + flutter);
            pos.setXYZ(j * (cols + 1) + i, p.x, p.y, p.z);
          }
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      },
    };
  };

  /** Pointes le long du dos (dinosaure). */
  const spikes = (color: string) => {
    const m = own(mat(color, 0.6));
    const cone = new THREE.ConeGeometry(1, 1, 4);
    for (let i = 0; i < 5; i++) {
      const y = 0.035 - i * 0.055;
      const s = 0.03 - i * 0.003;
      piece(chestExtras, cone, m, v(0, y, 0.062), v(s * 0.6, s * 1.4, s), new THREE.Euler(Math.PI / 2, 0, 0));
    }
  };

  const fur = own(mat('#f8f9fa', 1));
  const build = (id: SkinId) => {
    const H = headExtras;
    const C = chestExtras;
    const P = pelvisExtras;
    switch (id) {
      case 'competition': {
        piece(H, new THREE.TorusGeometry(1, 0.2, 8, 28), own(mat('#e03131', 0.8)), v(0, 0.041, -0.002), v(0.051, 0.056, 0.03), new THREE.Euler(Math.PI / 2 + 0.12, 0, 0));
        const bibMat = own(new THREE.MeshStandardMaterial({ map: bibTexture(), roughness: 0.8 }));
        const bib = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true, -0.55, 1.1);
        piece(C, bib, bibMat, v(0, -0.07, 0), v(0.107, 0.1, 0.066));
        break;
      }
      case 'retro': {
        piece(H, new THREE.TorusGeometry(1, 0.28, 8, 28), own(mat('#ff3cac', 1)), v(0, 0.042, -0.002), v(0.052, 0.057, 0.034), new THREE.Euler(Math.PI / 2 + 0.12, 0, 0));
        extras.push(wristbands('#00e5ff'));
        break;
      }
      case 'astronaute': {
        const shell = own(new THREE.MeshPhongMaterial({ color: '#f1f3f5', shininess: 40 }));
        piece(H, sphere, shell, v(0, 0.004, -0.004), v(0.086, 0.092, 0.088));
        const visor = own(new THREE.MeshPhongMaterial({ color: '#2a2111', specular: '#ffcf6b', shininess: 120 }));
        piece(H, new THREE.SphereGeometry(1, 24, 16, Math.PI / 2 - 0.95, 1.9, 0.95, 1.05), visor, v(0, 0.004, 0.002), v(0.089, 0.094, 0.091));
        piece(H, new THREE.TorusGeometry(1, 0.12, 8, 28), shell, v(0, -0.062, 0), v(0.07, 0.07, 0.05), new THREE.Euler(Math.PI / 2, 0, 0));
        const pack = own(new THREE.MeshPhongMaterial({ color: '#dee2e6', shininess: 25 }));
        piece(C, new THREE.BoxGeometry(1, 1, 1), pack, v(0, -0.06, 0.09), v(0.16, 0.2, 0.07));
        piece(C, cylGeo, own(mat('#EE5A24', 0.6)), v(0.05, 0.02, 0.127), v(0.012, 0.004, 0.012), new THREE.Euler(Math.PI / 2, 0, 0));
        piece(C, cylGeo, own(mat('#40c057', 0.6)), v(0.02, 0.02, 0.127), v(0.012, 0.004, 0.012), new THREE.Euler(Math.PI / 2, 0, 0));
        break;
      }
      case 'dino': {
        const green = own(mat('#5fb04e', 0.85));
        piece(H, new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), green, v(0, 0.008, -0.006), v(0.068, 0.075, 0.072), new THREE.Euler(-0.5, 0, 0));
        const white = own(mat('#ffffff', 0.4));
        const black = own(mat('#1b1c1f', 0.3));
        for (const s of [-1, 1]) {
          piece(H, sphere, white, v(s * 0.026, 0.066, 0.03), 0.014);
          piece(H, sphere, black, v(s * 0.027, 0.07, 0.04), 0.0065);
        }
        const tooth = new THREE.ConeGeometry(1, 1, 4);
        for (let i = 0; i < 7; i++) {
          const a = -0.9 + (i * 1.8) / 6;
          piece(H, tooth, white, v(Math.sin(a) * 0.05, 0.03 + Math.cos(a) * 0.012, 0.05 * Math.cos(a * 0.6)), v(0.005, 0.012, 0.005), new THREE.Euler(Math.PI, 0, 0));
        }
        spikes('#f59f00');
        for (let i = 0; i < 4; i++) piece(H, new THREE.ConeGeometry(1, 1, 4), own(mat('#f59f00', 0.6)), v(0, 0.075 - i * 0.022, -0.04 - i * 0.017), v(0.012, 0.03, 0.016), new THREE.Euler(-0.9 - i * 0.25, 0, 0));
        extras.push(tail(['#5fb04e'], 0.5, 0.06));
        break;
      }
      case 'banane': {
        // Banane à cinq pans, ouverte devant pour le visage, du dessus de la tête aux cuisses.
        const profile: [number, number][] = [
          [0.0, -0.62],
          [0.45, -0.58],
          [0.82, -0.45],
          [1.0, -0.2],
          [1.0, 0.15],
          [0.86, 0.38],
          [0.55, 0.55],
          [0.18, 0.66],
          [0.0, 0.7],
        ];
        const g = new THREE.LatheGeometry(
          profile.map(([r, y]) => new THREE.Vector2(r, y)),
          5,
          Math.PI * 0.22,
          Math.PI * 1.56,
        );
        // Courbée vers l'arrière, comme une vraie banane.
        const pos = g.getAttribute('position');
        for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + 0.45 * (1 - pos.getY(i) ** 2));
        g.computeVertexNormals();
        const yellow = own(new THREE.MeshStandardMaterial({ color: '#ffe135', roughness: 0.6, side: THREE.DoubleSide, flatShading: true }));
        piece(C, g, yellow, v(0, -0.09, 0.005), v(0.15, 0.53, 0.12), new THREE.Euler(0, Math.PI, 0));
        const brown = own(mat('#6b4f2a', 0.8));
        piece(C, cylGeo, brown, v(0, 0.29, -0.03), v(0.016, 0.06, 0.016), new THREE.Euler(-0.5, 0, 0));
        piece(C, sphere, brown, v(0, -0.42, -0.03), v(0.03, 0.02, 0.03));
        break;
      }
      case 'heros': {
        const red = own(mat('#e03131', 0.7));
        piece(P, sphere, red, v(0, -0.012, 0.004), v(0.099, 0.066, 0.064));
        const mask = own(mat('#1b1c1f', 0.6));
        piece(H, new THREE.SphereGeometry(1, 24, 8, Math.PI / 2 - 0.9, 1.8, 1.35, 0.35), mask, v(0, 0.008, 0), v(0.057, 0.067, 0.061));
        const gold = own(mat('#ffd43b', 0.5));
        piece(C, new THREE.CylinderGeometry(1, 1, 1, 4), gold, v(0, 0.02, -0.06), v(0.035, 0.01, 0.035), new THREE.Euler(Math.PI / 2, 0, 0));
        extras.push(cape('#e03131'));
        break;
      }
      case 'ninja': {
        const black = own(mat('#1d1f24', 0.9));
        piece(H, new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.44), black, v(0, 0, 0), v(0.058, 0.068, 0.062));
        piece(H, new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, Math.PI * 0.555, Math.PI * 0.445), black, v(0, 0, 0), v(0.058, 0.068, 0.062));
        const red = own(mat('#e03131', 0.8));
        piece(H, new THREE.TorusGeometry(1, 0.15, 8, 28), red, v(0, 0.028, 0), v(0.06, 0.062, 0.03), new THREE.Euler(Math.PI / 2 + 0.15, 0, 0));
        extras.push(ribbon('#e03131'));
        break;
      }
      case 'pirate': {
        const red = own(mat('#c92a2a', 0.85));
        piece(H, new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), red, v(0, 0.012, -0.004), v(0.066, 0.072, 0.07), new THREE.Euler(-0.3, 0, 0));
        piece(H, sphere, red, v(0.03, 0.01, -0.06), v(0.014, 0.01, 0.01));
        piece(H, new THREE.CapsuleGeometry(1, 2, 2, 6), red, v(0.04, -0.012, -0.066), v(0.006, 0.012, 0.006), new THREE.Euler(0, 0, 0.5));
        const black = own(mat('#111214', 0.5));
        piece(H, new THREE.CylinderGeometry(1, 1, 1, 16), black, v(-0.02, 0.008, 0.055), v(0.012, 0.004, 0.012), new THREE.Euler(Math.PI / 2, 0, 0));
        piece(H, new THREE.TorusGeometry(1, 0.03, 6, 32), black, v(0, 0.012, 0), v(0.06, 0.066, 0.06), new THREE.Euler(0, 0, -0.35));
        const beard = own(mat('#2b2118', 0.95));
        piece(H, new THREE.SphereGeometry(1, 20, 12, Math.PI / 2 - 1.2, 2.4, Math.PI * 0.58, Math.PI * 0.42), beard, v(0, -0.012, 0.01), v(0.05, 0.062, 0.05));
        for (const s of [-1, 1]) piece(H, sphere, beard, v(s * 0.011, -0.0085, 0.055), v(0.012, 0.0045, 0.006), new THREE.Euler(0, 0, s * 0.35));
        break;
      }
      case 'robot': {
        const metal = own(new THREE.MeshStandardMaterial({ color: '#c3cbd3', roughness: 0.35, metalness: 0.35 }));
        piece(H, new THREE.BoxGeometry(1, 1, 1), metal, v(0, 0.004, 0), v(0.115, 0.12, 0.115));
        const glowMat = own(new THREE.MeshBasicMaterial({ color: '#66d9e8' }));
        for (const s of [-1, 1]) piece(H, new THREE.BoxGeometry(1, 1, 1), glowMat, v(s * 0.024, 0.012, 0.058), v(0.026, 0.012, 0.004));
        piece(H, new THREE.BoxGeometry(1, 1, 1), own(mat('#495057', 0.5)), v(0, -0.026, 0.058), v(0.05, 0.006, 0.004));
        piece(H, cylGeo, metal, v(0, 0.08, 0), v(0.004, 0.04, 0.004));
        piece(H, sphere, own(new THREE.MeshBasicMaterial({ color: '#ff6b6b' })), v(0, 0.104, 0), 0.011);
        for (const s of [-1, 1]) piece(H, cylGeo, own(mat('#5c636b', 0.4)), v(s * 0.062, 0.004, 0), v(0.02, 0.012, 0.02), new THREE.Euler(0, 0, Math.PI / 2));
        const vent = own(mat('#5c636b', 0.5));
        for (let i = 0; i < 3; i++) piece(C, new THREE.BoxGeometry(1, 1, 1), vent, v(0, -0.02 - i * 0.03, 0.064), v(0.09, 0.008, 0.006));
        piece(C, new THREE.BoxGeometry(1, 1, 1), glowMat, v(0, -0.05, -0.064), v(0.04, 0.025, 0.004));
        break;
      }
      case 'noel': {
        const red = own(mat('#c92a2a', 0.85));
        const hat = new THREE.ConeGeometry(1, 1, 20, 6, true);
        const pos = hat.getAttribute('position');
        // Bonnet qui retombe vers l'arrière.
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i) + 0.5;
          pos.setZ(i, pos.getZ(i) - 0.9 * y * y);
          pos.setY(i, pos.getY(i) - 0.25 * y * y);
        }
        hat.computeVertexNormals();
        piece(H, hat, red, v(0, 0.075, -0.012), v(0.058, 0.09, 0.058), new THREE.Euler(-0.25, 0, 0));
        piece(H, new THREE.TorusGeometry(1, 0.22, 8, 28), fur, v(0, 0.035, -0.006), v(0.058, 0.06, 0.04), new THREE.Euler(Math.PI / 2 - 0.25, 0, 0));
        piece(H, sphere, fur, v(0, 0.085, -0.07), 0.016);
        piece(H, new THREE.SphereGeometry(1, 20, 12, Math.PI / 2 - 1.3, 2.6, Math.PI * 0.5, Math.PI * 0.5), fur, v(0, -0.02, 0.008), v(0.056, 0.08, 0.054));
        for (const s of [-1, 1]) piece(H, sphere, fur, v(s * 0.013, -0.0095, 0.055), v(0.016, 0.0068, 0.008), new THREE.Euler(0, 0, s * 0.3));
        piece(P, new THREE.BoxGeometry(1, 1, 1), own(mat('#ffd43b', 0.4)), v(0, 0.018, -0.058), v(0.03, 0.022, 0.006));
        extras.push(trims());
        break;
      }
      case 'licorne': {
        const white = own(mat('#fff0f6', 0.85));
        piece(H, new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), white, v(0, 0.008, -0.006), v(0.067, 0.075, 0.072), new THREE.Euler(-0.45, 0, 0));
        const horn = own(new THREE.MeshStandardMaterial({ map: hornTexture(), roughness: 0.4 }));
        piece(H, new THREE.ConeGeometry(1, 1, 16), horn, v(0, 0.098, 0.034), v(0.014, 0.075, 0.014), new THREE.Euler(0.45, 0, 0));
        const pink = own(mat('#fcc2d7', 0.7));
        for (const s of [-1, 1]) {
          piece(H, new THREE.ConeGeometry(1, 1, 8), white, v(s * 0.045, 0.078, -0.01), v(0.014, 0.034, 0.008), new THREE.Euler(0, 0, -s * 0.4));
          piece(H, new THREE.ConeGeometry(1, 1, 8), pink, v(s * 0.045, 0.077, -0.004), v(0.008, 0.024, 0.004), new THREE.Euler(0, 0, -s * 0.4));
        }
        for (let i = 0; i < 9; i++) {
          const a = 0.38 + i * 0.25;
          const lock = new THREE.Euler(-a - Math.PI / 2, 0, (i % 2 ? 1 : -1) * 0.25);
          piece(H, sphere, own(mat(RAINBOW[i % RAINBOW.length], 0.75)), v(0, 0.008 + Math.cos(a) * 0.077, -0.006 - Math.sin(a) * 0.075), v(0.017, 0.026, 0.009), lock);
        }
        extras.push(tail(RAINBOW, 0.42, 0.03, true));
        break;
      }
      default:
        break;
    }
  };

  /** Poignets éponge (rétro). */
  function wristbands(color: string): Extra {
    const m = own(mat(color, 1));
    const rings = [0, 1].map(() => add(new THREE.CylinderGeometry(1, 1, 1, 14), m, extraRoot));
    return {
      update: (b, _info, f) => {
        b.arms.forEach((a, i) => {
          const d = a.hand.clone().sub(a.elbow);
          rings[i].position.copy(a.hand).addScaledVector(d, -0.12);
          rings[i].quaternion.setFromUnitVectors(UP, d.normalize());
          rings[i].scale.set(0.024 * f.hgt, 0.028 * f.hgt, 0.024 * f.hgt);
        });
      },
    };
  }

  /** Bordures de fourrure blanche aux poignets, aux chevilles et au bas de la veste (Père Noël). */
  function trims(): Extra {
    const rings = [0, 1, 2, 3].map(() => add(new THREE.CylinderGeometry(1, 1, 1, 16), fur, extraRoot));
    const hemFur = add(cylGeo, fur, extraRoot);
    return {
      update: (b, _info, f) => {
        const h = f.hgt;
        b.arms.forEach((a, i) => {
          const d = a.hand.clone().sub(a.elbow);
          rings[i].position.copy(a.hand).addScaledVector(d, -0.14);
          rings[i].quaternion.setFromUnitVectors(UP, d.normalize());
          rings[i].scale.set(0.029 * h, 0.022 * h, 0.029 * h);
        });
        b.legs.forEach((l, i) => {
          const d = l.foot.clone().sub(l.knee);
          rings[2 + i].position.copy(l.foot).addScaledVector(d, -0.12);
          rings[2 + i].quaternion.setFromUnitVectors(UP, d.normalize());
          rings[2 + i].scale.set(0.036 * h, 0.024 * h, 0.036 * h);
        });
        hemFur.position.copy(b.pelvis).addScaledVector(f.yAx, 0.03 * h);
        hemFur.quaternion.copy(torso.quaternion);
        hemFur.scale.set(0.098 * h, 0.03 * h, 0.066 * h);
      },
    };
  }

  /** Pans du bandeau de ninja qui flottent derrière la tête. */
  function ribbon(color: string): Extra {
    const m = own(new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
    const tails = [0, 1].map(() => {
      const g = new THREE.PlaneGeometry(1, 1, 1, 6);
      const mesh = add(g, m, extraRoot);
      mesh.frustumCulled = false;
      return g;
    });
    return {
      update: (b, info, f) => {
        const h = f.hgt;
        headGroup.updateMatrixWorld();
        const knot = headGroup.localToWorld(v(0, 0.028, -0.064));
        group.worldToLocal(knot);
        tails.forEach((g, t) => {
          const pos = g.getAttribute('position');
          const side = t ? 1 : -1;
          for (let j = 0; j <= 6; j++) {
            const k = j / 6;
            const wave = Math.sin(info.now / 200 + k * 5 + t) * 0.02 * h * k;
            const c = knot
              .clone()
              .addScaledVector(f.zAx, 0.09 * h * k)
              .addScaledVector(f.yAx, -0.06 * h * k + wave)
              .addScaledVector(f.xAx, side * 0.03 * h * k);
            for (let i = 0; i <= 1; i++) {
              const p = c.clone().addScaledVector(f.yAx, (i - 0.5) * 0.016 * h);
              pos.setXYZ(j * 2 + i, p.x, p.y, p.z);
            }
          }
          pos.needsUpdate = true;
          g.computeVertexNormals();
        });
      },
    };
  }

  const LOOKS_FULL = Object.fromEntries(SKINS.map((s) => [s.id, { ...BASE_LOOK, ...LOOKS[s.id] }])) as Record<SkinId, Look>;

  /** Change de costume. */
  const setSkin = (id: SkinId) => {
    for (const g of [headExtras, chestExtras, pelvisExtras, extraRoot]) {
      g.traverse((o) => {
        if (o instanceof THREE.Mesh && o.geometry !== sphere && o.geometry !== cylGeo) o.geometry.dispose();
      });
      g.clear();
    }
    owned.splice(0).forEach((m) => {
      if (m === fur) return;
      (m as THREE.MeshStandardMaterial).map?.dispose();
      m.dispose();
    });
    owned.push(fur);
    extras = [];
    look = LOOKS_FULL[id];
    const L = look;
    M.skin.color.set(L.skin);
    M.top.color.set(L.topMap ? '#ffffff' : L.top);
    M.top.map = L.topMap ? textures.stripes : null;
    M.bottom.color.set(L.bottomMap ? '#ffffff' : L.bottom);
    M.bottom.map = L.bottomMap ? textures.zigzag : null;
    for (const m of [M.top, M.bottom]) m.needsUpdate = true;
    for (const m of [M.skin, M.top, M.bottom, ...M.hands]) {
      m.metalness = L.metal ? 0.3 : 0;
      m.roughness = L.metal ? 0.4 : m === M.skin ? 0.55 : 0.85;
    }
    M.hair.color.set(L.hairColor);
    M.brow.color.set(L.hairColor === '#f1f3f5' ? '#ced4da' : L.hairColor);
    M.shoe.forEach((m) => m.color.set(L.shoe));
    M.rubber.color.set(L.rubber);
    M.strap.color.set(L.strap);
    // Mains blanchies par la magnésie, ou gants.
    M.hands.forEach((m) => m.color.set(L.gloves ?? L.skin).lerp(new THREE.Color('#ffffff'), L.gloves ? 0 : 0.18));
    M.bag.color.set(L.bag);
    M.belt.color.set(L.belt);
    hair.visible = L.hair !== 'none';
    if (L.hair !== 'none') hair.geometry = hairGeos[L.hair];
    face.visible = !L.noFace;
    for (const p of [head, nose, ...ears]) p.visible = id !== 'robot';
    const sleeveMat = L.sleeves === 'long' ? M.top : M.skin;
    arms.forEach((a) => {
      a.sleeve.visible = L.sleeves === 'short';
      a.shoulder.material = L.sleeves === 'none' ? M.skin : M.top;
      a.upper.material = sleeveMat;
      a.fore.material = sleeveMat;
      a.elbow.material = sleeveMat;
      a.wrist.material = L.gloves ? M.hands[0] : sleeveMat;
    });
    const shinMat = L.legs === 'shorts' ? M.skin : M.bottom;
    legs.forEach((l) => {
      l.thigh.material = L.legs === 'shorts' ? M.skin : M.bottom;
      l.shorts.visible = L.legs === 'shorts';
      l.knee.material = shinMat;
      l.shin.material = shinMat;
      l.cuff.visible = L.legs !== 'shorts';
    });
    build(id);
  };

  /* ----- Pose ----- */

  const Z = new THREE.Vector3(0, 0, 1);
  const basis = new THREE.Matrix4();
  const between = (mesh: THREE.Mesh, a: V, b: V, r: number) => {
    const d = b.clone().sub(a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.set(r, d.length(), r);
    mesh.quaternion.setFromUnitVectors(UP, d.normalize());
  };
  const ball = (mesh: THREE.Mesh, at: V, r: number) => {
    mesh.position.copy(at);
    mesh.scale.setScalar(r);
  };
  /** Oriente un objet : `y` = son axe +y, `z` = son axe +z (rendu perpendiculaire). */
  const orient = (o: THREE.Object3D, y: V, z: V) => {
    const yy = y.clone().normalize();
    const zz = z.clone().addScaledVector(yy, -z.dot(yy)).normalize();
    const xx = new THREE.Vector3().crossVectors(yy, zz);
    basis.makeBasis(xx, yy, zz);
    o.quaternion.setFromRotationMatrix(basis);
  };
  const limbs = ['lh', 'rh', 'lf', 'rf'] as const;
  const glow = new THREE.Color('#EE5A24');
  const target = new THREE.Vector3();

  const update = (b: Body3, info: PoseInfo) => {
    const hgt = info.height;
    const { chest, pelvis } = b;
    const breath = 1 + Math.sin(info.now / 700) * 0.012;

    // Buste aplati, face au mur.
    const yAx = chest.clone().sub(pelvis).normalize();
    const zAx = Z.clone().addScaledVector(yAx, -yAx.z).normalize();
    const xAx = new THREE.Vector3().crossVectors(yAx, zAx);
    basis.makeBasis(xAx, yAx, zAx);
    const top = chest.clone().addScaledVector(yAx, hgt * 0.035);
    const bottom = pelvis.clone().addScaledVector(yAx, -hgt * 0.005);
    torso.position.copy(top).add(bottom).multiplyScalar(0.5);
    torso.quaternion.setFromRotationMatrix(basis);
    torso.scale.set(hgt * 0.104 * breath, top.distanceTo(bottom), hgt * 0.06 * breath);
    chestFrame.position.copy(chest);
    chestFrame.quaternion.copy(torso.quaternion);
    chestFrame.scale.setScalar(hgt);
    pelvisFrame.position.copy(pelvis);
    pelvisFrame.quaternion.copy(torso.quaternion);
    pelvisFrame.scale.setScalar(hgt);
    // Bas du t-shirt, ceinture et fesses dans le pantalon.
    hem.position.copy(pelvis).addScaledVector(yAx, hgt * 0.04);
    hem.quaternion.copy(torso.quaternion);
    hem.scale.set(hgt * 0.092, hgt * 0.03, hgt * 0.06);
    belt.position.copy(pelvis).addScaledVector(yAx, hgt * 0.018);
    belt.quaternion.copy(torso.quaternion);
    belt.scale.set(hgt * 0.09, hgt * 0.014, hgt * 0.058);
    seat.position.copy(pelvis).addScaledVector(yAx, -hgt * 0.012).addScaledVector(zAx, hgt * 0.006);
    seat.quaternion.copy(torso.quaternion);
    seat.scale.set(hgt * 0.095, hgt * 0.062, hgt * 0.06);
    // Sac à magnésie dans le dos, à la ceinture, qui se balance un peu.
    const swing = Math.sin(info.now / 380) * 0.08;
    const bagP = pelvis.clone().addScaledVector(zAx, hgt * 0.072).addScaledVector(yAx, hgt * 0.01);
    bag.position.copy(bagP);
    bag.quaternion.copy(torso.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(swing, 0, swing * 0.5)));
    bag.scale.set(hgt * 0.026, hgt * 0.062, hgt * 0.026);
    bagTop.position.copy(bagP).addScaledVector(yAx, hgt * 0.033);
    bagTop.quaternion.copy(bag.quaternion);
    bagTop.scale.set(hgt * 0.028, hgt * 0.008, hgt * 0.028);
    between(neck, chest, b.neck, hgt * 0.026);

    // Tête un peu ovale qui regarde la prise visée (sinon droit devant), en partie seulement,
    // comme le permet le cou.
    headGroup.position.copy(b.head);
    headGroup.scale.setScalar(hgt * 1.08);
    group.updateWorldMatrix(true, false);
    const gaze = v(0, 0, -1);
    if (info.look) gaze.multiplyScalar(0.7).addScaledVector(info.look.clone().sub(b.head).normalize(), 0.45);
    headGroup.up.copy(yAx).transformDirection(group.matrixWorld);
    target.copy(b.head).add(gaze.normalize());
    headGroup.lookAt(group.localToWorld(target.clone()));
    head.scale.set(0.054, 0.064, 0.058);
    hair.position.set(0, 0.003, -0.002);
    hair.scale.set(0.059, 0.068, 0.063);
    nose.position.set(0, -0.004, 0.056);
    nose.scale.set(0.008, 0.013, 0.01);
    ears.forEach((ear, i) => {
      ear.position.set((i ? 1 : -1) * 0.053, -0.002, -0.004);
      ear.scale.set(0.008, 0.016, 0.012);
    });

    b.arms.forEach((a, i) => {
      const arm = arms[i];
      const limb = i ? 'rh' : 'lh';
      ball(arm.shoulder, a.shoulder, hgt * 0.041);
      // Manche courte sur le haut du bras, peau en dessous.
      between(arm.sleeve, a.shoulder, a.shoulder.clone().lerp(a.elbow, 0.45), hgt * 0.041);
      between(arm.upper, a.shoulder, a.elbow, hgt * 0.035);
      ball(arm.elbow, a.elbow, hgt * 0.026);
      between(arm.fore, a.elbow, a.hand, hgt * 0.031);
      ball(arm.wrist, a.hand, hgt * 0.019);
      // Main : forme selon la prise, ouverte en l'air, poing levé pour le portrait.
      const t = info.types[limb];
      const flying = info.moving === limb;
      const grip: Grip = info.fists?.[i] ? 'fist' : flying ? 'relaxed' : t ? GRIP_OF[t] : 'mid';
      arm.hand.geometry = handGeos[i][grip];
      arm.hand.position.copy(a.hand);
      arm.hand.scale.setScalar(hgt);
      const along = a.grip.clone().sub(a.hand);
      if (along.lengthSq() < 1e-8) along.copy(a.hand).sub(a.elbow);
      // Paume vers le mur ; vers le haut sous une inversée ; vers le bas sur une prise poussée.
      const palm =
        t === 'inversee' && !flying ? v(0, 1, 0) : along.y < -0.3 * along.length() && !flying ? v(0, -1, 0.2) : v(0, 0.15, -1);
      orient(arm.hand, along, palm);
    });

    b.legs.forEach((l, i) => {
      const leg = legs[i];
      const limb = limbs[2 + i];
      const side = i ? 1 : -1;
      ball(leg.hip, l.hip, hgt * 0.055);
      between(leg.thigh, l.hip, l.knee, hgt * 0.057);
      between(leg.shorts, l.hip, l.hip.clone().lerp(l.knee, 0.6), hgt * 0.063);
      ball(leg.knee, l.knee, hgt * 0.041);
      between(leg.shin, l.knee, l.foot, hgt * 0.044);
      // Bas du pantalon resserré à la cheville.
      between(leg.cuff, l.foot.clone().lerp(l.knee, 0.16), l.foot.clone().lerp(l.knee, 0.04), hgt * 0.03);
      // Chausson : de la cheville vers la pointe posée sur la prise, dessus du pied vers le haut ;
      // talon posé sur la prise pour un crochet de talon, pointe vers le haut pour un crochet de pointe.
      const style = info.moving === limb ? undefined : info.types[limb];
      const toTip = l.toe.clone().sub(l.foot);
      leg.shoe.position.copy(l.foot);
      if (style === 'talon') {
        orient(leg.shoe, v(side * 0.8, 0.35, 0.45), v(0, 0.6, 0.6));
        leg.shoe.scale.set(hgt, hgt, hgt);
      } else if (style === 'pointe') {
        orient(leg.shoe, toTip, v(0, 0.2, -1));
        leg.shoe.scale.set(hgt, Math.min(1.15, toTip.length() / (0.115 * hgt)) * hgt, hgt);
      } else if (style === 'drapeau') {
        orient(leg.shoe, toTip, v(0, 0.3, 1));
        leg.shoe.scale.set(hgt, Math.min(1.15, toTip.length() / (0.115 * hgt)) * hgt, hgt);
      } else if (style === 'vide') {
        orient(leg.shoe, toTip, v(0, 0, -1));
        leg.shoe.scale.setScalar(hgt);
      } else {
        orient(leg.shoe, toTip, UP);
        leg.shoe.scale.set(hgt, Math.max(0.8, Math.min(1.15, toTip.length() / (0.115 * hgt))) * hgt, hgt);
      }
    });

    // Le membre qui bouge s'allume légèrement.
    [...M.hands, ...M.shoe].forEach((m, i) => {
      m.emissive.copy(glow);
      m.emissiveIntensity = info.moving === limbs[i] ? 0.45 : 0;
    });

    const frames: Frames = { yAx, zAx, xAx, hgt };
    extras.forEach((e) => e.update?.(b, info, frames));
  };

  setSkin(DEFAULT_SKIN);
  return {
    group,
    setSkin,
    update,
    /** Couleur de la lueur du membre qui bouge. */
    setGlow: (c: string) => glow.set(c),
  };
}

export type Climber = ReturnType<typeof createClimber>;
