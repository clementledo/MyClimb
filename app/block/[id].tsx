import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { formatDate } from '@/components/BlockRow';
import { Badge, Button, Card, Empty, Icon } from '@/components/ui';
import {
  DISCIPLINE_LABELS,
  FEEL_LABELS,
  GRADE_SYSTEM_LABELS,
  holdHex,
  isFirstTry,
  isSent,
  RESULT_LABELS,
  placeOf,
  ROPE_LABELS,
} from '@/lib/climbing';
import { deleteBlock, getBlock, type Block } from '@/lib/db';
import { deletePhoto } from '@/lib/photos';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

export default function BlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [block, setBlock] = useState<Block | null>(null);

  useFocusEffect(useCallback(() => setBlock(getBlock(Number(id))), [id]));

  if (!block) return <Empty icon="search_off" text="Grimpe introuvable." />;

  const kind = block.discipline === 'bloc' ? 'ce bloc' : 'cette voie';
  const remove = () =>
    Alert.alert(`Supprimer ${kind} ?`, 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deleteBlock(block.id);
          deletePhoto(block.photoUri);
          router.back();
        },
      },
    ]);

  const attemptsText = isFirstTry(block.result)
    ? null
    : `${block.attempts} essai${block.attempts > 1 ? 's' : ''}`;
  const gymId = block.gymId;

  const details: { label: string; value: string; onPress?: () => void }[] = [
    {
      label: 'Type',
      value: [
        DISCIPLINE_LABELS[block.discipline],
        block.outdoor ? 'extérieur' : 'en salle',
        block.rope ? ROPE_LABELS[block.rope].toLowerCase() : null,
      ]
        .filter(Boolean)
        .join(', '),
    },
    {
      label: block.outdoor ? 'Site' : 'Salle',
      value: placeOf(block),
      onPress: gymId ? () => router.push({ pathname: '/gym/[id]', params: { id: gymId } }) : undefined,
    },
    { label: 'Date', value: formatDate(block.date) },
    ...(block.styles.length ? [{ label: 'Profil du mur', value: block.styles.join(', ') }] : []),
    ...(block.holds.length ? [{ label: 'Types de prises', value: block.holds.join(', ') }] : []),
    ...(block.moves.length ? [{ label: 'Mouvements', value: block.moves.join(', ') }] : []),
    ...(block.feel ? [{ label: 'Cotation ressentie', value: FEEL_LABELS[block.feel] }] : []),
  ];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: space.xxl }}>
      {block.photoUri && <Image source={{ uri: block.photoUri }} style={s.photo} contentFit="cover" />}
      <View style={s.body}>
        <View style={s.header}>
          <View style={s.gradeRow}>
            <Text style={s.grade}>{block.grade}</Text>
            {block.color && (
              <View style={s.colorPill}>
                <View style={[s.dot, { backgroundColor: holdHex(block.color) }]} />
                <Text style={s.colorText}>{block.color}</Text>
              </View>
            )}
          </View>
          <Text style={s.system}>{GRADE_SYSTEM_LABELS[block.gradeSystem]}</Text>
          {block.name && <Text style={s.name}>{block.name}</Text>}
          <View style={s.badges}>
            <Badge label={RESULT_LABELS[block.result]} tone={isSent(block.result) ? 'success' : 'neutral'} />
            {attemptsText && <Badge label={attemptsText} tone="neutral" />}
          </View>
        </View>

        <Card style={s.card}>
          {details.map((d, i) => (
            <View key={d.label} style={[s.info, i < details.length - 1 && s.divider]}>
              <Text style={s.label}>{d.label}</Text>
              <Text style={[s.value, d.onPress && s.link]} onPress={d.onPress} numberOfLines={3}>
                {d.value}
              </Text>
              {d.onPress && <Icon name="chevron_right" size={18} color={colors.primary} />}
            </View>
          ))}
        </Card>

        {block.note && (
          <Card style={s.noteCard}>
            <Text style={s.noteTitle}>Note</Text>
            <Text style={s.note}>{block.note}</Text>
          </Card>
        )}

        <View style={s.actions}>
          <Button
            label="Modifier"
            icon="edit"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/block/edit/[id]', params: { id: String(block.id) } })}
          />
          <Button label="Supprimer" icon="delete" variant="secondary" style={{ flex: 1 }} onPress={remove} />
        </View>
      </View>
    </ScrollView>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  photo: { width: '100%', aspectRatio: 4 / 5 },
  body: { padding: space.lg, gap: space.lg },
  header: { gap: 4 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grade: { fontSize: 44, fontWeight: '800', letterSpacing: -1.5, color: colors.text },
  colorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  colorText: { fontSize: 13, fontWeight: '600', color: colors.text },
  system: { ...type.subhead },
  name: { ...type.headline, marginTop: 4 },
  badges: { flexDirection: 'row', gap: 6, marginTop: space.sm },
  card: { paddingVertical: 4 },
  info: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { width: 120, fontSize: 14, fontWeight: '500', color: colors.muted },
  value: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'right' },
  link: { color: colors.primary },
  noteCard: { gap: 6 },
  noteTitle: { ...type.overline },
  note: { ...type.body },
  actions: { flexDirection: 'row', gap: space.sm },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border },
});
