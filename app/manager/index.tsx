import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ManagerCard } from '@/components/ManagerCard';
import { Crest, G, GameBackground, GameHeader, GButton, GTabs, HelpTip, Panel } from '@/components/ManagerUi';
import { Icon } from '@/components/ui';
import {
  canClaimDaily,
  claimDaily,
  competitionPreview,
  createClub,
  energyLeft,
  LEAGUES,
  loadClub,
  MAX_CLIMBERS,
  PROGRAMS,
  ratingOf,
  ROUNDS,
  saveClub,
  itemText,
  sellItem,
  standings,
  tick,
  type Club,
  type Item,
} from '@/lib/manager';
import { CLUB_COLORS } from '@/lib/managerData';
import { themedStyles } from '@/lib/theme';

const KIND_LABEL: Record<Item['kind'], string> = { materiel: 'Matériel', boost: 'Boosts', coach: 'Coachs', sponsor: 'Sponsors', competence: 'Stages de compétence' };

export default function ManagerHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const [club, setClub] = useState<Club | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'equipe' | 'objets' | 'ligue'>('equipe');

  useFocusEffect(
    useCallback(() => {
      const c = loadClub();
      if (c) {
        const gains = tick(c);
        saveClub(c);
        const total = Object.values(gains).reduce((a, b) => a + b, 0);
        if (total > 0) setTimeout(() => Alert.alert('Entraînement', `Tes grimpeurs ont gagné ${total} point${total > 1 ? 's' : ''} de stats depuis ta dernière visite.`), 400);
      }
      setClub(c);
      setLoaded(true);
    }, []),
  );

  if (!loaded) return <View style={s.screen} />;
  if (!club)
    return (
      <NewClub
        onCreate={(c) => {
          setClub(c);
          router.push('/manager/packs');
        }}
      />
    );

  const L = LEAGUES[club.league];
  const table = standings(club);
  const rank = table.findIndex((r) => r.mine) + 1;
  const next = competitionPreview(club);
  const energy = energyLeft(club);
  const cardW = Math.floor((width - 32 - 12) / 2);

  const daily = () => {
    const r = claimDaily(club);
    if (!r) return;
    saveClub(club);
    setClub({ ...club });
    Alert.alert('Récompense du jour', `+${r.coins} pièces · série de ${r.streak} jour${r.streak > 1 ? 's' : ''}${r.pack ? '\nBonus : un pack argent !' : ''}`);
  };

  return (
    <View style={s.screen}>
      <GameBackground colors={club.colors} />
      <GameHeader title="Manager" club={club} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}>
        <View style={s.hero}>
          <Crest colors={club.colors} size={72} letter={club.name} />
          <View style={s.heroBody}>
            <Text style={s.clubName} numberOfLines={1} adjustsFontSizeToFit>
              {club.name}
            </Text>
            <View style={[s.league, { backgroundColor: L.color }]}>
              <Icon name="emoji_events" size={14} color="#fff" />
              <Text style={s.leagueText}>{L.short}</Text>
            </View>
            <Text style={s.muted}>
              Saison {club.season.n} · {rank}ᵉ · {club.season.points.me ?? 0} pts
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => (energy > 0 ? router.push('/manager/compet') : Alert.alert('Plus d’énergie', 'Tu as joué tes 10 compétitions du jour. Reviens demain, tes grimpeurs en profiteront pour récupérer !'))}
          accessibilityRole="button"
          accessibilityLabel="Jouer la compétition"
          style={({ pressed }) => [s.play, pressed && { transform: [{ scale: 0.98 }] }]}>
          <View style={s.playBody}>
            <Text style={s.playOver}>
              MANCHE {next.round}/{ROUNDS} · {L.short.toUpperCase()}
            </Text>
            <Text style={s.playTitle}>Combiné bloc + difficulté</Text>
            <View style={s.progress}>
              <View style={[s.progressFill, { width: `${(club.season.round / ROUNDS) * 100}%` }]} />
            </View>
            <Text style={s.playSmall}>Blocs niveau {next.difficulty} · les 3 premiers montent</Text>
          </View>
          <View style={s.playBtn}>
            <Icon name="play_arrow" size={34} color={G.bg} />
          </View>
        </Pressable>

        <View style={s.row}>
          <Pressable onPress={() => router.push('/manager/packs')} accessibilityRole="button" accessibilityLabel="Packs" style={({ pressed }) => [s.tile, pressed && s.pressed]}>
            <Icon name="redeem" size={26} color={G.gold} />
            <Text style={s.tileTitle}>Packs</Text>
            <Text style={s.tileText}>{club.packs.length > 0 ? `${club.packs.length} à ouvrir` : 'Boutique'}</Text>
            {club.packs.length > 0 && <View style={s.dot} />}
          </Pressable>
          <Pressable onPress={daily} disabled={!canClaimDaily(club)} accessibilityRole="button" accessibilityLabel="Récompense du jour" style={({ pressed }) => [s.tile, !canClaimDaily(club) && { opacity: 0.5 }, pressed && s.pressed]}>
            <Icon name="calendar_month" size={26} color={G.green} />
            <Text style={s.tileTitle}>Cadeau du jour</Text>
            <Text style={s.tileText}>{canClaimDaily(club) ? 'À récupérer' : `Série : ${club.daily.streak} j`}</Text>
            {canClaimDaily(club) && <View style={s.dot} />}
          </Pressable>
        </View>

        <GTabs
          options={[
            { value: 'equipe', label: `Équipe (${club.climbers.length}/${MAX_CLIMBERS})` },
            { value: 'objets', label: `Objets (${club.items.length})` },
            { value: 'ligue', label: 'Ligue' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <View style={s.helpRow}>
          <Text style={s.muted}>Comment ça marche ?</Text>
          <HelpTip topic={tab} />
        </View>

        {tab === 'equipe' && (
          <View style={s.grid}>
            {[...club.climbers]
              .sort((a, b) => ratingOf(b) - ratingOf(a))
              .map((c) => (
                <View key={c.id} style={{ width: cardW, gap: 6 }}>
                  <ManagerCard climber={c} club={club} width={cardW} onPress={() => router.push(`/manager/climber/${c.id}`)} />
                  <View style={s.under}>
                    <Text style={s.underText} numberOfLines={1}>
                      {c.program ? PROGRAMS.find((p) => p.id === c.program)?.name : 'Sans programme'}
                    </Text>
                    <View style={s.fatTrack}>
                      <View style={[s.fatFill, { width: `${c.fatigue}%`, backgroundColor: c.fatigue > 70 ? G.red : c.fatigue > 45 ? G.gold : G.green }]} />
                    </View>
                  </View>
                </View>
              ))}
          </View>
        )}

        {tab === 'objets' &&
          (club.items.length === 0 ? (
            <Panel>
              <Text style={s.muted}>Ouvre des packs pour gagner du matériel, des boosts, des coachs, des sponsors et des stages de compétence.</Text>
            </Panel>
          ) : (
            (Object.keys(KIND_LABEL) as Item['kind'][]).map((k) => {
              const list = club.items.filter((i) => i.kind === k);
              if (!list.length) return null;
              return (
                <Panel key={k}>
                  <Text style={s.panelTitle}>{KIND_LABEL[k]}</Text>
                  {list.map((it) => (
                    <View key={it.id} style={s.itemRow}>
                      <View style={[s.itemLv, { backgroundColor: ['#7D8A97', '#2F80ED', '#9B45E4', '#E9A100'][it.level - 1] }]}>
                        <Text style={s.itemLvText}>{it.level}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemName}>{it.name}</Text>
                        <Text style={s.muted}>{itemText(it)}</Text>
                      </View>
                      <Pressable
                        hitSlop={8}
                        accessibilityLabel={`Vendre ${it.name}`}
                        onPress={() =>
                          Alert.alert(`Vendre ${it.name} ?`, `Tu gagnes ${it.level * 60} pièces.`, [
                            { text: 'Annuler', style: 'cancel' },
                            {
                              text: 'Vendre',
                              onPress: () => {
                                sellItem(club, it.id);
                                setClub({ ...club });
                              },
                            },
                          ])
                        }>
                        <Icon name="sell" size={20} color={G.muted} />
                      </Pressable>
                    </View>
                  ))}
                </Panel>
              );
            })
          ))}

        {tab === 'ligue' && (
          <Panel>
            <Text style={s.panelTitle}>
              {L.name} · manche {club.season.round}/{ROUNDS}
            </Text>
            {table.map((r, i) => (
              <View key={r.id} style={[s.tableRow, r.mine && s.tableMine]}>
                <View style={[s.zone, { backgroundColor: i < 3 && club.league < 2 ? G.green : i >= 7 && club.league > 0 ? G.red : 'transparent' }]} />
                <Text style={s.pos}>{i + 1}</Text>
                <View style={[s.teamDot, { backgroundColor: r.color }]} />
                <Text style={[s.teamName, r.mine && { color: G.gold }]} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={s.strength}>{Math.round(r.strength)}</Text>
                <Text style={s.points}>{r.points}</Text>
              </View>
            ))}
            <Text style={s.muted}>Vert : montée · Rouge : descente · Le chiffre gris est la note moyenne de l’équipe.</Text>
          </Panel>
        )}
      </ScrollView>
    </View>
  );
}

