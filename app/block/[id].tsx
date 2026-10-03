import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { formatDate } from '@/components/BlockRow';
import { Button, Empty } from '@/components/ui';
import {
  DISCIPLINE_LABELS,
  FEEL_LABELS,
  GRADE_SYSTEM_LABELS,
  holdHex,
  isFirstTry,
  RESULT_LABELS,
  placeOf,
  ROPE_LABELS,
} from '@/lib/climbing';
import { deleteBlock, getBlock, type Block } from '@/lib/db';
import { deletePhoto } from '@/lib/photos';
import { colors, themedStyles } from '@/lib/theme';

export default function BlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [block, setBlock] = useState<Block | null>(null);

  useFocusEffect(useCallback(() => setBlock(getBlock(Number(id))), [id]));

  if (!block) return <Empty text="Grimpe introuvable." />;

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

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {block.photoUri && <Image source={{ uri: block.photoUri }} style={s.photo} contentFit="cover" />}
      <View style={s.body}>
        <View style={s.header}>
          <Text style={s.grade}>{block.grade}</Text>
          <Text style={s.system}>{GRADE_SYSTEM_LABELS[block.gradeSystem]}</Text>
        </View>
        {block.name && <Text style={s.name}>{block.name}</Text>}
        <Text style={[s.result, block.result === 'project' && { color: colors.muted }]}>
          {RESULT_LABELS[block.result]}
          {attemptsText ? ` · ${attemptsText}` : ''}
        </Text>

        <Info
          label="Type"
          value={[
            DISCIPLINE_LABELS[block.discipline],
            block.outdoor ? 'extérieur' : 'en salle',
            block.rope ? ROPE_LABELS[block.rope].toLowerCase() : null,
          ]
            .filter(Boolean)
            .join(', ')}
        />
        <Info
          label={block.outdoor ? 'Site' : 'Salle'}
          value={placeOf(block)}
          onPress={gymId ? () => router.push({ pathname: '/gym/[id]', params: { id: gymId } }) : undefined}
        />
        <Info label="Date" value={formatDate(block.date)} />
        {block.color && (
          <View style={s.info}>
            <Text style={s.label}>Couleur</Text>
            <View style={s.colorRow}>
              <View style={[s.dot, { backgroundColor: holdHex(block.color) }]} />
              <Text style={s.value}>{block.color}</Text>
            </View>
          </View>
        )}
        {block.styles.length > 0 && <Info label="Profil du mur" value={block.styles.join(', ')} />}
        {block.holds.length > 0 && <Info label="Types de prises" value={block.holds.join(', ')} />}
        {block.moves.length > 0 && <Info label="Mouvements" value={block.moves.join(', ')} />}
        {block.feel && <Info label="Cotation ressentie" value={FEEL_LABELS[block.feel]} />}
        {block.note && <Info label="Note" value={block.note} />}

        <Button
          label="Modifier"
          onPress={() => router.push({ pathname: '/block/edit/[id]', params: { id: String(block.id) } })}
        />
        <Button label="Supprimer" variant="danger" onPress={remove} />
      </View>
    </ScrollView>
  );
}

function Info({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <View style={s.info}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, onPress && { color: colors.primary }]} onPress={onPress}>
        {value}
      </Text>
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1, backgroundColor: colors.background },
  photo: { width: '100%', aspectRatio: 3 / 4 },
  body: { padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  grade: { fontSize: 36, fontWeight: '800', color: colors.text },
  system: { color: colors.muted },
  name: { fontSize: 18, fontWeight: '600', color: colors.text },
  result: { fontSize: 16, fontWeight: '700', color: colors.success },
  info: { gap: 2 },
  label: { color: colors.muted, fontSize: 13 },
  value: { color: colors.text, fontSize: 16 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
});
