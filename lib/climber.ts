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
const TORSO: [number, number][] = [
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

function torsoGeometry() {
  // Le milieu de la texture (u = 0,5) tombe au milieu du dos.
  return new THREE.LatheGeometry(
    TORSO.map(([r, y]) => new THREE.Vector2(r, y)),
    32,
    Math.PI,
  );
}

/** Rayon du buste à une hauteur (de -0,5 au bassin à 0,5 aux épaules). */
function torsoRadius(y: number) {
  const side = TORSO.slice(1, -1);
  const k = side.findIndex(([, py]) => py >= y);
  const i = k < 0 ? side.length - 1 : Math.max(1, k);
  const [r0, y0] = side[i - 1];
  const [r1, y1] = side[i];
  return r0 + ((r1 - r0) * Math.min(1, Math.max(0, (y - y0) / (y1 - y0 || 1))));
}

/** Courbe une forme dressée selon y : la pointe se décale de `dir` (chapeau pointu, cornes). */
function bend(g: THREE.BufferGeometry, dir: V) {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = ((pos.getY(i) - min.y) / (max.y - min.y)) ** 2;
    pos.setXYZ(i, pos.getX(i) + dir.x * t, pos.getY(i) + dir.y * t, pos.getZ(i) + dir.z * t);
  }
  g.computeVertexNormals();
  return g;
}

/** Étoile à cinq branches en relief, de rayon 1, face vers +z. */
function starGeometry(inner = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : 1;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
  g.translate(0, 0, -0.15);
  return g;
}

/** Copies d'une forme (taille, rotation, place), fondues en une seule géométrie : dents, tresses. */
function copies(geo: THREE.BufferGeometry, places: [V, V, THREE.Euler][]) {
  const q = new THREE.Quaternion();
  return merge(places.map(([p, s, r]) => geo.clone().scale(s.x, s.y, s.z).applyQuaternion(q.setFromEuler(r)).translate(p.x, p.y, p.z)));
}

/** Rocher : boule à facettes un peu cabossée (golem). */
function rockGeometry(seed: number) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Même bosse pour les sommets confondus (les faces ne sont pas partagées).
    const k = 1 + 0.13 * Math.sin(x * 5.1 + seed) * Math.sin(y * 4.3 + z * 3.7 + seed * 2);
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
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

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number) => a.map((x, i) => x + (b[i] - x) * Math.min(1, Math.max(0, t))) as RGB;

/** Hasard fixe entre 0 et 1 pour une case (i, j). */
function hash(i: number, j: number, seed: number) {
  const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Bruit doux qui se raccorde aux bords : `nx` cases sur la largeur, `ny` sur la hauteur (x de 0 à nx, y de 0 à ny). */
function tileNoise(nx: number, ny: number, seed: number) {
  const h = (i: number, j: number) => hash(((i % nx) + nx) % nx, ((j % ny) + ny) % ny, seed);
  return (x: number, y: number) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const sx = (x - i) ** 2 * (3 - 2 * (x - i));
    const sy = (y - j) ** 2 * (3 - 2 * (y - j));
    const a = h(i, j);
    const b = h(i + 1, j);
    const c = h(i, j + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + h(i + 1, j + 1)) * sx * sy;
  };
}

/** Carreaux rouges et noirs de la chemise de bûcheron, en flanelle. */
function plaidTexture() {
  const red = rgb('#c3262c');
  const dark = rgb('#5a1418');
  const black = rgb('#1d1c21');
  return dataTexture(64, 64, (x, y) => {
    const a = Math.floor(x / 8) % 2;
    const b = Math.floor(y / 8) % 2;
    const c = a && b ? black : a || b ? dark : red;
    return (x + y) % 4 ? c : mix(c, black, 0.25);
  });
}

/** Rayures d'abeille ou de chat tigré : bandes ondulées de `dark` sur `light`. */
function bandsTexture(light: string, dark: string, n: number, part: number, wave: number) {
  const L = rgb(light);
  const D = rgb(dark);
  const step = 64 / n;
  return dataTexture(64, 64, (x, y) => {
    const f = (y + wave * Math.sin((x / 64) * Math.PI * 4)) / step;
    return f - Math.floor(f) < part ? D : L;
  });
}

/** Bandelettes de momie en biais, et par endroits une seconde couche croisée par-dessus. */
function bandageTexture() {
  const cols = [rgb('#efe7d3'), rgb('#d9cdae')];
  const seam = rgb('#8f7f60');
  const n = tileNoise(4, 4, 4);
  return dataTexture(64, 64, (x, y) => {
    const over = n(x / 16, y / 16) > 0.56;
    const t = over ? y - x * 0.25 : y + x * 0.5;
    const k = Math.floor(t / 8);
    const f = (t - k * 8) / 8;
    // Ombre sous le bord de la bande du dessus, puis la toile avec sa trame.
    if (f < 0.14) return seam;
    const c = cols[((k % 2) + 2) % 2];
    if (f < 0.3) return mix(c, seam, 0.45 - f);
    return mix(c, seam, (x * 3 + y * 5) % 7 ? 0 : 0.12);
  });
}

/** Écailles de dragon : rangées de demi-ronds décalées, bord sombre et reflet au centre. */
function scalesTexture(base: string, edge: string, shine: string) {
  const B = rgb(base);
  const E = rgb(edge);
  const S = rgb(shine);
  return dataTexture(64, 64, (x, y) => {
    // Chaque écaille couvre le haut de celles de la rangée d'en dessous.
    for (let r = Math.floor(y / 8) + 1; r >= Math.floor(y / 8) - 1; r--) {
      const cy = r * 8;
      const cx = (r % 2 ? 8 : 0) + Math.round((x - (r % 2 ? 8 : 0)) / 16) * 16;
      const d = Math.hypot(x - cx, (y - cy) * 1.15) / 10;
      if (d < 1) return d > 0.8 ? E : mix(S, B, d * 1.4);
    }
    return B;
  });
}

