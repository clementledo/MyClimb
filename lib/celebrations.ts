/**
 * Célébrations au top de la simulation 3D : la main libre lâche la prise pour un geste (poing levé,
 * coucou…) pendant que des effets jaillissent autour du haut du mur (confettis, ballons, feux
 * d'artifice…). Tout est préparé au choix de la célébration (géométries, matières, réserves de
 * particules) ; à chaque image, on ne fait que placer et colorer ce qui existe déjà. Les positions
 * se calculent directement à partir du temps écoulé : même rendu quelle que soit la cadence.
 */
import * as THREE from 'three';

import type { Body3 } from './climber';
import type { CelebrationId } from './cosmetics';
import { MYTHIC_COLORS } from './rarity';
import type { Contacts, HandTypes, Pt } from './simulation';

type V3 = THREE.Vector3;

/* ---------- Outils ---------- */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Passe en douceur de 0 à 1 quand `x` va de `a` à `b`. */
const smooth = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
/** Monte de `a` à `b`, redescend de `c` à `d`. */
const bump = (a: number, b: number, c: number, d: number, x: number) => smooth(a, b, x) * (1 - smooth(c, d, x));
/** Apparition qui dépasse un peu puis se pose. */
const pop = (x: number) => {
  const k = clamp01(x) - 1;
  return 1 + 2.7 * k * k * k + 1.7 * k * k;
};
/** Distance parcourue avec le frottement de l'air : la vitesse de départ `v` s'éteint au taux `k` (par s). */
const glide = (v: number, k: number, t: number) => (v * (1 - Math.exp(-k * t))) / k;
/** Chute freinée par l'air : accélération `g`, puis vitesse limite `g / k`. */
const fall = (g: number, k: number, t: number) => (g / k) * (t - (1 - Math.exp(-k * t)) / k);
/** Hasard reproductible tiré d'un nombre (scintillements, arcs électriques). */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Petit générateur pseudo-aléatoire : la même fête à chaque fois. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const color = (hex: string) => new THREE.Color(hex);
/** Couleurs de fête, bien visibles sur le mur clair. */
const PARTY = ['#ff4d6d', '#ffbe0b', '#3a86ff', '#06d6a0', '#8338ec', '#fb5607', '#ff006e', '#00b4d8'];

/** Direction au hasard, en coordonnées de la fête (x, y, z). */
function randomDir(rand: () => number): [number, number, number] {
  const z = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a), z];
}

/** Direction ramenée devant le mur (vers la salle). */
function front(d: [number, number, number]): [number, number, number] {
  if (d[2] < -0.2) d[2] = -d[2];
  return d;
}

/* ---------- Textures calculées (rien à charger) ---------- */

type Fill = (x: number, y: number, px: number, frame: number) => number[];

/**
 * Bande de `frames` images carrées de `n` pixels. `fill` reçoit des coordonnées de -1 à 1 (y vers le
 * haut), la taille d'un pixel (pour adoucir les bords) et le numéro de l'image ; il rend [r, g, b, a].
 */
function paint(n: number, frames: number, fill: Fill, srgb = false) {
  const w = n * frames;
  const data = new Uint8Array(w * n * 4);
  const px = 2 / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < w; i++) {
      const c = fill((((i % n) + 0.5) / n) * 2 - 1, ((j + 0.5) / n) * 2 - 1, px, Math.floor(i / n));
      for (let k = 0; k < 4; k++) data[(j * w + i) * 4 + k] = Math.round(clamp01(c[k]) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, w, n, THREE.RGBAFormat);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Bord adouci d'une forme : `d` distance signée (négative dedans). */
const cover = (d: number, px: number) => clamp01(0.5 - d / px);

/** Distance du point (x, y) au segment [a, b]. */
function seg(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** Distance signée à un polygone (négative dedans). */
function poly(x: number, y: number, pts: [number, number][]) {
  let d = Infinity;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[j];
    d = Math.min(d, seg(x, y, ax, ay, bx, by));
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside ? -d : d;
}

/** Distance (approchée) à une ellipse de centre (cx, cy), de rayons rx et ry, tournée de `a`. */
function ellipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number, a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const u = (x - cx) * c + (y - cy) * s;
  const v = -(x - cx) * s + (y - cy) * c;
  return (Math.hypot(u / rx, v / ry) - 1) * Math.min(rx, ry);
}

/** Sommets d'une étoile à `n` branches, pointe en haut. */
function starPoints(n: number, outer: number, inner: number) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? inner : outer;
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  });
}

/** Contour du cœur (courbe classique), pointe en bas. */
const HEART = Array.from({ length: 48 }, (_, i) => {
  const t = (i / 48) * Math.PI * 2;
  const x = 16 * Math.sin(t) ** 3;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return [(x / 17) * 0.82, (y / 17 + 0.15) * 0.82] as [number, number];
});
const STAR4 = starPoints(4, 0.8, 0.22);
const STAR5 = starPoints(5, 0.8, 0.36);
const STAR5_FIRE = starPoints(5, 0.6, 0.25);
const STAR6 = starPoints(6, 0.85, 0.13);

/** Note de musique : croche (♪) ou deux croches liées (♫). */
function note(x: number, y: number, double: boolean) {
  if (!double) {
    const head = ellipse(x, y, -0.2, -0.5, 0.27, 0.19, 0.4);
    const stem = seg(x, y, 0.04, -0.45, 0.04, 0.72) - 0.05;
    // Crochet : courbe qui part du haut de la hampe et s'amincit.
    let flag = Infinity;
    const bez = (t: number) => [(1 - t) ** 2 * 0.04 + 2 * t * (1 - t) * 0.52 + t * t * 0.42, (1 - t) ** 2 * 0.72 + 2 * t * (1 - t) * 0.5 + t * t * 0.08];
    for (let i = 0; i < 8; i++) {
      const [ax, ay] = bez(i / 8);
      const [bx, by] = bez((i + 1) / 8);
      flag = Math.min(flag, seg(x, y, ax, ay, bx, by) - lerp(0.09, 0.03, i / 8));
    }
    return Math.min(head, stem, flag);
  }
  const h1 = ellipse(x, y, -0.43, -0.52, 0.24, 0.17, 0.4);
  const h2 = ellipse(x, y, 0.33, -0.38, 0.24, 0.17, 0.4);
  const s1 = seg(x, y, -0.22, -0.47, -0.22, 0.52) - 0.045;
  const s2 = seg(x, y, 0.54, -0.33, 0.54, 0.66) - 0.045;
  const beam = seg(x, y, -0.18, 0.5, 0.5, 0.64) - 0.09;
  return Math.min(h1, h2, s1, s2, beam);
}

/** Trait de mouvement en arc « ) ». */
function motionArc(x: number, y: number) {
  const cx = -0.3;
  const R = 0.62;
  const span = 0.8;
  const a = Math.atan2(y, x - cx);
  if (Math.abs(a) <= span) return Math.abs(Math.hypot(x - cx, y) - R) - 0.08;
  return Math.hypot(x - cx - R * Math.cos(span), y - Math.sign(a) * R * Math.sin(span)) - 0.08;
}

/** Flocon à six branches. */
function flake(x: number, y: number) {
  let d = Infinity;
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const u = x * c + y * s;
    const v = -x * s + y * c;
    d = Math.min(
      d,
      seg(u, v, 0, 0, 0.74, 0),
      seg(u, v, 0.36, 0, 0.54, 0.17),
      seg(u, v, 0.36, 0, 0.54, -0.17),
      seg(u, v, 0.56, 0, 0.68, 0.11),
      seg(u, v, 0.56, 0, 0.68, -0.11),
    );
  }
  return d - 0.055;
}

/** Teinte, saturation, luminosité (0 à 1) vers rouge, vert, bleu. */
function hsl(h: number, s: number, l: number) {
  const c = new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l, THREE.SRGBColorSpace);
  const out = { r: 0, g: 0, b: 0 };
  c.getRGB(out, THREE.SRGBColorSpace);
  return [out.r, out.g, out.b];
}

/** Composantes sRGB (0 à 1) d'une couleur « #rrggbb ». */
const srgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

const PUFF: [number, number, number][] = [
  [-0.38, -0.2, 0.34],
  [0.36, -0.22, 0.32],
  [0, -0.08, 0.44],
  [-0.16, 0.28, 0.34],
  [0.24, 0.24, 0.3],
];

const TEXTURES = {
  /** Lumières (fond additif, blanches : la couleur vient de chaque particule). */
  fire: () =>
    paint(64, 8, (x, y, px, f) => {
      const r = Math.hypot(x, y);
      let a: number;
      if (f === 0) a = Math.max(0, 1 - r) ** 2;
      else if (f === 1) {
        // Comète : tête ronde à droite, queue qui s'amincit vers la gauche.
        const t = (x + 1) / 2;
        a = (t ** 1.5 * Math.exp(-((y / (0.1 + 0.3 * t)) ** 2)) + Math.exp(-(((x - 0.6) / 0.3) ** 2) - (y / 0.3) ** 2)) * smooth(1, 0.9, x);
      } else if (f === 2) {
        // Scintillement : cœur brillant et quatre rayons fins.
        const rays = Math.exp(-((y / 0.055) ** 2)) * Math.max(0, 1 - Math.abs(x)) ** 2 + Math.exp(-((x / 0.055) ** 2)) * Math.max(0, 1 - Math.abs(y)) ** 2;
        a = Math.max(0, 1 - r / 0.42) ** 2 + rays;
      } else if (f === 3) {
        const d = poly(x, y, STAR5_FIRE);
        a = Math.max(cover(d, px), 0.5 * Math.exp(-Math.max(0, d) * 9));
      } else if (f === 4) a = r > 1 ? 0 : Math.exp(-(((r - 0.7) / 0.06) ** 2)) + 0.3 * Math.exp(-(((r - 0.7) / 0.16) ** 2));
      // Barre douce (éclairs, rayon de lumière), reflet en longueur, étoile à six branches.
      else if (f === 5) a = Math.exp(-((y / 0.42) ** 2)) * smooth(1, 0.72, Math.abs(x));
      else if (f === 6) a = Math.exp(-((y / 0.05) ** 2)) * Math.max(0, 1 - Math.abs(x)) ** 1.5 + Math.max(0, 1 - r / 0.35) ** 2;
      else {
        const d = poly(x, y, STAR6);
        a = Math.max(cover(d, px), 0.35 * Math.exp(-Math.max(0, d) * 10));
      }
      return [1, 1, 1, a];
    }),
  /** Dessins façon BD (fond normal) : remplissage blanc et contour sombre, teintés par particule. */
  ink: () =>
    paint(64, 8, (x, y, px, f) => {
      let d: number;
      if (f === 0) d = seg(x, y, -0.7, 0, 0.66, 0) - (0.05 + 0.09 * clamp01((x + 0.7) / 1.4));
      else if (f === 1) d = motionArc(x, y);
      else if (f === 2 || f === 3) d = note(x, y, f === 3);
      else if (f === 4) d = poly(x, y, STAR4);
      else if (f === 5) d = poly(x, y, STAR5);
      else if (f === 6) d = poly(x, y, HEART);
      else d = Math.hypot(x, y) - 0.55;
      const k = 0.3 + 0.7 * cover(d, px);
      return [k, k, k, cover(d - 0.1, px)];
    }),
  /** Formes douces (fond normal) : bulle irisée, flocon, nuage de magnésie, point. */
  soft: () =>
    paint(
      64,
      4,
      (x, y, px, f) => {
        const r = Math.hypot(x, y);
        if (f === 0) {
          // Bulle : liseré irisé, film presque transparent et deux reflets.
          const rim = Math.exp(-(((r - 0.82) / 0.07) ** 2));
          const film = r < 0.82 ? 0.06 + 0.12 * (r / 0.82) ** 3 : 0;
          const [cr, cg, cb] = hsl(Math.atan2(y, x) / (Math.PI * 2) + r * 0.3, 0.9, 0.5);
          const spot = Math.exp(-(((x + 0.34) / 0.16) ** 2) - ((y - 0.36) / 0.11) ** 2) + 0.7 * Math.exp(-(((x - 0.3) / 0.07) ** 2) - ((y + 0.42) / 0.05) ** 2);
          const a = clamp01(rim * 0.9 + film + spot);
          const wk = clamp01(spot / Math.max(a, 1e-3));
          return [lerp(cr, 1, wk), lerp(cg, 1, wk), lerp(cb, 1, wk), a];
        }
        if (f === 1) {
          const d = flake(x, y);
          const k = 0.45 + 0.55 * cover(d, px);
          return [k * 0.8, k * 0.9, k, cover(d - 0.09, px)];
        }
        if (f === 2) {
          // Nuage : quelques boules floues, un peu plus gris en bas.
          let a = 0;
          for (const [bx, by, br] of PUFF) a = Math.max(a, smooth(0.2, -0.16, Math.hypot(x - bx, y - by) - br));
          const k = 0.8 + 0.2 * smooth(-0.6, 0.5, y);
          return [k, k, k, a];
        }
        return [1, 1, 1, smooth(0.95, 0.55, r)];
      },
      true,
    ),
  /** Bandes de l'arc-en-ciel, du violet (dedans) au rouge (dehors), bords adoucis. */
  rainbow: () => {
    const cols = ['#9d4edd', '#4361ee', '#4cc9f0', '#38d16a', '#ffd60a', '#ff9f1c', '#ff3b3b'].map(srgb);
    return paint(
      64,
      1,
      (_, y) => {
        const v = (y + 1) / 2;
        const k = clamp01((v - 0.06) / 0.88) * (cols.length - 1);
        const i = Math.min(cols.length - 2, Math.floor(k));
        const c = cols[i].map((a, j) => lerp(a, cols[i + 1][j], k - i));
        return [...c, smooth(0, 0.1, v) * smooth(1, 0.9, v)];
      },
      true,
    );
  },
};
type TextureName = keyof typeof TEXTURES;
const FRAMES: Record<TextureName, number> = { fire: 8, ink: 8, soft: 4, rainbow: 1 };

