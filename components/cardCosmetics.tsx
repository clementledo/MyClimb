/**
 * Contours et fonds de la carte joueur, dessinés en SVG dans le repère de la carte (100 × 142).
 * Les contours suivent le bord du bouclier ; les fonds passent derrière le grimpeur et s'effacent
 * avant le nom et les stats (et autour de la note) pour que la carte reste lisible.
 * Les objets mythiques sont animés : leur dessin dépend du temps `t` (en secondes).
 */
import type { ReactNode } from 'react';
import { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Mask, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { BackdropId, FrameId } from '@/lib/cosmetics';

/** Silhouette de la carte, un bouclier, dans un repère de 100 × 142. */
export const SHAPE = 'M14 2H86L98 14V108C98 118 92 124 84 128L52.5 141C50.9 141.7 49.1 141.7 47.5 141L16 128C8 124 2 118 2 108V14Z';

export type Look = { top: string; bottom: string; shine: string; text: string; line: string };
/** Ce que reçoit chaque dessin : couleurs de la carte, identifiants SVG uniques, temps (animés). */
export type Ctx = { c: Look; id: (k: string) => string; t: number };
type Art = (x: Ctx) => ReactNode;

/** Objets animés (mythiques) : à redessiner en continu. */
export const ANIMATED_FRAMES = new Set<FrameId>(['comete', 'prisme', 'lave', 'aurore']);
export const ANIMATED_BACKDROPS = new Set<BackdropId>(['aurore', 'filantes', 'code']);

/* ---------- Outils ---------- */

type V = [number, number];
const f2 = (n: number) => n.toFixed(2);
const cubic = (a: V, b: V, c: V, d: V, t: number): V => {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
};

/** Le bord du bouclier en points serrés, dans le sens des aiguilles d'une montre depuis le haut à gauche. */
const DENSE: V[] = (() => {
  const pts: V[] = [];
  const line = (a: V, b: V) => {
    for (let i = 0; i < 40; i++) pts.push([a[0] + ((b[0] - a[0]) * i) / 40, a[1] + ((b[1] - a[1]) * i) / 40]);
  };
  const curve = (a: V, b: V, c: V, d: V) => {
    for (let i = 0; i < 40; i++) pts.push(cubic(a, b, c, d, i / 40));
  };
  line([14, 2], [86, 2]);
  line([86, 2], [98, 14]);
  line([98, 14], [98, 108]);
  curve([98, 108], [98, 118], [92, 124], [84, 128]);
  line([84, 128], [52.5, 141]);
  curve([52.5, 141], [50.9, 141.7], [49.1, 141.7], [47.5, 141]);
  line([47.5, 141], [16, 128]);
  curve([16, 128], [8, 124], [2, 118], [2, 108]);
  line([2, 108], [2, 14]);
  line([2, 14], [14, 2]);
  return pts;
})();
const SEG = DENSE.map((p, i) => Math.hypot(DENSE[(i + 1) % DENSE.length][0] - p[0], DENSE[(i + 1) % DENSE.length][1] - p[1]));
const PERIMETER = SEG.reduce((a, b) => a + b, 0);

/** Point du bord : position, direction vers l'intérieur (nx, ny), angle de la tangente (degrés), `t` de 0 à 1. */
type Pt = { x: number; y: number; nx: number; ny: number; a: number; t: number };

/** Le point du bord à la fraction `t` du tour, rentré de `inset`. */
function at(t: number, inset = 0): Pt {
  let d = (((t % 1) + 1) % 1) * PERIMETER;
  let i = 0;
  while (i < SEG.length - 1 && d > SEG[i]) d -= SEG[i++];
  const p = DENSE[i];
  const q = DENSE[(i + 1) % DENSE.length];
  const k = SEG[i] ? d / SEG[i] : 0;
  const tx = (q[0] - p[0]) / (SEG[i] || 1);
  const ty = (q[1] - p[1]) / (SEG[i] || 1);
  // Vers l'intérieur : à droite du sens de parcours (l'axe y descend).
  const nx = -ty;
  const ny = tx;
  return { x: p[0] + (q[0] - p[0]) * k + nx * inset, y: p[1] + (q[1] - p[1]) * k + ny * inset, nx, ny, a: (Math.atan2(ty, tx) * 180) / Math.PI, t };
}

/** Points du bord tous les `step` (en unités de carte), rentrés de `inset`. */
function rim(step: number, inset = 0, phase = 0): Pt[] {
  const n = Math.max(1, Math.round(PERIMETER / step));
  return Array.from({ length: n }, (_, i) => at((i + phase) / n, inset));
}

const polyline = (pts: { x: number; y: number }[], close = true) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${f2(p.x)} ${f2(p.y)}`).join('') + (close ? 'Z' : '');

const rimCache = new Map<number, string>();
/** Le bord rentré de `inset`, en chemin SVG fermé. */
function rimPath(inset: number) {
  let d = rimCache.get(inset);
  if (!d) {
    d = polyline(rim(0.8, inset));
    rimCache.set(inset, d);
  }
  return d;
}

/** Le bord rentré d'une distance qui varie le long du tour (vagues, lianes…). */
const wavyRim = (inset: (t: number) => number, step = 0.8) => polyline(rim(step).map((p) => at(p.t, inset(p.t))));

/** Le bord coupé en `n` morceaux, pour colorer chacun à part (contours animés). */
function rimPieces(n: number, inset: number) {
  return Array.from({ length: n }, (_, i) => {
    const pts = Array.from({ length: 5 }, (_, k) => at((i + k / 4) / n, inset));
    return { d: polyline(pts, false), t: i / n };
  });
}

/** Hasard reproductible : la même carte se dessine toujours pareil. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Couleur depuis teinte (0–1), saturation et luminosité. */
export function hsl(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + (((h % 1) + 1) % 1) * 12) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Mélange de deux couleurs #rrggbb. */
export function mix(a: string, b: string, k: number) {
  const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(p(a, i) + (p(b, i) - p(a, i)) * k)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Couleur dans une suite de couleurs, `k` de 0 à 1. */
function ramp(colors: string[], k: number) {
  const x = Math.max(0, Math.min(0.9999, k)) * (colors.length - 1);
  const i = Math.floor(x);
  return mix(colors[i], colors[i + 1], x - i);
}

/** Petite étoile à quatre branches. */
const star = (x: number, y: number, r: number) =>
  `M${f2(x)} ${f2(y - r)}Q${f2(x)} ${f2(y)} ${f2(x + r)} ${f2(y)}Q${f2(x)} ${f2(y)} ${f2(x)} ${f2(y + r)}Q${f2(x)} ${f2(y)} ${f2(x - r)} ${f2(y)}Q${f2(x)} ${f2(y)} ${f2(x)} ${f2(y - r)}Z`;

/** Prise d'escalade : une forme ronde un peu irrégulière. */
function hold(x: number, y: number, r: number, rnd: () => number) {
  const k = 7;
  const pts = Array.from({ length: k }, (_, i) => {
    const a = (i / k) * Math.PI * 2;
    const rr = r * (0.75 + rnd() * 0.45);
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8];
  });
  const mid = (i: number) => {
    const a = pts[i % k];
    const b = pts[(i + 1) % k];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  let d = `M${f2(mid(0)[0])} ${f2(mid(0)[1])}`;
  for (let i = 1; i <= k; i++) {
    const p = pts[i % k];
    const m = mid(i);
    d += `Q${f2(p[0])} ${f2(p[1])} ${f2(m[0])} ${f2(m[1])}`;
  }
  return d + 'Z';
}

/** Flocon à six branches. */
function flake(x: number, y: number, r: number) {
  let d = '';
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3;
    d += `M${f2(x - Math.cos(a) * r)} ${f2(y - Math.sin(a) * r)}L${f2(x + Math.cos(a) * r)} ${f2(y + Math.sin(a) * r)}`;
  }
  return d;
}

/** Feuille en amande, pointe vers `angle` (degrés). */
const leaf = (x: number, y: number, len: number, w: number, angle: number) => {
  const a = (angle * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const tip = [x + ux * len, y + uy * len];
  const c1 = [x + ux * len * 0.5 - uy * w, y + uy * len * 0.5 + ux * w];
  const c2 = [x + ux * len * 0.5 + uy * w, y + uy * len * 0.5 - ux * w];
  return `M${f2(x)} ${f2(y)}Q${f2(c1[0])} ${f2(c1[1])} ${f2(tip[0])} ${f2(tip[1])}Q${f2(c2[0])} ${f2(c2[1])} ${f2(x)} ${f2(y)}Z`;
};

/** Trait lumineux : plusieurs épaisseurs de plus en plus transparentes. */
function glow(d: string, color: string, width: number, key: string, strength = 1) {
  return [
    <Path key={`${key}3`} d={d} fill="none" stroke={color} strokeWidth={width * 4} opacity={0.07 * strength} />,
    <Path key={`${key}2`} d={d} fill="none" stroke={color} strokeWidth={width * 2.2} opacity={0.18 * strength} />,
    <Path key={`${key}1`} d={d} fill="none" stroke={color} strokeWidth={width} />,
  ];
}

/** Dégradé diagonal. */
const diag = (id: string, colors: string[]) => (
  <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
    {colors.map((col, i) => (
      <Stop key={i} offset={String(i / (colors.length - 1))} stopColor={col} />
    ))}
  </LinearGradient>
);

/** Dégradé vertical (haut → bas). */
const vert = (id: string, colors: string[], opacities?: number[]) => (
  <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    {colors.map((col, i) => (
      <Stop key={i} offset={String(i / (colors.length - 1))} stopColor={col} stopOpacity={opacities?.[i] ?? 1} />
    ))}
  </LinearGradient>
);

/* ---------- Contours ---------- */

const rope =
  (a: string, b: string): Art =>
  () => {
    const d = rimPath(2.2);
    return (
      <G>
        <Path d={d} fill="none" stroke={a} strokeWidth={2.8} />
        <Path d={d} fill="none" stroke={b} strokeWidth={2.8} strokeDasharray="1.4 1.4" />
        <Path d={d} fill="none" stroke="#FFFFFF" strokeWidth={0.5} strokeDasharray="0.5 2.3" strokeDashoffset={0.4} opacity={0.8} />
        <Path d={rimPath(0.6)} fill="none" stroke="#00000033" strokeWidth={0.3} />
      </G>
    );
  };

const neon =
  (outer: string, outerCore: string, inner: string, innerCore: string): Art =>
  () => (
    <G>
      {glow(rimPath(2), outer, 1.4, 'o')}
      <Path d={rimPath(2)} fill="none" stroke={outerCore} strokeWidth={0.6} />
      {glow(rimPath(4.8), inner, 0.8, 'i', 0.8)}
      <Path d={rimPath(4.8)} fill="none" stroke={innerCore} strokeWidth={0.35} />
    </G>
  );

const pixels =
  (main: string, accent: string): Art =>
  ({ c }) => (
    <G>
      {rim(3.1, 1.9).map((p, i) => (
        <Rect key={`a${i}`} x={p.x - 1.4} y={p.y - 1.4} width={2.8} height={2.8} fill={i % 7 === 0 ? accent : main} />
      ))}
      {rim(6.2, 4.6).map((p, i) => (
        <Rect key={`b${i}`} x={p.x - 1} y={p.y - 1} width={2} height={2} fill={c.line} opacity={0.7} />
      ))}
    </G>
  );

/** Métal poli : bande en dégradé, ligne gravée et rivets. */
const metal =
  (colors: string[], engrave: string, rivet: string, gem?: [string, string, string]): Art =>
  ({ id }) => (
    <G>
      <Defs>
        {diag(id('metal'), colors)}
        {gem && (
          <RadialGradient id={id('gem')} cx="0.35" cy="0.35" r="0.7">
            {gem.map((col, i) => (
              <Stop key={i} offset={String(i / 2)} stopColor={col} />
            ))}
          </RadialGradient>
        )}
      </Defs>
      <Path d={rimPath(2)} fill="none" stroke={`url(#${id('metal')})`} strokeWidth={3.6} />
      <Path d={rimPath(4.3)} fill="none" stroke={engrave} strokeWidth={0.4} />
      <Path d={rimPath(0.4)} fill="none" stroke={engrave} strokeWidth={0.3} opacity={0.7} />
      {rim(12, 2).map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={0.7} fill={rivet} stroke={engrave} strokeWidth={0.25} />
      ))}
      {gem &&
        [
          [8.5, 8.5],
          [91.5, 8.5],
        ].map(([x, y], i) => (
          <G key={`g${i}`}>
            <Circle cx={x} cy={y} r={2.7} fill={engrave} />
            <Circle cx={x} cy={y} r={2.1} fill={`url(#${id('gem')})`} />
            <Circle cx={x - 0.6} cy={y - 0.7} r={0.5} fill="#FFFFFF" opacity={0.9} />
          </G>
        ))}
    </G>
  );