/** Plaques du ventre du dragon (et du plastron du samouraï) : bandes avec un sillon sombre. */
function platesTexture(face: string, groove: string, n: number) {
  const F = rgb(face);
  const G = rgb(groove);
  const step = 64 / n;
  return dataTexture(4, 64, (_, y) => {
    const f = (y % step) / step;
    return f < 0.14 ? G : mix(F, G, f > 0.7 ? (f - 0.7) * 1.2 : 0);
  });
}

/** Armure de samouraï : lamelles laquées rouges en rangées, laçage noir. */
function lamellarTexture() {
  const red = rgb('#b3201c');
  const lit = rgb('#e0483a');
  const lace = rgb('#18181c');
  return dataTexture(64, 64, (x, y) => {
    const f = y % 8;
    if (f === 0) return lace;
    if ((x % 8 === 3 || x % 8 === 4) && f > 1 && f < 6) return lace;
    return f === 7 ? lit : mix(red, lace, (7 - f) * 0.04);
  });
}

/** Fourrure à mèches (yéti, viking) : chaque mèche foncée à la racine, claire au bout, en quinconce. */
function furTexture(light: string, dark: string) {
  const L = rgb(light);
  const D = rgb(dark);
  return dataTexture(64, 64, (x, y) => {
    const lock = Math.floor(x / 4);
    const f = ((y + hash(lock, 0, 5) * 16) % 16) / 16;
    return mix(L, D, f * 0.9 + (x % 4 === 0 ? 0.15 : 0) - 0.1);
  });
}

/** Robe du magicien : nuit bleue semée d'étoiles dorées. */
function starsTexture(sky: string) {
  const S = rgb(sky);
  const gold = rgb('#ffd43b');
  const spots: [number, number, number][] = [
    [12, 14, 5],
    [42, 8, 3.5],
    [30, 34, 4.5],
    [56, 40, 3],
    [10, 50, 3.5],
    [44, 56, 4],
  ];
  return dataTexture(64, 64, (x, y) => {
    for (const [cx, cy, R] of spots) {
      const dx = ((x - cx + 96) % 64) - 32;
      const dy = ((y - cy + 96) % 64) - 32;
      const rho = Math.hypot(dx, dy);
      if (rho > R) continue;
      // Branche la plus proche : dedans si du bon côté du segment pointe - creux.
      const seg = Math.PI / 5;
      const a = Math.atan2(dy, dx) - Math.PI / 2;
      const phi = Math.abs((((a % (2 * seg)) + 3 * seg) % (2 * seg)) - seg);
      const ix = 0.42 * R * Math.cos(seg) - R;
      const iy = 0.42 * R * Math.sin(seg);
      const px = rho * Math.cos(phi) - R;
      const py = rho * Math.sin(phi);
      if (ix * py - iy * px >= 0) return gold;
    }
    return hash(x, y, 7) < 0.01 ? mix(S, gold, 0.7) : S;
  });
}

/** Roche sombre fendue de lave (golem) ; `glow` : les fissures seules, pour la lueur. */
function lavaTexture(glow: boolean) {
  const N = 128;
  const G = 4;
  const cell = N / G;
  const rock = [rgb('#2b2421'), rgb('#4a3d35')];
  const hot = [rgb('#ff5a0a'), rgb('#ffd23f')];
  const n = tileNoise(16, 16, 2);
  return dataTexture(N, N, (x, y) => {
    // Cellules de Voronoï qui se raccordent aux bords : fissure là où deux cellules se touchent.
    let d1 = 1e9;
    let d2 = 1e9;
    const ci = Math.floor(x / cell);
    const cj = Math.floor(y / cell);
    for (let j = cj - 1; j <= cj + 1; j++) {
      for (let i = ci - 1; i <= ci + 1; i++) {
        const wi = (i + G) % G;
        const wj = (j + G) % G;
        const px = (i + 0.15 + 0.7 * hash(wi, wj, 1)) * cell;
        const py = (j + 0.15 + 0.7 * hash(wi, wj, 2)) * cell;
        const d = Math.hypot(x - px, y - py);
        if (d < d1) [d1, d2] = [d, d1];
        else if (d < d2) d2 = d;
      }
    }
    const e = (d2 - d1) / (1.6 + 1.6 * n(x / 8, y / 8));
    const heat = Math.max(0, 1 - e);
    if (glow) return mix([0, 0, 0], mix(hot[0], hot[1], heat - 0.3), Math.min(1, heat * 1.6));
    const stone = mix(rock[0], rock[1], n((x / N) * 16, (y / N) * 16) * 0.9 + (e > 3 ? 0 : 0.2));
    return heat > 0 ? mix(stone, mix(hot[0], hot[1], heat - 0.3), Math.min(1, heat * 1.6)) : stone;
  });
}

/** Ciel cosmique : nébuleuse bleue et violette, étoiles. */
function cosmosTexture() {
  const N = 128;
  const ramp = ['#090c33', '#1b1d6e', '#4a2a9a', '#9a3fb8', '#e37ad2'].map(rgb);
  const n1 = tileNoise(4, 4, 11);
  const n2 = tileNoise(8, 8, 12);
  const n3 = tileNoise(16, 16, 13);
  return dataTexture(N, N, (x, y) => {
    const u = x / N;
    const w = y / N;
    const f = n1(u * 4, w * 4) * 0.55 + n2(u * 8, w * 8) * 0.3 + n3(u * 16, w * 16) * 0.15;
    const t = Math.max(0, f - 0.25) * 1.9 * (ramp.length - 1);
    const k = Math.min(ramp.length - 2, Math.floor(t));
    const sky = mix(ramp[k], ramp[k + 1], t - k);
    const s = hash(x, y, 21);
    if (s < 0.018) return mix(sky, [255, 255, 255], 0.55 + s * 25);
    return sky;
  });
}

