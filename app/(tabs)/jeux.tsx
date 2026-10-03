import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, Segmented } from '@/components/ui';
import { GAMES, type Game } from '@/lib/games';
import { colors, themedStyles } from '@/lib/theme';

type Filter = 'all' | 'solo' | 'group';

function GameCard({ game, highlighted }: { game: Game; highlighted?: boolean }) {
  return (
    <View style={[s.card, highlighted && s.cardHighlighted]}>
      <View style={s.cardHead}>
        <Text style={s.name}>{game.name}</Text>
        <Text style={s.tag}>{game.group ? 'À plusieurs' : 'Seul'}</Text>
      </View>
      <Text style={s.works}>{game.works}</Text>
      <Text style={s.rules}>{game.rules}</Text>
    </View>
  );
}

export default function GamesScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState<Game | null>(null);

  const games = GAMES.filter((g) => filter === 'all' || g.group === (filter === 'group'));

  const pickRandom = () => {
    const others = games.length > 1 ? games.filter((g) => g !== picked) : games;
    setPicked(others[Math.floor(Math.random() * others.length)] ?? null);
  };

  const changeFilter = (f: Filter) => {
    setFilter(f);
    setPicked(null);
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Segmented
        options={[
          { value: 'all', label: 'Tous' },
          { value: 'solo', label: 'Seul' },
          { value: 'group', label: 'À plusieurs' },
        ]}
        value={filter}
        onChange={changeFilter}
      />
      <Button label="Un jeu au hasard" onPress={pickRandom} />
      {picked && <GameCard game={picked} highlighted />}
      {games
        .filter((g) => g !== picked)
        .map((g) => (
          <GameCard key={g.name} game={g} />
        ))}
    </ScrollView>
  );
}

const s = themedStyles({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { padding: 14, gap: 6, borderRadius: 12, backgroundColor: colors.surface },
  cardHighlighted: { backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.primary },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  tag: { fontSize: 12, fontWeight: '600', color: colors.primary },
  works: { fontSize: 13, fontWeight: '600', color: colors.muted },
  rules: { fontSize: 15, lineHeight: 21, color: colors.text },
});