/** Cristal taillé : bande en dégradé, facettes aux coins et éclats. */
const crystal =
  (band: string[], facets: [string, string, string], seed: number): Art =>
  ({ id }) => {
    const rnd = seeded(seed);
    const facet = (x: number, y: number, s: number, flip: number) => (
      <G>
        <Polygon points={`${x},${y} ${x + s * flip},${y} ${x},${y + s}`} fill={facets[0]} />
        <Polygon points={`${x + s * flip},${y} ${x},${y + s} ${x + s * 0.55 * flip},${y + s * 0.55}`} fill={facets[1]} />
        <Polygon points={`${x},${y} ${x + s * 0.55 * flip},${y + s * 0.55} ${x},${y + s}`} fill={facets[2]} />
      </G>
    );
    return (
      <G>
        <Defs>{diag(id('crystal'), band)}</Defs>
        <Path d={rimPath(1.9)} fill="none" stroke={`url(#${id('crystal')})`} strokeWidth={3.4} />
        <Path d={rimPath(3.9)} fill="none" stroke="#FFFFFF" strokeWidth={0.35} opacity={0.7} />
        {facet(4, 4, 9, 1)}
        {facet(96, 4, 9, -1)}
        {rim(9, 2).map((p, i) => (
          <Path key={i} d={star(p.x, p.y, 1 + rnd() * 1.2)} fill="#FFFFFF" opacity={0.9} />
        ))}
      </G>
    );
  };

/** Éclairs qui courent le long des côtés. */
const bolts =
  (band: string, core: string, haloColor: string, seed: number): Art =>
  () => {
    const rnd = seeded(seed);
    const bolt = (x: number, dir: number) => {
      let d = `M${x} 18`;
      for (let y = 18; y < 104; y += 5) d += `L${f2(x + dir * (rnd() * 3.5))} ${y + 5}`;
      return d;
    };
    return (
      <G>
        <Path d={rimPath(1.6)} fill="none" stroke={band} strokeWidth={2.6} />
        {[bolt(5.2, 1), bolt(94.8, -1)].map((d, i) => (
          <G key={i}>
            <Path d={d} fill="none" stroke={haloColor} strokeWidth={3} opacity={0.3} strokeLinejoin="round" />
            <Path d={d} fill="none" stroke={core} strokeWidth={0.9} strokeLinejoin="round" />
          </G>
        ))}
        <Path d={rimPath(1.6)} fill="none" stroke={haloColor} strokeWidth={0.5} strokeDasharray="6 3" />
      </G>
    );
  };

/** Flammes qui lèchent le bord. */
const flames =
  (base: string[], tongues: [string, string], seed: number): Art =>
  ({ id }) => {
    const rnd = seeded(seed);
    return (
      <G>
        <Defs>
          <LinearGradient id={id('fire')} x1="0" y1="1" x2="0" y2="0">
            {base.map((col, i) => (
              <Stop key={i} offset={String(i / (base.length - 1))} stopColor={col} />
            ))}
          </LinearGradient>
        </Defs>
        {rim(3.3, 1.2).map((p, i) => {
          const h = 3 + rnd() * 3.2;
          const w = 1.9;
          const tx = p.x + p.nx * h + -p.ny * (rnd() - 0.5) * 1.2;
          const ty = p.y + p.ny * h + p.nx * (rnd() - 0.5) * 1.2;
          const mx = p.x + p.nx * h * 0.45;
          const my = p.y + p.ny * h * 0.45;
          return (
            <Path
              key={i}
              d={`M${f2(p.x + p.ny * w)} ${f2(p.y - p.nx * w)}Q${f2(mx)} ${f2(my)} ${f2(tx)} ${f2(ty)}Q${f2(mx)} ${f2(my)} ${f2(p.x - p.ny * w)} ${f2(p.y + p.nx * w)}Z`}
              fill={tongues[i % 2]}
              opacity={0.9}
            />
          );
        })}
        <Path d={rimPath(1.5)} fill="none" stroke={`url(#${id('fire')})`} strokeWidth={2.8} />
      </G>
    );
  };

