import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BlockRow } from '@/components/BlockRow';
import { Chip, Empty } from '@/components/ui';
import { GRADES, RESULT_LABELS, type BlockResult } from '@/lib/climbing';
import { listBlocks, type Block } from '@/lib/db';
import { colors } from '@/lib/theme';

type ResultFilter = 'all' | 'done' | 'project';

export default function BlocksScreen() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [gym, setGym] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [result, setResult] = useState<ResultFilter>('all');

  useFocusEffect(useCallback(() => setBlocks(listBlocks()), []));

  const gyms = useMemo(() => {
    const m = new Map<string, string>();
    blocks.forEach((b) => m.set(b.gymId, b.gymName));
    return [...m.entries()];
  }, [blocks]);

  const grades = useMemo(() => {
    const used = new Set(blocks.map((b) => b.grade));
    return [...GRADES.font, ...GRADES.v].filter((g) => used.has(g));
  }, [blocks]);

  const isDone = (r: BlockResult) => r !== 'project';
  const filtered = blocks.filter(
    (b) =>
      (!gym || b.gymId === gym) &&
      (!grade || b.grade === grade) &&
      (result === 'all' || (result === 'done' ? isDone(b.result) : !isDone(b.result))),
  );

  return (
    <View style={s.container}>
      {blocks.length > 0 && (
        <View style={s.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            <Chip label="Tous" selected={result === 'all'} onPress={() => setResult('all')} />
            <Chip label="Réussis" selected={result === 'done'} onPress={() => setResult('done')} />
            <Chip label={RESULT_LABELS.project} selected={result === 'project'} onPress={() => setResult('project')} />
          </ScrollView>
          {gyms.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              <Chip label="Toutes les salles" selected={!gym} onPress={() => setGym(null)} />
              {gyms.map(([id, name]) => (
                <Chip key={id} label={name} selected={gym === id} onPress={() => setGym(id)} />
              ))}
            </ScrollView>
          )}
          {grades.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              <Chip label="Toutes cotations" selected={!grade} onPress={() => setGrade(null)} />
              {grades.map((g) => (
                <Chip key={g} label={g} selected={grade === g} onPress={() => setGrade(g)} />
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(b) => String(b.id)}
        renderItem={({ item }) => <BlockRow block={item} />}
        ListEmptyComponent={
          <Empty
            text={
              blocks.length === 0
                ? 'Aucun bloc pour l\'instant.\nAppuie sur + pour ajouter ton premier bloc.'
                : 'Aucun bloc ne correspond à ces filtres.'
            }
          />
        }
        contentContainerStyle={{ paddingBottom: 96 }}
      />

      <Pressable style={s.fab} onPress={() => router.push('/block/new')}>
        <Text style={s.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { paddingVertical: 8, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  chips: { gap: 8, paddingHorizontal: 12 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 34, fontWeight: '600' },
});
