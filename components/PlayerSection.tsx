import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { PackArt } from '@/components/Collectible';
import { PlayerCardView } from '@/components/PlayerCard';
import { SkinPicker } from '@/components/SkinPicker';
import { Button, Card, Icon, Sheet, styles as ui } from '@/components/ui';
import { equipped, ownsSkin, pendingPacks, syncFromJournal } from '@/lib/collection';
import type { BackdropId, FrameId, TitleId } from '@/lib/cosmetics';
import { getSetting, setSetting, type Block, type TrainingLog } from '@/lib/db';
import { cardTrend, STATS, type StatId } from '@/lib/playerCard';
import { DEFAULT_SKIN, isSkin, SKIN_KEY, type SkinId } from '@/lib/skins';
import { todayIso } from '@/lib/stats';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';
import { useCollectionSummary } from '@/lib/useCollection';
import { useTicker } from '@/lib/useTicker';

const NAME_KEY = 'playerName';
const readName = () => getSetting(NAME_KEY) ?? 'Clement';
const readSkin = (): SkinId => {
  const v = getSetting(SKIN_KEY);
  return isSkin(v) && ownsSkin(v) ? v : DEFAULT_SKIN;
};
const readLook = () => ({
  frame: equipped('contour') as FrameId | null,
  backdrop: equipped('fond') as BackdropId | null,
  title: equipped('titre') as TitleId | null,
});
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
  const [look, setLook] = useState(readLook);
  const focused = useIsFocused();
  // Le costume peut aussi changer dans la simulation, les objets dans la collection ; les packs
  // mérités depuis la dernière fois sont donnés ici.
  useFocusEffect(
    useCallback(() => {
      syncFromJournal();
      setSkin(readSkin());
      setLook(readLook());
    }, []),
  );
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
        <PlayerCardView
          card={card}
          name={name}
          skin={skin}
          frame={look.frame}
          backdrop={look.backdrop}
          title={look.title}
          animate={focused}
          changes={changes}
          width={cardW}
          onPress={() => setEdit(true)}
        />
        <Pressable onPress={() => setEdit(true)} style={s.link} hitSlop={8} accessibilityLabel="Costume et nom">
          <Icon name="checkroom" size={18} color={colors.primary} />
          <Text style={s.linkText}>Costume et nom</Text>
        </Pressable>
      </View>

      <CollectionEntry focused={focused} />

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

/** Packs à ouvrir et collection, sous la carte. */
function CollectionEntry({ focused }: { focused: boolean }) {
  const router = useRouter();
  const sum = useCollectionSummary();
  const next = sum.packs ? pendingPacks()[0] : null;
  const t = useTicker(focused && sum.packs > 0, 20);
  return (
    <Card style={s.collection}>
      <Pressable
        onPress={() => router.push('/collection/packs')}
        style={({ pressed }) => [s.packRow, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={sum.packs ? 'Ouvrir mes packs' : 'Gagner des packs'}>
        <View style={!next && { opacity: 0.4 }}>
          <PackArt kind={next?.kind ?? 'seance'} w={48} t={t} count={sum.packs} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.title}>{sum.packs ? `${sum.packs} pack${sum.packs > 1 ? 's' : ''} à ouvrir` : 'Aucun pack à ouvrir'}</Text>
          <Text style={s.helpMuted} numberOfLines={2}>
            {next ? next.reason : 'Une séance de 5 grimpes ou plus = un pack de cartes.'}
          </Text>
        </View>
        {next ? <Button label="Ouvrir" size="sm" onPress={() => router.push('/collection/packs')} /> : <Icon name="chevron_right" size={20} color={colors.muted} />}
      </Pressable>
      <Pressable
        onPress={() => router.push('/collection')}
        style={({ pressed }) => [s.collRow, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Ma collection">
        <Icon name="collections_bookmark" size={20} color={colors.primary} />
        <Text style={s.collTitle}>Ma collection</Text>
        {sum.fresh > 0 && <View style={s.freshDot} />}
        <Text style={s.collCount}>
          {sum.owned}/{sum.total}
        </Text>
        <Icon name="water_drop" size={16} color={colors.primary} />
        <Text style={s.collCount}>{sum.chalk}</Text>
        <Icon name="chevron_right" size={20} color={colors.muted} />
      </Pressable>
    </Card>
  );
}

const s = themedStyles({
  collection: { gap: space.md },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  collRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  collTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  collCount: { fontSize: 14, fontWeight: '700', color: colors.muted },
  freshDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
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
