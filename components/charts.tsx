import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '@/lib/theme';

/** Couleurs des résultats : du premier coup, réussi après essais, pas encore. */
export const RESULT_COLORS = [colors.primary, '#F7A072', '#D9D9D9'];

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={s.legend}>
      {items.map((it) => (
        <View key={it.label} style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: it.color }]} />
          <Text style={s.legendText}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Ne garde qu'une étiquette sur n pour qu'elles ne se chevauchent pas. */
function sparse<T>(items: T[], max: number) {
  const step = Math.max(1, Math.ceil(items.length / max));
  return (i: number) => i % step === 0 || i === items.length - 1;
}

const PAD = { left: 40, right: 8, top: 10, bottom: 22 };

/**
 * Courbes sur des périodes. Les valeurs sont des indices (de cotation par exemple) ;
 * `formatY` les transforme en étiquettes. Une valeur null laisse un trou.
 */
export function LineChart({
  width,
  height = 180,
  labels,
  series,
  formatY,
}: {
  width: number;
  height?: number;
  labels: string[];
  series: { values: (number | null)[]; color: string }[];
  formatY: (v: number) => string;
}) {
  const all = series.flatMap((sr) => sr.values).filter((v): v is number => v !== null);
  if (all.length === 0) return null;
  const min = Math.max(0, Math.min(...all) - 1);
  const max = Math.max(...all) + 1;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;
  const yStep = Math.max(1, Math.ceil((max - min) / 5));
  const ticks: number[] = [];
  for (let v = Math.ceil(min); v <= max; v += yStep) ticks.push(v);
  const showX = sparse(labels, 6);

  return (
    <Svg width={width} height={height}>
      {ticks.map((v) => (
        <Line key={`g${v}`} x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={colors.border} strokeWidth={1} />
      ))}
      {ticks.map((v) => (
        <SvgText key={`t${v}`} x={PAD.left - 6} y={y(v) + 4} fontSize={11} fill={colors.muted} textAnchor="end">
          {formatY(v)}
        </SvgText>
      ))}
      {labels.map((l, i) =>
        showX(i) ? (
          <SvgText key={`x${i}`} x={x(i)} y={height - 6} fontSize={10} fill={colors.muted} textAnchor="middle">
            {l}
          </SvgText>
        ) : null,
      )}
      {series.map((sr, k) => {
        const pts = sr.values
          .map((v, i) => (v === null ? null : { cx: x(i), cy: y(v) }))
          .filter((p): p is { cx: number; cy: number } => p !== null);
        return (
          <G key={k}>
            {pts.length > 1 && (
              <Polyline
                points={pts.map((p) => `${p.cx},${p.cy}`).join(' ')}
                fill="none"
                stroke={sr.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            )}
            {pts.map((p, i) => (
              <Circle key={i} cx={p.cx} cy={p.cy} r={3.5} fill={sr.color} />
            ))}
          </G>
        );
      })}
    </Svg>
  );
}

/** Colonnes empilées, une par période. */
export function StackedColumns({
  width,
  height = 160,
  labels,
  stacks,
  palette = RESULT_COLORS,
}: {
  width: number;
  height?: number;
  labels: string[];
  stacks: number[][];
  palette?: string[];
}) {
  const totals = stacks.map((st) => st.reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...totals);
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, labels.length);
  const barW = Math.max(3, Math.min(28, slot * 0.7));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const showX = sparse(labels, 6);
  const ticks = [0, Math.ceil(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <Svg width={width} height={height}>
      {ticks.map((v) => (
        <Line key={`g${v}`} x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={colors.border} strokeWidth={1} />
      ))}
      {ticks.map((v) => (
        <SvgText key={`t${v}`} x={PAD.left - 6} y={y(v) + 4} fontSize={11} fill={colors.muted} textAnchor="end">
          {String(v)}
        </SvgText>
      ))}
      {stacks.map((st, i) => {
        const cx = PAD.left + slot * i + slot / 2;
        let acc = 0;
        return st.map((v, k) => {
          if (v === 0) return null;
          const top = y(acc + v);
          const bottom = y(acc);
          acc += v;
          return (
            <Rect key={`${i}-${k}`} x={cx - barW / 2} y={top} width={barW} height={bottom - top} fill={palette[k]} />
          );
        });
      })}
      {labels.map((l, i) =>
        showX(i) ? (
          <SvgText
            key={`x${i}`}
            x={PAD.left + slot * i + slot / 2}
            y={height - 6}
            fontSize={10}
            fill={colors.muted}
            textAnchor="middle">
            {l}
          </SvgText>
        ) : null,
      )}
    </Svg>
  );
}

/** Barres horizontales empilées : une ligne par catégorie. */
export function StackedBars({
  rows,
  palette = RESULT_COLORS,
  labelWidth = 44,
}: {
  rows: { label: string; parts: number[] }[];
  palette?: string[];
  labelWidth?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((a, b) => a + b, 0)));
  return (
    <View style={{ gap: 6 }}>
      {rows.map((r) => {
        const total = r.parts.reduce((a, b) => a + b, 0);
        return (
          <View key={r.label} style={s.barRow}>
            <Text style={[s.barLabel, { width: labelWidth }]} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={s.barTrack}>
              {r.parts.map((v, k) =>
                v > 0 ? <View key={k} style={{ width: `${(v / max) * 100}%`, backgroundColor: palette[k] }} /> : null,
              )}
            </View>
            <Text style={s.barValue}>{total}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Taux (0 à 1) par catégorie, avec le détail à droite. */
export function RateBars({
  rows,
  labelWidth = 104,
  highlight,
}: {
  rows: { label: string; rate: number; detail: string }[];
  labelWidth?: number;
  highlight?: string | null;
}) {
  return (
    <View style={{ gap: 6 }}>
      {rows.map((r) => (
        <View key={r.label} style={s.barRow}>
          <Text style={[s.barLabel, { width: labelWidth }]} numberOfLines={1}>
            {r.label}
          </Text>
          <View style={s.barTrack}>
            <View
              style={{
                width: `${Math.round(r.rate * 100)}%`,
                backgroundColor: r.label === highlight ? colors.danger : colors.primary,
              }}
            />
          </View>
          <Text style={[s.barValue, { width: 76 }]}>{r.detail}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.muted, fontSize: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { fontWeight: '600', color: colors.text, fontSize: 13 },
  barTrack: {
    flex: 1,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barValue: { width: 28, textAlign: 'right', color: colors.muted, fontVariant: ['tabular-nums'], fontSize: 13 },
});