/* ---------- Réserves d'objets ---------- */

/*
 * Particules : un carré par particule, toujours face à la caméra (taille en mètres, rotation dans
 * l'image). Avec une vitesse, le carré s'étire en traînée derrière la particule.
 */
const SPRITE_VERTEX = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aVel;
attribute vec4 aColor;
attribute vec4 aShape;
uniform float uFrames;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vUv = vec2((uv.x + aShape.w) / uFrames, uv.y);
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  vec3 vel = (modelViewMatrix * vec4(aVel, 0.0)).xyz;
  float l = length(vel.xy);
  vec2 c;
  if (l > 1e-5) {
    vec2 d = vel.xy / l;
    float along = mix(-l - aShape.x * 0.5, aShape.x * 0.5, position.x + 0.5);
    c = d * along + vec2(-d.y, d.x) * position.y * aShape.y;
  } else {
    vec2 q = position.xy * aShape.xy;
    float cs = cos(aShape.z);
    float sn = sin(aShape.z);
    c = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
  }
  mv.xy += c;
  gl_Position = projectionMatrix * mv;
}`;

const SPRITE_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float uOpacity;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(t.rgb * vColor.rgb, t.a * vColor.a * uOpacity);
  #include <colorspace_fragment>
}`;

/** Réserve de particules face à la caméra, dessinées en une seule passe. */
function spritePool(n: number, map: THREE.Texture, frames: number, additive: boolean) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  const attr = (size: number) => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    return a;
  };
  const pos = attr(3);
  const vel = attr(3);
  const col = attr(4);
  const shape = attr(4);
  geo.setAttribute('aPos', pos);
  geo.setAttribute('aVel', vel);
  geo.setAttribute('aColor', col);
  geo.setAttribute('aShape', shape);
  geo.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uFrames: { value: frames }, uOpacity: { value: 1 } },
    vertexShader: SPRITE_VERTEX,
    fragmentShader: SPRITE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  material.toneMapped = false;
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = additive ? 3 : 2;
  let count = 0;
  return {
    mesh,
    material,
    begin: () => {
      count = 0;
    },
    /**
     * Ajoute une particule : position, largeur et hauteur (m), couleur, opacité, rotation dans l'image,
     * numéro de l'image dans la texture, et traînée (vecteur en m, vers l'arrière de la particule).
     */
    add(p: V3, w: number, h: number, c: THREE.Color, a: number, rot = 0, frame = 0, trail: V3 | null = null) {
      if (count >= n || a <= 0.003 || w <= 0) return;
      const i = count++;
      pos.setXYZ(i, p.x, p.y, p.z);
      if (trail) vel.setXYZ(i, trail.x, trail.y, trail.z);
      else vel.setXYZ(i, 0, 0, 0);
      col.setXYZW(i, c.r, c.g, c.b, Math.min(1, a));
      shape.setXYZW(i, w, h, rot, frame);
    },
    end() {
      geo.instanceCount = count;
      mesh.visible = count > 0;
      for (const a of [pos, vel, col, shape]) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, count * a.itemSize);
        a.needsUpdate = true;
      }
    },
    dispose() {
      quad.dispose();
      geo.dispose();
      material.dispose();
    },
  };
}
type Sprites = ReturnType<typeof spritePool>;

/** Réserve d'objets en relief (confettis, ballons, cœurs…), dessinés en une seule passe. */
function shapePool(n: number, geo: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.InstancedMesh(geo, material, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color());
  mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  const m = new THREE.Matrix4();
  let count = 0;
  return {
    mesh,
    begin: () => {
      count = 0;
    },
    add(p: V3, q: THREE.Quaternion, s: V3, c: THREE.Color) {
      if (count >= n || s.x <= 0) return;
      mesh.setMatrixAt(count, m.compose(p, q, s));
      mesh.setColorAt(count, c);
      count++;
    },
    end() {
      mesh.count = count;
      mesh.visible = count > 0;
      for (const [a, size] of [
        [mesh.instanceMatrix, 16],
        [mesh.instanceColor, 3],
      ] as const) {
        if (!a) continue;
        a.clearUpdateRanges();
        a.addUpdateRange(0, count * size);
        a.needsUpdate = true;
      }
    },
  };
}
type Shapes = ReturnType<typeof shapePool>;

/** De quoi construire une célébration ; tout ce qui est créé ici est libéré au changement. */
function makeKit(root: THREE.Group, seed: number) {
  const owned: { dispose: () => void }[] = [];
  const textures: Partial<Record<TextureName, THREE.Texture>> = {};
  const sprites: Sprites[] = [];
  const shapes: Shapes[] = [];
  /** Matières qui s'effacent avec la fin de la fête (opacité suivie). */
  const fading: { m: THREE.Material; a: number }[] = [];
  const own = <T extends { dispose: () => void }>(x: T) => {
    owned.push(x);
    return x;
  };
  const texture = (name: TextureName) => (textures[name] ??= own(TEXTURES[name]()));
  return {
    root,
    rand: seeded(seed),
    own,
    texture,
    /** Particules dessinées avec une des textures ; `fire` s'ajoute à la lumière. */
    sprites(n: number, name: TextureName) {
      const p = own(spritePool(n, texture(name), FRAMES[name], name === 'fire'));
      root.add(p.mesh);
      sprites.push(p);
      return p;
    },
    /** Objets en relief d'une même forme, avec une couleur chacun. */
    shapes(n: number, geo: THREE.BufferGeometry, material: THREE.Material, shadow = false) {
      own(geo);
      own(material);
      material.transparent = true;
      fading.push({ m: material, a: material.opacity });
      const p = shapePool(n, geo, material);
      own(p.mesh);
      p.mesh.castShadow = shadow;
      root.add(p.mesh);
      shapes.push(p);
      return p;
    },
    /** Objet fixe (arc-en-ciel, anneau) : il s'efface lui aussi à la fin. */
    mesh(geo: THREE.BufferGeometry, material: THREE.Material) {
      own(geo);
      own(material);
      fading.push({ m: material, a: material.opacity });
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = false;
      root.add(mesh);
      return mesh;
    },
    /** Avant l'image : on vide les réserves et on applique le fondu de fin. */
    begin(fade: number) {
      for (const p of sprites) {
        p.begin();
        p.material.uniforms.uOpacity.value = fade;
      }
      for (const p of shapes) p.begin();
      for (const f of fading) f.m.opacity = f.a * fade;
    },
    end() {
      for (const p of sprites) p.end();
      for (const p of shapes) p.end();
    },
    dispose() {
      owned.forEach((o) => o.dispose());
      root.clear();
    },
  };
}
type Kit = ReturnType<typeof makeKit>;

/* ---------- Formes en relief ---------- */

/** Cœur bombé (environ 2 de large), face vers +z. */
function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(-0.2, -0.75, -1, -0.3, -1, 0.25);
  s.bezierCurveTo(-1, 0.8, -0.4, 1.05, 0, 0.6);
  s.bezierCurveTo(0.4, 1.05, 1, 0.8, 1, 0.25);
  s.bezierCurveTo(1, -0.3, 0.2, -0.75, 0, -1);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.18, bevelSegments: 4, curveSegments: 10 });
  g.center();
  return g;
}

/** Étoile à cinq branches bombée (rayon 1), face vers +z. */
function starGeometry() {
  const s = new THREE.Shape(starPoints(5, 1, 0.45).map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.08, bevelSegments: 2 });
  g.center();
  return g;
}

/** Ballon de baudruche (rayon 1 environ), nœud en bas. */
function balloonGeometry() {
  const pts = [new THREE.Vector2(0, -1.32), new THREE.Vector2(0.1, -1.27), new THREE.Vector2(0.07, -1.18)];
  for (let i = 1; i <= 18; i++) {
    const a = (i / 18) * Math.PI;
    pts.push(new THREE.Vector2(Math.sin(a) * (0.7 + (0.3 * (1 - Math.cos(a))) / 2), -Math.cos(a) * 1.12));
  }
  return new THREE.LatheGeometry(pts, 20);
}

/** Demi-anneau de rayons `r0` (bord v = 0) à `r1` (v = 1), en `n` tranches de droite à gauche. */
function arcGeometry(r0: number, r1: number, n: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    pos.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
    uv.push(i / n, 0, i / n, 1);
    if (i < n) index.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/** Carré qui montre une seule image d'une bande de texture (anneau de lumière posé dans l'espace). */
function frameQuad(frame: number, frames: number) {
  const g = new THREE.PlaneGeometry(1, 1);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) + frame) / frames);
  return g;
}

/* ---------- La scène vue par les effets ---------- */

/** Ce que voient les effets à chaque image (positions dans la scène, en mètres). */
type Stage = {
  /** Temps depuis l'arrivée au top (ms) et fondu de fin (1, puis vers 0). */
  age: number;
  fade: number;
  /** Taille du grimpeur. */
  h: number;
  head: V3;
  chest: V3;
  pelvis: V3;
  /** Main libre (milieu des doigts) et sac à magnésie. */
  hand: V3;
  bag: V3;
  /** 1 si la main libre est la droite, -1 pour la gauche. */
  side: number;
  /** Repère de la fête : X vers la droite, U vers le haut, N sort du mur. */
  X: V3;
  U: V3;
  N: V3;
  /** Distance de la tête au mur. */
  depth: number;
  /** Axes de l'image (éclats dans le plan de l'écran) et direction de la caméra depuis la tête. */
  right: V3;
  up: V3;
  toCam: V3;
  /** À remplir par l'effet : éclair de lumière dans la salle (0 à 1 et plus) et sa couleur. */
  flash: number;
  flashColor: THREE.Color;
};

/** Point à (x, y, z) mètres de `o` : vers la droite, vers le haut, loin du mur. */
const off = (s: Stage, o: V3, x: number, y: number, z: number, out: V3) =>
  out.copy(o).addScaledVector(s.X, x).addScaledVector(s.U, y).addScaledVector(s.N, z);
/** Point à (x, y, z) mètres de la tête. */
const at = (s: Stage, x: number, y: number, z: number, out: V3) => off(s, s.head, x, y, z, out);
/** Point posé à `gap` du mur, à (x, y) de la tête. */
const onWall = (s: Stage, x: number, y: number, gap: number, out: V3) => off(s, s.head, x, y, gap - s.depth, out);
/** Direction (x, y, z) du repère de la fête. */
const toward = (s: Stage, x: number, y: number, z: number, out: V3) =>
  out.copy(s.X).multiplyScalar(x).addScaledVector(s.U, y).addScaledVector(s.N, z);
