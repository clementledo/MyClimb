import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ManagerCard } from '@/components/ManagerCard';
import { G, GameBackground, GameHeader, GButton, Panel, StatBar } from '@/components/ManagerUi';
import { Icon } from '@/components/ui';
import { equip, itemText, loadClub, nameOf, PROGRAMS, release, sellPrice, setProgram, statWithGear, teachSkill, TEAM_SIZE, trainSpeed, unequip, type Club } from '@/lib/manager';
import { MSTATS, SKILLS, STYLES } from '@/lib/managerData';
import { themedStyles } from '@/lib/theme';

export default function ClimberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const [club, setClub] = useState<Club | null>(loadClub);
  const c = club?.climbers.find((x) => x.id === id);
  if (!club || !c) return <View style={s.screen} />;
  const refresh = () => setClub({ ...club });
  const gear = club.items.filter((i) => i.kind === 'materiel');
  const stages = club.items.filter((i) => i.kind === 'competence' && i.skill && !c.skills.includes(i.skill));
  const nextPot = 100 - (c.xp % 100);

  return (
    <View style={s.screen}>
      <GameBackground colors={club.colors} />
      <GameHeader title={nameOf(c)} club={club} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}>
        <View style={s.top}>
          <ManagerCard climber={c} club={club} width={190} />
        </View>
        <Panel>
          <Text style={s.title}>
            {c.flag} {STYLES[c.style].name}
          </Text>
          <Text style={s.bio}>{c.bio}</Text>
          <View style={s.facts}>
            <Fact label="Potentiel" value={String(c.potential)} />
            <Fact label="Compétitions" value={String(c.comps)} />
            <Fact label="Tops" value={String(c.tops)} />
          </View>
          <Text style={s.muted}>Encore {nextPot} XP pour +1 de potentiel. Le potentiel est le plafond de ses stats.</Text>
          <StatBar label="Fatigue" value={c.fatigue} max={100} color={c.fatigue > 70 ? G.red : c.fatigue > 45 ? G.gold : G.green} />
          {c.fatigue > 45 && <Text style={s.warn}>Fatigué : il grimpe moins bien et progresse moins. Mets-le au repos ou fais tourner l’équipe.</Text>}
        </Panel>

        <Panel>
          <Text style={s.title}>Stats</Text>
          {MSTATS.map((m) => (
            <StatBar key={m.id} label={m.name} value={c.stats[m.id]} extra={statWithGear(club, c, m.id) - c.stats[m.id]} color={STYLES[c.style].strong.includes(m.id) ? G.accent : G.blue} />
          ))}
        </Panel>

        <Panel>
          <Text style={s.title}>Programme d’entraînement</Text>
          <Text style={s.muted}>Il s’entraîne même quand l’app est fermée. Plus une stat est proche du potentiel, plus elle monte lentement.</Text>
          <View style={s.chips}>
            {PROGRAMS.map((p) => {
              const on = c.program === p.id;
              const boost = p.id !== 'repos' ? Math.round((trainSpeed(club, p.id) - 1) * 100) : 0;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setProgram(club, c.id, on ? null : p.id);
                    refresh();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Programme ${p.name}`}
                  style={[s.chip, on && s.chipOn, p.id === 'repos' && !on && { borderColor: G.green }]}>
                  <Text style={[s.chipText, on && { color: G.bg }]}>
                    {p.name}
                    {boost > 0 ? ` +${boost}%` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Panel>

        <Panel>
          <Text style={s.title}>Matériel ({c.gear.length}/2)</Text>
          {gear.length === 0 && <Text style={s.muted}>Pas encore de matériel : il se gagne dans les packs.</Text>}
          {gear.map((it) => {
            const worn = c.gear.includes(it.id);
            const other = club.climbers.find((o) => o.id !== c.id && o.gear.includes(it.id));
            return (
              <Pressable
                key={it.id}
                onPress={() => {
                  if (worn) unequip(club, c.id, it.id);
                  else equip(club, c.id, it.id);
                  refresh();
                }}
                accessibilityLabel={`${worn ? 'Retirer' : 'Équiper'} ${it.name}`}
                style={[s.itemRow, worn && s.itemOn]}>
                <Icon name={worn ? 'check_circle' : 'checkroom'} size={22} color={worn ? G.green : G.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{it.name}</Text>
                  <Text style={s.muted}>
                    {itemText(it)}
                    {other ? ` · porté par ${other.first}` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Panel>

        <Panel>
          <Text style={s.title}>Compétences</Text>
          {c.skills.length === 0 && <Text style={s.muted}>Aucune pour l’instant. Les stages de compétence s’obtiennent dans les packs.</Text>}
          {c.skills.map((k) => (
            <View key={k} style={s.itemRow}>
              <Icon name={SKILLS[k].icon} size={22} color={G.gold} />
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{SKILLS[k].name}</Text>
                <Text style={s.muted}>{SKILLS[k].text}</Text>
              </View>
            </View>
          ))}
          {stages.map((it) => (
            <GButton
              key={it.id}
              label={`Apprendre « ${SKILLS[it.skill!].name} »`}
              icon="school"
              tone="ghost"
              onPress={() => {
                teachSkill(club, c.id, it.id);
                refresh();
              }}
            />
          ))}
        </Panel>

        <GButton
          label={`Libérer (+${sellPrice(c)} pièces)`}
          tone="ghost"
          disabled={club.climbers.length <= TEAM_SIZE}
          onPress={() =>
            Alert.alert(`Libérer ${nameOf(c)} ?`, `Il quitte ton club et tu gagnes ${sellPrice(c)} pièces. Impossible d’annuler.`, [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Libérer',
                style: 'destructive',
                onPress: () => {
                  release(club, c.id);
                  router.back();
                },
              },
            ])
          }
        />
      </ScrollView>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.fact}>
      <Text style={s.factValue}>{value}</Text>
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

const s = themedStyles({
  screen: { flex: 1, backgroundColor: G.bg },
  content: { paddingHorizontal: 16, gap: 16 },
  top: { alignItems: 'center', paddingVertical: 8 },
  title: { color: G.text, fontWeight: '800', fontSize: 17 },
  bio: { color: G.text, opacity: 0.9, fontSize: 15, lineHeight: 21, fontStyle: 'italic' },
  muted: { color: G.muted, fontSize: 13, lineHeight: 18 },
  warn: { color: G.gold, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  facts: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6 },
  fact: { alignItems: 'center' },
  factValue: { color: G.text, fontWeight: '900', fontSize: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center', borderWidth: 1.5, borderColor: G.line, backgroundColor: 'rgba(255,255,255,0.05)' },
  chipOn: { backgroundColor: G.gold, borderColor: G.gold },
  chipText: { color: G.text, fontWeight: '700', fontSize: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12 },
  itemOn: { backgroundColor: 'rgba(81,207,102,0.12)' },
  itemName: { color: G.text, fontWeight: '700', fontSize: 15 },
});
