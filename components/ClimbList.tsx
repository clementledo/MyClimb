import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { BlockRow } from '@/components/BlockRow';
import { Chip, Empty, Icon, Segmented, Sheet } from '@/components/ui';
import { GRADES, isSent, placeKey, placeOf, type Discipline } from '@/lib/climbing';
import { listBlocks, type Block } from '@/lib/db';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

type ResultFilter = 'all' | 'done' | 'project';

/** Toutes les grimpes, avec des filtres. */
export function ClimbList() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [outdoor, setOutdoor] = useState<boolean | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [result, setResult] = useState<ResultFilter>('all');
  const [sheet, setSheet] = useState(false);

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

  const active = [discipline, outdoor, place, grade].filter((v) => v !== null).length;
  const reset = () => {
    setDiscipline(null);
    setOutdoor(null);
    setPlace(null);
    setGrade(null);
  };

  return (
    <View style={s.container}>
      {blocks.length > 0 && (
        <View style={s.toolbar}>
          <Segmented
            style={{ flex: 1 }}
            options={[
              { value: 'all', label: 'Toutes' },
              { value: 'done', label: 'Réussies' },
              { value: 'project', label: 'Projets' },
            ]}
            value={result}
            onChange={setResult}
          />
          <Pressable
            onPress={() => setSheet(true)}
            accessibilityLabel="Filtres"
            style={({ pressed }) => [s.filterButton, active > 0 && s.filterButtonActive, pressed && { opacity: 0.6 }]}>
            <Icon name="tune" size={20} color={active > 0 ? colors.onPrimary : colors.text} />
            {active > 0 && <Text style={s.filterCount}>{active}</Text>}
          </Pressable>
        </View>
      )}

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Filtres">
        {(hasVoies || hasOutdoor) && (
          <>
            <View style={s.group}>
              <Text style={s.groupTitle}>Type</Text>
              <View style={s.chips}>
                <Chip label="Blocs et voies" selected={!discipline} onPress={() => setDiscipline(null)} />
                <Chip label="Blocs" selected={discipline === 'bloc'} onPress={() => setDiscipline('bloc')} />
                <Chip label="Voies" selected={discipline === 'voie'} onPress={() => setDiscipline('voie')} />
              </View>
            </View>
            <View style={s.group}>
              <Text style={s.groupTitle}>Où</Text>
              <View style={s.chips}>
                <Chip label="Partout" selected={outdoor === null} onPress={() => setOutdoor(null)} />
                <Chip label="En salle" selected={outdoor === false} onPress={() => setOutdoor(false)} />
                <Chip label="Extérieur" selected={outdoor === true} onPress={() => setOutdoor(true)} />
              </View>
            </View>
          </>
        )}
        {places.length > 1 && (
          <View style={s.group}>
            <Text style={s.groupTitle}>Lieu</Text>
            <View style={s.chips}>
              <Chip label="Tous les lieux" selected={!place} onPress={() => setPlace(null)} />
              {places.map(([key, name]) => (
                <Chip key={key} label={name} selected={place === key} onPress={() => setPlace(key)} />
              ))}
            </View>
          </View>
        )}
        {grades.length > 1 && (
          <View style={s.group}>
            <Text style={s.groupTitle}>Cotation</Text>
            <View style={s.chips}>
              <Chip label="Toutes" selected={!grade} onPress={() => setGrade(null)} />
              {grades.map((g) => (
                <Chip key={g} label={g} selected={grade === g} onPress={() => setGrade(g)} />
              ))}
            </View>
          </View>
        )}
        {active > 0 && (
          <Pressable onPress={reset} style={s.reset}>
            <Text style={s.resetText}>Effacer les filtres</Text>
          </Pressable>
        )}
      </Sheet>

      <FlatList
        data={filtered}
        keyExtractor={(b) => String(b.id)}
        renderItem={({ item }) => <BlockRow block={item} />}
        ListHeaderComponent={
          blocks.length > 0 ? (
            <Text style={s.count}>
              {filtered.length} grimpe{filtered.length > 1 ? 's' : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <Empty
            icon={blocks.length === 0 ? 'landscape' : 'filter_alt_off'}
            title={blocks.length === 0 ? 'Aucune grimpe pour l’instant' : undefined}
            text={
              blocks.length === 0
                ? 'Démarre une séance depuis l’onglet Grimper pour noter tes blocs et tes voies.'
                : 'Aucune grimpe ne correspond à ces filtres.'
            }
          />
        }
        contentContainerStyle={s.list}
      />
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  filterButtonActive: { backgroundColor: colors.primary },
  filterCount: { fontSize: 14, fontWeight: '800', color: colors.onPrimary },
  group: { gap: space.sm },
  groupTitle: { ...type.callout },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  reset: { alignSelf: 'flex-start', paddingVertical: 4 },
  resetText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  count: { ...type.overline, marginBottom: 2, paddingHorizontal: 4 },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: 10 },
});