/** Point dans le plan de l'image autour de `o` (angle `a`, rayon `r`), avancé vers la caméra. */
const around = (s: Stage, o: V3, a: number, r: number, front: number, out: V3) =>
  out.copy(o).addScaledVector(s.right, Math.cos(a) * r).addScaledVector(s.up, Math.sin(a) * r).addScaledVector(s.toCam, front);

// Vecteurs et couleurs de travail (une seule célébration tourne à la fois).
const P = new THREE.Vector3();
const C = new THREE.Vector3();
const D = new THREE.Vector3();
const L = new THREE.Vector3();
const V = new THREE.Vector3();
const SC = new THREE.Vector3();
const Q = new THREE.Quaternion();
const EU = new THREE.Euler();
const M = new THREE.Matrix4();
const COL = new THREE.Color();
const WHITE = new THREE.Color('#ffffff');
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Morceau de ficelle (cylindre fin) de `a` à `b`. */
function stick(pool: Shapes, a: V3, b: V3, r: number, c: THREE.Color) {
  D.subVectors(b, a);
  const l = D.length();
  if (l < 1e-5) return;
  Q.setFromUnitVectors(Y_AXIS, D.divideScalar(l));
  pool.add(P.addVectors(a, b).multiplyScalar(0.5), Q, SC.set(r, l, r), c);
}

/* ---------- Feux d'artifice (partagés) ---------- */

type Shell = {
  /** Moment de l'éclatement (ms) et position (à partir de la tête). */
  t: number;
  at: [number, number, number];
  colors: string[];
  kind: 'pivoine' | 'anneau' | 'saule' | 'double';
  n: number;
  /** Vitesse de départ des étincelles (m/s) : fixe la taille de la gerbe. */
  speed: number;
  /** Fusée tirée depuis les tapis avant l'éclatement. */
  rocket?: boolean;
};

const FLIGHT = 0.6;

/** Gerbes d'étincelles freinées par l'air qui retombent, avec leurs fusées. */
function fireworks(k: Kit, shells: Shell[], pool?: Sprites) {
  const fire = pool ?? k.sprites(shells.reduce((n, s) => n + s.n, 0) + shells.length * 12, 'fire');
  const r = k.rand;
  const warm = color('#ffd8a8');
  const data = shells.map((sh) => {
    const cols = sh.colors.map(color);
    // Anneau : dans un plan penché vers la caméra.
    const tilt = r() * Math.PI;
    return {
      ...sh,
      cols,
      sparks: Array.from({ length: sh.n }, (_, j) => {
        let d: [number, number, number];
        if (sh.kind === 'anneau') {
          const a = (j / sh.n) * Math.PI * 2;
          d = [Math.cos(a) * Math.cos(tilt), Math.sin(a), Math.cos(a) * Math.sin(tilt) * 0.5];
        } else d = randomDir(r);
        const inner = sh.kind === 'double' && j % 2 === 1;
        return {
          d,
          v: sh.speed * (inner ? 0.5 : 1) * (sh.kind === 'anneau' ? 1 : 0.8 + r() * 0.35),
          life: (sh.kind === 'saule' ? 2.1 : 1.2) + r() * 0.45,
          c: cols[inner ? cols.length - 1 : j % cols.length],
          tw: r() * 6.3,
        };
      }),
      // Étincelles qui tombent de la fusée pendant sa montée.
      shed: Array.from({ length: 10 }, () => [(r() - 0.5) * 0.5, (r() - 0.5) * 0.3, (r() - 0.5) * 0.5]),
      launch: (r() - 0.5) * 0.6,
    };
  });
  return (s: Stage) => {
    for (const sh of data) {
      const t = (s.age - sh.t) / 1000;
      at(s, sh.at[0], sh.at[1], sh.at[2], C);
      if (sh.rocket && t < 0 && t > -FLIGHT) {
        // Fusée : part des tapis, monte en ralentissant, traînée dorée et étincelles qui tombent.
        const q = 1 + t / FLIGHT;
        at(s, sh.at[0] + sh.launch, 0.4 - s.head.y, sh.at[2], L);
        P.lerpVectors(L, C, 1 - (1 - q) ** 2);
        V.subVectors(C, L).multiplyScalar(((2 * (1 - q)) / FLIGHT) * 0.12);
        fire.add(P, 0.06, 0.04, warm, 1, 0, 1, V);
        fire.add(P, 0.16, 0.16, warm, 0.45, 0, 0);
        sh.shed.forEach((d, m) => {
          const born = m / sh.shed.length;
          const u = (q - born) * FLIGHT;
          if (u < 0 || u > 0.45) return;
          const e = 1 - (1 - born) ** 2;
          P.lerpVectors(L, C, e);
          off(s, P, d[0] * u, d[1] * u - 1.5 * u * u, d[2] * u, P);
          fire.add(P, 0.025, 0.025, warm, 1 - u / 0.45, 0, 2);
        });
      }
      if (t < 0) continue;
      // Lueur et éclair de lumière au moment de l'éclatement.
      if (t < 0.45) {
        const e = t / 0.45;
        fire.add(C, 0.5 + 1.1 * Math.sqrt(e), 0.5 + 1.1 * Math.sqrt(e), sh.cols[0], 0.7 * (1 - e) ** 2, 0, 0);
        fire.add(C, 0.3 * (1 - e), 0.3 * (1 - e), WHITE, 1 - e, 0, 2);
        const f = 0.85 * (1 - e) ** 2;
        if (f > s.flash) {
          s.flash = f;
          s.flashColor.copy(sh.cols[0]).lerp(WHITE, 0.4);
        }
      }
      const willow = sh.kind === 'saule';
      const drag = willow ? 1.5 : 2.3;
      const g = willow ? 2.6 : 1.5;
      for (const p of sh.sparks) {
        if (t > p.life) continue;
        toward(s, p.d[0], p.d[1], p.d[2], D);
        P.copy(C).addScaledVector(D, glide(p.v, drag, t)).addScaledVector(s.U, -fall(g, 1.1, t));
        // Vitesse actuelle : donne la longueur et le sens de la traînée.
        V.copy(D)
          .multiplyScalar(p.v * Math.exp(-drag * t))
          .addScaledVector(s.U, (-g / 1.1) * (1 - Math.exp(-1.1 * t)))
          .multiplyScalar(willow ? 0.24 : 0.07);
        COL.copy(WHITE).lerp(p.c, smooth(0, 0.16, t));
        const twinkle = t > p.life * 0.5 ? 0.55 + 0.45 * Math.sin(t * 47 + p.tw) : 1;
        fire.add(P, 0.045, 0.032, COL, (1 - smooth(p.life * 0.55, p.life, t)) * twinkle, 0, 1, V);
      }
    }
  };
}

/* ---------- Geste du bras libre ---------- */

/** Geste de la main libre. */
type Arm = 'pompe' | 'coucou' | 'poing' | 'champion' | 'main' | 'danse' | 'sac' | 'arc' | 'nova';
/** Où regarde le grimpeur pendant la fête. */
type Look = 'camera' | 'haut' | 'main';

/** Repère du bras libre, dans celui du mur : X vers l'extérieur, U vers le haut, O loin du mur. */
const arm = {
  S: new THREE.Vector3(),
  L1: 0,
  L2: 0,
  X: new THREE.Vector3(),
  U: new THREE.Vector3(),
  O: new THREE.Vector3(0, 0, 1),
  h: 1.8,
  /** Ouverture du sac à magnésie et direction « vers le bas » du buste. */
  bag: new THREE.Vector3(),
  down: new THREE.Vector3(),
};
const T1 = new THREE.Vector3();
const T2 = new THREE.Vector3();

/** Direction x X + u U + o O du bras. */
const dir3 = (x: number, u: number, o: number, out: V3) => out.copy(arm.X).multiplyScalar(x).addScaledVector(arm.U, u).addScaledVector(arm.O, o);
/** Poignet à `k` fois l'allonge du bras, dans la direction (x, u, o) depuis l'épaule. */
const aim = (x: number, u: number, o: number, k: number, out: V3) =>
  out.copy(arm.S).addScaledVector(dir3(x, u, o, T1).normalize(), k * (arm.L1 + arm.L2));

/** Coup de poing vers le ciel : part vite, revient plus doucement (q de 0 à 1). */
const punch = (q: number) => (q < 0.3 ? 1 - (1 - q / 0.3) ** 2 : 1 - smooth(0.3, 1, q));
/** Avancée de l'arc-en-ciel qui se dessine (0 à 1), partagée par le geste et l'effet. */
const rainbowAt = (age: number) => smooth(900, 2500, age);
/** Moments où le poing frappe l'air (« pompe ») et où le sac explose. */
const PUMPS = [918, 1478, 2038, 2650];
const BAG_POP = 900;
/** Explosion de la supernova. */
const NOVA = 2050;

/**
 * Cible du geste à `age` ms : poignet (`wrist`), côté où plie le coude (`pole`) et direction des
 * doigts (`fingers`, laissée nulle : dans le prolongement de l'avant-bras). Vrai pour un poing fermé.
 */
function armGoal(kind: Arm, age: number, wrist: V3, pole: V3, fingers: V3): boolean {
  fingers.set(0, 0, 0);
  dir3(1, -0.3, 0.35, pole);
  switch (kind) {
    case 'pompe': {
      // Trois coups de poing vers le ciel, puis le poing reste levé.
      const p = (age - 750) / 560;
      const k = p < 0 ? 0 : p < 3 ? punch(p % 1) : smooth(3, 3.4, p);
      aim(lerp(0.55, 0.3, k), lerp(0.5, 0.92, k), lerp(0.55, 0.28, k), lerp(0.62, 0.97, k), wrist);
      return true;
    }
    case 'coucou': {
      // Coude sur le côté, avant-bras qui se balance : le coucou, tourné vers la caméra.
      const sw = smooth(700, 1000, age) * (1 - smooth(3000, 3300, age));
      const phi = 0.25 + 0.55 * sw * Math.sin(((age - 800) / 500) * Math.PI * 2);
      const e = dir3(0.8, -0.05, 0.6, T2).normalize();
      dir3(Math.sin(phi), Math.cos(phi), 0.2, fingers).normalize();
      wrist.copy(arm.S).addScaledVector(e, arm.L1).addScaledVector(fingers, arm.L2);
      pole.copy(e);
      fingers.addScaledVector(arm.U, 0.15);
      return false;
    }
    case 'poing': {
      // Poing levé qui tremble un peu de joie.
      aim(0.35, 0.9, 0.3, 0.94 + 0.03 * Math.sin((age / 330) * Math.PI * 2) * smooth(900, 1200, age), wrist);
      return true;
    }
    case 'champion': {
      // Poing tendu vers le ciel ; il donne l'élan à la fusée finale.
      aim(0.14, 0.97, 0.24, 0.97 - 0.3 * bump(3300, 3500, 3560, 3800, age), wrist);
      return true;
    }
    case 'main':
      aim(0.5 + 0.07 * Math.sin((age / 1400) * Math.PI * 2), 0.82, 0.35, 0.95, wrist);
      return false;
    case 'danse':
      // Main levée qui se balance en rythme.
      aim(0.42 + 0.3 * Math.sin((age / 900) * Math.PI * 2), 0.85, 0.35, 0.93, wrist);
      return false;
    case 'sac': {
      // La main plonge dans le sac (le nuage part), puis se lève en secouant la magnésie.
      const up = smooth(BAG_POP + 50, BAG_POP + 550, age);
      T2.copy(arm.bag).addScaledVector(arm.down, -0.07 * arm.h).addScaledVector(arm.O, 0.012 * arm.h);
      T2.addScaledVector(arm.down, 0.015 * arm.h * bump(650, 780, 820, BAG_POP, age));
      const shake = 0.05 * Math.sin((age / 120) * Math.PI * 2) * bump(BAG_POP + 500, BAG_POP + 650, 2300, 2500, age);
      aim(0.55 + shake, 0.75, 0.45, 0.95, wrist);
      wrist.lerp(T2, 1 - up).addScaledVector(arm.O, 0.12 * arm.h * Math.sin(Math.PI * up));
      pole.lerp(dir3(0.9, -0.2, 0.6, T1), 1 - up);
      if (up < 0.5) fingers.copy(arm.down);
      return false;
    }
    case 'arc': {
      // La main suit l'arc-en-ciel qui se dessine : de son côté jusqu'au-dessus de la tête.
      const a = Math.min(0.7, rainbowAt(age)) * Math.PI;
      aim(0.9 * Math.cos(a), 0.12 + 0.88 * Math.sin(a), 0.4, 0.95, wrist);
      return false;
    }
    case 'nova': {
      // Le poing serré devant soi concentre l'énergie, puis la main s'ouvre d'un coup.
      const go = smooth(NOVA, NOVA + 140, age);
      const shake = 0.012 * arm.h * smooth(800, 2000, age) * (1 - go);
      aim(0.35, 0.45, 0.8, 0.6, T2);
      T2.addScaledVector(arm.X, shake * Math.sin(age * 0.11)).addScaledVector(arm.U, shake * Math.sin(age * 0.083 + 1));
      aim(0.45, 0.85, 0.4, 0.98, wrist);
      wrist.lerp(T2, 1 - go);
      return go < 0.5;
    }
  }
}

