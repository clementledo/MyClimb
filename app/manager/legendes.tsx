import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ManagerCard } from '@/components/ManagerCard';
import { G, GameBackground, GameHeader, HelpTip, Panel } from '@/components/ManagerUi';
import { Icon } from '@/components/ui';
import { loadClub, type Club } from '@/lib/manager';
import { LEGENDS, STYLES } from '@/lib/managerData';
import { themedStyles } from '@/lib/theme';

export default function ManagerLegends() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const [club] = useState<Club | null>(loadClub);
  if (!club) return <View style={s.screen} />;
  const cardW = Math.floor((width - 32 - 12) / 2);
  const got = club.legends ?? [];

  return (
    <View style={s.screen}>
      <GameBackground colors={club.colors} />
      <GameHeader title="Légendes" club={club} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}>
        <Panel>
          <View style={s.titleRow}>
            <Text style={[s.title, { flex: 1 }]}>
              {got.length}/{LEGENDS.length} légendes
            </Text>
            <HelpTip topic="legendes" />
          </View>
          <Text style={s.muted}>Chaque exploit de ton club attire une légende. Elle rejoint ton équipe pour de bon.</Text>
          {!!club.trophies && (
            <Text style={s.muted}>
              Palmarès : {club.trophies.titles} titre{club.trophies.titles > 1 ? 's' : ''} de champion · {club.trophies.cups} coupe{club.trophies.cups > 1 ? 's' : ''} · {club.contracts ?? 0} contrat{(club.contracts ?? 0) > 1 ? 's' : ''} rempli{(club.contracts ?? 0) > 1 ? 's' : ''}
            </Text>
          )}
        </Panel>
        <View style={s.grid}>
          {LEGENDS.map((l) => {
            const climber = got.includes(l.id) ? club.climbers.find((c) => c.first === l.first && c.last === l.last) : undefined;
            return (
              <View key={l.id} style={{ width: cardW, gap: 6 }}>
                {climber ? (
                  <ManagerCard climber={climber} club={club} width={cardW} onPress={() => router.push(`/manager/climber/${climber.id}`)} />
                ) : (
                  <View style={[s.locked, { width: cardW, height: cardW * 1.45 }]} accessibilityLabel={`${l.first} ${l.last}, verrouillée`}>
                    <Text style={s.lockedRating}>{l.rating}</Text>
                    <Icon name="lock" size={42} color="#C77DFF" />
                    <Text style={s.lockedName} numberOfLines={2}>
                      {l.flag} {l.first} {l.last}
                    </Text>
                    <Text style={s.lockedStyle}>{STYLES[l.style].name}</Text>
                  </View>
                )}
                <Text style={[s.cond, got.includes(l.id) && { color: G.green }]} numberOfLines={2}>
                  {got.includes(l.id) ? '✓ ' : ''}
                  {l.condText}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = themedStyles({
  screen: { flex: 1, backgroundColor: G.bg },
  content: { paddingHorizontal: 16, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: G.text, fontWeight: '900', fontSize: 20 },
  muted: { color: G.muted, fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  locked: { borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderWidth: 2, borderColor: 'rgba(199,125,255,0.5)', backgroundColor: 'rgba(60,30,90,0.6)' },
  lockedRating: { position: 'absolute', top: 10, left: 12, color: '#C77DFF', fontWeight: '900', fontSize: 24 },
  lockedName: { color: G.text, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  lockedStyle: { color: G.muted, fontSize: 12 },
  cond: { color: G.muted, fontSize: 12, fontWeight: '700', paddingHorizontal: 4 },
});
