import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { PlayerCardView } from '@/components/PlayerCard';
import { SkinPicker } from '@/components/SkinPicker';
import { Button, Card, Icon, Sheet, styles as ui } from '@/components/ui';
import { getSetting, setSetting, type Block, type TrainingLog } from '@/lib/db';
import { cardTrend, STATS, type StatId } from '@/lib/playerCard';
import { DEFAULT_SKIN, isSkin, SKIN_KEY, type SkinId } from '@/lib/skins';
import { todayIso } from '@/lib/stats';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

const NAME_KEY = 'playerName';
const readName = () => getSetting(NAME_KEY) ?? 'Clement';
const readSkin = (): SkinId => {
  const v = getSetting(SKIN_KEY);
  return isSkin(v) ? v : DEFAULT_SKIN;
};
const signed = (v: number) => {
  const r = Math.round(v * 10) / 10;
  const t = Math.abs(r).toFixed(1).replace('.', ',').replace(',0', '');
  return r > 0 ? `+${t}` : r < 0 ? `−${t}` : '=';
};

/** Carte joueur en haut des statistiques, avec la progression de chaque stat sur 7 et 30 jours. */
export function PlayerSection({ blocks, logs }: { blocks: Block[]; logs: TrainingLog[] }) {
  const { width } = useWindowDimensions();
  const [name, setName] = useState(readName);
  const [skin, setSkin] = useState(readSkin);
  const [edit, setEdit] = useState(false);
  const [help, setHelp] = useState(false);
  // Le costume peut aussi changer dans les réglages de la simulation.
  useFocusEffect(useCallback(() => setSkin(readSkin()), []));
  const today = todayIso();
  const { card, week, month } = useMemo(() => cardTrend(blocks, logs, today), [blocks, logs, today]);

  const changes = {} as Record<StatId, number>;
  for (const st of STATS) changes[st.id] = Math.floor(card.stats[st.id]) - Math.floor(month.stats[st.id]);
  const cardW = Math.min(width - 2 * space.lg - 2 * space.xl, 320);

  const changeName = (v: string) => {
    setName(v);
    setSetting(NAME_KEY, v.trim());
  };
  const changeSkin = (id: SkinId) => {
    setSkin(id);
    setSetting(SKIN_KEY, id);
  };

  return (
    <>
      <View style={s.cardWrap}>
        <PlayerCardView card={card} name={name} skin={skin} changes={changes} width={cardW} onPress={() => setEdit(true)} />
        <Pressable onPress={() => setEdit(true)} style={s.link} hitSlop={8} accessibilityLabel="Costume et nom">
          <Icon name="checkroom" size={18} color={colors.primary} />
          <Text style={s.linkText}>Costume et nom</Text>
        </Pressable>
      </View>

      <Card style={s.panel}>
        <View style={s.row}>
          <Text style={s.title}>Mes stats</Text>
          <Text style={s.colHead}>7 j</Text>
          <Text style={s.colHead}>30 j</Text>
        </View>
        {STATS.map((st) => {
          const v = card.stats[st.id];
          const change = (d: number) => (
            <Text style={[s.rowChange, d >= 0.05 ? s.up : d <= -0.05 ? s.down : null]}>{signed(d)}</Text>
          );
          return (
            <View key={st.id} style={s.row}>
              <Text style={s.rowName}>{st.name}</Text>
              <Text style={s.rowValue}>{Math.floor(v)}</Text>
              {/* Ce qui manque pour le point suivant : chaque séance remplit un peu la barre. */}
              <View style={s.track}>
                <View style={[s.bar, { width: `${Math.round((v - Math.floor(v)) * 100)}%` }]} />
              </View>
              {change(v - week.stats[st.id])}
              {change(v - month.stats[st.id])}
            </View>
          );
        })}
        {card.next && (
          <View style={s.next}>
            <Icon name="military_tech" size={18} color={colors.primary} />
            <Text style={s.nextText}>
              Encore {card.next.missing} point{card.next.missing > 1 ? 's' : ''} de note globale pour la carte {card.next.name}.
            </Text>
          </View>
        )}
        <Pressable onPress={() => setHelp(!help)} style={s.link} accessibilityLabel="Comment faire monter mes stats">
          <Text style={s.linkText}>Comment les faire monter ?</Text>
          <Icon name={help ? 'expand_less' : 'expand_more'} size={18} color={colors.primary} />
        </Pressable>
        {help && (
          <View style={s.help}>
            {STATS.map((st) => (
              <Text key={st.id} style={s.helpText}>
                <Text style={s.helpName}>{st.name} : </Text>
                {st.what}
              </Text>
            ))}
            <Text style={s.helpMuted}>
              Les cotations réussies comptent le plus, puis tout ce que tu grimpes et travailles : plus c’est dur pour
              toi, plus ça compte. Une séance compte à partir de 5 grimpes. Sans séance, les stats baissent doucement.
            </Text>
          </View>
        )}
      </Card>

      <Sheet visible={edit} onClose={() => setEdit(false)} title="Ma carte" footer={<Button label="OK" onPress={() => setEdit(false)} />}>
        <Text style={s.label}>Nom sur la carte</Text>
        <TextInput
          value={name}
          onChangeText={changeName}
          placeholder="Ton prénom"
          placeholderTextColor={colors.muted}
          style={ui.input}
          maxLength={14}
          accessibilityLabel="Nom sur la carte"
        />
        <Text style={s.label}>Costume</Text>
        <SkinPicker value={skin} onChange={changeSkin} />
        <Text style={s.helpMuted}>Le costume est le même dans la simulation 3D.</Text>
      </Sheet>
    </>
  );
}

const s = themedStyles({
  cardWrap: { alignItems: 'center', paddingVertical: space.sm, gap: space.md },
  panel: { gap: space.md },
  title: { ...type.headline, flex: 1 },
  colHead: { ...type.caption, width: 38, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowName: { width: 80, fontSize: 14, fontWeight: '600', color: colors.text },
  rowValue: { width: 26, fontSize: 15, fontWeight: '800', color: colors.text, textAlign: 'right' },
  track: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.surface, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  rowChange: { width: 38, fontSize: 13, fontWeight: '700', color: colors.muted, textAlign: 'right' },
  up: { color: colors.success },
  down: { color: colors.danger },
  next: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  nextText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  help: { gap: space.sm },
  helpText: { ...type.body, fontSize: 14, lineHeight: 20 },
  helpName: { fontWeight: '700', color: colors.text },
  helpMuted: { ...type.caption, lineHeight: 18 },
  label: { ...type.callout },
});