/** Ce que la célébration change dans la pose du grimpeur (passé à `climber.update`). */
export type CelebrationPose = { types: HandTypes; fists: [boolean, boolean]; look: V3 };

const W0 = new THREE.Vector3();
const Wg = new THREE.Vector3();
const Pg = new THREE.Vector3();
const Fg = new THREE.Vector3();
const MID = new THREE.Vector3();
const POLE = new THREE.Vector3();
const FING = new THREE.Vector3();
const SIDE = new THREE.Vector3();
const result: CelebrationPose = { types: {}, fists: [false, false], look: new THREE.Vector3() };
const TYPES: HandTypes = {};

/** Coude (`elbow`) et poignet (`wrist`) d'un bras de longueurs l1, l2 qui va de `root` vers `target`, plié vers `pole`. */
function reach(root: V3, target: V3, l1: number, l2: number, pole: V3, elbow: V3, wrist: V3) {
  const u = T1.subVectors(target, root);
  let d = u.length();
  if (d < 1e-6) u.set(0, 1, 0);
  else u.divideScalar(d);
  d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(d, l1 + l2 - 1e-3));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  SIDE.copy(pole).addScaledVector(u, -pole.dot(u));
  if (SIDE.lengthSq() < 1e-10) SIDE.set(0, 0, 1);
  else SIDE.normalize();
  elbow.copy(root).addScaledVector(u, a).addScaledVector(SIDE, hh);
  wrist.copy(root).addScaledVector(u, d);
}

/* ---------- Les célébrations ---------- */

type Fx = (s: Stage) => void;
type Def = {
  /** Durée totale, en ms (le geste et les effets finissent avant). */
  dur: number;
  arm: Arm;
  look: Look;
  /** Lumières de la salle baissées (0 à 1) et teinte de l'éclairage pendant la fête. */
  night?: number;
  tint?: string;
  build: (k: Kit) => Fx;
};

