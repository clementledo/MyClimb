import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';

import { BlockRow } from '@/components/BlockRow';
import { Button, Empty, Icon } from '@/components/ui';
import { isFirstTry, isSent } from '@/lib/climbing';
import { getGym, listBlocksAddedSince, type Block } from '@/lib/db';
import { endSession, getSession, type Session } from '@/lib/session';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

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

  if (!session) return <Empty icon="timer_off" text="Aucune séance en cours." />;

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
      <Stack.Screen options={{ title: 'Séance' }} />
      <FlatList
        data={blocks}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={s.content}
        renderItem={({ item }) => <BlockRow block={item} showGym={false} />}
        ListHeaderComponent={
          <View style={s.header}>
            <View style={s.hero}>
              <View style={s.heroTop}>
                <Icon name={session.gymId ? 'fitness_center' : 'terrain'} size={18} color={colors.onPrimary} />
                <Text style={s.place} numberOfLines={1}>
                  {place}
                </Text>
              </View>
              <Text style={s.time}>{elapsed(session.startedAt)}</Text>
              <View style={s.stats}>
                <Stat label="Grimpes" value={blocks.length} />
                <View style={s.sep} />
                <Stat label="Réussies" value={sent} />
                <View style={s.sep} />
                <Stat label="Du 1er coup" value={firstTry} />
              </View>
            </View>
            <Button label="Ajouter une grimpe" icon="add" onPress={() => router.push('/block/new')} />
            {blocks.length > 0 && <Text style={s.listTitle}>Grimpes de la séance</Text>}
          </View>
        }
        ListEmptyComponent={
          <Empty icon="landscape" text="Ajoute ta première grimpe : cotation, couleur, photo et ton résultat." />
        }
        ListFooterComponent={
          <Button label="Terminer la séance" icon="flag" variant="secondary" onPress={finish} style={s.finish} />
        }
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  content: { padding: space.lg, gap: 10, paddingBottom: space.xxl },
  header: { gap: space.lg, marginBottom: space.xs },
  hero: { padding: space.xl, borderRadius: radius.lg, backgroundColor: colors.primary, gap: space.xs },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  place: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.onPrimary },
  time: { fontSize: 44, fontWeight: '800', letterSpacing: -1.5, color: colors.onPrimary },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.onPrimary },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.onPrimary, opacity: 0.85 },
  sep: { width: 1, height: 32, backgroundColor: colors.onPrimary, opacity: 0.3, marginHorizontal: space.md },
  listTitle: { ...type.overline, paddingHorizontal: 4 },
  finish: { marginTop: space.lg },
});