export const FRAME_ART: Record<FrameId, Art> = {
  corde: rope('#E8590C', '#1971C2'),
  'corde-fluo': rope('#82C91E', '#FCC419'),
  // Prises de toutes les couleurs vissées sur le bord.
  prises: () => {
    const rnd = seeded(5);
    const colors = ['#E03131', '#2F9E44', '#1C7ED6', '#F59F00', '#AE3EC9', '#F76707', '#0CA678', '#E64980'];
    return (
      <G>
        {rim(7.2, 3.2).map((p, i) => (
          <G key={i}>
            <Path d={hold(p.x, p.y, 2.3 + rnd() * 0.9, rnd)} fill={colors[i % colors.length]} stroke="#00000040" strokeWidth={0.25} />
            <Circle cx={p.x} cy={p.y} r={0.45} fill="#00000066" />
          </G>
        ))}
      </G>
    );
  },
  pixel: pixels('#212529', '#40C057'),
  // Traces de magnésie et de doigts blancs.
  magnesie: () => {
    const rnd = seeded(9);
    return (
      <G>
        {rim(4.5, 2.5).map((p, i) => (
          <Ellipse
            key={i}
            cx={p.x + (rnd() - 0.5) * 2}
            cy={p.y + (rnd() - 0.5) * 2}
            rx={1.6 + rnd() * 2.4}
            ry={1 + rnd() * 1.4}
            fill="#FFFFFF"
            opacity={0.35 + rnd() * 0.35}
            transform={`rotate(${Math.round(rnd() * 180)} ${f2(p.x)} ${f2(p.y)})`}
          />
        ))}
        {[
          [9, 30, -12],
          [86, 92, 10],
        ].map(([x, y, a], k) => (
          <G key={k} transform={`rotate(${a} ${x} ${y})`} opacity={0.75}>
            {[0, 1.6, 3.2, 4.8].map((dx) => (
              <Path key={dx} d={`M${x + dx} ${y}l0.4 9`} stroke="#FFFFFF" strokeWidth={1.1} strokeLinecap="round" />
            ))}
          </G>
        ))}
      </G>
    );
  },
  // Strap blanc enroulé autour de la carte.
  strap: () => {
    const rnd = seeded(31);
    return (
      <G>
        <Path d={rimPath(2.4)} fill="none" stroke="#F8F9FA" strokeWidth={3.8} />
        <Path d={rimPath(2.4)} fill="none" stroke="#DEE2E6" strokeWidth={3.8} strokeDasharray="0.35 2.4" />
        <Path d={rimPath(0.55)} fill="none" stroke="#ADB5BD" strokeWidth={0.3} />
        <Path d={rimPath(4.25)} fill="none" stroke="#ADB5BD" strokeWidth={0.3} />
        {rim(21, 2.4).map((p, i) => (
          <Ellipse key={i} cx={p.x} cy={p.y} rx={1.2 + rnd()} ry={0.7} fill="#CED4DA" opacity={0.6} transform={`rotate(${f2(p.a)} ${f2(p.x)} ${f2(p.y)})`} />
        ))}
        <Path d="M10 4.5l-3 -3.2M90 4.5l3 -3.2" stroke="#F8F9FA" strokeWidth={2} strokeLinecap="round" />
      </G>
    );
  },
  pointilles: ({ c }) => (
    <G>
      {rim(2.6, 2.2).map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={0.65} fill={c.line} opacity={0.85} />
      ))}
      {[
        [9, 9],
        [91, 9],
        [9, 105],
        [91, 105],
      ].map(([x, y], i) => (
        <Path key={`s${i}`} d={star(x, y, 2.2)} fill={c.line} />
      ))}
    </G>
  ),
  // Damier noir et blanc, comme un drapeau d'arrivée.
  damier: () => (
    <G>
      {[1.2, 3.5].map((inset, row) =>
        rim(2.3, inset).map((p, i) => (
          <Rect
            key={`${row}-${i}`}
            x={p.x - 1.2}
            y={p.y - 1.2}
            width={2.4}
            height={2.4}
            fill={(i + row) % 2 ? '#F8F9FA' : '#212529'}
            transform={`rotate(${f2(p.a)} ${f2(p.x)} ${f2(p.y)})`}
          />
        )),
      )}
    </G>
  ),
  // Bois de poutre : veinures, nœuds et vis.
  bois: () => {
    const rnd = seeded(37);
    return (
      <G>
        <Path d={rimPath(2.4)} fill="none" stroke="#B07D4B" strokeWidth={4.4} />
        {[1.3, 2.3, 3.4].map((k, j) => (
          <Path
            key={j}
            d={wavyRim((t) => k + 0.35 * Math.sin(t * 90 + j * 2))}
            fill="none"
            stroke="#8C5E34"
            strokeWidth={0.28}
            strokeDasharray={`${6 + j * 2} 2 ${10 - j} 3`}
            opacity={0.75}
          />
        ))}
        {rim(27, 2.4).map((p, i) => (
          <Ellipse key={i} cx={p.x} cy={p.y} rx={1.3 + rnd() * 0.6} ry={0.7} fill="#7F5530" opacity={0.8} transform={`rotate(${f2(p.a)} ${f2(p.x)} ${f2(p.y)})`} />
        ))}
        <Path d={rimPath(0.25)} fill="none" stroke="#7F5530" strokeWidth={0.5} />
        <Path d={rimPath(4.6)} fill="none" stroke="#7F5530" strokeWidth={0.5} />
        {[
          [9.5, 9.5],
          [90.5, 9.5],
          [7, 104],
          [93, 104],
        ].map(([x, y], i) => (
          <G key={`v${i}`}>
            <Circle cx={x} cy={y} r={1.2} fill="#CED4DA" stroke="#868E96" strokeWidth={0.3} />
            <Path d={`M${x - 0.8} ${y}h1.6`} stroke="#495057" strokeWidth={0.35} transform={`rotate(${30 + i * 40} ${x} ${y})`} />
          </G>
        ))}
      </G>
    );
  },
  bronze: metal(['#F3D2A2', '#B87333', '#7A4419', '#E0A96D'], '#5C3317', '#E8B98A'),
  // Bulles de savon.
  bulles: () => {
    const rnd = seeded(43);
    return (
      <G>
        {rim(4.2, 2.6).map((p, i) => {
          const r = 0.9 + rnd() * 1.8;
          const x = p.x + p.nx * (rnd() - 0.3) * 2;
          const y = p.y + p.ny * (rnd() - 0.3) * 2;
          return (
            <G key={i}>
              <Circle cx={x} cy={y} r={r} fill="#D0EBFF" opacity={0.45} stroke="#74C0FC" strokeWidth={0.3} />
              <Circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.28} fill="#FFFFFF" opacity={0.9} />
            </G>
          );
        })}
      </G>
    );
  },
  vagues: () => (
    <G>
      <Path d={wavyRim((t) => 2.6 + 1.1 * Math.sin(t * Math.PI * 2 * 30))} fill="none" stroke="#1C7ED6" strokeWidth={1.3} />
      <Path d={wavyRim((t) => 3.6 + 1.1 * Math.sin(t * Math.PI * 2 * 30 + Math.PI))} fill="none" stroke="#74C0FC" strokeWidth={0.9} />
      {rim(PERIMETER / 30, 1.5, 0.25).map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={0.6} fill="#FFFFFF" opacity={0.9} />
      ))}
    </G>
  ),
  // Liane avec des feuilles et quelques fleurs.
  lianes: () => {
    const rnd = seeded(3);
    return (
      <G>
        <Path d={wavyRim((t) => 2.6 + Math.sin(t * 380) * 1.1, 1.2)} fill="none" stroke="#2B8A3E" strokeWidth={1.3} />
        {rim(5.5, 2.6).map((p, i) => {
          const side = i % 2 ? 1 : -1;
          return <Path key={i} d={leaf(p.x, p.y, 4, 1.3, p.a + side * 55)} fill={i % 3 ? '#40C057' : '#2F9E44'} />;
        })}
        {rim(23, 3.6).map((p, i) => (
          <G key={`f${i}`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <Circle
                key={a}
                cx={p.x + Math.cos((a * Math.PI) / 180) * 0.9}
                cy={p.y + Math.sin((a * Math.PI) / 180) * 0.9}
                r={0.75}
                fill={rnd() > 0.5 ? '#F06595' : '#FCC419'}
              />
            ))}
            <Circle cx={p.x} cy={p.y} r={0.5} fill="#FFF3BF" />
          </G>
        ))}
      </G>
    );
  },
  // Branche de cerisier en fleurs et pétales qui tombent.
  cerisier: () => {
    const rnd = seeded(47);
    return (
      <G>
        <Path d={wavyRim((t) => 2.4 + Math.sin(t * 260) * 0.9, 1.2)} fill="none" stroke="#6F4E37" strokeWidth={1.1} />
        {rim(6.5, 2.6).map((p, i) => {
          const x = p.x + p.nx * (rnd() - 0.5) * 2;
          const y = p.y + p.ny * (rnd() - 0.5) * 2;
          const petal = i % 3 ? '#FFC9DE' : '#FFA8C5';
          return (
            <G key={i}>
              {[0, 72, 144, 216, 288].map((a) => (
                <Ellipse
                  key={a}
                  cx={x + Math.cos(((a + i * 13) * Math.PI) / 180) * 0.95}
                  cy={y + Math.sin(((a + i * 13) * Math.PI) / 180) * 0.95}
                  rx={0.85}
                  ry={0.6}
                  fill={petal}
                  transform={`rotate(${a + i * 13} ${f2(x + Math.cos(((a + i * 13) * Math.PI) / 180) * 0.95)} ${f2(y + Math.sin(((a + i * 13) * Math.PI) / 180) * 0.95)})`}
                />
              ))}
              <Circle cx={x} cy={y} r={0.45} fill="#E64980" />
            </G>
          );
        })}
        {rim(13, 7).map((p, i) => (
          <Ellipse key={`p${i}`} cx={p.x} cy={p.y} rx={0.7} ry={0.4} fill="#FFC9DE" opacity={0.8} transform={`rotate(${i * 47} ${f2(p.x)} ${f2(p.y)})`} />
        ))}
      </G>
    );
  },
  // Feuilles d'automne.
  automne: () => {
    const rnd = seeded(53);
    const colors = ['#E8590C', '#F08C00', '#FAB005', '#C92A2A', '#D9480F'];
    return (
      <G>
        {rim(3.4, 2.5).map((p, i) => {
          const a = p.a + (rnd() - 0.5) * 140;
          const len = 3 + rnd() * 1.8;
          const x = p.x - Math.cos((a * Math.PI) / 180) * len * 0.5;
          const y = p.y - Math.sin((a * Math.PI) / 180) * len * 0.5;
          return (
            <G key={i}>
              <Path d={leaf(x, y, len, 1.3, a)} fill={colors[Math.floor(rnd() * colors.length)]} />
              <Path
                d={`M${f2(x)} ${f2(y)}L${f2(x + Math.cos((a * Math.PI) / 180) * len * 0.8)} ${f2(y + Math.sin((a * Math.PI) / 180) * len * 0.8)}`}
                stroke="#7F2E00"
                strokeWidth={0.18}
                opacity={0.6}
              />
            </G>
          );
        })}
      </G>
    );
  },
  neon: neon('#22D3EE', '#A5F3FC', '#F472B6', '#FBCFE8'),
  'neon-acide': neon('#94D82D', '#E9FAC8', '#FFD43B', '#FFF3BF'),
  // Glace : bord givré et stalactites en haut.
  glace: ({ id }) => {
    const rnd = seeded(7);
    const icicles = [];
    for (let x = 15; x < 85; x += 3.4) {
      const h = 2 + rnd() * 5.5;
      icicles.push(`M${f2(x)} 3.6L${f2(x + 1.5)} ${f2(3.6 + h)}L${f2(x + 3)} 3.6Z`);
    }
    return (
      <G>
        <Defs>{diag(id('ice'), ['#E7F5FF', '#74C0FC', '#1971C2'])}</Defs>
        <Path d={rimPath(1.8)} fill="none" stroke={`url(#${id('ice')})`} strokeWidth={3.2} />
        <Path d={rimPath(3.6)} fill="none" stroke="#FFFFFF" strokeWidth={0.4} opacity={0.8} />
        <Path d={icicles.join('')} fill="#D0EBFF" stroke="#74C0FC" strokeWidth={0.25} opacity={0.95} />
        {[
          [8, 24, 1.8],
          [92, 40, 1.4],
          [10, 96, 1.6],
          [89, 110, 2],
        ].map(([x, y, r], i) => (
          <Path key={i} d={star(x, y, r)} fill="#FFFFFF" />
        ))}
      </G>
    );
  },
  arcenciel: ({ id }) => (
    <G>
      <Defs>{diag(id('rainbow'), ['#FA5252', '#FD7E14', '#FCC419', '#40C057', '#228BE6', '#7950F2', '#E64980'])}</Defs>
      <Path d={rimPath(1.9)} fill="none" stroke={`url(#${id('rainbow')})`} strokeWidth={3.4} />
      <Path d={rimPath(4)} fill="none" stroke="#FFFFFF" strokeWidth={0.5} opacity={0.9} />
    </G>
  ),
  // Dégaines accrochées sur les côtés.
  degaines: () => {
    const draws: [number, number, number][] = [
      [4.2, 26, 8],
      [4.2, 56, -6],
      [4.2, 86, 6],
      [95.8, 40, -8],
      [95.8, 70, 6],
      [95.8, 98, -5],
    ];
    const metals = ['#FA5252', '#4DABF7', '#FAB005', '#40C057', '#BE4BDB', '#FF922B'];
    return (
      <G>
        <Path d={rimPath(1.5)} fill="none" stroke="#ADB5BD" strokeWidth={1.4} />
        <Path d={rimPath(1.5)} fill="none" stroke="#F1F3F5" strokeWidth={0.4} />
        {draws.map(([x, y, a], i) => (
          <G key={i} transform={`rotate(${a} ${x} ${y})`}>
            <Rect x={x - 1.2} y={y - 2.6} width={2.4} height={4.4} rx={1.2} fill="none" stroke={metals[i]} strokeWidth={0.6} />
            <Rect x={x - 0.75} y={y + 1.4} width={1.5} height={5.2} rx={0.5} fill="#343A40" />
            <Rect x={x - 0.75} y={y + 3.2} width={1.5} height={1} fill={metals[(i + 2) % metals.length]} />
            <Rect x={x - 1.3} y={y + 6.2} width={2.6} height={4.6} rx={1.3} fill="none" stroke={metals[(i + 3) % metals.length]} strokeWidth={0.6} />
          </G>
        ))}
      </G>
    );
  },
  // Toiles d'araignée dans les coins, et une petite araignée.
  toile: ({ c }) => {
    const web = (cx: number, cy: number, from: number, to: number, r: number) => {
      const rays = 6;
      const angles = Array.from({ length: rays }, (_, i) => ((from + ((to - from) * i) / (rays - 1)) * Math.PI) / 180);
      let d = '';
      angles.forEach((a) => (d += `M${cx} ${cy}L${f2(cx + Math.cos(a) * r)} ${f2(cy + Math.sin(a) * r)}`));
      for (let k = 1; k <= 4; k++) {
        const rr = (r * k) / 4.3;
        angles.forEach((a, i) => {
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr;
          if (!i) d += `M${f2(x)} ${f2(y)}`;
          else {
            const m = (a + angles[i - 1]) / 2;
            d += `Q${f2(cx + Math.cos(m) * rr * 0.86)} ${f2(cy + Math.sin(m) * rr * 0.86)} ${f2(x)} ${f2(y)}`;
          }
        });
      }
      return d;
    };
    return (
      <G>
        <Path d={rimPath(1.2)} fill="none" stroke={c.line} strokeWidth={0.8} opacity={0.7} />
        <Path d={web(3, 3, 0, 90, 17) + web(97, 3, 90, 180, 17) + web(3, 110, -90, 0, 14) + web(97, 110, 180, 270, 14)} fill="none" stroke={c.line} strokeWidth={0.28} opacity={0.85} />
        <Path d="M84 3V24" stroke={c.line} strokeWidth={0.2} />
        <Ellipse cx={84} cy={26} rx={1.4} ry={1.8} fill="#212529" />
        <Circle cx={84} cy={23.8} r={0.9} fill="#212529" />
        {[-1, 1].map((s) =>
          [0, 1, 2].map((k) => (
            <Path key={`${s}${k}`} d={`M84 ${25 + k}q${s * 1.6} -1 ${s * 2.6} ${0.6 + k * 0.6}`} stroke="#212529" strokeWidth={0.3} fill="none" />
          )),
        )}
      </G>
    );
  },
  argent: metal(['#FFFFFF', '#CED4DA', '#868E96', '#F1F3F5'], '#495057', '#E9ECEF', ['#D0EBFF', '#339AF0', '#1864AB']),
  // Borne d'arcade : couloirs bleus, pac-gommes et un fantôme.
  arcade: () => (
    <G>
      <Path d={rimPath(0.9)} fill="none" stroke="#3B5BDB" strokeWidth={0.8} />
      <Path d={rimPath(4.6)} fill="none" stroke="#3B5BDB" strokeWidth={0.8} />
      {rim(3, 2.75).map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={0.42} fill="#FFE066" />
      ))}
      {[
        [8, 8],
        [92, 8],
        [6, 106],
        [94, 106],
      ].map(([x, y], i) => (
        <Circle key={`p${i}`} cx={x} cy={y} r={1.2} fill="#FFE066" />
      ))}
      <Path d="M40 2.75L42.4 1.2A2.2 2.2 0 1 0 42.4 4.3Z" fill="#FCC419" />
      <Path d="M30 4.8V2.6A1.9 1.9 0 0 1 33.8 2.6V4.8L33.15 4.2L32.55 4.8L31.9 4.2L31.25 4.8L30.65 4.2Z" fill="#FA5252" />
      <Circle cx={31.3} cy={2.6} r={0.45} fill="#FFFFFF" />
      <Circle cx={32.6} cy={2.6} r={0.45} fill="#FFFFFF" />
    </G>
  ),
  eclair: bolts('#1A1B4B', '#FFF3BF', '#FFD43B', 13),
  orage: bolts('#2B1B5E', '#F3F0FF', '#B197FC', 19),
  feu: flames(['#C92A2A', '#F76707', '#FFD43B'], ['#FFA94D', '#FFD43B'], 21),
  'feu-bleu': flames(['#1864AB', '#4DABF7', '#E7F5FF'], ['#74C0FC', '#D0EBFF'], 23),
  // Espace : bord violet, étoiles et petites planètes.
  cosmos: ({ id }) => {
    const rnd = seeded(17);
    return (
      <G>
        <Defs>
          {diag(id('space'), ['#7048E8', '#1864AB'])}
          <RadialGradient id={id('planet')} cx="0.35" cy="0.35" r="0.7">
            <Stop offset="0" stopColor="#FFC078" />
            <Stop offset="1" stopColor="#E8590C" />
          </RadialGradient>
        </Defs>
        <Path d={rimPath(1.9)} fill="none" stroke={`url(#${id('space')})`} strokeWidth={3.4} />
        {rim(4.2, 1.9).map((p, i) => (
          <Path key={i} d={star(p.x, p.y, 0.5 + rnd() * 0.8)} fill="#FFFFFF" opacity={0.6 + rnd() * 0.4} />
        ))}
        <Circle cx={90} cy={10} r={3} fill={`url(#${id('planet')})`} />
        <Ellipse cx={90} cy={10} rx={5} ry={1.3} fill="none" stroke="#FFE8CC" strokeWidth={0.5} transform="rotate(-20 90 10)" />
        <Circle cx={9} cy={118} r={2} fill="#91A7FF" />
      </G>
    );
  },
  // Circuit imprimé : pistes, pastilles dorées et puces.
  circuit: () => {
    const rnd = seeded(59);
    const traces = rim(6.5, 3.4).map((p, i) => {
      const inward = 2.5 + rnd() * 4.5;
      const side = (rnd() - 0.5) * 6;
      const x1 = p.x + p.nx * inward;
      const y1 = p.y + p.ny * inward;
      const x2 = x1 + p.ny * side;
      const y2 = y1 - p.nx * side;
      return { d: `M${f2(p.x)} ${f2(p.y)}L${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}`, x: x2, y: y2, i };
    });
    return (
      <G>
        <Path d={rimPath(2)} fill="none" stroke="#087F5B" strokeWidth={3.6} />
        <Path d={rimPath(2)} fill="none" stroke="#63E6BE" strokeWidth={0.35} strokeDasharray="5 1.5 1 1.5" />
        {traces.map((tr) => (
          <G key={tr.i}>
            <Path d={tr.d} fill="none" stroke="#38D9A9" strokeWidth={0.4} opacity={0.9} />
            <Circle cx={tr.x} cy={tr.y} r={0.6} fill="#FCC419" />
          </G>
        ))}
        {[
          [11, 11],
          [89, 11],
        ].map(([x, y], i) => (
          <G key={`c${i}`}>
            <Rect x={x - 3.5} y={y - 2.2} width={7} height={4.4} rx={0.5} fill="#212529" />
            {[-2.4, -0.8, 0.8, 2.4].map((dx) => (
              <G key={dx}>
                <Rect x={x + dx - 0.25} y={y - 3} width={0.5} height={0.8} fill="#ADB5BD" />
                <Rect x={x + dx - 0.25} y={y + 2.2} width={0.5} height={0.8} fill="#ADB5BD" />
              </G>
            ))}
            <Circle cx={x - 2.4} cy={y - 1.2} r={0.35} fill="#495057" />
          </G>
        ))}
      </G>
    );
  },
  // Plumes de paon tout autour.
  plumes: () => (
    <G>
      {rim(4.6, 1.2).map((p, i) => {
        const a = p.a + 90 + (i % 2 ? 18 : -18);
        const rad = (a * Math.PI) / 180;
        const ex = p.x + Math.cos(rad) * 5.2;
        const ey = p.y + Math.sin(rad) * 5.2;
        return (
          <G key={i}>
            <Path d={leaf(p.x, p.y, 6.2, 1.9, a)} fill={i % 2 ? '#0CA678' : '#1098AD'} opacity={0.95} />
            <Path d={`M${f2(p.x)} ${f2(p.y)}L${f2(ex)} ${f2(ey)}`} stroke="#E6FCF5" strokeWidth={0.2} />
            <Ellipse cx={ex - Math.cos(rad) * 1.4} cy={ey - Math.sin(rad) * 1.4} rx={1} ry={0.8} fill="#FCC419" />
            <Circle cx={ex - Math.cos(rad) * 1.4} cy={ey - Math.sin(rad) * 1.4} r={0.5} fill="#1C3FAA" />
          </G>
        );
      })}
    </G>
  ),
  rubis: crystal(['#FFFFFF', '#FFA8A8', '#E03131', '#FFE3E3'], ['#FFE3E3', '#FA5252', '#FF8787'], 61),
  emeraude: crystal(['#FFFFFF', '#8CE99A', '#2B8A3E', '#EBFBEE'], ['#EBFBEE', '#40C057', '#8CE99A'], 67),
  // Or massif, pierres précieuses et lauriers.
  or: ({ id }) => {
    const leaves = (side: number) =>
      Array.from({ length: 6 }, (_, i) => {
        const x = 50 + side * (3 + i * 3.2);
        const y = 137.5 - i * 1.55;
        const a = side * (-30 - i * 6);
        return <Ellipse key={`${side}${i}`} cx={x} cy={y} rx={1.9} ry={0.85} fill="#E67700" transform={`rotate(${a} ${x} ${y})`} />;
      });
    return (
      <G>
        <Defs>
          {diag(id('gold'), ['#FFF3BF', '#FAB005', '#E67700', '#FFE066'])}
          <RadialGradient id={id('gem')} cx="0.35" cy="0.35" r="0.7">
            <Stop offset="0" stopColor="#FFC9C9" />
            <Stop offset="0.5" stopColor="#FA5252" />
            <Stop offset="1" stopColor="#A61E1E" />
          </RadialGradient>
        </Defs>
        <Path d={rimPath(2)} fill="none" stroke={`url(#${id('gold')})`} strokeWidth={3.8} />
        <Path d={rimPath(4.6)} fill="none" stroke="#FFF3BF" strokeWidth={0.5} />
        {[
          [8.5, 8.5],
          [91.5, 8.5],
        ].map(([x, y], i) => (
          <G key={i}>
            <Circle cx={x} cy={y} r={2.6} fill="#E67700" />
            <Circle cx={x} cy={y} r={2} fill={`url(#${id('gem')})`} />
            <Circle cx={x - 0.6} cy={y - 0.7} r={0.5} fill="#FFFFFF" opacity={0.9} />
          </G>
        ))}
        {leaves(-1)}
        {leaves(1)}
      </G>
    );
  },
  diamant: crystal(['#FFFFFF', '#99E9F2', '#3BC9DB', '#E3FAFC'], ['#E3FAFC', '#66D9E8', '#99E9F2'], 29),
  // Écailles de dragon et cornes.
  ecailles: ({ id }) => (
    <G>
      <Defs>{diag(id('scale'), ['#FF6B6B', '#C92A2A', '#7A1010'])}</Defs>
      {[1.4, 3.6].map((inset, row) =>
        rim(2.6, inset, row * 0.5).map((p, i) => {
          const r = 1.6;
          const x = p.x;
          const y = p.y;
          return (
            <Path
              key={`${row}-${i}`}
              d={`M${f2(x - r)} ${f2(y)}A${r} ${r} 0 0 0 ${f2(x + r)} ${f2(y)}Z`}
              fill={`url(#${id('scale')})`}
              stroke="#FCC419"
              strokeWidth={0.25}
              transform={`rotate(${f2(p.a)} ${f2(x)} ${f2(y)})`}
            />
          );
        }),
      )}
      {[
        [10, 5, 1],
        [90, 5, -1],
      ].map(([x, y, s], i) => (
        <Path key={`h${i}`} d={`M${x} ${y}Q${x - s * 6} ${y - 1} ${x - s * 9} ${y + 6}Q${x - s * 4} ${y + 2} ${x + s * 1.5} ${y + 3}Z`} fill="#F1F3F5" stroke="#868E96" strokeWidth={0.3} />
      ))}
    </G>
  ),
  // Couronne en haut, bande d'or et pierres.
  couronne: ({ id }) => (
    <G>
      <Defs>
        {diag(id('gold'), ['#FFF3BF', '#FAB005', '#E67700', '#FFE066'])}
        {vert(id('crown'), ['#FFE066', '#F59F00'])}
      </Defs>
      <Path d={rimPath(2)} fill="none" stroke={`url(#${id('gold')})`} strokeWidth={3.4} />
      <Path d={rimPath(4.3)} fill="none" stroke="#E67700" strokeWidth={0.4} />
      {rim(9, 2).map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={0.75} fill={['#FA5252', '#228BE6', '#40C057'][i % 3]} stroke="#FFF3BF" strokeWidth={0.25} />
      ))}
      <Path d="M38 8L39.5 0.5L44.5 5L50 -1.5L55.5 5L60.5 0.5L62 8Z" fill={`url(#${id('crown')})`} stroke="#E67700" strokeWidth={0.4} />
      {[39.5, 50, 60.5].map((x, i) => (
        <Circle key={`p${i}`} cx={x} cy={i === 1 ? -1 : 0.6} r={0.9} fill="#FFFFFF" />
      ))}
      <Circle cx={50} cy={5.2} r={1.1} fill="#FA5252" />
      <Circle cx={44} cy={6} r={0.7} fill="#228BE6" />
      <Circle cx={56} cy={6} r={0.7} fill="#40C057" />
    </G>
  ),
  // Ailes d'ange sur les côtés et auréole.
  ailes: ({ id }) => {
    const wing = (side: number) =>
      Array.from({ length: 7 }, (_, i) => {
        const x = side < 0 ? 4 : 96;
        const y = 22 + i * 7;
        const a = side < 0 ? 90 + 40 - i * 5 : 90 - 40 + i * 5;
        return (
          <Path
            key={`${side}${i}`}
            d={leaf(x, y, 14 - i * 0.9, 2.3, a + (side < 0 ? -60 : 60))}
            fill={`url(#${id('feather')})`}
            stroke="#E9C46A"
            strokeWidth={0.25}
            opacity={0.95}
          />
        );
      });
    return (
      <G>
        <Defs>{diag(id('feather'), ['#FFFFFF', '#F1F3F5', '#FFF3BF'])}</Defs>
        <Path d={rimPath(1.8)} fill="none" stroke="#FFF9DB" strokeWidth={2.4} />
        <Path d={rimPath(1.8)} fill="none" stroke="#E9C46A" strokeWidth={0.4} />
        {wing(-1)}
        {wing(1)}
        <Ellipse cx={50} cy={4.5} rx={9} ry={2} fill="none" stroke="#FCC419" strokeWidth={1.1} />
        <Ellipse cx={50} cy={4.5} rx={9} ry={2} fill="none" stroke="#FFF3BF" strokeWidth={0.35} />
      </G>
    );
  },

  /* ----- Mythiques, animés ----- */

  // Une comète fait le tour de la carte.
  comete: ({ id, t }) => {
    const heads = [
      { s: t * 0.16, colors: ['#FFFFFF', '#74C0FC', '#7048E8'], r: 1.7 },
      { s: t * 0.16 + 0.5, colors: ['#FFFFFF', '#FFA8C5', '#E64980'], r: 1.2 },
    ];
    return (
      <G>
        <Defs>{diag(id('night'), ['#1B1F3B', '#2B2F77', '#1B1F3B'])}</Defs>
        <Path d={rimPath(2)} fill="none" stroke={`url(#${id('night')})`} strokeWidth={3.6} />
        <Path d={rimPath(4.1)} fill="none" stroke="#4C6EF5" strokeWidth={0.35} opacity={0.8} />
        {rim(9, 2).map((p, i) => (
          <Path key={`s${i}`} d={star(p.x, p.y, 0.7)} fill="#FFFFFF" opacity={0.25 + 0.75 * Math.abs(Math.sin(t * 2.2 + i * 1.7))} />
        ))}
        {heads.map((h, j) =>
          Array.from({ length: 28 }, (_, k) => {
            const p = at(h.s - k * 0.0045, 2);
            const fade = 1 - k / 28;
            return <Circle key={`${j}-${k}`} cx={p.x} cy={p.y} r={h.r * (0.25 + 0.75 * fade)} fill={ramp(h.colors, k / 28)} opacity={k ? fade * 0.85 : 1} />;
          }),
        )}
        {heads.map((h, j) => {
          const p = at(h.s, 2);
          return <Circle key={`g${j}`} cx={p.x} cy={p.y} r={h.r * 2.6} fill={h.colors[1]} opacity={0.25} />;
        })}
      </G>
    );
  },
  // Arc-en-ciel qui coule tout autour.
  prisme: ({ t }) => {
    const pieces = rimPieces(90, 2);
    return (
      <G>
        {pieces.map((p, i) => (
          <Path key={i} d={p.d} fill="none" stroke={hsl(p.t * 2 - t * 0.35, 0.95, 0.6)} strokeWidth={3.6} strokeLinecap="round" />
        ))}
        <Path d={rimPath(4.2)} fill="none" stroke="#FFFFFF" strokeWidth={0.5} opacity={0.85} />
        {Array.from({ length: 7 }, (_, i) => {
          const p = at(i / 7 + t * 0.05, 2);
          const r = 1.2 + Math.sin(t * 4 + i * 2) * 0.8;
          return <Path key={`s${i}`} d={star(p.x, p.y, Math.max(0.2, r))} fill="#FFFFFF" />;
        })}
      </G>
    );
  },
  // Coulée de lave qui bouillonne.
  lave: ({ t }) => {
    const pieces = rimPieces(110, 2);
    return (
      <G>
        <Path d={rimPath(2)} fill="none" stroke="#2B0A05" strokeWidth={4.4} />
        {pieces.map((p, i) => {
          const heat = 0.5 + 0.5 * Math.sin(i * 0.55 + t * 2.4) * Math.cos(i * 0.21 - t * 1.3);
          return <Path key={i} d={p.d} fill="none" stroke={ramp(['#5C0A00', '#D9480F', '#FF922B', '#FFE066'], heat)} strokeWidth={2.4} strokeLinecap="round" />;
        })}
        {Array.from({ length: 10 }, (_, i) => {
          const life = (t * 0.7 + i * 0.37) % 1;
          const p = at(i / 10 + 0.03, 2 + life * 5);
          return <Circle key={`b${i}`} cx={p.x} cy={p.y} r={0.9 * (1 - life)} fill="#FFA94D" opacity={1 - life} />;
        })}
        <Path d={rimPath(4.6)} fill="none" stroke="#FF6B00" strokeWidth={0.35} opacity={0.6} />
      </G>
    );
  },
  // Voiles verts et violets qui ondulent.
  aurore: ({ t }) => {
    const pieces = rimPieces(80, 2);
    const colors = ['#38D9A9', '#3BC9DB', '#9775FA', '#F783AC', '#38D9A9'];
    return (
      <G>
        <Path d={rimPath(2)} fill="none" stroke="#0B1A33" strokeWidth={4} />
        {pieces.map((p, i) => (
          <Path key={i} d={p.d} fill="none" stroke={ramp(colors, (p.t * 3 + t * 0.12) % 1)} strokeWidth={2.4} opacity={0.65 + 0.35 * Math.sin(i * 0.4 + t * 2)} />
        ))}
        {[0, 1].map((k) => (
          <Path
            key={`w${k}`}
            d={wavyRim((s) => 4.6 + k * 1.2 + Math.sin(s * 40 + t * (2 + k)) * 0.9, 1.6)}
            fill="none"
            stroke={k ? '#B197FC' : '#63E6BE'}
            strokeWidth={0.5}
            opacity={0.8}
          />
        ))}
      </G>
    );
  },
};