const DEFS: Record<CelebrationId, Def> = {
  /* ----- Communs : simples et courtes ----- */

  poing: {
    dur: 4000,
    arm: 'pompe',
    look: 'main',
    build: (k) => {
      const ink = k.sprites(40, 'ink');
      const gold = [color('#ffb703'), color('#fb8500')];
      return (s) => {
        PUMPS.forEach((hit, b) => {
          const t = s.age - hit;
          if (t < 0 || t > 360) return;
          // Éclats autour du poing à chaque coup, le dernier plus grand.
          const last = b === PUMPS.length - 1;
          const big = last ? 1.45 : 1;
          const n = last ? 12 : 8;
          const e = 1 - (1 - t / 360) ** 3;
          const a = 1 - smooth(200, 360, t);
          for (let j = 0; j < n; j++) {
            const ang = (j / n) * Math.PI * 2 + b * 0.5;
            around(s, s.hand, ang, (0.08 + 0.13 * e) * big, 0.12, P);
            ink.add(P, 0.085 * big, 0.034 * big, gold[j % 2], a, ang, 0);
          }
          for (let j = 0; j < (last ? 5 : 2); j++) {
            around(s, s.hand, hash(b * 7 + j) * Math.PI * 2, (0.17 + 0.1 * hash(b * 13 + j)) * big * (0.6 + 0.4 * e), 0.14, P);
            const size = 0.06 * pop(t / 150);
            ink.add(P, size, size, gold[0], a, 0, 4);
          }
        });
      };
    },
  },

  coucou: {
    dur: 4000,
    arm: 'coucou',
    look: 'camera',
    build: (k) => {
      const ink = k.sprites(12, 'ink');
      const blue = color('#339af0');
      const yellow = color('#ffd43b');
      return (s) => {
        // Traits de mouvement de chaque côté de la main, au rythme du coucou.
        const on = bump(900, 1100, 3000, 3250, s.age);
        const swing = s.side * Math.sin(((s.age - 800) / 500) * Math.PI * 2);
        for (const d of [-1, 1]) {
          const a = on * clamp01(d * swing * 1.6 - 0.3);
          for (let j = 0; j < 2; j++) {
            around(s, s.hand, d > 0 ? 0 : Math.PI, 0.15 + 0.1 * j, 0.1, P);
            ink.add(P, 0.16 + 0.07 * j, 0.16 + 0.07 * j, blue, a * (1 - 0.3 * j), d > 0 ? 0 : Math.PI, 1);
          }
        }
        // Trois petites étoiles au début du coucou.
        for (let j = 0; j < 3; j++) {
          const t = s.age - 850 - j * 160;
          if (t < 0 || t > 650) continue;
          around(s, s.hand, 0.6 + j * 1.1, 0.2 + 0.07 * (t / 650), 0.12, P);
          const size = 0.08 * pop(t / 180);
          ink.add(P, size, size, yellow, 1 - smooth(380, 650, t), 0, 4);
        }
      };
    },
  },

  magnesie: {
    dur: 4000,
    arm: 'sac',
    look: 'main',
    build: (k) => {
      const soft = k.sprites(32, 'soft');
      const ink = k.sprites(50, 'ink');
      const r = k.rand;
      // Boules du nuage : surtout vers la salle, sur les côtés et vers le haut.
      const puffs = Array.from({ length: 28 }, () => {
        const d = [(r() - 0.5) * 2.4, r() * 1.2 - 0.2, 0.3 + r()];
        const l = Math.hypot(d[0], d[1], d[2]);
        return {
          d: d.map((x) => x / l),
          v: 0.5 + r() * 1.0,
          s0: 0.12 + r() * 0.1,
          s1: 0.38 + r() * 0.36,
          rot: r() * 6.3,
          spin: (r() - 0.5) * 0.8,
          k: 0.86 + r() * 0.14,
          delay: r() * 0.12,
        };
      });
      // Grains de magnésie projetés, qui retombent.
      const specks = Array.from({ length: 44 }, () => {
        const d = randomDir(r);
        return { d: [d[0], Math.abs(d[1]) * 0.8, Math.abs(d[2]) + 0.2], v: 1.4 + r() * 1.6, size: 0.014 + r() * 0.014, life: 0.7 + r() * 0.6 };
      });
      const shade = new THREE.Color();
      const chalk = color('#f8f9fa');
      return (s) => {
        const t0 = (s.age - BAG_POP) / 1000;
        if (t0 < 0) return;
        for (const p of puffs) {
          const t = t0 - p.delay;
          if (t < 0) continue;
          const a = smooth(0, 0.06, t) * (1 - smooth(1.1, 2.7, t));
          const g = glide(p.v, 3.2, t);
          off(s, s.bag, p.d[0] * g, p.d[1] * g + 0.08 * t, p.d[2] * g + 0.06, P);
          const size = lerp(p.s1, p.s0, Math.exp(-2.4 * t));
          soft.add(P, size, size, shade.setScalar(p.k), 0.95 * a, p.rot + p.spin * t, 2);
        }
        for (const p of specks) {
          if (t0 > p.life) continue;
          const g = glide(p.v, 1.6, t0);
          off(s, s.bag, p.d[0] * g, p.d[1] * g - fall(4, 0.8, t0), p.d[2] * g, P);
          ink.add(P, p.size, p.size, chalk, 1 - smooth(p.life * 0.6, p.life, t0), 0, 7);
        }
      };
    },
  },

  bulles: {
    dur: 4000,
    arm: 'main',
    look: 'haut',
    build: (k) => {
      const soft = k.sprites(40, 'soft');
      const r = k.rand;
      const list = Array.from({ length: 36 }, (_, i) => {
        // Deux bulles sur trois partent de la main, les autres montent d'en bas.
        const hand = i % 3 !== 2;
        return {
          hand,
          born: 300 + i * 66 + r() * 60,
          life: 1.5 + r() * 1.1,
          o: hand ? [(r() - 0.5) * 0.12, (r() - 0.5) * 0.1, r() * 0.1] : [(r() - 0.5) * 2.6, -1.8 + r(), 0.25 + r() * 1.3],
          v: [(r() - 0.4) * 0.35, 0.2 + r() * 0.25, 0.06 + r() * 0.24],
          size: 0.05 + r() * 0.085,
          ph: r() * 6.3,
        };
      });
      return (s) => {
        for (const b of list) {
          const t = (s.age - b.born) / 1000;
          if (t < 0 || t > b.life) continue;
          // En fin de vie, la bulle gonfle un peu et éclate.
          const end = clamp01((t - b.life + 0.12) / 0.12);
          const x = b.o[0] + (b.hand ? s.side : 1) * b.v[0] * t + 0.05 * Math.sin(2.2 * t + b.ph);
          off(s, b.hand ? s.hand : s.head, x, b.o[1] + b.v[1] * t + 0.02 * Math.sin(3 * t + b.ph), b.o[2] + b.v[2] * t, P);
          const size = b.size * pop(t / 0.25) * (1 + 0.4 * end);
          soft.add(P, size, size, WHITE, 1 - end, 0, 0);
        }
      };
    },
  },

  notes: {
    dur: 4000,
    arm: 'danse',
    look: 'main',
    build: (k) => {
      const ink = k.sprites(22, 'ink');
      const r = k.rand;
      const cols = ['#7048e8', '#1c7ed6', '#e64980', '#0ca678', '#f76707'].map(color);
      const list = Array.from({ length: 20 }, (_, i) => {
        const d = i % 2 ? 1 : -1;
        return {
          born: 450 + i * 125,
          life: 1.6 + r() * 0.5,
          o: [d * (0.12 + r() * 0.1), 0.12 + r() * 0.12, 0.12 + r() * 0.1],
          v: [d * (0.18 + r() * 0.3), 0.32 + r() * 0.2, 0.12 + r() * 0.25],
          size: 0.15 + r() * 0.07,
          frame: r() < 0.5 ? 2 : 3,
          c: cols[i % cols.length],
          ph: r() * 6.3,
        };
      });
      return (s) => {
        for (const n of list) {
          const t = (s.age - n.born) / 1000;
          if (t < 0 || t > n.life) continue;
          at(s, n.o[0] + n.v[0] * t + 0.05 * Math.sin(5 * t + n.ph), n.o[1] + n.v[1] * t, n.o[2] + n.v[2] * t, P);
          const size = n.size * pop(t / 0.2);
          ink.add(P, size, size, n.c, 1 - smooth(n.life * 0.65, n.life, t), 0.35 * Math.sin(4 * t + n.ph), n.frame);
        }
      };
    },
  },

  /* ----- Rares : colorées ----- */

  confettis: {
    dur: 4200,
    arm: 'poing',
    look: 'haut',
    build: (k) => {
      const pool = k.shapes(260, new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }));
      const ink = k.sprites(8, 'ink');
      const r = k.rand;
      const cols = PARTY.map(color);
      // Deux canons de part et d'autre du grimpeur, puis une pluie venue d'en haut.
      const bits = Array.from({ length: 260 }, (_, i) => {
        const gun = i < 170 ? (i % 2 ? 1 : -1) : 0;
        const axis = randomDir(r);
        return {
          gun,
          born: gun ? 450 + r() * 70 : 850 + r() * 1100,
          o: gun ? [gun * 0.85, 0.25, 0.55] : [(r() - 0.5) * 3.4, 1.3 + r() * 0.8, 0.1 + r() * 1.9],
          v: gun ? [-gun * (0.2 + r() * 1.4), 2.2 + r() * 2.2, (r() - 0.3) * 1.4] : [0, 0, 0],
          drop: 0.45 + r() * 0.3,
          axis: new THREE.Vector3(...axis),
          spin: 6 + r() * 9,
          ph: r() * 6.3,
          w: 0.034 + r() * 0.026,
          h: 0.02 + r() * 0.014,
          c: cols[i % cols.length],
        };
      });
      const yellow = color('#ffd43b');
      return (s) => {
        for (const b of bits) {
          const t = (s.age - b.born) / 1000;
          if (t < 0) continue;
          // Lancés puis freinés par l'air, ils retombent en virevoltant.
          const x = b.o[0] + glide(b.v[0], 3, t) + 0.06 * Math.sin(4 * t + b.ph);
          const y = b.o[1] + glide(b.v[1], 3, t) - fall(b.drop * 3, 3, t);
          const z = b.o[2] + glide(b.v[2], 3, t) + 0.04 * Math.cos(3.3 * t + b.ph);
          at(s, x, y, z, P);
          Q.setFromAxisAngle(b.axis, b.spin * t + b.ph);
          pool.add(P, Q, SC.set(b.w, b.h, 1), b.c);
        }
        // « Pan ! » des deux canons.
        for (const gun of [-1, 1]) {
          const t = s.age - 450;
          if (t < 0 || t > 300) continue;
          at(s, gun * 0.85, 0.25, 0.55, C);
          for (let j = 0; j < 3; j++) {
            around(s, C, 1.2 + j * 1.9, 0.06 + 0.1 * (t / 300), 0, P);
            const size = 0.07 * pop(t / 120);
            ink.add(P, size, size, yellow, 1 - smooth(150, 300, t), 0, 4);
          }
        }
      };
    },
  },

  ballons: {
    dur: 4200,
    arm: 'main',
    look: 'haut',
    build: (k) => {
      const balloons = k.shapes(14, balloonGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.25 }), true);
      const strings = k.shapes(28, new THREE.CylinderGeometry(1, 1, 1, 4, 1), new THREE.MeshLambertMaterial({ color: '#868e96' }));
      const r = k.rand;
      const cols = ['#ff4d6d', '#ffbe0b', '#3a86ff', '#06d6a0', '#8338ec', '#fb5607', '#ff70a6'].map(color);
      // Ballons lâchés depuis les tapis, bien répartis devant le mur.
      const list = Array.from({ length: 14 }, (_, i) => ({
        born: i * 85 + r() * 60,
        x: (((i * 0.618) % 1) - 0.5) * 3 + (r() - 0.5) * 0.3,
        z: 0.35 + r() * 1.6,
        rise: 1.05 + r() * 0.35,
        size: 0.13 + r() * 0.035,
        ph: r() * 6.3,
        c: cols[i % cols.length],
      }));
      const knot = new THREE.Vector3();
      const mid = new THREE.Vector3();
      const end = new THREE.Vector3();
      return (s) => {
        const floor = 0.45 - s.head.y;
        for (const b of list) {
          const t = (s.age - b.born) / 1000;
          if (t < 0) continue;
          const y = floor + b.rise * t + 0.55 * (1 - Math.exp(-2.5 * t));
          const lean = 0.15 * Math.cos(1.4 * t + b.ph);
          at(s, b.x + 0.08 * Math.sin(1.4 * t + b.ph), y, b.z + 0.05 * Math.sin(1.1 * t + b.ph), P);
          Q.setFromAxisAngle(s.N, lean);
          balloons.add(P, Q, SC.setScalar(b.size), b.c);
          // Ficelle en deux morceaux sous le nœud, qui traîne un peu.
          knot.copy(s.U).multiplyScalar(-1.3 * b.size).applyQuaternion(Q).add(P);
          off(s, knot, 0.03 * Math.sin(2 * t + b.ph), -0.19, 0, mid);
          off(s, mid, 0.05 * Math.sin(2 * t + b.ph + 0.8), -0.19, 0, end);
          stick(strings, knot, mid, 0.004, WHITE);
          stick(strings, mid, end, 0.004, WHITE);
        }
      };
    },
  },

  coeurs: {
    dur: 4200,
    arm: 'main',
    look: 'main',
    build: (k) => {
      const hearts = k.shapes(22, heartGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.32, emissive: '#4a0a1e' }), true);
      const ink = k.sprites(24, 'ink');
      const r = k.rand;
      const cols = ['#ff4d6d', '#ff8fab', '#f03e3e', '#e64980', '#ffb3c6'].map(color);
      const list = Array.from({ length: 22 }, (_, i) => {
        // Un cœur sur deux part de la main levée, les autres d'autour du grimpeur.
        const hand = i % 2 === 0;
        return {
          hand,
          born: 350 + i * 100 + r() * 50,
          o: hand ? [0, 0.04, 0.06] : [(r() - 0.5) * 1.3, -0.75 + r() * 0.75, 0.25 + r() * 0.5],
          v: [(r() - 0.5) * 0.35, 0.36 + r() * 0.2, 0.12 + r() * 0.25],
          size: 0.05 + r() * 0.045,
          ph: r() * 6.3,
          c: cols[i % cols.length],
        };
      });
      const sparkles = Array.from({ length: 22 }, () => ({ x: (r() - 0.5) * 2, y: -0.6 + r() * 1.6, z: 0.2 + r() * 0.9, ph: r(), rate: 0.9 + r() * 0.8 }));
      const pink = color('#ff8fab');
      return (s) => {
        // Les cœurs se tournent vers la caméra et se balancent doucement.
        const face = Math.atan2(s.toCam.x, s.toCam.z);
        for (const b of list) {
          const t = (s.age - b.born) / 1000;
          if (t < 0) continue;
          off(s, b.hand ? s.hand : s.head, b.o[0] + b.v[0] * t + 0.08 * Math.sin(2 * t + b.ph), b.o[1] + b.v[1] * t, b.o[2] + b.v[2] * t, P);
          Q.setFromEuler(EU.set(0.1 * Math.sin(1.7 * t + b.ph), face + 0.45 * Math.sin(2.3 * t + b.ph), 0.18 * Math.sin(2 * t + b.ph)));
          hearts.add(P, Q, SC.setScalar(b.size * pop(t / 0.3)), b.c);
        }
        // Petites étincelles roses qui scintillent entre les cœurs.
        for (const p of sparkles) {
          const q = (s.age / 1000) * p.rate + p.ph;
          const ph = q % 1;
          if (s.age < 600 || ph > 0.4) continue;
          at(s, p.x, p.y + 0.15 * q, p.z, P);
          const size = 0.07 * Math.sin((ph / 0.4) * Math.PI);
          ink.add(P, size, size, pink, 1, 0, 4);
        }
      };
    },
  },

  flocons: {
    dur: 4500,
    arm: 'main',
    look: 'haut',
    night: 0.45,
    tint: '#8fb8ff',
    build: (k) => {
      const soft = k.sprites(160, 'soft');
      const fire = k.sprites(16, 'fire');
      const r = k.rand;
      const flakes = Array.from({ length: 160 }, () => ({
        x: (r() - 0.5) * 4.2,
        y: -2.2 + r() * 3.6,
        z: 0.08 + r() * 2.6,
        delay: r() * 1500,
        v: 0.2 + r() * 0.22,
        size: 0.05 + r() * 0.07,
        ph: r() * 6.3,
        spin: (r() - 0.5) * 1.2,
        frame: r() < 0.7 ? 1 : 3,
      }));
      const glints = Array.from({ length: 16 }, () => ({ flake: Math.floor(r() * 160), ph: r(), rate: 0.6 + r() * 0.8 }));
      const snow = color('#f3f9ff');
      const ice = color('#d0ebff');
      const where = (s: Stage, f: (typeof flakes)[number], t: number, out: V3) =>
        at(s, f.x + 0.15 * Math.sin(0.8 * t + f.ph), f.y - f.v * t, f.z + 0.1 * Math.sin(0.6 * t + f.ph), out);
      return (s) => {
        for (const f of flakes) {
          const t = (s.age - f.delay) / 1000;
          if (t < 0) continue;
          where(s, f, t, P);
          soft.add(P, f.size, f.size, snow, smooth(0, 0.6, t), f.ph + f.spin * t, f.frame);
        }
        // Reflets qui scintillent sur quelques flocons.
        for (const g of glints) {
          const f = flakes[g.flake];
          const t = (s.age - f.delay) / 1000;
          const ph = ((s.age / 1000) * g.rate + g.ph) % 1;
          if (t < 0.3 || ph > 0.3) continue;
          where(s, f, t, P);
          const size = f.size * 2.4 * Math.sin((ph / 0.3) * Math.PI);
          fire.add(P, size, size, ice, 0.9, 0.4, 2);
        }
      };
    },
  },

  /* ----- Épiques : lumineuses, salle dans le noir ----- */

  artifice: {
    dur: 4500,
    arm: 'poing',
    look: 'haut',
    night: 0.62,
    tint: '#4a5a8c',
    build: (k) =>
      fireworks(k, [
        { t: 800, at: [-0.75, 0.55, 0.7], colors: ['#ff4d6d', '#ffd6a5'], kind: 'pivoine', n: 56, speed: 1.9, rocket: true },
        { t: 1300, at: [0.8, 0.7, 0.9], colors: ['#4cc9f0', '#4361ee'], kind: 'anneau', n: 44, speed: 1.7, rocket: true },
        { t: 1800, at: [-0.1, 0.9, 0.5], colors: ['#ff5ca8', '#7dff7a'], kind: 'double', n: 60, speed: 2.0, rocket: true },
        { t: 2300, at: [0.55, 0.4, 1.2], colors: ['#b388ff', '#ffffff'], kind: 'pivoine', n: 52, speed: 1.8, rocket: true },
        { t: 2850, at: [-0.4, 0.8, 1.0], colors: ['#ffc94d', '#ff9f1c'], kind: 'saule', n: 56, speed: 1.4, rocket: true },
      ]),
  },

  etoiles: {
    dur: 4500,
    arm: 'main',
    look: 'main',
    night: 0.5,
    tint: '#7c5cff',
    build: (k) => {
      const stars = k.shapes(
        14,
        starGeometry(),
        new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ff9e00', emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.3 }),
        true,
      );
      const fire = k.sprites(180, 'fire');
      const r = k.rand;
      // Deux anneaux d'étoiles qui tournent en sens contraires autour du grimpeur, en montant.
      const list = Array.from({ length: 14 }, (_, i) => ({
        ring: i % 2,
        ph: ((i >> 1) / 7) * Math.PI * 2 + (i % 2) * 0.45,
        born: 300 + i * 70,
        size: 0.075 + r() * 0.03,
        spin: 3 + r() * 3,
      }));
      const glitter = Array.from({ length: 40 }, () => ({ x: (r() - 0.5) * 2.6, y: -1.3 + r() * 2.3, z: 0.1 + r() * 1.3, ph: r(), rate: 0.7 + r() * 1.2 }));
      const gold = color('#ffd23f');
      const pale = color('#fff3bf');
      const halo = color('#ffb703');
      const orbit = (s: Stage, st: (typeof list)[number], t: number, out: V3) => {
        const a = st.ph + (st.ring ? -2.4 : 2.0) * t;
        // À la fin, les étoiles s'envolent en s'éloignant.
        const fly = smooth(3.2, 4.1, t);
        const rx = 0.8 * (1 + 1.8 * fly);
        const y = (st.ring ? 0.2 : -0.55) + 0.45 * smooth(0.3, 3, t) + 0.05 * Math.sin(2 * a) + 0.8 * fly;
        return at(s, Math.cos(a) * rx, y, 0.42 + Math.sin(a) * 0.37 * (1 + fly), out);
      };
      return (s) => {
        const t = s.age / 1000;
        fire.add(off(s, s.chest, 0, 0.1, -0.05, P), 2.2, 2.2, halo, (0.2 + 0.05 * Math.sin(t * 5)) * bump(0.3, 1, 3.4, 4.2, t), 0, 0);
        for (const st of list) {
          const u = (s.age - st.born) / 1000;
          if (u < 0) continue;
          const size = st.size * pop(u / 0.3) * (1 - smooth(3.4, 4.1, t));
          orbit(s, st, t, P);
          Q.setFromEuler(EU.set(0.3 * Math.sin(t * 2 + st.ph), st.spin * t, 0));
          stars.add(P, Q, SC.setScalar(size), gold);
          fire.add(P, size * 2.6, size * 2.6, halo, 0.35, 0, 0);
          // Traînée de paillettes derrière chaque étoile.
          for (let m = 1; m <= 8; m++) {
            if (u < m * 0.04) break;
            orbit(s, st, t - m * 0.045, P);
            const tw = 0.6 + 0.4 * Math.sin(t * 30 + m * 2 + st.ph * 5);
            const sz = size * (1.1 - m * 0.1);
            fire.add(P, sz, sz, m % 2 ? pale : gold, (1 - m / 9) * tw, m, 2);
          }
        }
        // Paillettes qui scintillent tout autour.
        for (const g of glitter) {
          const ph = (t * g.rate + g.ph) % 1;
          if (t < 0.6 || ph > 0.35) continue;
          at(s, g.x, g.y, g.z, P);
          const size = 0.09 * Math.sin((ph / 0.35) * Math.PI);
          fire.add(P, size, size, g.ph > 0.5 ? gold : pale, 0.9, 0, 7);
        }
      };
    },
  },

  eclairs: {
    dur: 4500,
    arm: 'poing',
    look: 'haut',
    night: 0.72,
    tint: '#3d4f8a',
    build: (k) => {
      const fire = k.sprites(340, 'fire');
      const r = k.rand;
      const SEGS = 28;
      /** Ligne brisée : écarts au hasard, de plus en plus fins (déplacement du point milieu). */
      const jag = (n: number, amp: number) => {
        const o = new Float32Array(n + 1);
        const split = (a: number, b: number, w: number) => {
          if (b - a < 2) return;
          const m = (a + b) >> 1;
          o[m] = (o[a] + o[b]) / 2 + (r() - 0.5) * w;
          split(a, m, w * 0.55);
          split(m, b, w * 0.55);
        };
        split(0, n, amp);
        return o;
      };
      // Chaque coup : un éclair principal et deux branches ; une cible sur le mur ou le poing levé.
      const strikes = [
        { t: 650, to: [-0.75, 0.42] as [number, number] | null },
        { t: 1300, to: [0.72, 0.6] as [number, number] | null },
        { t: 1950, to: null },
        { t: 2080, to: [-0.35, 0.78] as [number, number] | null },
        { t: 2750, to: [0.3, 0.9] as [number, number] | null },
      ].map((st) => ({
        ...st,
        from: [(r() - 0.5) * 0.9, 2.1, 0.5 + r() * 0.6],
        ox: jag(SEGS, 0.5),
        oz: jag(SEGS, 0.25),
        branches: [0, 1].map(() => ({ at: Math.floor(SEGS * (0.3 + r() * 0.35)), dir: [(r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.3), -0.7, (r() - 0.5) * 0.3], len: 0.25 + r() * 0.2, ox: jag(10, 0.12) })),
        sparks: Array.from({ length: 20 }, () => ({ d: [(r() - 0.5) * 2, r() * 1.2 - 0.2, 0.3 + r()], v: 1 + r() * 1.6, life: 0.45 + r() * 0.4 })),
      }));
      // Branche qui part de chaque segment (ou rien).
      const branchAt = strikes.map((st) => Array.from({ length: SEGS + 1 }, (_, i) => st.branches.find((b) => b.at === i) ?? null));
      const core = color('#f1f6ff');
      const glow = color('#6f8cff');
      const spark = color('#bcd4ff');
      const A = new THREE.Vector3();
      const B = new THREE.Vector3();
      const prev = new THREE.Vector3();
      const tip = new THREE.Vector3();
      const along = new THREE.Vector3();
      /** Intensité d'un éclair (scintille, puis s'éteint) à `t` ms du coup. */
      const flicker = (t: number) => (t < 0 || t > 340 ? 0 : t < 45 ? 1 : t < 90 ? 0.25 : t < 150 ? 1 : 1 - smooth(150, 340, t));
      /** Un trait de lumière de `a` à `b` : cœur blanc et halo bleu. */
      const bolt = (a: V3, b: V3, w: number, f: number) => {
        along.subVectors(b, a);
        fire.add(b, w, w, core, f, 0, 5, along);
        fire.add(b, w * 5, w * 5, glow, 0.4 * f, 0, 5, along);
      };
      return (s) => {
        strikes.forEach((st, n) => {
          const t = s.age - st.t;
          const f = flicker(t);
          if (t < 0 || t > 1200) return;
          at(s, st.from[0], st.from[1], st.from[2], A);
          if (st.to) onWall(s, st.to[0], st.to[1], 0.05, B);
          else B.copy(s.hand);
          if (f > 0) {
            // Éclair principal, découpé en segments, puis ses branches.
            prev.copy(A);
            for (let i = 1; i <= SEGS; i++) {
              const q = i / SEGS;
              P.lerpVectors(A, B, q).addScaledVector(s.X, st.ox[i]).addScaledVector(s.N, st.oz[i]);
              bolt(prev, P, 0.022, f);
              const br = branchAt[n][i];
              if (br) {
                toward(s, br.dir[0], br.dir[1], br.dir[2], D).normalize();
                L.copy(P);
                for (let j = 1; j <= 10; j++) {
                  tip.copy(P).addScaledVector(D, (br.len * j) / 10).addScaledVector(s.X, br.ox[j]);
                  bolt(L, tip, 0.014, f * (1 - j / 12));
                  L.copy(tip);
                }
              }
              prev.copy(P);
            }
            if (f > s.flash) {
              s.flash = 1.25 * f;
              s.flashColor.set('#c8d6ff');
            }
          }
          // Impact : lueur, onde et étincelles qui rebondissent.
          const u = t / 1000;
          if (u < 0.35) {
            fire.add(B, 0.6 * (1 - u / 0.35), 0.6 * (1 - u / 0.35), glow, 0.8, 0, 0);
            fire.add(B, 0.15 + 1.3 * u, 0.15 + 1.3 * u, spark, 0.8 * (1 - u / 0.35), 0, 4);
          }
          for (const p of st.sparks) {
            if (u > p.life) continue;
            const g = glide(p.v, 1.5, u) * 0.6;
            off(s, B, p.d[0] * g, p.d[1] * g - fall(5, 0.6, u), p.d[2] * g, P);
            const e = 0.6 * p.v * Math.exp(-1.5 * u);
            toward(s, p.d[0] * e, p.d[1] * e - (5 / 0.6) * (1 - Math.exp(-0.6 * u)), p.d[2] * e, V).multiplyScalar(0.04);
            fire.add(P, 0.03, 0.02, spark, 1 - u / p.life, 0, 1, V);
          }
        });
        // Petits arcs électriques autour du poing levé.
        const on = bump(500, 700, 3300, 3600, s.age);
        if (on > 0) {
          const slot = Math.floor(s.age / 60);
          for (let j = 0; j < 4; j++) {
            let a = hash(slot * 13 + j) * Math.PI * 2;
            around(s, s.hand, a, 0.03, 0.08, L);
            for (let m = 1; m <= 3; m++) {
              a += (hash(slot * 7 + j * 3 + m) - 0.5) * 1.2;
              around(s, s.hand, a, 0.03 + m * 0.035, 0.08, P);
              bolt(L, P, 0.008, on * (0.5 + 0.5 * hash(slot + j)));
              L.copy(P);
            }
          }
        }
      };
    },
  },

  /* ----- Légendaires : riches ----- */

  or: {
    dur: 5500,
    arm: 'main',
    look: 'haut',
    night: 0.35,
    tint: '#ffcf70',
    build: (k) => {
      const coins = k.shapes(
        146,
        new THREE.CylinderGeometry(1, 1, 0.14, 24).rotateX(Math.PI / 2),
        new THREE.MeshStandardMaterial({ metalness: 0.25, roughness: 0.35, emissive: '#b37a00', emissiveIntensity: 0.75 }),
        true,
      );
      const fire = k.sprites(150, 'fire');
      const r = k.rand;
      const golds = ['#ffd24a', '#ffe17a', '#ffc21a'].map(color);
      // Pluie de pièces du plafond, puis une fontaine finale depuis le haut du mur.
      const coinsList = Array.from({ length: 146 }, (_, i) => {
        const fountain = i >= 110;
        const axis = randomDir(r);
        return {
          fountain,
          born: fountain ? 3700 + r() * 300 : (i / 110) * 3200 + r() * 150,
          o: fountain ? [(r() - 0.5) * 0.3, 0.75, 0.25] : [(r() - 0.5) * 3.6, 1.5 + r() * 0.8, 0.15 + r() * 2],
          v: fountain ? [(r() - 0.5) * 2, 1.8 + r() * 0.9, 0.3 + r() * 1.1] : [0, 0, 0],
          drop: 1.6 + r() * 0.9,
          axis: new THREE.Vector3(...axis),
          spin: 5 + r() * 8,
          ph: r() * 6.3,
          size: 0.045 + r() * 0.02,
          c: golds[i % golds.length],
        };
      });
      const spots = coinsList.map(() => new THREE.Vector3());
      const shown = coinsList.map(() => false);
      const glints = Array.from({ length: 50 }, () => ({ coin: Math.floor(r() * coinsList.length), ph: r(), rate: 1.2 + r() * 1.6 }));
      const dust = Array.from({ length: 60 }, () => ({ x: (r() - 0.5) * 3.4, y: -1.5 + r() * 2.8, z: 0.1 + r() * 1.8, v: 0.1 + r() * 0.12, ph: r() * 6.3, size: 0.02 + r() * 0.025 }));
      const pale = color('#fff3bf');
      const amber = color('#ffb300');
      return (s) => {
        coinsList.forEach((c, i) => {
          const t = (s.age - c.born) / 1000;
          shown[i] = false;
          if (t < 0) return;
          const g = c.fountain ? 7 : c.drop * 3;
          const y = c.o[1] + c.v[1] * t - fall(g, c.fountain ? 0.4 : 3, t);
          if (y < -3.2) return;
          at(s, c.o[0] + c.v[0] * t, y, c.o[2] + c.v[2] * t, spots[i]);
          Q.setFromAxisAngle(c.axis, c.spin * t + c.ph);
          coins.add(spots[i], Q, SC.setScalar(c.size), c.c);
          shown[i] = true;
        });
        // Éclats de lumière qui scintillent sur les pièces.
        for (const g of glints) {
          const ph = ((s.age / 1000) * g.rate + g.ph) % 1;
          if (!shown[g.coin] || ph > 0.25) continue;
          const size = 0.16 * Math.sin((ph / 0.25) * Math.PI);
          fire.add(off(s, spots[g.coin], 0, 0, 0.03, P), size, size, pale, 1, 0.3, 2);
        }
        // Poussière d'or qui descend doucement.
        const t = s.age / 1000;
        for (const d of dust) {
          at(s, d.x + 0.1 * Math.sin(t + d.ph), d.y - d.v * t, d.z, P);
          fire.add(P, d.size, d.size, amber, 0.8 * smooth(0.2, 1, t) * (0.5 + 0.5 * Math.sin(t * 6 + d.ph)), 0, 0);
        }
        // Grande lueur dorée au moment de la fontaine.
        const u = (s.age - 3700) / 1000;
        if (u > 0 && u < 0.8) fire.add(onWall(s, 0, 0.5, 0.2, P), 1 + 2 * u, 1 + 2 * u, amber, 0.5 * (1 - u / 0.8), 0, 0);
      };
    },
  },

  arcenciel: {
    dur: 5500,
    arm: 'arc',
    look: 'main',
    night: 0.3,
    tint: '#fff1dc',
    build: (k) => {
      const SEGS = 96;
      const tex = k.texture('rainbow');
      const rainbow = (r0: number, r1: number, opacity: number) => {
        const mesh = k.mesh(
          arcGeometry(r0, r1, SEGS),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }),
        );
        mesh.renderOrder = 1;
        return mesh;
      };
      // Arc principal et second arc, plus pâle, aux couleurs inversées.
      const bows = [rainbow(1.0, 1.42, 0.92), rainbow(1.78, 1.56, 0.4)];
      const soft = k.sprites(14, 'soft');
      const fire = k.sprites(80, 'fire');
      const r = k.rand;
      const sparkles = Array.from({ length: 50 }, () => {
        const a = r();
        // Moment où la pointe passe à cet endroit (inverse de la courbe d'avancée).
        const born = 900 + 1600 * (0.5 - Math.sin(Math.asin(1 - 2 * a) / 3));
        return { a, rad: 1.02 + r() * 0.38, born, ph: r(), rate: 0.8 + r(), size: 0.06 + r() * 0.07 };
      });
      const clouds = Array.from({ length: 14 }, (_, i) => ({ end: i < 7 ? 0 : 1, x: (r() - 0.5) * 0.4, y: (r() - 0.3) * 0.2, size: 0.24 + r() * 0.18, ph: r() * 6.3 }));
      const center = new THREE.Vector3();
      const cloud = new THREE.Color('#ffffff');
      const tip = color('#fffbe6');
      const arcPoint = (s: Stage, a: number, rad: number, out: V3) => onWall(s, s.side * Math.cos(a) * rad, -0.8 + Math.sin(a) * rad, 0.1, out);
      return (s) => {
        const p = rainbowAt(s.age);
        // Les arcs sont posés contre le mur, derrière le grimpeur, et se dessinent du côté de la main.
        onWall(s, 0, -0.8, 0.08, center);
        M.makeBasis(s.X, D.crossVectors(s.N, s.X), s.N);
        bows.forEach((bow, i) => {
          bow.position.copy(center).addScaledVector(s.N, i * 0.01);
          bow.quaternion.setFromRotationMatrix(M);
          bow.scale.set(s.side, 1, 1);
          bow.geometry.setDrawRange(0, 6 * Math.round(clamp01(p * 1.05 - i * 0.05) * SEGS));
        });
        // Pointe brillante qui trace l'arc.
        if (p > 0 && p < 1) {
          arcPoint(s, p * Math.PI, 1.21, P);
          fire.add(P, 0.5, 0.5, tip, 0.8, 0, 0);
          fire.add(P, 0.22, 0.22, WHITE, 1, s.age / 200, 2);
        }
        // Paillettes laissées le long de l'arc, qui scintillent.
        for (const g of sparkles) {
          const t = (s.age - g.born) / 1000;
          if (t < 0) continue;
          const ph = (t * g.rate + g.ph) % 1;
          const a = t < 0.5 ? 1 - t / 0.5 : ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI) : 0;
          if (a <= 0) continue;
          arcPoint(s, g.a * Math.PI, g.rad, P);
          fire.add(P, g.size, g.size, tip, a, 0, 2);
        }
        // Petits nuages aux pieds de l'arc, quand la pointe y arrive.
        for (const c of clouds) {
          const t = (s.age - (c.end ? 2500 : 900)) / 1000;
          if (t < 0) continue;
          arcPoint(s, c.end * Math.PI, 1.21, P);
          off(s, P, c.x, c.y + 0.02 * Math.sin(t * 2 + c.ph), 0.12, P);
          const size = c.size * pop(t / 0.4);
          soft.add(P, size, size, cloud, 0.95, c.ph, 2);
        }
      };
    },
  },

  /* ----- Mythiques : un spectacle et un final ----- */

  ascension: {
    dur: 6000,
    arm: 'champion',
    look: 'haut',
    night: 0.75,
    tint: '#ffe2a8',
    build: (k) => {
      const fire = k.sprites(260, 'fire');
      const finale = fireworks(k, [
        { t: 3950, at: [0.1, 0.8, 0.6], colors: MYTHIC_COLORS, kind: 'pivoine', n: 96, speed: 2.3 },
        { t: 4200, at: [-0.85, 0.5, 0.9], colors: ['#ff5ca8', '#ffd6e7'], kind: 'anneau', n: 44, speed: 1.6 },
        { t: 4350, at: [0.9, 0.55, 0.8], colors: ['#4cc9f0', '#e0fbff'], kind: 'double', n: 50, speed: 1.8 },
        { t: 4550, at: [-0.1, 1.0, 0.7], colors: ['#ffc94d', '#ff9f1c'], kind: 'saule', n: 60, speed: 1.4 },
      ]);
      const r = k.rand;
      const motes = Array.from({ length: 46 }, () => ({ x: (r() - 0.5) * 0.7, y: -2.2 + r() * 3.6, z: 0.1 + r() * 0.5, v: 0.08 + r() * 0.15, ph: r(), rate: 0.8 + r() }));
      // Étincelles qui montent en spirale autour du grimpeur.
      const rising = Array.from({ length: 150 }, () => ({
        born: 1000 + r() * 2300,
        a: r() * Math.PI * 2,
        rad: 0.3 + r() * 0.25,
        y: -1.7 + r() * 1.5,
        life: 1 + r() * 0.6,
        w: (r() < 0.5 ? -1 : 1) * (2 + r() * 1.5),
      }));
      const warm = color('#fff0c2');
      const gold = color('#ffc94d');
      const beam = color('#ffe8b0');
      const rocket = new THREE.Vector3();
      const BEAM = 10;
      return (s) => {
        const t = s.age;
        // Rayon de lumière : descend sur le grimpeur, s'intensifie, puis s'éteint après la fusée.
        const reveal = smooth(400, 1100, t);
        const glow = reveal * (1 - smooth(3800, 4400, t)) * (1 + 0.6 * bump(3250, 3450, 3500, 3700, t));
        if (glow > 0) {
          const top = 2.8;
          const bottom = lerp(top, -2.6, reveal);
          // Devant le grimpeur (sinon le halo, face à la caméra, rentre dans le mur de biais), et en
          // tronçons qui se recouvrent (les fondus s'additionnent à 1) pour la même raison en hauteur.
          const len = (top - bottom) / (1 + 0.86 * (BEAM - 1));
          for (let i = 0; i < BEAM; i++) {
            off(s, s.chest, 0, top - len / 2 - i * len * 0.86 - (s.chest.y - s.head.y), 0.3, P);
            fire.add(P, len, 0.34, beam, 0.45 * glow, Math.PI / 2, 5);
            fire.add(P, len, 1.2, gold, 0.3 * glow, Math.PI / 2, 5);
          }
          // Poussières qui flottent dans le rayon.
          for (const m of motes) {
            const ph = ((t / 1000) * m.rate + m.ph) % 1;
            off(s, s.chest, m.x, m.y + m.v * (t / 1000) - (s.chest.y - s.head.y), m.z, P);
            if (P.y > s.head.y + bottom + 0.2) fire.add(P, 0.035, 0.035, warm, glow * (0.4 + 0.6 * Math.sin(ph * Math.PI)), 0, 2);
          }
        }
        // Étincelles qui montent en spirale, de plus en plus vite.
        for (const p of rising) {
          const u = (t - p.born) / 1000;
          if (u < 0 || u > p.life) continue;
          const a = p.a + p.w * u;
          const rad = p.rad * (1 - 0.4 * u);
          const y = p.y + 0.4 * u + 1.1 * u * u;
          off(s, s.chest, Math.cos(a) * rad, y, 0.3 + Math.sin(a) * rad * 0.6, P);
          toward(s, -Math.sin(a) * rad * p.w, 0.4 + 2.2 * u, Math.cos(a) * rad * 0.6 * p.w, V).multiplyScalar(0.06);
          fire.add(P, 0.035, 0.024, u < 0.15 ? WHITE : gold, 1 - smooth(p.life * 0.6, p.life, u), 0, 1, V);
        }
        // Fusée qui part du poing levé vers le bouquet final.
        const u = (t - 3600) / 350;
        if (u >= 0 && u <= 1) {
          at(s, 0.1, 0.8, 0.6, C);
          rocket.lerpVectors(s.hand, C, 1 - (1 - u) ** 2);
          V.subVectors(C, s.hand).multiplyScalar(0.35 * (1 - u));
          fire.add(rocket, 0.08, 0.05, warm, 1, 0, 1, V);
          fire.add(rocket, 0.25, 0.25, gold, 0.6, 0, 0);
        }
        finale(s);
      };
    },
  },

  supernova: {
    dur: 6000,
    arm: 'nova',
    look: 'main',
    night: 0.85,
    tint: '#6a4cff',
    build: (k) => {
      const fire = k.sprites(380, 'fire');
      const r = k.rand;
      const ringTex = k.texture('fire');
      // Anneau de lumière posé dans l'espace (presque à plat), en plus de ceux face à la caméra.
      const disc = k.mesh(
        frameQuad(4, 8),
        new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false }),
      );
      disc.renderOrder = 3;
      const discMat = disc.material as THREE.MeshBasicMaterial;
      const cols = MYTHIC_COLORS.map(color);
      const cold = ['#8ec5ff', '#b197fc', '#ffffff', '#74c0fc'].map(color);
      // Implosion : la lumière est aspirée vers le cœur en tourbillonnant.
      const inward = Array.from({ length: 150 }, () => ({ d: front(randomDir(r)), r0: 1.4 + r() * 0.7, arrive: 800 + r() * 1150, spin: (r() < 0.5 ? -1 : 1) * (1.5 + r() * 1.5), c: cold[Math.floor(r() * cold.length)] }));
      // Explosion : des étoiles de toutes les couleurs et des traits de lumière blanche.
      const stars = Array.from({ length: 180 }, (_, j) => {
        const d = front(randomDir(r));
        return { d, v: 2.2 + r() * 1.6, life: 2.2 + r() * 1.2, c: cols[j % cols.length], rot: r() * 6.3, spin: (r() - 0.5) * 6, size: 0.06 + r() * 0.05, tw: r() * 6.3 };
      });
      const streaks = Array.from({ length: 90 }, () => ({ d: front(randomDir(r)), v: 3 + r() * 2.5, life: 0.7 + r() * 0.4 }));
      // Petites gerbes qui éclatent ensuite sur la coquille.
      const pops = Array.from({ length: 6 }, (_, i) => ({ t: 2500 + i * 170 + r() * 80, d: randomDir(r), dist: 0.9 + r() * 0.6, c: cols[(i * 3) % cols.length], dirs: Array.from({ length: 8 }, () => randomDir(r)) }));
      const core = new THREE.Vector3();
      const violet = color('#9775fa');
      const ice = color('#d0bfff');
      return (s) => {
        const t = s.age;
        at(s, s.side * 0.25, 0.1, 0.55, core);
        const boom = (t - NOVA) / 1000;
        if (boom < 0) {
          // Cœur qui grossit et palpite, puis se tasse juste avant l'explosion.
          const grow = smooth(400, 1800, t) * (1 - 0.7 * smooth(1850, NOVA, t));
          const beat = 1 + 0.15 * Math.sin(t / 45);
          fire.add(core, (0.15 + 0.5 * grow) * beat, (0.15 + 0.5 * grow) * beat, violet, 0.9 * smooth(200, 600, t), 0, 0);
          fire.add(core, 0.35 * grow + 0.08, 0.35 * grow + 0.08, WHITE, smooth(300, 800, t), t / 300, 2);
          for (const p of inward) {
            const u = (t - (p.arrive - 900)) / 900;
            if (u < 0 || u >= 1) continue;
            const rad = p.r0 * (1 - u ** 2.2);
            const a = p.spin * u * u;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            toward(s, p.d[0] * ca - p.d[2] * sa, p.d[1], p.d[0] * sa + p.d[2] * ca, D);
            P.copy(core).addScaledVector(D, rad);
            V.subVectors(core, P).multiplyScalar(-0.12 * (0.3 + u));
            fire.add(P, 0.04, 0.03, p.c, smooth(0, 0.2, u), 0, 1, V);
          }
          // Anneaux qui se resserrent sur le cœur.
          for (const t0 of [900, 1450]) {
            const u = (t - t0) / 450;
            if (u < 0 || u > 1) continue;
            const size = lerp(2.4, 0.2, u * u);
            fire.add(core, size, size, ice, 0.6 * Math.sin(u * Math.PI), 0, 4);
          }
          disc.visible = false;
          return;
        }
        // Explosion : éclair de lumière, boule qui enfle, ondes et étoiles.
        if (boom < 0.6) {
          s.flash = 1.6 * (1 - boom / 0.6) ** 2;
          s.flashColor.set('#e5dbff');
        }
        if (boom < 0.5) {
          const size = 0.3 + 2.8 * Math.sqrt(boom / 0.5);
          fire.add(core, size, size, WHITE, (1 - boom / 0.5) ** 1.5, 0, 0);
        }
        fire.add(core, 1.2, 1.2, violet, 0.35 * (1 - smooth(0.3, 2.5, boom)), 0, 0);
        for (const [delay, grow, c] of [
          [0, 3.4, WHITE],
          [0.14, 2.6, violet],
          [0.3, 1.9, ice],
        ] as const) {
          const u = (boom - delay) / 1.1;
          if (u < 0 || u > 1) continue;
          const size = 0.2 + grow * (1 - (1 - u) ** 2.5);
          fire.add(core, size, size, c, 0.9 * (1 - u) ** 1.4, 0, 4);
        }
        const du = boom / 1.3;
        disc.visible = du < 1;
        if (du < 1) {
          disc.position.copy(core);
          M.makeBasis(s.X, D.copy(s.N).multiplyScalar(-1).addScaledVector(s.U, 0.35).normalize(), V.copy(s.U).addScaledVector(s.N, 0.35).normalize());
          disc.quaternion.setFromRotationMatrix(M);
          disc.scale.setScalar(0.3 + 4 * (1 - (1 - du) ** 2.5));
          discMat.color.copy(violet).lerp(WHITE, 1 - du);
          discMat.opacity = (1 - du) ** 1.3 * s.fade;
        }
        for (const p of stars) {
          if (boom > p.life) continue;
          toward(s, p.d[0], p.d[1], p.d[2], D);
          P.copy(core).addScaledVector(D, glide(p.v, 2, boom)).addScaledVector(s.U, -fall(0.5, 1, boom));
          // Les couleurs défilent doucement, les étoiles scintillent en s'éteignant.
          COL.copy(p.c).lerp(WHITE, 1 - smooth(0, 0.3, boom));
          const tw = boom > p.life * 0.45 ? 0.5 + 0.5 * Math.sin(boom * 30 + p.tw) : 1;
          const size = p.size * (0.7 + 0.3 * Math.sin(boom * 9 + p.tw));
          fire.add(P, size, size, COL, (1 - smooth(p.life * 0.5, p.life, boom)) * tw, p.rot + p.spin * boom, 3);
        }
        for (const p of streaks) {
          if (boom > p.life) continue;
          toward(s, p.d[0], p.d[1], p.d[2], D);
          P.copy(core).addScaledVector(D, glide(p.v, 3.2, boom));
          V.copy(D).multiplyScalar(p.v * Math.exp(-3.2 * boom) * 0.08);
          fire.add(P, 0.05, 0.03, WHITE, 1 - boom / p.life, 0, 1, V);
        }
        for (const p of pops) {
          const u = (t - p.t) / 1000;
          if (u < 0 || u > 0.7) continue;
          toward(s, p.d[0], p.d[1], p.d[2], D);
          C.copy(core).addScaledVector(D, p.dist);
          fire.add(C, 0.45 * (1 - u / 0.7), 0.45 * (1 - u / 0.7), p.c, 0.8, 0, 0);
          for (const d of p.dirs) {
            toward(s, d[0], d[1], d[2], D);
            P.copy(C).addScaledVector(D, glide(1.2, 3, u));
            fire.add(P, 0.05, 0.05, p.c, 1 - u / 0.7, u * 4, 7);
          }
        }
      };
    },
  },
};