/** Bande réfléchissante des pompiers : jaune, argent au milieu. */
function reflectTexture() {
  const yellow = rgb('#f2d228');
  const silver = rgb('#dde3e9');
  return dataTexture(4, 16, (_, y) => (y >= 6 && y < 10 ? silver : yellow));
}

/** Motifs des vêtements (haut, bas, pièces des costumes), dessinés à la première utilisation. */
const PATTERNS = {
  stripes: () => stripesTexture('#e03131', '#f8f9fa', 7),
  zigzag: zigzagTexture,
  plaid: plaidTexture,
  bee: () => bandsTexture('#ffd02e', '#1b1c1f', 4, 0.5, 0),
  tabby: () => bandsTexture('#f4a04a', '#c8641e', 6, 0.32, 2.5),
  bandage: bandageTexture,
  scales: () => scalesTexture('#b8322a', '#6e1512', '#e05a40'),
  belly: () => platesTexture('#f0c76e', '#b98536', 6),
  lamellar: lamellarTexture,
  fur: () => furTexture('#f6f9fc', '#b9c8d8'),
  pelt: () => furTexture('#a07e5c', '#4f3b29'),
  stars: () => starsTexture('#2f2a7e'),
  lava: () => lavaTexture(false),
  lavaGlow: () => lavaTexture(true),
  cosmos: cosmosTexture,
  reflect: reflectTexture,
};
type Pattern = keyof typeof PATTERNS;

/* ---------- Costumes ---------- */

