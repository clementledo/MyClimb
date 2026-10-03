import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Badge, Icon } from '@/components/ui';

import { DISCIPLINE_LABELS, holdHex, isFirstTry, isSent, placeOf, RESULT_LABELS } from '@/lib/climbing';
import type { Block } from '@/lib/db';
import { colors, radius, space, themedStyles } from '@/lib/theme';

export function BlockRow({ block, showGym = true }: { block: Block; showGym?: boolean }) {
  const tries =
    block.result === 'project'
      ? `${block.attempts} essai${block.attempts > 1 ? 's' : ''}`
      : !isFirstTry(block.result) && block.attempts > 1
        ? `${block.attempts} essais`
        : null;
  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && s.pressed]}
      onPress={() => router.push({ pathname: '/block/[id]', params: { id: String(block.id) } })}>
      {block.photoUri ? (
        <Image source={{ uri: block.photoUri }} style={s.thumb} contentFit="cover" />
      ) : (
        <View style={[s.thumb, s.thumbEmpty]}>
          <Icon name={block.discipline === 'voie' ? 'height' : 'landscape'} size={24} color={colors.muted} />
        </View>
      )}
      <View style={s.body}>
        <View style={s.line}>
          <Text style={s.grade}>{block.grade}</Text>
          {block.color && <View style={[s.dot, { backgroundColor: holdHex(block.color) }]} />}
          <Text style={s.kind}>
            {DISCIPLINE_LABELS[block.discipline]}
            {block.outdoor ? ' · Extérieur' : ''}
          </Text>
        </View>
        <Text style={s.sub} numberOfLines={1}>
          {[block.name, showGym ? placeOf(block) : null, formatDate(block.date), block.styles.join(', ')]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <View style={s.badges}>
          <Badge label={RESULT_LABELS[block.result]} tone={isSent(block.result) ? 'success' : 'neutral'} />
          {tries && <Badge label={tries} tone="neutral" />}
        </View>
      </View>
      <Icon name="chevron_right" size={20} color={colors.muted} />
    </Pressable>
  );
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const s = themedStyles({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.surface },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grade: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, color: colors.text },
  kind: { fontSize: 13, fontWeight: '600', color: colors.muted },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border },
  sub: { fontSize: 13, fontWeight: '400', color: colors.muted },
  badges: { flexDirection: 'row', gap: 6, marginTop: 3 },
});
