import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { BlockRow } from '@/components/BlockRow';
import { Button, Empty } from '@/components/ui';
import { isFirstTry, isSent } from '@/lib/climbing';
import { getGym, listBlocksAddedSince, type Block } from '@/lib/db';
import { endSession, getSession, type Session } from '@/lib/session';
import { colors, themedStyles } from '@/lib/theme';

function elapsed(since: number) {
  const min = Math.max(0, Math.round((Date.now() - since) / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

export default function SessionScreen() {
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [blocks, setBlocks] = useState<Block[]>([]);

  useFocusEffect(
    useCallback(() => {
      const current = getSession();
      setSession(current);
      setBlocks(current ? listBlocksAddedSince(current.startedAt) : []);
    }, []),
  );

  if (!session) return <Empty text="Aucune séance en cours." />;

  const place = session.gymId ? (getGym(session.gymId)?.name ?? 'Salle') : (session.site ?? 'Extérieur');
  const sent = blocks.filter((b) => isSent(b.result)).length;
  const firstTry = blocks.filter((b) => isFirstTry(b.result)).length;

  const finish = () =>
    Alert.alert(
      'Terminer la séance ?',
      blocks.length === 0
        ? 'Aucune grimpe ajoutée.'
        : `${blocks.length} grimpe${blocks.length > 1 ? 's' : ''}, ${sent} réussie${sent > 1 ? 's' : ''} en ${elapsed(session.startedAt)}.`,
      [
        { text: 'Continuer', style: 'cancel' },
        {
          text: 'Terminer',
          onPress: () => {
            endSession();
            router.back();
          },
        },
      ],
    );

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: `Séance · ${place}` }} />
      <View style={s.header}>
        <View style={s.tiles}>
          <Tile label="Grimpes" value={String(blocks.length)} />
          <Tile label="Réussies" value={String(sent)} />
          <Tile label="Du premier coup" value={String(firstTry)} />
          <Tile label="Durée" value={elapsed(session.startedAt)} />
        </View>
        <Button label="+ Ajouter une grimpe" onPress={() => router.push('/block/new')} />
      </View>
      <FlatList
        data={blocks}
        keyExtractor={(b) => String(b.id)}
        renderItem={({ item }) => <BlockRow block={item} showGym={false} />}
        ListEmptyComponent={<Empty text="Ajoute ta première grimpe de la séance." />}
        ListFooterComponent={
          <View style={s.footer}>
            <Button label="Terminer la séance" variant="secondary" onPress={finish} />
          </View>
        }
      />
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center' },
  tileValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  tileLabel: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  footer: { padding: 16 },
});