function NewClub({ onCreate }: { onCreate: (c: Club) => void }) {
  const { top, bottom } = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [c1, setC1] = useState(CLUB_COLORS[0]);
  const [c2, setC2] = useState(CLUB_COLORS[12]);
  const colors: [string, string] = [c1, c2];
  return (
    <View style={s.screen}>
      <GameBackground colors={colors} />
      <ScrollView contentContainerStyle={[s.newContent, { paddingTop: top + 24, paddingBottom: bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Text style={s.newOver}>MYCLIMB MANAGER</Text>
        <Text style={s.newTitle}>Crée ton club</Text>
        <View style={s.crestBig}>
          <Crest colors={colors} size={130} letter={name || 'M'} />
        </View>
        <Panel>
          <Text style={s.panelTitle}>Nom du club</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Ex. : Les Grimpeurs de Montréal" placeholderTextColor={G.muted} style={s.input} maxLength={24} accessibilityLabel="Nom du club" />
          <Text style={s.panelTitle}>Couleur principale</Text>
          <ColorRow value={c1} onChange={setC1} />
          <Text style={s.panelTitle}>Deuxième couleur</Text>
          <ColorRow value={c2} onChange={setC2} />
        </Panel>
        <Text style={s.newText}>Tu démarres en Ligue régionale avec 3 grimpeurs bronze et un pack de bienvenue. À toi de recruter, d’entraîner et de viser la Coupe du monde.</Text>
        <GButton label="Créer mon club" icon="flag" onPress={() => onCreate(createClub(name, colors))} disabled={name.trim().length < 2} />
      </ScrollView>
    </View>
  );
}

function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={s.colors}>
      {CLUB_COLORS.map((c) => (
        <Pressable key={c} onPress={() => onChange(c)} accessibilityLabel={`Couleur ${c}`} style={[s.color, { backgroundColor: c }, value === c && s.colorOn]} />
      ))}
    </View>
  );
}

const s = themedStyles({
  helpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: -6 },
  screen: { flex: 1, backgroundColor: G.bg },
  content: { paddingHorizontal: 16, gap: 16 },
  pressed: { transform: [{ scale: 0.97 }] },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroBody: { flex: 1, gap: 6 },
  clubName: { color: G.text, fontSize: 26, fontWeight: '900' },
  league: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, height: 24, borderRadius: 12 },
  leagueText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  muted: { color: G.muted, fontSize: 13, lineHeight: 18 },
  play: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 22, backgroundColor: G.accent, shadowColor: G.accent, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  playBody: { flex: 1, gap: 4 },
  playOver: { color: G.bg, fontWeight: '800', fontSize: 12, letterSpacing: 1, opacity: 0.8 },
  playTitle: { color: '#fff', fontWeight: '900', fontSize: 20 },
  progress: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.2)', overflow: 'hidden', marginTop: 4 },
  progressFill: { height: 6, backgroundColor: '#fff' },
  playSmall: { color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '600' },
  playBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: G.gold, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, padding: 16, gap: 4, borderRadius: 20, backgroundColor: 'rgba(26,34,87,0.85)', borderWidth: 1, borderColor: G.line },
  tileTitle: { color: G.text, fontWeight: '800', fontSize: 16, marginTop: 4 },
  tileText: { color: G.muted, fontSize: 13 },
  dot: { position: 'absolute', top: 12, right: 12, width: 10, height: 10, borderRadius: 5, backgroundColor: G.red },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  under: { gap: 4, paddingHorizontal: 4 },
  underText: { color: G.muted, fontSize: 12, fontWeight: '700' },
  fatTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fatFill: { height: 5, borderRadius: 3 },
  panelTitle: { color: G.text, fontWeight: '800', fontSize: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  itemLv: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  itemLvText: { color: '#fff', fontWeight: '900' },
  itemName: { color: G.text, fontWeight: '700', fontSize: 15 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: 10, paddingRight: 8 },
  tableMine: { backgroundColor: 'rgba(255,212,59,0.12)' },
  zone: { width: 4, height: 24, borderRadius: 2 },
  pos: { width: 20, color: G.muted, fontWeight: '800', textAlign: 'center' },
  teamDot: { width: 12, height: 12, borderRadius: 6 },
  teamName: { flex: 1, color: G.text, fontWeight: '700' },
  strength: { width: 30, color: G.muted, fontWeight: '700', textAlign: 'right' },
  points: { width: 34, color: G.text, fontWeight: '900', textAlign: 'right' },
  newContent: { paddingHorizontal: 20, gap: 18 },
  newOver: { color: G.gold, fontWeight: '800', letterSpacing: 2, textAlign: 'center' },
  newTitle: { color: G.text, fontWeight: '900', fontSize: 32, textAlign: 'center' },
  crestBig: { alignItems: 'center' },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 14, color: G.text, fontSize: 16, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.08)' },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  color: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  colorOn: { borderColor: '#fff', borderWidth: 3, transform: [{ scale: 1.1 }] },
  newText: { color: G.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