type Look = {
  skin: string;
  top: string;
  topMap?: Pattern;
  sleeves: 'short' | 'long' | 'none';
  /** Couleur des manches longues et des épaules ; sinon celle du haut. */
  arms?: string;
  bottom: string;
  bottomMap?: Pattern;
  /** Motif lumineux du haut et du bas (fissures de lave, étoiles), que le costume fait pulser. */
  glowMap?: Pattern;
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
  bucheron: {
    topMap: 'plaid',
    sleeves: 'long',
    bottom: '#3d5a86',
    shoe: '#7a4a24',
    rubber: '#2b1d14',
    strap: '#e0a526',
    hairColor: '#5a3820',
    bag: '#e0a526',
    belt: '#3a2a20',
  },
  cowboy: {
    top: '#eadcbf',
    sleeves: 'long',
    bottom: '#3d5a86',
    shoe: '#7a4a24',
    rubber: '#2b1d14',
    strap: '#c9a227',
    hairColor: '#6b4423',
    bag: '#a8743a',
    belt: '#4a2f1d',
  },
  pompier: {
    top: '#28344b',
    sleeves: 'long',
    bottom: '#28344b',
    shoe: '#1b1c1f',
    rubber: '#111214',
    strap: '#f2d228',
    gloves: '#2b2d31',
    hairColor: '#2b2118',
    bag: '#c92a2a',
    belt: '#1b1c1f',
  },
  abeille: {
    topMap: 'bee',
    sleeves: 'long',
    arms: '#1b1c1f',
    bottom: '#1b1c1f',
    shoe: '#1b1c1f',
    rubber: '#111214',
    strap: '#ffd02e',
    hairColor: '#3a2a20',
    bag: '#ffd02e',
    belt: '#1b1c1f',
  },
  chat: {
    topMap: 'tabby',
    sleeves: 'long',
    bottomMap: 'tabby',
    shoe: '#f8f9fa',
    rubber: '#c8641e',
    strap: '#f783ac',
    gloves: '#f8f9fa',
    hair: 'none',
    bag: '#f783ac',
    belt: '#c8641e',
  },
  momie: {
    skin: '#6b5a48',
    topMap: 'bandage',
    sleeves: 'long',
    bottomMap: 'bandage',
    shoe: '#d6c9a8',
    rubber: '#5c5040',
    strap: '#9b8d6c',
    gloves: '#e6dcc3',
    hair: 'none',
    bag: '#9b8d6c',
    belt: '#9b8d6c',
  },
  viking: {
    top: '#3f5a7a',
    sleeves: 'long',
    bottom: '#6b4f2a',
    shoe: '#5a3e22',
    rubber: '#2b1d14',
    strap: '#c9a227',
    hair: 'long',
    hairColor: '#d9822b',
    bag: '#8a5a2b',
    belt: '#3a2a20',
  },
  requin: {
    top: '#6d8aa6',
    sleeves: 'long',
    bottom: '#6d8aa6',
    shoe: '#4f6a85',
    rubber: '#2b3440',
    strap: '#f1f3f5',
    hair: 'none',
    bag: '#f1f3f5',
    belt: '#4f6a85',
  },
  panda: {
    top: '#f8f9fa',
    sleeves: 'long',
    arms: '#1d1e22',
    bottom: '#1d1e22',
    shoe: '#1d1e22',
    rubber: '#0f1012',
    strap: '#f8f9fa',
    gloves: '#1d1e22',
    hair: 'none',
    bag: '#69db7c',
    belt: '#1d1e22',
  },
  sorcier: {
    topMap: 'stars',
    sleeves: 'long',
    bottomMap: 'stars',
    shoe: '#2f2a7e',
    rubber: '#17153d',
    strap: '#ffd43b',
    hair: 'long',
    hairColor: '#f1f3f5',
    bag: '#ffd43b',
    belt: '#ffd43b',
  },
  chevalier: {
    top: '#aab4bf',
    sleeves: 'long',
    bottom: '#9aa4af',
    shoe: '#8d959e',
    rubber: '#3b4046',
    strap: '#c92a2a',
    gloves: '#8d959e',
    hair: 'none',
    noFace: true,
    metal: true,
    bag: '#c92a2a',
    belt: '#5c3d2e',
  },
  yeti: {
    skin: '#9cc9ef',
    topMap: 'fur',
    sleeves: 'long',
    bottomMap: 'fur',
    shoe: '#e9eef3',
    rubber: '#7a8a9c',
    strap: '#9cc9ef',
    gloves: '#9cc9ef',
    hair: 'none',
    bag: '#9cc9ef',
    belt: '#d3dce6',
  },
  samourai: {
    top: '#1d1e24',
    sleeves: 'long',
    bottom: '#23252e',
    shoe: '#1b1c1f',
    rubber: '#111214',
    strap: '#c92a2a',
    hairColor: '#111214',
    bag: '#c92a2a',
    belt: '#c9a227',
  },
  dragon: {
    skin: '#b8322a',
    topMap: 'scales',
    sleeves: 'long',
    bottomMap: 'scales',
    shoe: '#6e1512',
    rubber: '#2b0f0d',
    strap: '#f0c76e',
    gloves: '#7a1c17',
    hair: 'none',
    noFace: true,
    bag: '#f0c76e',
    belt: '#6e1512',
  },
  golem: {
    skin: '#3a302a',
    topMap: 'lava',
    sleeves: 'long',
    bottomMap: 'lava',
    glowMap: 'lavaGlow',
    shoe: '#2b2421',
    rubber: '#1b1614',
    strap: '#ff9f1a',
    gloves: '#3a302a',
    hair: 'none',
    noFace: true,
    bag: '#2b2421',
    belt: '#2b2421',
  },
  cosmique: {
    skin: '#1b1d6e',
    topMap: 'cosmos',
    sleeves: 'long',
    bottomMap: 'cosmos',
    glowMap: 'cosmos',
    shoe: '#2b1d6b',
    rubber: '#0b0c2a',
    strap: '#9be7ff',
    gloves: '#3b2a8a',
    hair: 'none',
    noFace: true,
    bag: '#9be7ff',
    belt: '#3b2a8a',
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
    sleeve: mat(BASE_LOOK.top, 0.85),
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
  // Motifs gardés pour toute la vie du grimpeur (jamais libérés au changement de costume).
  const textures: Partial<Record<Pattern, THREE.Texture>> = {};
  const pattern = (p: Pattern) => (textures[p] ??= PATTERNS[p]());

  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 20);
  const sleeveGeo = new THREE.CylinderGeometry(0.9, 1, 1, 20, 1, true);
  // Bas du haut et bas du pantalon : une tranche fine du motif, pas tout le motif écrasé.
  const hemGeo = new THREE.CylinderGeometry(1, 1, 1, 20);
  const hemUv = hemGeo.getAttribute('uv');
  for (let i = 0; i < hemUv.count; i++) hemUv.setY(i, 0.45 + hemUv.getY(i) * 0.1);
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

  /**
   * Queue du bas du dos vers le sol, qui se balance : chaîne de cônes, ou touffue (boules).
   * `lift` : le bout remonte (queue de chat).
   */
  const tail = (colors: string[], len: number, r0: number, puffy = false, lift = 0) => {
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
            .addScaledVector(f.yAx, -0.6 - k * 0.5 + lift * k * k)
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

  /**
   * Pièce collée au buste (gilet, plastron, bandes) : le buste entre deux hauteurs (de -0,5 au
   * bassin à 0,5 aux épaules), un peu plus large, sur une part du tour (angle 0 : le milieu du ventre).
   * `fringe` : bord du bas en dents de scie (fourrure).
   */
  const shell = (m: THREE.Material, y0: number, y1: number, from = 0, around = Math.PI * 2, grow = 1.05, fringe = 0) => {
    const pts = Array.from({ length: 9 }, (_, i) => {
      const y = y0 + ((y1 - y0) * i) / 8;
      return new THREE.Vector2(torsoRadius(y) * grow, y);
    });
    const geo = new THREE.LatheGeometry(pts, 32, Math.PI + from, around);
    if (fringe) {
      // Les sommets du bas sont les premiers de chaque colonne de 9.
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i += 18) pos.setY(i, pos.getY(i) - fringe);
      geo.computeVertexNormals();
    }
    const mesh = add(geo, m, extraRoot);
    extras.push({
      update: () => {
        mesh.position.copy(torso.position);
        mesh.quaternion.copy(torso.quaternion);
        mesh.scale.copy(torso.scale);
      },
    });
    return mesh;
  };

  /** Anneaux autour des membres (bandes, manchettes) : os, place le long de l'os (0 à 1), rayon et hauteur. */
  type Spot = ['upper' | 'fore' | 'thigh' | 'shin', number, number, number];
  const rings = (m: THREE.Material, spots: Spot[], geo: THREE.BufferGeometry = cylGeo) => {
    const meshes = spots.map(() => [add(geo, m, extraRoot), add(geo, m, extraRoot)]);
    extras.push({
      update: (b, _info, f) => {
        spots.forEach(([bone, t, r, len], k) => {
          b.arms.forEach((a, i) => {
            const l = b.legs[i];
            const [p, q] = bone === 'upper' ? [a.shoulder, a.elbow] : bone === 'fore' ? [a.elbow, a.hand] : bone === 'thigh' ? [l.hip, l.knee] : [l.knee, l.foot];
            const d = q.clone().sub(p);
            const mesh = meshes[k][i];
            mesh.position.copy(p).addScaledVector(d, t);
            mesh.quaternion.setFromUnitVectors(UP, d.normalize());
            mesh.scale.set(r * f.hgt, len * f.hgt, r * f.hgt);
          });
        });
      },
    });
  };

  /** Baguette de `a` à `b` dans le repère `parent` (manche, antenne, moustache de chat). */
  const rod = (parent: THREE.Object3D, m: THREE.Material, a: V, b: V, r: number, geo: THREE.BufferGeometry = cylGeo) => {
    const d = b.clone().sub(a);
    const mesh = piece(parent, geo, m, a.clone().add(b).multiplyScalar(0.5), v(r, d.length(), r));
    mesh.quaternion.setFromUnitVectors(UP, d.normalize());
    return mesh;
  };

  /** Capuche de costume (comme celle du dinosaure) : calotte qui laisse le visage dégagé. */
  const hood = (m: THREE.Material, open = 0.6, tilt = -0.45, s = v(0.067, 0.075, 0.072)) =>
    piece(headExtras, new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * open), m, v(0, 0.008, -0.006), s, new THREE.Euler(tilt, 0, 0));

  /** Repère qui pivote (ailes qui battent, nageoire) : enfant de `parent`, en `p`. */
  const pivot = (parent: THREE.Object3D, p: V) => {
    const g = new THREE.Group();
    g.position.copy(p);
    parent.add(g);
    return g;
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
      case 'bucheron': {
        // Bonnet de laine à revers et pompon, grosse barbe, hache dans le dos.
        const wool = own(mat('#2f5d46', 1));
        piece(H, new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), wool, v(0, 0.016, -0.004), v(0.064, 0.074, 0.068), new THREE.Euler(-0.25, 0, 0));
        piece(H, new THREE.TorusGeometry(1, 0.16, 8, 28), wool, v(0, 0.016, -0.004), v(0.066, 0.07, 0.05), new THREE.Euler(Math.PI / 2 - 0.25, 0, 0));
        piece(H, sphere, wool, v(0, 0.093, -0.022), 0.017);
        const beard = own(mat('#5e3b22', 1));
        piece(H, new THREE.SphereGeometry(1, 20, 12, Math.PI / 2 - 1.35, 2.7, Math.PI * 0.55, Math.PI * 0.45), beard, v(0, -0.012, 0.006), v(0.057, 0.086, 0.056));
        for (const [x, y] of [
          [-0.022, -0.072],
          [0, -0.082],
          [0.022, -0.072],
        ])
          piece(H, sphere, beard, v(x, y, 0.036), v(0.02, 0.018, 0.016));
        for (const s of [-1, 1]) piece(H, sphere, beard, v(s * 0.013, -0.01, 0.056), v(0.017, 0.0075, 0.009), new THREE.Euler(0, 0, s * 0.3));
        // Fer en coin (tranchant plus haut que le talon) sur un manche en travers du dos.
        const wood = own(mat('#a0703c', 0.7));
        const steel = own(new THREE.MeshStandardMaterial({ color: '#aeb6bf', roughness: 0.35, metalness: 0.3 }));
        const top = v(0.085, 0.09, 0.078);
        rod(C, wood, v(-0.07, -0.19, 0.078), top, 0.009);
        const blade = new THREE.BoxGeometry(1, 1, 1);
        const bp = blade.getAttribute('position');
        for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) * (bp.getX(i) > 0 ? 1.8 : 0.8));
        blade.computeVertexNormals();
        const tilt = new THREE.Euler(0, 0, -0.505);
        piece(C, blade, steel, top.clone().add(v(0.021, -0.012, 0)), v(0.05, 0.03, 0.009), tilt);
        piece(C, new THREE.BoxGeometry(1, 1, 1), own(mat('#eef1f4', 0.3)), top.clone().add(v(0.044, -0.024, 0)), v(0.006, 0.054, 0.0095), tilt);
        break;
      }
      case 'cowboy': {
        // Chapeau à bord relevé, foulard rouge, gilet de cuir avec l'étoile du shérif, lasso.
        const felt = own(mat('#9a6a3a', 0.85));
        const crown = new THREE.LatheGeometry(
          [
            [1.0, 0.0],
            [0.97, 0.45],
            [0.86, 0.72],
            [0.5, 0.64],
            [0.0, 0.6],
          ].map(([r, y]) => new THREE.Vector2(r, y)),
          24,
        );
        const hat = new THREE.Group();
        hat.position.set(0, 0.043, -0.004);
        hat.rotation.x = -0.12;
        H.add(hat);
        piece(hat, crown, felt, v(0, 0, 0), v(0.058, 0.072, 0.064));
        const brim = new THREE.LatheGeometry(
          [
            [0.9, -0.03],
            [1.85, -0.02],
            [1.92, 0.0],
            [1.85, 0.02],
            [0.9, 0.03],
          ].map(([r, y]) => new THREE.Vector2(r, y)),
          32,
        );
        const pos = brim.getAttribute('position');
        for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + 0.13 * pos.getX(i) ** 2 - 0.03 * pos.getZ(i) ** 2);
        brim.computeVertexNormals();
        piece(hat, brim, felt, v(0, 0.002, 0), v(0.058, 0.07, 0.064));
        piece(hat, new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), own(mat('#3a2a20', 0.8)), v(0, 0.008, 0), v(0.0585, 0.012, 0.0645));
        const beard = own(mat('#6b4423', 0.95));
        for (const s of [-1, 1]) piece(H, sphere, beard, v(s * 0.012, -0.009, 0.055), v(0.014, 0.0055, 0.007), new THREE.Euler(0, 0, s * 0.45));
        const red = own(mat('#d9363e', 0.8));
        piece(C, new THREE.TorusGeometry(1, 0.35, 8, 20), red, v(0, 0.036, 0.002), v(0.034, 0.034, 0.024), new THREE.Euler(Math.PI / 2, 0, 0));
        piece(C, new THREE.ConeGeometry(1, 1, 3), red, v(0, 0.0, -0.06), v(0.05, 0.07, 0.012), new THREE.Euler(Math.PI - 0.15, 0, 0));
        const leather = own(mat('#6e4020', 0.8));
        shell(leather, -0.32, 0.47, 0.42, Math.PI * 2 - 0.84);
        const gold = own(new THREE.MeshStandardMaterial({ color: '#f2c12e', roughness: 0.3, metalness: 0.5 }));
        piece(C, starGeometry(), gold, v(-0.058, 0.004, -0.055), v(0.015, 0.015, 0.02), new THREE.Euler(0, Math.PI + 0.55, 0));
        piece(P, new THREE.BoxGeometry(1, 1, 1), gold, v(0, 0.018, -0.06), v(0.034, 0.024, 0.008));
        const rope = own(mat('#c8a165', 0.9));
        for (const k of [0, 1]) piece(P, new THREE.TorusGeometry(1, 0.12, 6, 20), rope, v(0.104 + k * 0.006, -0.03, 0.005), v(0.04, 0.046, 0.04), new THREE.Euler(0, Math.PI / 2, k * 0.3));
        break;
      }
      case 'pompier': {
        // Casque rouge à long bord derrière et écusson doré, bandes réfléchissantes partout.
        const red = own(new THREE.MeshStandardMaterial({ color: '#c92a2a', roughness: 0.3 }));
        piece(H, new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), red, v(0, 0.02, -0.006), v(0.066, 0.072, 0.072), new THREE.Euler(-0.1, 0, 0));
        piece(H, sphere, red, v(0, 0.022, -0.03), v(0.083, 0.008, 0.1), new THREE.Euler(-0.18, 0, 0));
        piece(H, new THREE.TorusGeometry(1, 0.1, 6, 20, Math.PI), red, v(0, 0.02, -0.006), v(0.074, 0.075, 0.03), new THREE.Euler(-0.1, Math.PI / 2, 0));
        const gold = own(new THREE.MeshStandardMaterial({ color: '#f2c12e', roughness: 0.35, metalness: 0.4 }));
        // Écusson en forme de blason (pointe en bas), le milieu rouge.
        const shield = new THREE.CylinderGeometry(1, 1, 1, 5);
        piece(H, shield, gold, v(0, 0.06, 0.058), v(0.024, 0.006, 0.027), new THREE.Euler(Math.PI / 2 - 0.4, 0, 0));
        piece(H, shield, own(mat('#a51d1d', 0.5)), v(0, 0.06, 0.0615), v(0.015, 0.004, 0.017), new THREE.Euler(Math.PI / 2 - 0.4, 0, 0));
        const band = own(new THREE.MeshStandardMaterial({ map: pattern('reflect'), roughness: 0.5 }));
        shell(band, 0.08, 0.17);
        shell(band, -0.36, -0.27);
        rings(band, [
          ['fore', 0.62, 0.031, 0.04],
          ['upper', 0.55, 0.04, 0.04],
          ['shin', 0.55, 0.05, 0.045],
          ['shin', 0.78, 0.045, 0.045],
        ]);
        break;
      }
      case 'abeille': {
        // Serre-tête à antennes, ailes transparentes qui battent, dard.
        const black = own(mat('#1b1c1f', 0.6));
        piece(H, new THREE.TorusGeometry(1, 0.06, 6, 24, Math.PI), black, v(0, 0.004, 0.008), v(0.062, 0.072, 0.06));
        const ball = own(mat('#ffd02e', 0.5));
        for (const s of [-1, 1]) {
          const curve = new THREE.QuadraticBezierCurve3(v(s * 0.026, 0.068, 0.012), v(s * 0.03, 0.104, 0.024), v(s * 0.05, 0.108, 0.038));
          piece(H, new THREE.TubeGeometry(curve, 8, 0.0028, 5), black, v(0, 0, 0), 1);
          piece(H, sphere, ball, v(s * 0.052, 0.109, 0.04), 0.011);
        }
        const wing = own(new THREE.MeshStandardMaterial({ color: '#dff3ff', roughness: 0.15, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
        const flaps: [THREE.Group, number][] = [];
        for (const s of [-1, 1]) {
          for (const [lift, len, wid] of [
            [0.5, 0.11, 0.05],
            [-0.4, 0.075, 0.035],
          ]) {
            const p = pivot(C, v(s * 0.025, -0.015, 0.07));
            p.rotation.z = s * lift;
            piece(p, sphere, wing, v(s * len, 0, 0), v(len, wid, 0.004)).castShadow = false;
            flaps.push([p, s]);
          }
        }
        extras.push({ update: (_b, info) => flaps.forEach(([p, s]) => (p.rotation.y = -s * (0.55 + 0.35 * Math.sin(info.now / 45)))) });
        piece(P, new THREE.ConeGeometry(1, 1, 10), black, v(0, -0.055, 0.058), v(0.012, 0.035, 0.012), new THREE.Euler(Math.PI / 2, 0, 0));
        break;
      }
      case 'chat': {
        // Capuche tigrée à oreilles pointues, nez rose, moustaches, ventre blanc, queue qui remonte.
        hood(M.top);
        const pink = own(mat('#f7a1c0', 0.6));
        const ear = new THREE.ConeGeometry(1, 1, 4);
        for (const s of [-1, 1]) {
          piece(H, ear, M.top, v(s * 0.04, 0.078, -0.006), v(0.022, 0.04, 0.012), new THREE.Euler(0, 0, -s * 0.38));
          piece(H, ear, pink, v(s * 0.04, 0.076, -0.0005), v(0.013, 0.026, 0.006), new THREE.Euler(0, 0, -s * 0.38));
        }
        piece(H, sphere, pink, v(0, -0.001, 0.0655), v(0.0085, 0.0055, 0.005));
        const dark = own(mat('#3b2a20', 0.6));
        for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) rod(H, dark, v(s * 0.024, -0.012 + k * 0.004, 0.0535), v(s * 0.068, -0.012 + k * 0.011, 0.045), 0.0016);
        piece(C, sphere, own(mat('#fff4e6', 0.9)), v(0, -0.12, -0.033), v(0.052, 0.11, 0.025));
        extras.push(tail(['#f4a04a', '#c8641e'], 0.6, 0.032, false, 2.2));
        break;
      }
      case 'momie': {
        // Tête emmaillotée avec une fente pour les yeux, cou bandé, bandelettes qui pendent.
        piece(H, new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.43), M.top, v(0, 0.002, -0.002), v(0.06, 0.07, 0.066));
        piece(H, new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.44), M.top, v(0, 0.002, -0.002), v(0.06, 0.07, 0.068));
        piece(C, cylGeo, M.top, v(0, 0.045, 0.003), v(0.03, 0.06, 0.03));
        extras.push(ribbon('#ddd1b3'));
        break;
      }
      case 'viking': {
        // Casque à cornes et nasal, barbe rousse à deux tresses, fourrure sur les épaules, bouclier rond.
        const steel = own(new THREE.MeshStandardMaterial({ color: '#a3acb6', roughness: 0.35, metalness: 0.4 }));
        piece(H, new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), steel, v(0, 0.018, -0.004), v(0.063, 0.07, 0.067), new THREE.Euler(-0.15, 0, 0));
        const bronze = own(new THREE.MeshStandardMaterial({ color: '#b5833a', roughness: 0.4, metalness: 0.5 }));
        piece(H, new THREE.TorusGeometry(1, 0.14, 6, 28), bronze, v(0, 0.018, -0.004), v(0.065, 0.068, 0.04), new THREE.Euler(Math.PI / 2 - 0.15, 0, 0));
        piece(H, new THREE.TorusGeometry(1, 0.08, 6, 20, Math.PI), bronze, v(0, 0.018, -0.004), v(0.068, 0.074, 0.03), new THREE.Euler(-0.15, Math.PI / 2, 0));
        piece(H, new THREE.BoxGeometry(1, 1, 1), steel, v(0, 0.01, 0.066), v(0.008, 0.032, 0.006), new THREE.Euler(-0.15, 0, 0));
        const ivory = own(mat('#efe6cf', 0.5));
        for (const s of [-1, 1]) {
          const horn = bend(new THREE.ConeGeometry(0.014, 0.065, 10, 6), v(-s * 0.035, 0, 0));
          piece(H, horn, ivory, v(s * 0.075, 0.045, -0.006), 1, new THREE.Euler(0, 0, -s * (Math.PI / 2 - 0.3)));
        }
        const ginger = own(mat('#d9822b', 0.95));
        piece(H, new THREE.SphereGeometry(1, 20, 12, Math.PI / 2 - 1.2, 2.4, Math.PI * 0.55, Math.PI * 0.45), ginger, v(0, -0.016, 0.008), v(0.054, 0.076, 0.053));
        for (const s of [-1, 1]) piece(H, new THREE.CapsuleGeometry(1, 2, 2, 6), ginger, v(s * 0.016, -0.014, 0.055), v(0.006, 0.01, 0.006), new THREE.Euler(0, 0, s * 1.1));
        const braid: [V, V, THREE.Euler][] = [];
        for (const s of [-1, 1]) for (let k = 0; k < 3; k++) braid.push([v(s * 0.013, -0.078 - k * 0.014, 0.04 - k * 0.004), v(0.0085 - k * 0.001, 0.009, 0.0085 - k * 0.001), new THREE.Euler()]);
        piece(H, copies(sphere, braid), ginger, v(0, 0, 0), 1);
        for (const s of [-1, 1]) piece(H, sphere, bronze, v(s * 0.013, -0.12, 0.031), 0.006);
        // Peau de bête sur les épaules et le dos, col bien gonflé.
        const pelt = own(new THREE.MeshStandardMaterial({ map: pattern('pelt'), roughness: 1 }));
        shell(pelt, 0.12, 0.5, 0.9, Math.PI * 2 - 1.8, 1.14, 0.08);
        piece(C, new THREE.TorusGeometry(1, 0.45, 10, 24), pelt, v(0, 0.036, 0.006), v(0.05, 0.05, 0.034), new THREE.Euler(Math.PI / 2, 0, 0));
        for (const s of [-1, 1]) piece(C, sphere, pelt, v(s * 0.098, 0.014, 0.006), v(0.054, 0.036, 0.058));
        const paint = own(mat('#b0302a', 0.7));
        piece(C, cylGeo, paint, v(0, -0.11, 0.085), v(0.1, 0.012, 0.1), new THREE.Euler(Math.PI / 2, 0, 0));
        piece(C, new THREE.TorusGeometry(1, 0.06, 6, 32), steel, v(0, -0.11, 0.085), v(0.1, 0.1, 0.1));
        piece(C, sphere, steel, v(0, -0.11, 0.092), v(0.022, 0.022, 0.014));
        break;
      }
      case 'requin': {
        // Capuche de requin : gueule ouverte autour du visage (deux rangées de dents), aileron, queue.
        const cap = hood(M.top, 0.58, -0.6, v(0.071, 0.08, 0.078));
        cap.position.set(0, 0.012, -0.01);
        cap.updateMatrix();
        const jaw = new THREE.Matrix4().compose(v(0, -0.004, 0.004), new THREE.Quaternion(), v(0.066, 0.078, 0.066));
        const edge = (a: number, theta: number, m: THREE.Matrix4) =>
          v(Math.sin(a) * Math.sin(theta), Math.cos(theta), Math.cos(a) * Math.sin(theta)).applyMatrix4(m);
        piece(H, new THREE.SphereGeometry(1, 24, 10, Math.PI / 2 - 1.25, 2.5, Math.PI * 0.62, Math.PI * 0.3), M.top, v(0, -0.004, 0.004), v(0.066, 0.078, 0.066));
        const teeth: [V, V, THREE.Euler][] = [];
        for (let i = 0; i < 9; i++) teeth.push([edge(-1.05 + (i * 2.1) / 8, Math.PI * 0.58, cap.matrix).add(v(0, -0.006, -0.004)), v(0.006, 0.016, 0.006), new THREE.Euler(Math.PI, 0, 0)]);
        for (let i = 0; i < 7; i++) teeth.push([edge(-0.9 + (i * 1.8) / 6, Math.PI * 0.62, jaw).add(v(0, 0.006, -0.002)), v(0.005, 0.014, 0.005), new THREE.Euler()]);
        piece(H, copies(new THREE.ConeGeometry(1, 1, 4), teeth), own(mat('#f8f9fa', 0.35)), v(0, 0, 0), 1);
        const black = own(mat('#15171a', 0.3));
        for (const s of [-1, 1]) piece(H, sphere, black, v(s * 0.062, 0.035, 0.03), 0.0075);
        piece(H, bend(new THREE.ConeGeometry(0.032, 0.064, 8), v(0, 0, -0.022)), M.top, v(0, 0.092, -0.024), v(0.25, 1, 1));
        piece(C, sphere, own(mat('#f1f3f5', 0.8)), v(0, -0.11, -0.034), v(0.068, 0.15, 0.026));
        // Queue de requin : corps effilé, nageoire en croissant (lobe du haut plus grand).
        const fin = pivot(P, v(0, -0.05, 0.05));
        fin.rotation.x = 0.12;
        piece(fin, new THREE.ConeGeometry(1, 1, 12), M.top, v(0, 0, 0.1), v(0.045, 0.2, 0.04), new THREE.Euler(Math.PI / 2, 0, 0));
        const lobe = new THREE.ConeGeometry(1, 1, 8);
        piece(fin, lobe, M.top, v(0, 0.045, 0.21), v(0.008, 0.11, 0.028), new THREE.Euler(0.55, 0, 0));
        piece(fin, lobe, M.top, v(0, -0.026, 0.205), v(0.008, 0.07, 0.022), new THREE.Euler(Math.PI - 0.75, 0, 0));
        extras.push({ update: (_b, info) => (fin.rotation.y = Math.sin(info.now / 380) * 0.35) });
        break;
      }
      case 'panda': {
        // Capuche blanche à oreilles rondes noires, taches autour des yeux, nez noir, petite queue.
        hood(M.top);
        const black = own(mat('#1d1e22', 0.8));
        for (const s of [-1, 1]) {
          piece(H, sphere, black, v(s * 0.047, 0.07, -0.012), v(0.021, 0.021, 0.012), new THREE.Euler(0, 0, -s * 0.5));
          piece(H, sphere, black, v(s * 0.022, 0.004, 0.049), v(0.017, 0.021, 0.006), new THREE.Euler(0.15, 0, s * 0.5));
        }
        piece(H, sphere, black, v(0, -0.001, 0.0655), v(0.0085, 0.006, 0.005));
        // Bande noire sur les épaules et le haut du dos, comme un vrai panda.
        shell(black, 0.28, 0.5, 0.95, Math.PI * 2 - 1.9, 1.03);
        piece(P, sphere, M.top, v(0, -0.045, 0.066), 0.022);
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
    const shared = Object.values(textures);
    owned.splice(0).forEach((m) => {
      if (m === fur) return;
      const map = (m as THREE.MeshStandardMaterial).map;
      if (map && !shared.includes(map)) map.dispose();
      m.dispose();
    });
    owned.push(fur);
    extras = [];
    look = LOOKS_FULL[id];
    const L = look;
    M.skin.color.set(L.skin);
    M.top.color.set(L.topMap ? '#ffffff' : L.top);
    M.top.map = L.topMap ? pattern(L.topMap) : null;
    M.sleeve.color.set(L.arms ?? L.top);
    M.bottom.color.set(L.bottomMap ? '#ffffff' : L.bottom);
    M.bottom.map = L.bottomMap ? pattern(L.bottomMap) : null;
    for (const m of [M.top, M.bottom]) {
      m.emissiveMap = L.glowMap ? pattern(L.glowMap) : null;
      m.emissive.set(L.glowMap ? '#ffffff' : '#000000');
      m.emissiveIntensity = 1;
      m.needsUpdate = true;
    }
    for (const m of [M.skin, M.top, M.sleeve, M.bottom, ...M.hands]) {
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
    const armMat = L.arms ? M.sleeve : M.top;
    const sleeveMat = L.sleeves === 'long' ? armMat : M.skin;
    arms.forEach((a) => {
      a.sleeve.visible = L.sleeves === 'short';
      a.shoulder.material = L.sleeves === 'none' ? M.skin : armMat;
      a.upper.material = sleeveMat;
      a.fore.material = sleeveMat;
      a.elbow.material = sleeveMat;
      a.wrist.material = L.gloves ? M.hands[0] : sleeveMat;
    });
    // Les rayures du pirate et le zigzag rétro restent comme sur leurs images.
    hem.geometry = L.topMap === 'stripes' ? cylGeo : hemGeo;
    const shinMat = L.legs === 'shorts' ? M.skin : M.bottom;
    legs.forEach((l) => {
      l.thigh.material = L.legs === 'shorts' ? M.skin : M.bottom;
      l.shorts.visible = L.legs === 'shorts';
      l.knee.material = shinMat;
      l.shin.material = shinMat;
      l.cuff.visible = L.legs !== 'shorts';
      l.cuff.geometry = L.bottomMap === 'zigzag' ? cylGeo : hemGeo;
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