/* ---------- Pour la scène ---------- */

/**
 * Main qui lâche la prise au top : celle qui n'est pas sur la dernière prise ; si les deux y sont,
 * celle du côté de la caméra (la plus visible).
 */
export function freeHand(c: Contacts, top: Pt, yaw: number): 0 | 1 {
  const dl = Math.hypot(c.lh.x - top.x, c.lh.y - top.y);
  const dr = Math.hypot(c.rh.x - top.x, c.rh.y - top.y);
  if (Math.abs(dl - dr) < 0.12) return yaw >= 0 ? 1 : 0;
  return dl > dr ? 0 : 1;
}

/** Ambiance de la salle pendant la fête : lumières baissées, teinte et éclairs de lumière. */
export type Mood = { night: number; tint: THREE.Color; flash: number; flashColor: THREE.Color };

/** Célébrations dans la scène `scene` ; une seule choisie à la fois (ou aucune). */
export function createCelebrations(scene: THREE.Object3D) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  let def: Def | null = null;
  let kit: Kit | null = null;
  let fx: Fx | null = null;
  const v = () => new THREE.Vector3();
  const stage: Stage = {
    age: 0,
    fade: 1,
    h: 1.8,
    head: v(),
    chest: v(),
    pelvis: v(),
    hand: v(),
    bag: v(),
    side: 1,
    X: new THREE.Vector3(1, 0, 0),
    U: new THREE.Vector3(0, 1, 0),
    N: v(),
    depth: 0,
    right: v(),
    up: v(),
    toCam: v(),
    flash: 0,
    flashColor: new THREE.Color(),
  };
  const mood: Mood = { night: 0, tint: new THREE.Color(), flash: 0, flashColor: new THREE.Color() };
  const look = v();

  /** Ouverture du sac à magnésie (comme dans le grimpeur : dans le dos, à la ceinture), repère du mur. */
  const bagOf = (b: Body3, h: number, out: V3) => {
    const y = T1.subVectors(b.chest, b.pelvis).normalize();
    const z = T2.set(0, 0, 1).addScaledVector(y, -y.z).normalize();
    return out.copy(b.pelvis).addScaledVector(z, 0.072 * h).addScaledVector(y, 0.043 * h);
  };

  /** Change de célébration (null : aucune) ; libère tout ce que la précédente avait créé. */
  const set = (id: CelebrationId | null) => {
    kit?.dispose();
    kit = null;
    fx = null;
    def = id ? DEFS[id] : null;
    root.visible = false;
    if (!def || !id) return;
    let seed = 7;
    for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483646;
    kit = makeKit(root, seed + 1);
    fx = def.build(kit);
  };

  /**
   * Geste à `age` ms de l'arrivée : le bras `free` de `b` (repère du mur, modifié sur place) quitte sa
   * prise, fait le geste puis y revient. `up` : la verticale et `cam` : la caméra, dans le repère du
   * mur. Renvoie ce qu'il faut passer au grimpeur, ou null hors de la fête.
   */
  const pose = (age: number, b: Body3, free: 0 | 1, h: number, types: HandTypes, up: V3, cam: V3): CelebrationPose | null => {
    if (!def || age < 0) return null;
    const w = smooth(200, 750, age) * (1 - smooth(def.dur - 1100, def.dur - 350, age));
    if (w <= 0) return null;
    const a = b.arms[free];
    const side = free ? 1 : -1;
    arm.S.copy(a.shoulder);
    arm.L1 = a.shoulder.distanceTo(a.elbow);
    arm.L2 = a.elbow.distanceTo(a.hand);
    arm.h = h;
    arm.X.set(side, 0, 0);
    // « En haut » : la verticale, mais toujours un peu décollée du mur (en dévers, vers la salle).
    arm.U.set(0, up.y, Math.max(up.z, 0.12 + 0.75 * Math.max(0, -up.z))).normalize();
    bagOf(b, h, arm.bag);
    arm.down.subVectors(b.pelvis, b.chest).normalize();
    const fist = armGoal(def.arm, age, Wg, Pg, Fg);

    // Trajet depuis la prise : en arc, en s'écartant du mur.
    const grip = a.hand.distanceTo(a.grip);
    W0.copy(a.hand);
    FING.subVectors(a.grip, a.hand).normalize();
    POLE.subVectors(a.elbow, a.shoulder);
    T2.subVectors(W0, a.shoulder).normalize();
    POLE.addScaledVector(T2, -POLE.dot(T2));
    const span = W0.distanceTo(Wg);
    MID.addVectors(W0, Wg).multiplyScalar(0.5).addScaledVector(arm.O, 0.35 * span).addScaledVector(arm.X, 0.2 * span);
    // Bézier : départ (prise), point de passage, arrivée (geste).
    const k = w;
    P.copy(W0).multiplyScalar((1 - k) ** 2).addScaledVector(MID, 2 * k * (1 - k)).addScaledVector(Wg, k * k);
    POLE.normalize().lerp(Pg.normalize(), k);
    reach(a.shoulder, P, arm.L1, arm.L2, POLE, a.elbow, a.hand);
    // Jamais dans le mur.
    const zMin = 0.035 * h;
    if (a.elbow.z < zMin) a.elbow.z = zMin;
    if (a.hand.z < zMin) a.hand.z = zMin;
    // Doigts : dans le prolongement de l'avant-bras (un peu vers le haut), ou la direction du geste.
    if (Fg.lengthSq() > 0) T2.copy(Fg).normalize();
    else T2.subVectors(a.hand, a.elbow).normalize().addScaledVector(arm.U, 0.3).normalize();
    FING.lerp(T2, k).normalize();
    a.grip.copy(a.hand).addScaledVector(FING, grip);

    const limb = free ? 'rh' : 'lh';
    const away = w > 0.3;
    result.fists[0] = result.fists[1] = false;
    result.fists[free] = fist && away;
    // Main ouverte : on la fait tenir « à plat » (doigts presque tendus).
    result.types = types;
    if (away) {
      TYPES.lh = types.lh;
      TYPES.rh = types.rh;
      TYPES.lf = types.lf;
      TYPES.rf = types.rf;
      TYPES[limb] = 'plat';
      result.types = TYPES;
    }
    // Regard : du mur vers la caméra, le ciel ou la main, sans à-coup.
    const head = b.head;
    if (def.look === 'camera') {
      // Le cou ne tourne pas assez pour la regarder en face : on tourne la tête au plus loin vers elle.
      T1.subVectors(cam, head).normalize();
      T2.copy(T1).addScaledVector(arm.O, -T1.dot(arm.O));
      if (T2.lengthSq() < 1e-6) T2.set(side, 0, 0);
      T2.normalize();
      look.copy(arm.O).multiplyScalar(0.64).addScaledVector(T2, 0.77);
    } else if (def.look === 'haut') look.copy(arm.U).addScaledVector(arm.O, 0.35);
    else look.subVectors(a.grip, head);
    if (def.arm === 'danse') look.addScaledVector(arm.U, 0.25 * Math.sin((age / 450) * Math.PI));
    look.normalize().lerp(T1.set(0, 0, -1), 1 - w).normalize();
    result.look.copy(head).add(look);
    return result;
  };

  /**
   * Effets à `age` ms de l'arrivée (après le placement de la caméra : les particules lui font face).
   * `b` : le grimpeur (repère du mur `tilt`). Renvoie l'ambiance de la salle, ou null hors de la fête.
   */
  const frame = (age: number, b: Body3, free: 0 | 1, h: number, tilt: THREE.Object3D, camera: THREE.Camera): Mood | null => {
    if (!def || !kit || !fx || age < 0 || age > def.dur) {
      root.visible = false;
      return null;
    }
    root.visible = true;
    const s = stage;
    s.age = age;
    s.fade = 1 - smooth(def.dur - 900, def.dur - 100, age);
    s.h = h;
    s.side = free ? 1 : -1;
    tilt.localToWorld(s.head.copy(b.head));
    tilt.localToWorld(s.chest.copy(b.chest));
    tilt.localToWorld(s.pelvis.copy(b.pelvis));
    tilt.localToWorld(s.hand.copy(b.arms[free].grip));
    tilt.localToWorld(bagOf(b, h, s.bag));
    s.N.set(0, 0, 1).applyQuaternion(tilt.quaternion);
    s.depth = s.head.dot(s.N);
    s.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    s.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    s.toCam.subVectors(camera.position, s.head).normalize();
    s.flash = 0;
    kit.begin(s.fade);
    fx(s);
    kit.end();
    mood.night = (def.night ?? 0) * bump(0, 600, def.dur - 1300, def.dur - 300, age);
    mood.tint.set(def.tint ?? '#ffffff');
    mood.flash = s.flash * s.fade;
    mood.flashColor.copy(s.flashColor);
    return mood;
  };

  return {
    set,
    pose,
    frame,
    dispose: () => {
      kit?.dispose();
      scene.remove(root);
    },
  };
}
