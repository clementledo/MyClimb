import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Badge, Button, Icon, Segmented } from '@/components/ui';
import { GAMES, type Game } from '@/lib/games';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

type Filter = 'all' | 'solo' | 'group';

function GameCard({ game, highlighted }: { game: Game; highlighted?: boolean }) {
  return (
    <View style={[s.card, highlighted && s.cardHighlighted]}>
      {highlighted && (
        <View style={s.pickedRow}>
          <Icon name="casino" size={16} color={colors.primary} />
          <Text style={s.picked}>Tiré au sort pour toi</Text>
        </View>
      )}
      <View style={s.cardHead}>
        <Text style={s.name}>{game.name}</Text>
        <Badge label={game.group ? 'À plusieurs' : 'Seul'} tone={game.group ? 'primary' : 'neutral'} />
      </View>
      <View style={s.worksRow}>
        <Icon name="fitness_center" size={15} color={colors.muted} />
        <Text style={s.works}>{game.works}</Text>
      </View>
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
      <Text style={s.intro}>Des jeux pour progresser en t&apos;amusant, seul ou entre amis.</Text>
      <Button label="Un jeu au hasard" icon="casino" onPress={pickRandom} />
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
  container: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.md, paddingBottom: space.xxl },
  intro: { ...type.body, color: colors.muted },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHighlighted: { borderWidth: 2, borderColor: colors.primary },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  picked: { ...type.overline, color: colors.primary },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  name: { flex: 1, ...type.headline },
  worksRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  works: { fontSize: 13, fontWeight: '600', color: colors.muted },
  rules: { ...type.body },
});
