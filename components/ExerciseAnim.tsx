import { useEffect, useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { exercisePose, HAS_ANIMATION, toneStyle, type AnimColors, type Shape } from '@/lib/exercisePoses';
import { colors } from '@/lib/theme';

/** Une image toutes les ~33 ms : bien assez pour ces petits pictogrammes. */
const FRAME = 1 / 30;

function ShapeView({ s, pal }: { s: Shape; pal: AnimColors }) {
  const { color, opacity } = toneStyle(s.tone, pal);
  const op = opacity < 1 ? opacity : undefined;
  const fill = s.fill ? color : 'none';
  if (s.k === 'path') {
    return (
      <Path
        d={s.d}
        fill={fill}
        stroke={color}
        strokeWidth={s.w}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={s.dash}
        opacity={op}
      />
    );
  }
  const w = s.w ?? 0;
  const stroke = w > 0 ? color : undefined;
  if (s.k === 'circle') {
    return <Circle cx={s.cx} cy={s.cy} r={s.r} fill={fill} stroke={stroke} strokeWidth={w || undefined} opacity={op} />;
  }
  return (
    <Rect
      x={s.x}
      y={s.y}
      width={s.width}
      height={s.height}
      rx={s.rx}
      fill={fill}
      stroke={stroke}
      strokeWidth={w || undefined}
      strokeLinejoin="round"
      opacity={op}
    />
  );
}

/**
 * Petite animation en boucle qui montre le mouvement d'un exercice.
 * Carrée ; sans `size`, elle prend la largeur de son parent. Rien si l'exercice n'a pas d'animation.
 */
export function ExerciseAnim({ id, size, playing = true }: { id: string; size?: number; playing?: boolean }) {
  const has = HAS_ANIMATION(id);
  const [clock, setClock] = useState({ id, t: 0 });
  const [measured, setMeasured] = useState(0);
  const elapsed = useRef({ id, t: 0 });

  useEffect(() => {
    if (elapsed.current.id !== id) elapsed.current = { id, t: 0 };
    if (!has || !playing) return;
    let raf = 0;
    let prev: number | null = null;
    let acc = 0;
    const tick = (now: number) => {
      if (prev !== null) {
        // Après une pause (appli en arrière-plan), on reprend sans sauter.
        const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000));
        elapsed.current.t += dt;
        acc += dt;
        if (acc >= FRAME) {
          acc = 0;
          setClock({ id, t: elapsed.current.t });
        }
      }
      prev = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id, has, playing]);

  if (!has) return null;

  const side = size ?? measured;
  const onLayout =
    size === undefined
      ? (e: LayoutChangeEvent) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w !== measured) setMeasured(w);
        }
      : undefined;
  const frame = exercisePose(id, clock.id === id ? clock.t : 0);
  const pal: AnimColors = { body: colors.text, accent: colors.primary, prop: colors.muted, bg: colors.card };

  return (
    <View
      style={size === undefined ? { width: '100%', aspectRatio: 1 } : { width: size, height: size }}
      onLayout={onLayout}
      accessibilityRole="image"
    >
      {frame && side > 0 && (
        <Svg width={side} height={side} viewBox="0 0 100 100">
          {frame.shapes.map((s, i) => (
            <ShapeView key={i} s={s} pal={pal} />
          ))}
        </Svg>
      )}
    </View>
  );
}
