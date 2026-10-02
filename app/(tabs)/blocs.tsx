import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BlockRow } from '@/components/BlockRow';
import { Chip, Empty } from '@/components/ui';
import { GRADES, isSent, placeKey, placeOf, RESULT_LABELS, type Discipline } from '@/lib/climbing';
import { listBlocks, type Block } from '@/lib/db';
import { colors } from '@/lib/theme';

type ResultFilter = 'all' | 'done' | 'project';

export default function BlocksScreen() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [outdoor, setOutdoor] = useState<boolean | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [result, setResult] = useState<ResultFilter>('all');

  useFocusEffect(useCallback(() => setBlocks(listBlocks()), []));

  const places = useMemo(() => {
    const m = new Map<string, string>();
    blocks
      .filter((b) => (!discipline || b.discipline === discipline) && (outdoor === null || b.outdoor === outdoor))
      .forEach((b) => m.set(placeKey(b), placeOf(b)));
    return [...m.entries()];
  }, [blocks, discipline, outdoor]);

  const grades = useMemo(() => {
    const used = new Set(blocks.filter((b) => !discipline || b.discipline === discipline).map((b) => b.grade));
    return [...new Set(Object.values(GRADES).flat())].filter((g) => used.has(g));
  }, [blocks, discipline]);

  const hasVoies = blocks.some((b) => b.discipline === 'voie');
  const hasOutdoor = blocks.some((b) => b.outdoor);
  const filtered = blocks.filter(
    (b) =>
      (!discipline || b.discipline === discipline) &&
      (outdoor === null || b.outdoor === outdoor) &&
      (!place || placeKey(b) === place) &&
      (!grade || b.grade === grade) &&
      (result === 'all' || (result === 'done' ? isSent(b.result) : !isSent(b.result))),
  );

  return (
    <View style={s.container}>
      {blocks.length > 0 && (
        <View style={s.filters}>
          {(hasVoies || hasOutdoor) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              <Chip label="Blocs et voies" selected={!discipline} onPress={() => setDiscipline(null)} />
              <Chip label="Blocs" selected={discipline === 'bloc'} onPress={() => setDiscipline('bloc')} />
              <Chip label="Voies" selected={discipline === 'voie'} onPress={() => setDiscipline('voie')} />
              <Chip label="Partout" selected={outdoor === null} onPress={() => setOutdoor(null)} />
              <Chip label="En salle" selected={outdoor === false} onPress={() => setOutdoor(false)} />
              <Chip label="Extérieur" selected={outdoor === true} onPress={() => setOutdoor(true)} />
            </ScrollView>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            <Chip label="Tous" selected={result === 'all'} onPress={() => setResult('all')} />
            <Chip label="Réussis" selected={result === 'done'} onPress={() => setResult('done')} />
            <Chip label={RESULT_LABELS.project} selected={result === 'project'} onPress={() => setResult('project')} />
          </ScrollView>
          {places.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              <Chip label="Tous les lieux" selected={!place} onPress={() => setPlace(null)} />
              {places.map(([key, name]) => (
                <Chip key={key} label={name} selected={place === key} onPress={() => setPlace(key)} />
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
                ? 'Ton carnet est vide.\nAppuie sur + pour ajouter un bloc ou une voie.'
                : 'Aucune grimpe ne correspond à ces filtres.'
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