/* ---------- Fonds ---------- */

const bars =
  (colors: string[]): Art =>
  ({ id }) => (
    <G>
      <Defs>
        <RadialGradient id={id('core')} cx="0.62" cy="0.3" r="0.5">
          <Stop offset="0" stopColor={colors[0]} stopOpacity={0.9} />
          <Stop offset="1" stopColor={colors[0]} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        const b = a + Math.PI / 18;
        return (
          <Path
            key={i}
            d={`M62 38L${f2(62 + Math.cos(a) * 120)} ${f2(38 + Math.sin(a) * 120)}L${f2(62 + Math.cos(b) * 120)} ${f2(38 + Math.sin(b) * 120)}Z`}
            fill={colors[1 + (i % (colors.length - 1))]}
            opacity={0.35}
          />
        );
      })}
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('core')})`} />
    </G>
  );

const fire =
  (colors: string[], seed: number): Art =>
  ({ id }) => {
    const rnd = seeded(seed);
    return (
      <G>
        <Defs>
          <LinearGradient id={id('flame')} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="0.6" stopColor={colors[1]} />
            <Stop offset="1" stopColor={colors[2]} stopOpacity={0.2} />
          </LinearGradient>
        </Defs>
        {Array.from({ length: 9 }, (_, i) => {
          const x = 6 + i * 11 + rnd() * 4;
          const h = 30 + rnd() * 34;
          const w = 7 + rnd() * 4;
          return (
            <Path
              key={i}
              d={`M${f2(x - w)} 82Q${f2(x - w * 0.6)} ${f2(82 - h * 0.5)} ${f2(x + (rnd() - 0.5) * 6)} ${f2(82 - h)}Q${f2(x + w * 0.6)} ${f2(82 - h * 0.5)} ${f2(x + w)} 82Z`}
              fill={`url(#${id('flame')})`}
              opacity={0.55}
            />
          );
        })}
      </G>
    );
  };

