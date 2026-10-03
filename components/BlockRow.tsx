import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DISCIPLINE_LABELS, holdHex, isFirstTry, placeOf, RESULT_LABELS } from '@/lib/climbing';
import type { Block } from '@/lib/db';
import { colors, themedStyles } from '@/lib/theme';

export function BlockRow({ block, showGym = true }: { block: Block; showGym?: boolean }) {
  return (
    <Pressable
      style={s.row}
      onPress={() => router.push({ pathname: '/block/[id]', params: { id: String(block.id) } })}>
      {block.photoUri ? (
        <Image source={{ uri: block.photoUri }} style={s.thumb} contentFit="cover" />
      ) : (
        <View style={[s.thumb, { backgroundColor: holdHex(block.color ?? '') }]} />
      )}
      <View style={{ flex: 1 }}>
        <View style={s.line}>
          <Text style={s.grade}>{block.grade}</Text>
          <Text style={s.kind}>
            {DISCIPLINE_LABELS[block.discipline]}
            {block.outdoor ? ' · Ext.' : ''}
          </Text>
          {block.color && (
            <View style={[s.dot, { backgroundColor: holdHex(block.color) }]} />
          )}
          <Text style={[s.result, block.result === 'project' && { color: colors.muted }]}>
            {RESULT_LABELS[block.result]}
            {!isFirstTry(block.result) && block.result !== 'project' && block.attempts > 1 ? ` · ${block.attempts} essais` : ''}
            {block.result === 'project' ? ` · ${block.attempts} essai${block.attempts > 1 ? 's' : ''}` : ''}
          </Text>
        </View>
        <Text style={s.sub} numberOfLines={1}>
          {[block.name, showGym ? placeOf(block) : null, formatDate(block.date), block.styles.join(', ')]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.surface },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grade: { fontSize: 18, fontWeight: '800', color: colors.text },
  kind: { fontSize: 12, fontWeight: '600', color: colors.muted },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border },
  result: { color: colors.success, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