/** Silhouette de montagnes : une ligne de crêtes fermée jusqu'en bas. */
const ridge = (pts: number[][], bottom = 100) => `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}L100 ${bottom}H0Z`;

/** Sapin stylisé. */
const pine = (x: number, base: number, h: number) =>
  `M${f2(x)} ${f2(base - h)}L${f2(x + h * 0.22)} ${f2(base - h * 0.55)}L${f2(x + h * 0.12)} ${f2(base - h * 0.55)}L${f2(x + h * 0.32)} ${f2(base - h * 0.15)}L${f2(x + h * 0.06)} ${f2(base - h * 0.15)}L${f2(x + h * 0.06)} ${f2(base)}L${f2(x - h * 0.06)} ${f2(base)}L${f2(x - h * 0.06)} ${f2(base - h * 0.15)}L${f2(x - h * 0.32)} ${f2(base - h * 0.15)}L${f2(x - h * 0.12)} ${f2(base - h * 0.55)}L${f2(x - h * 0.22)} ${f2(base - h * 0.55)}Z`;

export const BACKDROP_ART: Record<BackdropId, Art> = {
  pois: ({ c }) => (
    <G opacity={0.22}>
      {Array.from({ length: 9 * 9 }, (_, i) => {
        const col = i % 9;
        const row = Math.floor(i / 9);
        return <Circle key={i} cx={6 + col * 11 + (row % 2) * 5.5} cy={6 + row * 10} r={2.2} fill={c.line} />;
      })}
    </G>
  ),
  confettis: () => {
    const rnd = seeded(73);
    const colors = ['#FA5252', '#FAB005', '#40C057', '#228BE6', '#BE4BDB', '#FD7E14', '#15AABF'];
    return (
      <G>
        {Array.from({ length: 70 }, (_, i) => {
          const x = rnd() * 100;
          const y = rnd() * 90;
          const col = colors[i % colors.length];
          return i % 3 ? (
            <Rect key={i} x={x} y={y} width={2} height={0.9} fill={col} opacity={0.8} transform={`rotate(${Math.round(rnd() * 180)} ${f2(x)} ${f2(y)})`} />
          ) : (
            <Circle key={i} cx={x} cy={y} r={0.6} fill={col} opacity={0.8} />
          );
        })}
      </G>
    );
  },
  rayons: ({ c }) => (
    <G opacity={0.3}>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const b = a + Math.PI / 16;
        return (
          <Path
            key={i}
            d={`M62 38L${f2(62 + Math.cos(a) * 120)} ${f2(38 + Math.sin(a) * 120)}L${f2(62 + Math.cos(b) * 120)} ${f2(38 + Math.sin(b) * 120)}Z`}
            fill={c.shine}
          />
        );
      })}
    </G>
  ),
  rayures: ({ c }) => (
    <G opacity={0.16}>
      {Array.from({ length: 26 }, (_, i) => {
        const k = -100 + i * 8;
        return <Polygon key={i} points={`${k},0 ${k + 3.5},0 ${k + 103.5},100 ${k + 100},100`} fill={c.line} />;
      })}
    </G>
  ),
  carreaux: ({ c }) => (
    <G>
      {Array.from({ length: 17 }, (_, i) => (
        <Line key={`v${i}`} x1={i * 6.25} y1={0} x2={i * 6.25} y2={100} stroke={c.line} strokeWidth={i % 4 ? 0.22 : 0.45} opacity={0.4} />
      ))}
      {Array.from({ length: 17 }, (_, i) => (
        <Line key={`h${i}`} x1={0} y1={i * 6.25} x2={100} y2={i * 6.25} stroke={c.line} strokeWidth={i % 4 ? 0.22 : 0.45} opacity={0.4} />
      ))}
    </G>
  ),
  hexagones: ({ c }) => {
    const r = 5;
    const w = Math.sqrt(3) * r;
    let d = '';
    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 8; col++) {
        const x = col * w + (row % 2) * (w / 2);
        const y = row * r * 1.5;
        for (let k = 0; k < 6; k++) {
          const a = ((60 * k - 30) * Math.PI) / 180;
          d += `${k ? 'L' : 'M'}${f2(x + Math.cos(a) * r)} ${f2(y + Math.sin(a) * r)}`;
        }
        d += 'Z';
      }
    }
    return <Path d={d} fill="none" stroke={c.line} strokeWidth={0.35} opacity={0.38} />;
  },
  topo: ({ c }) => (
    <G opacity={0.35}>
      {Array.from({ length: 9 }, (_, k) => {
        const r = 6 + k * 6.5;
        const pts = Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * Math.PI * 2;
          const w = 1 + 0.12 * Math.sin(a * 3 + k) + 0.06 * Math.sin(a * 7 - k * 2);
          return `${i ? 'L' : 'M'}${f2(62 + Math.cos(a) * r * w)} ${f2(40 + Math.sin(a) * r * w * 0.8)}`;
        });
        return <Path key={k} d={pts.join('') + 'Z'} fill="none" stroke={c.line} strokeWidth={0.5} />;
      })}
    </G>
  ),
  montagnes: ({ c }) => (
    <G>
      <Path d="M0 62L18 40L30 52L46 30L60 46L74 26L92 48L100 42V100H0Z" fill={c.line} opacity={0.18} />
      <Path d="M0 74L14 60L28 70L44 52L58 66L70 54L86 68L100 60V100H0Z" fill={c.line} opacity={0.28} />
      <Path d="M46 30L50.5 35.5L48 35L45.5 37.5L42.5 34.5Z M74 26L79 32L76 31.5L73 34L70 30.5Z" fill="#FFFFFF" opacity={0.85} />
    </G>
  ),
  nuages: () => {
    const cloud = (x: number, y: number, s: number, k: number) => (
      <G key={k} opacity={0.7}>
        <Ellipse cx={x} cy={y} rx={9 * s} ry={4 * s} fill="#FFFFFF" />
        <Circle cx={x - 3 * s} cy={y - 2.5 * s} r={4 * s} fill="#FFFFFF" />
        <Circle cx={x + 2.5 * s} cy={y - 3.5 * s} r={5 * s} fill="#FFFFFF" />
      </G>
    );
    return (
      <G>
        <Rect x={0} y={0} width={100} height={100} fill="#A5D8FF" opacity={0.35} />
        {cloud(22, 18, 1, 0)}
        {cloud(70, 12, 0.8, 1)}
        {cloud(52, 44, 1.2, 2)}
        {cloud(14, 62, 0.9, 3)}
        {cloud(86, 58, 0.7, 4)}
      </G>
    );
  },
  mer: () => (
    <G>
      {[0, 1, 2, 3, 4, 5].map((k) => {
        const y = 22 + k * 12;
        let d = `M0 ${y}`;
        for (let x = 0; x <= 100; x += 2) d += `L${x} ${f2(y + Math.sin(x * 0.18 + k * 1.3) * 2.2)}`;
        return <Path key={k} d={d + 'V100H0Z'} fill={ramp(['#D0EBFF', '#74C0FC', '#1C7ED6', '#1864AB'], k / 5)} opacity={0.42} />;
      })}
    </G>
  ),
  mur: () => {
    const rnd = seeded(51);
    const colors = ['#E03131', '#2F9E44', '#1C7ED6', '#F59F00', '#AE3EC9', '#F76707', '#0CA678', '#E64980'];
    return (
      <G>
        {Array.from({ length: 8 * 7 }, (_, i) => (
          <Circle key={`b${i}`} cx={7 + (i % 8) * 12} cy={6 + Math.floor(i / 8) * 12} r={0.45} fill="#00000040" />
        ))}
        {Array.from({ length: 22 }, (_, i) => {
          const x = 6 + rnd() * 88;
          const y = 6 + rnd() * 78;
          return <Path key={i} d={hold(x, y, 1.8 + rnd() * 2.6, rnd)} fill={colors[i % colors.length]} opacity={0.55} />;
        })}
      </G>
    );
  },
  etoiles: ({ c }) => {
    const rnd = seeded(41);
    return (
      <G>
        {Array.from({ length: 34 }, (_, i) => {
          const x = 4 + rnd() * 92;
          const y = 4 + rnd() * 80;
          const r = 0.6 + rnd() * (i % 6 === 0 ? 2.6 : 1.2);
          return <Path key={i} d={star(x, y, r)} fill={i % 3 ? c.shine : '#FFFFFF'} opacity={0.55 + rnd() * 0.45} />;
        })}
      </G>
    );
  },
  soleil: ({ id, c }) => (
    <G>
      <Defs>{vert(id('sun'), ['#FFE066', '#F76707'])}</Defs>
      <Circle cx={62} cy={44} r={30} fill={`url(#${id('sun')})`} opacity={0.6} />
      {[48, 55, 61, 66, 70].map((y, i) => (
        <Rect key={y} x={30} y={y} width={64} height={1.2 + i * 0.5} fill={c.top} opacity={0.9} />
      ))}
    </G>
  ),
  'rayons-or': bars(['#FFF3BF', '#FFD43B', '#FAB005']),
  coucher: ({ id }) => (
    <G>
      <Defs>{vert(id('sky'), ['#5F3DC4', '#E64980', '#FF922B'])}</Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('sky')})`} opacity={0.85} />
      <Circle cx={62} cy={58} r={15} fill="#FFD43B" opacity={0.95} />
      <Path d={ridge([[0, 66], [16, 52], [30, 62], [46, 46], [62, 60], [78, 48], [100, 64]])} fill="#3B1D4A" opacity={0.85} />
      <Path d={ridge([[0, 78], [20, 66], [38, 74], [56, 64], [74, 74], [100, 68]])} fill="#24122E" />
    </G>
  ),
  foret: ({ id }) => (
    <G>
      <Defs>{vert(id('mist'), ['#E6FCF5', '#96F2D7'])}</Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('mist')})`} opacity={0.85} />
      <Circle cx={70} cy={20} r={8} fill="#FFFFFF" opacity={0.8} />
      {[
        { col: '#63E6BE', base: 58, h: 22, n: 9, off: 3 },
        { col: '#20C997', base: 72, h: 28, n: 7, off: 8 },
        { col: '#087F5B', base: 90, h: 36, n: 6, off: 0 },
      ].map((l, j) => (
        <Path key={j} d={Array.from({ length: l.n }, (_, i) => pine(l.off + (i * 100) / (l.n - 1), l.base, l.h * (0.8 + ((i * 7) % 5) / 12))).join('')} fill={l.col} />
      ))}
    </G>
  ),
  ville: ({ id }) => {
    const rnd = seeded(83);
    const towers = Array.from({ length: 11 }, (_, i) => ({ x: i * 9.5 - 2, w: 7 + rnd() * 3, h: 24 + rnd() * 34 }));
    return (
      <G>
        <Defs>{vert(id('night'), ['#1C1E3A', '#3B3F7A'])}</Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('night')})`} />
        {Array.from({ length: 24 }, (_, i) => (
          <Circle key={`s${i}`} cx={rnd() * 100} cy={rnd() * 40} r={0.3 + rnd() * 0.4} fill="#FFFFFF" opacity={0.8} />
        ))}
        <Circle cx={80} cy={16} r={6} fill="#FFF3BF" />
        <Circle cx={82.5} cy={14.5} r={5} fill="#2A2D5A" />
        {towers.map((tw, i) => (
          <G key={i}>
            <Rect x={tw.x} y={100 - tw.h} width={tw.w} height={tw.h} fill="#14152B" />
            {Array.from({ length: Math.floor(tw.h / 4) * 2 }, (_, k) => {
              const on = rnd() < 0.45;
              return on ? <Rect key={k} x={tw.x + 1.3 + (k % 2) * (tw.w / 2)} y={100 - tw.h + 2 + Math.floor(k / 2) * 4} width={1.4} height={1.6} fill="#FFD43B" opacity={0.9} /> : null;
            })}
          </G>
        ))}
      </G>
    );
  },
  neige: () => {
    const rnd = seeded(89);
    return (
      <G>
        <Rect x={0} y={0} width={100} height={100} fill="#D0EBFF" opacity={0.45} />
        {Array.from({ length: 26 }, (_, i) => {
          const x = rnd() * 100;
          const y = rnd() * 70;
          const r = 0.8 + rnd() * 1.8;
          return <Path key={i} d={flake(x, y, r)} stroke="#FFFFFF" strokeWidth={0.35} strokeLinecap="round" opacity={0.95} />;
        })}
        <Path d="M0 76Q20 68 40 74T80 72T100 74V100H0Z" fill="#FFFFFF" opacity={0.9} />
      </G>
    );
  },
  desert: ({ id }) => {
    const cactus = (x: number, base: number, h: number) =>
      `M${x - 1.2} ${base}V${base - h}a1.2 1.2 0 0 1 2.4 0V${base}Z M${x + 1.2} ${base - h * 0.55}h2V${base - h * 0.8}a1 1 0 0 1 2 0V${base - h * 0.45}h-4Z M${x - 1.2} ${base - h * 0.4}h-2V${base - h * 0.6}a1 1 0 0 0 -2 0V${base - h * 0.3}h4Z`;
    return (
      <G>
        <Defs>{vert(id('sky'), ['#FFE8CC', '#FFC078'])}</Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('sky')})`} opacity={0.9} />
        <Circle cx={70} cy={22} r={9} fill="#FFF3BF" />
        <Path d="M0 60Q25 48 50 58T100 52V100H0Z" fill="#F4B860" />
        <Path d="M0 72Q30 60 60 70T100 66V100H0Z" fill="#E8A33D" />
        <Path d="M0 84Q35 74 70 82T100 80V100H0Z" fill="#D98A2B" />
        <Path d={cactus(22, 70, 14) + cactus(78, 66, 10)} fill="#2F9E44" />
      </G>
    );
  },
  bleau: ({ id }) => (
    <G>
      <Defs>
        {vert(id('wood'), ['#E9F5DB', '#B2D8A6'])}
        <RadialGradient id={id('rock')} cx="0.4" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#F3E3B5" />
          <Stop offset="1" stopColor="#C9AE7A" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('wood')})`} opacity={0.9} />
      {[8, 30, 58, 86].map((x, i) => (
        <G key={i}>
          <Rect x={x} y={10} width={2.6} height={70} fill="#6B4F3A" opacity={0.7} />
          <Circle cx={x + 1.3} cy={12} r={10} fill="#69DB7C" opacity={0.55} />
        </G>
      ))}
      <Path d="M8 82C8 60 22 50 40 52C58 54 66 64 66 82Z" fill={`url(#${id('rock')})`} />
      <Path d="M58 84C58 70 70 62 84 64C96 66 100 74 100 84Z" fill={`url(#${id('rock')})`} />
      {[
        [24, 62],
        [32, 58],
        [44, 64],
        [76, 70],
        [86, 74],
      ].map(([x, y], i) => (
        <Ellipse key={`h${i}`} cx={x} cy={y} rx={1.4} ry={0.7} fill="#FFFFFF" opacity={0.9} />
      ))}
    </G>
  ),
  abysses: ({ id }) => {
    const rnd = seeded(97);
    const fish = (x: number, y: number, s: number, k: number) => (
      <Path key={k} d={`M${x} ${y}q${4 * s} ${-2.5 * s} ${8 * s} 0q${-4 * s} ${2.5 * s} ${-8 * s} 0Z M${x + 8 * s} ${y}l${2.5 * s} ${-2 * s}v${4 * s}Z`} fill="#4DABF7" opacity={0.6} />
    );
    return (
      <G>
        <Defs>{vert(id('deep'), ['#1971C2', '#0B3D91', '#04122B'])}</Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('deep')})`} />
        {[10, 34, 58, 80].map((x, i) => (
          <Polygon key={i} points={`${x},0 ${x + 9},0 ${x + 24},100 ${x + 6},100`} fill="#FFFFFF" opacity={0.06} />
        ))}
        {Array.from({ length: 18 }, (_, i) => (
          <Circle key={`b${i}`} cx={rnd() * 100} cy={rnd() * 90} r={0.4 + rnd() * 1.1} fill="none" stroke="#A5D8FF" strokeWidth={0.25} opacity={0.8} />
        ))}
        {fish(14, 30, 1, 0)}
        {fish(60, 18, 0.7, 1)}
        {fish(40, 52, 0.9, 2)}
      </G>
    );
  },
  // Holographique : dégradé arc-en-ciel avec reflets.
  holo: ({ id }) => (
    <G>
      <Defs>{diag(id('holo'), ['#FF8787', '#FFD43B', '#69DB7C', '#4DABF7', '#B197FC', '#F783AC', '#FF8787'])}</Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('holo')})`} opacity={0.32} />
      {[-30, 0, 30, 60].map((x) => (
        <Path key={x} d={`M${x} 0L${x + 18} 0L${x + 58} 100L${x + 40} 100Z`} fill="#FFFFFF" opacity={0.18} />
      ))}
      {[
        [20, 22],
        [80, 14],
        [70, 60],
      ].map(([x, y], i) => (
        <Path key={i} d={star(x, y, 2.2)} fill="#FFFFFF" opacity={0.9} />
      ))}
    </G>
  ),
  flammes: fire(['#E03131', '#FD7E14', '#FFD43B'], 61),
  'flammes-bleues': fire(['#1864AB', '#4DABF7', '#E7F5FF'], 63),
  synthwave: ({ id }) => {
    let grid = '';
    for (let k = 0; k < 9; k++) {
      const y = 58 + (k * k * 42) / 64;
      grid += `M0 ${f2(y)}H100`;
    }
    for (let k = -8; k <= 8; k++) grid += `M60 58L${f2(60 + k * 14)} 100`;
    return (
      <G>
        <Defs>
          {vert(id('sky'), ['#2B0B3F', '#7B2CBF', '#FF5DA2'])}
          {vert(id('sun'), ['#FFD166', '#FF5DA2'])}
        </Defs>
        <Rect x={0} y={0} width={100} height={58} fill={`url(#${id('sky')})`} />
        <Circle cx={60} cy={40} r={18} fill={`url(#${id('sun')})`} />
        {[44, 49, 53.5, 57].map((y, i) => (
          <Rect key={i} x={40} y={y} width={40} height={0.8 + i * 0.5} fill="#7B2CBF" />
        ))}
        <Rect x={0} y={58} width={100} height={42} fill="#1A0526" />
        <Path d={grid} stroke="#FF3EA5" strokeWidth={0.4} opacity={0.9} />
      </G>
    );
  },
  orage: ({ id }) => {
    const rnd = seeded(101);
    const bolt = (x: number) => {
      let d = `M${x} 8`;
      let cx = x;
      for (let y = 8; y < 70; y += 7) {
        cx += (rnd() - 0.5) * 8;
        d += `L${f2(cx)} ${y + 7}`;
      }
      return d;
    };
    return (
      <G>
        <Defs>{vert(id('storm'), ['#212529', '#495057'])}</Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('storm')})`} opacity={0.9} />
        {Array.from({ length: 30 }, (_, i) => {
          const x = rnd() * 110;
          const y = 10 + rnd() * 80;
          return <Line key={`r${i}`} x1={x} y1={y} x2={x - 2} y2={y + 6} stroke="#A5D8FF" strokeWidth={0.3} opacity={0.5} />;
        })}
        {[30, 72].map((x, i) => (
          <G key={i}>{glow(bolt(x), i ? '#FFF3BF' : '#D0EBFF', 0.8, `b${i}`)}</G>
        ))}
        {[
          [14, 8, 14],
          [44, 4, 16],
          [80, 9, 15],
        ].map(([x, y, r], i) => (
          <Ellipse key={`c${i}`} cx={x} cy={y} rx={r} ry={r * 0.45} fill="#343A40" />
        ))}
      </G>
    );
  },
  cristaux: ({ id }) => {
    const prism = (x: number, base: number, w: number, h: number, a: number, k: number) => (
      <G key={k} transform={`rotate(${a} ${x} ${base})`}>
        <Polygon points={`${x - w},${base} ${x - w},${base - h} ${x},${base - h - w * 1.2} ${x + w},${base - h} ${x + w},${base}`} fill={`url(#${id('crystal')})`} />
        <Polygon points={`${x},${base} ${x},${base - h} ${x},${base - h - w * 1.2} ${x + w},${base - h} ${x + w},${base}`} fill="#FFFFFF" opacity={0.25} />
      </G>
    );
    return (
      <G>
        <Defs>
          {vert(id('cave'), ['#1A1033', '#3B1F6B'])}
          {vert(id('crystal'), ['#E5DBFF', '#9775FA', '#5F3DC4'])}
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('cave')})`} opacity={0.9} />
        {prism(30, 86, 6, 34, -12, 0)}
        {prism(44, 90, 8, 46, 4, 1)}
        {prism(62, 88, 6, 30, 16, 2)}
        {prism(78, 92, 5, 22, -6, 3)}
        {prism(16, 92, 4, 18, -20, 4)}
        {[
          [40, 30],
          [70, 40],
          [20, 50],
        ].map(([x, y], i) => (
          <Path key={`s${i}`} d={star(x, y, 2)} fill="#FFFFFF" />
        ))}
      </G>
    );
  },
  jungle: ({ id }) => {
    const big = (x: number, y: number, len: number, a: number, col: string, k: number) => (
      <G key={k}>
        <Path d={leaf(x, y, len, len * 0.38, a)} fill={col} />
        <Path d={`M${x} ${y}L${f2(x + Math.cos((a * Math.PI) / 180) * len)} ${f2(y + Math.sin((a * Math.PI) / 180) * len)}`} stroke="#0B3D20" strokeWidth={0.4} opacity={0.6} />
      </G>
    );
    return (
      <G>
        <Defs>{vert(id('jungle'), ['#0B3D20', '#1E7B3B'])}</Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('jungle')})`} opacity={0.92} />
        {big(-4, 10, 30, 20, '#2B8A3E', 0)}
        {big(104, 6, 32, 160, '#37B24D', 1)}
        {big(0, 60, 26, -25, '#40C057', 2)}
        {big(100, 54, 28, 200, '#2F9E44', 3)}
        {big(50, -4, 22, 100, '#51CF66', 4)}
        <Path d="M20 0Q28 30 18 60" stroke="#8CE99A" strokeWidth={0.6} fill="none" opacity={0.7} />
        <Circle cx={74} cy={38} r={2.2} fill="#FF922B" />
        <Circle cx={74} cy={38} r={0.9} fill="#FFE066" />
        <Circle cx={26} cy={44} r={1.8} fill="#F06595" />
      </G>
    );
  },
  galaxie: ({ id }) => {
    const rnd = seeded(71);
    return (
      <G>
        <Defs>
          <RadialGradient id={id('nebula')} cx="0.62" cy="0.38" r="0.6">
            <Stop offset="0" stopColor="#F783AC" stopOpacity={0.75} />
            <Stop offset="0.45" stopColor="#7048E8" stopOpacity={0.6} />
            <Stop offset="1" stopColor="#1C2F6E" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="#0B1026" opacity={0.75} />
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('nebula')})`} />
        {Array.from({ length: 40 }, (_, i) => (
          <Circle key={i} cx={rnd() * 100} cy={rnd() * 85} r={0.25 + rnd() * 0.55} fill="#FFFFFF" opacity={0.5 + rnd() * 0.5} />
        ))}
      </G>
    );
  },
  dragon: ({ id }) => {
    const rnd = seeded(103);
    const body = 'M-4 70C10 52 22 78 36 60C48 44 40 28 56 24C68 21 74 30 80 26';
    return (
      <G>
        <Defs>
          {vert(id('red'), ['#2B0A0A', '#7A1F1F'])}
          {vert(id('breath'), ['#FFE066', '#FF6B00'])}
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('red')})`} opacity={0.92} />
        <Path d={body} fill="none" stroke="#120303" strokeWidth={6.5} strokeLinecap="round" />
        <Path d={body} fill="none" stroke="#3D0C0C" strokeWidth={0.6} strokeDasharray="1.2 1.4" />
        {Array.from({ length: 12 }, (_, i) => {
          const x = 2 + i * 6.2;
          const y = 64 - Math.sin(i * 0.8) * 10 - i * 2.4;
          return <Polygon key={i} points={`${x},${f2(y)} ${x + 2},${f2(y - 4.5)} ${x + 4},${f2(y)}`} fill="#120303" />;
        })}
        <Path d="M78 22L90 18L86 24L94 26L82 30Z" fill="#120303" />
        <Path d="M80 21L84 12L83 21Z" fill="#E9ECEF" />
        <Circle cx={85} cy={23} r={0.8} fill="#FFD43B" />
        <Path d="M92 25Q102 30 104 44Q96 36 86 34Z" fill={`url(#${id('breath')})`} opacity={0.9} />
        {Array.from({ length: 16 }, (_, i) => (
          <Circle key={`e${i}`} cx={rnd() * 100} cy={rnd() * 90} r={0.3 + rnd() * 0.6} fill="#FF922B" opacity={0.8} />
        ))}
      </G>
    );
  },
  temple: ({ id }) => (
    <G>
      <Defs>
        {vert(id('gold'), ['#FFF3BF', '#F59F00'])}
        {vert(id('stone'), ['#FFFFFF', '#FFE8A3'])}
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('gold')})`} opacity={0.6} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI - Math.PI;
        const b = a + Math.PI / 24;
        return <Path key={i} d={`M60 30L${f2(60 + Math.cos(a) * 90)} ${f2(30 + Math.sin(a) * 90)}L${f2(60 + Math.cos(b) * 90)} ${f2(30 + Math.sin(b) * 90)}Z`} fill="#FFFFFF" opacity={0.2} />;
      })}
      <Polygon points="30,30 60,16 90,30" fill={`url(#${id('stone')})`} stroke="#E67700" strokeWidth={0.4} />
      <Rect x={30} y={30} width={60} height={3} fill="#FFF3BF" stroke="#E67700" strokeWidth={0.3} />
      {[34, 46, 58, 70, 82].map((x) => (
        <G key={x}>
          <Rect x={x} y={33} width={4} height={44} fill={`url(#${id('stone')})`} stroke="#E67700" strokeWidth={0.25} />
          <Rect x={x - 0.8} y={33} width={5.6} height={1.6} fill="#FFE066" />
        </G>
      ))}
      <Rect x={28} y={77} width={64} height={3} fill="#FFF3BF" stroke="#E67700" strokeWidth={0.3} />
    </G>
  ),
  volcan: ({ id }) => {
    const rnd = seeded(107);
    return (
      <G>
        <Defs>
          {vert(id('sky'), ['#2B0A05', '#7F1D1D'])}
          {vert(id('lava'), ['#FFE066', '#FF6B00'])}
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('sky')})`} opacity={0.95} />
        {[
          [52, 18, 12],
          [64, 10, 9],
          [44, 8, 8],
        ].map(([x, y, r], i) => (
          <Circle key={`f${i}`} cx={x} cy={y} r={r} fill="#495057" opacity={0.55} />
        ))}
        <Path d="M10 100L44 44H64L98 100Z" fill="#1A0A05" />
        <Path d="M44 44Q54 36 64 44L60 52Q56 70 50 100H46Q52 70 48 52Z" fill={`url(#${id('lava')})`} opacity={0.95} />
        {Array.from({ length: 14 }, (_, i) => {
          const a = -Math.PI / 2 + (rnd() - 0.5) * 1.6;
          const d = 6 + rnd() * 26;
          return <Circle key={`l${i}`} cx={54 + Math.cos(a) * d} cy={40 + Math.sin(a) * d} r={0.6 + rnd() * 1.2} fill={i % 2 ? '#FF922B' : '#FFD43B'} />;
        })}
      </G>
    );
  },

  /* ----- Mythiques, animés ----- */

  aurore: ({ id, t }) => {
    const rnd = seeded(109);
    const band = (k: number) => {
      const top: string[] = [];
      const bottom: string[] = [];
      for (let x = -2; x <= 102; x += 4) {
        const y = 22 + k * 9 + Math.sin(x * 0.07 + t * (0.6 + k * 0.2) + k * 2) * 7 + Math.sin(x * 0.17 - t * 0.9) * 2;
        top.push(`${f2(x)} ${f2(y)}`);
        bottom.unshift(`${f2(x)} ${f2(y + 18 + Math.sin(x * 0.1 + t + k) * 4)}`);
      }
      return `M${top.join('L')}L${bottom.join('L')}Z`;
    };
    return (
      <G>
        <Defs>
          {vert(id('polar'), ['#06122B', '#0B2447'])}
          {['#38D9A9', '#66D9E8', '#B197FC'].map((col, k) => (
            <LinearGradient key={k} id={id(`veil${k}`)} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={col} stopOpacity={0} />
              <Stop offset="0.45" stopColor={col} stopOpacity={0.75} />
              <Stop offset="1" stopColor={col} stopOpacity={0} />
            </LinearGradient>
          ))}
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('polar')})`} />
        {Array.from({ length: 30 }, (_, i) => {
          const x = rnd() * 100;
          const y = rnd() * 80;
          return <Circle key={`s${i}`} cx={x} cy={y} r={0.25 + rnd() * 0.4} fill="#FFFFFF" opacity={0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + i))} />;
        })}
        {[0, 1, 2].map((k) => (
          <Path key={k} d={band(k)} fill={`url(#${id(`veil${k}`)})`} opacity={0.6 + 0.3 * Math.sin(t * 0.8 + k * 2)} />
        ))}
      </G>
    );
  },
  filantes: ({ id, t }) => {
    const rnd = seeded(113);
    const stars = Array.from({ length: 34 }, () => ({ x: rnd() * 100, y: rnd() * 85, r: 0.25 + rnd() * 0.5, p: rnd() * 6 }));
    return (
      <G>
        <Defs>{vert(id('sky'), ['#0B1026', '#2A2F6E'])}</Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id('sky')})`} />
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={0.3 + 0.7 * Math.abs(Math.sin(t * 1.8 + s.p))} />
        ))}
        {[0, 1, 2, 3].map((k) => {
          const life = (t * 0.35 + k * 0.27) % 1;
          if (life > 0.55) return null;
          const p = life / 0.55;
          const x0 = 108 - k * 13;
          const y0 = -6 + k * 9;
          const hx = x0 - p * 80;
          const hy = y0 + p * 48;
          return (
            <G key={`m${k}`}>
              {Array.from({ length: 10 }, (_, j) => (
                <Line
                  key={j}
                  x1={hx + j * 2.2}
                  y1={hy - j * 1.32}
                  x2={hx + (j + 1) * 2.2}
                  y2={hy - (j + 1) * 1.32}
                  stroke={j < 3 ? '#FFFFFF' : '#A5D8FF'}
                  strokeWidth={0.8 - j * 0.06}
                  opacity={(1 - j / 10) * (1 - p * 0.4)}
                />
              ))}
              <Circle cx={hx} cy={hy} r={0.9} fill="#FFFFFF" />
            </G>
          );
        })}
      </G>
    );
  },
  code: ({ t }) => {
    const rnd = seeded(127);
    const cols = Array.from({ length: 13 }, (_, i) => ({ x: 3 + i * 7.6, speed: 0.25 + rnd() * 0.3, off: rnd(), glyphs: Array.from({ length: 14 }, () => 0.6 + rnd() * 1.1) }));
    return (
      <G>
        <Rect x={0} y={0} width={100} height={100} fill="#03140B" opacity={0.88} />
        {cols.map((c, i) => {
          const head = ((t * c.speed + c.off) % 1.3) * 100 - 10;
          return (
            <G key={i}>
              {c.glyphs.map((w, k) => {
                const y = head - k * 3.4;
                if (y < -4 || y > 100) return null;
                return <Rect key={k} x={c.x - w / 2} y={y} width={w} height={2.2} rx={0.3} fill={k ? '#2F9E44' : '#D3F9D8'} opacity={k ? Math.max(0, 1 - k / 14) : 1} />;
              })}
            </G>
          );
        })}
      </G>
    );
  },
};

/* ---------- Calques ---------- */

/**
 * Fond à l'intérieur de la carte, effacé avant le nom et les stats et autour de la note
 * (en haut à gauche) pour que les chiffres restent lisibles.
 */
export function BackdropLayer({ backdrop, ctx }: { backdrop: BackdropId; ctx: Ctx }) {
  const { id } = ctx;
  return (
    <G>
      <Defs>
        <ClipPath id={id('bdclip')}>
          <Path d={SHAPE} />
        </ClipPath>
        <LinearGradient id={id('bdfade')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <RadialGradient id={id('bdhole')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.9} />
          <Stop offset="0.6" stopColor="#000000" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0} />
        </RadialGradient>
        <Mask id={id('bdmask')} x="0" y="0" width="100" height="142" maskUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={100} height={142} fill={`url(#${id('bdfade')})`} />
          <Ellipse cx={20} cy={24} rx={22} ry={26} fill={`url(#${id('bdhole')})`} />
        </Mask>
      </Defs>
      <G clipPath={`url(#${id('bdclip')})`}>
        <G mask={`url(#${id('bdmask')})`}>{BACKDROP_ART[backdrop](ctx)}</G>
      </G>
    </G>
  );
}

/** Contour par-dessus le bord de la carte. */
export function FrameLayer({ frame, ctx }: { frame: FrameId; ctx: Ctx }) {
  return (
    <G>
      <Defs>
        <ClipPath id={ctx.id('frclip')}>
          <Path d={SHAPE} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${ctx.id('frclip')})`}>{FRAME_ART[frame](ctx)}</G>
    </G>
  );
}
