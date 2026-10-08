import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, useWindowDimensions, Vibration, View } from 'react-native';

import { CelebrationArt, ItemCard, PackArt, ThemePreview } from '@/components/Collectible';
import { PlayerCardView } from '@/components/PlayerCard';
import { Button, Icon, Sheet } from '@/components/ui';
import {
  buy,
  chalkBalance,
  equip,
  equipped,
  isEquipped,
  itemsOf,
  KINDS,
  kindOf,
  markSeen,
  onCollectionChange,
  ownedAt,
  owns,
  pendingPacks,
  PRICE,
  syncFromJournal,
  type Item,
  type Kind,
} from '@/lib/collection';
import { CELEBRATIONS, type BackdropId, type CelebrationId, type FrameId, type TitleId } from '@/lib/cosmetics';
import { getSetting, listBlocks, listTrainingLogs } from '@/lib/db';
import { playerCard } from '@/lib/playerCard';
import { RARITIES, rarityOf, type Rarity } from '@/lib/rarity';
import { DEFAULT_SKIN, isSkin, SKIN_KEY, type SkinId } from '@/lib/skins';
import { todayIso } from '@/lib/stats';
import { colors, radius, space, ThemeSwitch, themedStyles, type, type ThemeId } from '@/lib/theme';
import { useCollectionSummary } from '@/lib/useCollection';
import { useTicker } from '@/lib/useTicker';

const GAP = 12;

/** Ce qu'il faut pour montrer les objets sur la carte du joueur. */
function readPlayer() {
  const v = getSetting(SKIN_KEY);
  const skin: SkinId = isSkin(v) && owns(`costume:${v}`) ? v : DEFAULT_SKIN;
  const card = playerCard(listBlocks(), listTrainingLogs(), todayIso());
  return { card, skin, name: getSetting('playerName') ?? 'Clement' };
}

const DESCRIPTION: Record<Kind, string> = {
  costume: 'Costume du grimpeur, sur ta carte et dans la simulation 3D.',
  contour: 'Contour de ta carte joueur.',
  fond: 'Fond de ta carte joueur, derrière ton grimpeur.',
  titre: 'Titre affiché sous ton nom, sur ta carte joueur.',
  celebration: 'Se joue en 3D quand ton grimpeur arrive au top, dans la Simulation.',
  theme: 'Couleurs de toute l’application.',
};

type Row = { key: string; rarity: Rarity; header: true; owned: number; total: number } | { key: string; items: ReturnType<typeof itemsOf> };

export default function CollectionScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const switcher = useContext(ThemeSwitch);
  const { width } = useWindowDimensions();
  const summary = useCollectionSummary();
  const [kind, setKind] = useState<Kind>('costume');
  const [version, setVersion] = useState(0);
  const [player, setPlayer] = useState(readPlayer);
  const [selected, setSelected] = useState<Item | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => onCollectionChange(() => setVersion((v) => v + 1)), []);
  useFocusEffect(
    useCallback(() => {
      syncFromJournal();
      setPlayer(readPlayer());
    }, []),
  );

  const items = useMemo(() => itemsOf(kind), [kind, version]); // eslint-disable-line react-hooks/exhaustive-deps
  // Les objets nouveaux ne le sont plus une fois qu'on a quitté leur onglet ou la collection.
  const seen = useRef<string[]>([]);
  useEffect(() => {
    seen.current = items.filter((x) => x.fresh).map((x) => x.item.id);
  }, [items]);
  useEffect(() => () => markSeen(seen.current), [kind]);
  useEffect(() => {
    if (!focused) markSeen(seen.current);
  }, [focused]);

  const cols = 3;
  const cardW = Math.floor((width - 2 * space.lg - (cols - 1) * GAP) / cols);
  const rows: Row[] = [];
  for (const r of [...RARITIES].reverse()) {
    const list = items.filter((x) => x.item.rarity === r.id);
    if (!list.length) continue;
    rows.push({ key: `h-${r.id}`, rarity: r.id, header: true, owned: list.filter((x) => x.owned).length, total: list.length });
    for (let i = 0; i < list.length; i += cols) rows.push({ key: list[i].item.id, items: list.slice(i, i + cols) });
  }

  const counts = (k: Kind) => {
    const all = itemsOf(k);
    return `${all.filter((x) => x.owned).length}/${all.length}`;
  };
  const freshIn = (k: Kind) => itemsOf(k).some((x) => x.fresh);

  const header = (
    <View style={s.head}>
      <View style={s.summary}>
        <View style={s.summaryTop}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.bigCount}>
              {summary.owned}
              <Text style={s.bigTotal}> / {summary.total}</Text>
            </Text>
            <Text style={s.muted}>objets obtenus</Text>
          </View>
          <View style={s.chalk} accessibilityLabel={`${summary.chalk} de magnésie`}>
            <Icon name="water_drop" size={18} color={colors.primary} />
            <Text style={s.chalkText}>{summary.chalk}</Text>
          </View>
        </View>
        <View style={s.track}>
          <View style={[s.bar, { width: `${Math.round((summary.owned / summary.total) * 100)}%` }]} />
        </View>
        <Pressable
          onPress={() => router.push('/collection/packs')}
          style={({ pressed }) => [s.packRow, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir mes packs">
          <PackArt kind={pendingPacks()[0]?.kind ?? 'seance'} w={34} count={summary.packs} />
          <View style={{ flex: 1 }}>
            <Text style={s.packTitle}>{summary.packs ? `${summary.packs} pack${summary.packs > 1 ? 's' : ''} à ouvrir` : 'Aucun pack à ouvrir'}</Text>
            <Text style={s.muted}>{summary.packs ? 'Touche pour les ouvrir' : 'Comment en gagner ?'}</Text>
          </View>
          <Icon name="chevron_right" size={20} color={colors.muted} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {KINDS.map((k) => {
          const active = k.id === kind;
          return (
            <Pressable
              key={k.id}
              onPress={() => setKind(k.id)}
              accessibilityState={{ selected: active }}
              accessibilityLabel={k.plural}
              style={({ pressed }) => [s.tab, active && s.tabActive, pressed && { opacity: 0.7 }]}>
              <Icon name={k.icon} size={18} color={active ? colors.onPrimary : colors.text} />
              <Text style={[s.tabText, active && s.tabTextActive]}>{k.plural}</Text>
              <Text style={[s.tabCount, active && s.tabTextActive]}>{counts(k.id)}</Text>
              {freshIn(k.id) && <View style={s.freshDot} />}
            </Pressable>
          );
        })}
      </ScrollView>
      {message && (
        <View style={s.toast}>
          <Icon name="check_circle" size={20} color={colors.success} />
          <Text style={s.toastText}>{message}</Text>
        </View>
      )}
    </View>
  );

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  };

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        ListHeaderComponent={header}
        contentContainerStyle={s.list}
        initialNumToRender={8}
        windowSize={7}
        renderItem={({ item: row }) =>
          'header' in row ? (
            <View style={s.rarityHead}>
              <View style={[s.rarityDot, { backgroundColor: rarityOf(row.rarity).color }]} />
              <Text style={s.rarityName}>{rarityOf(row.rarity).name}</Text>
              <Text style={s.rarityCount}>
                {row.owned} / {row.total}
              </Text>
            </View>
          ) : (
            <View style={s.row}>
              {row.items.map((x) => (
                <ItemCard
                  key={x.item.id}
                  item={x.item}
                  width={cardW}
                  owned={x.owned}
                  fresh={x.fresh}
                  equipped={x.owned && isEquipped(x.item)}
                  tier={player.card.tier}
                  skin={player.skin}
                  onPress={() => setSelected(x.item)}
                />
              ))}
            </View>
          )
        }
      />
      <ItemSheet
        item={selected}
        player={player}
        onClose={() => setSelected(null)}
        onBought={(i) => {
          Vibration.vibrate(40);
          flash(`${i.name} est à toi !`);
        }}
        onEquip={(i) => {
          if (i.kind === 'theme') {
            setSelected(null);
            switcher.theme(i.ref as ThemeId, '/collection');
            return;
          }
          equip(i.kind, i.ref);
          setPlayer(readPlayer());
          flash(i.kind === 'costume' ? `Costume ${i.name} enfilé` : `${i.name} choisi`);
        }}
        onRemove={(i) => {
          equip(i.kind, '');
          flash(`${kindOf(i.kind).name} retiré`);
        }}
      />
    </>
  );
}

/** Fiche d'un objet : grand aperçu (sur ta carte quand c'est pour la carte), et l'action possible. */
function ItemSheet({
  item,
  player,
  onClose,
  onBought,
  onEquip,
  onRemove,
}: {
  item: Item | null;
  player: ReturnType<typeof readPlayer>;
  onClose: () => void;
  onBought: (i: Item) => void;
  onEquip: (i: Item) => void;
  onRemove: (i: Item) => void;
}) {
  const { width } = useWindowDimensions();
  const [, refresh] = useState(0);
  const t = useTicker(!!item && (item.kind === 'celebration' || item.rarity === 'mythique'));
  if (!item) return null;
  const r = rarityOf(item.rarity);
  const mine = owns(item.id);
  const worn = mine && isEquipped(item);
  const price = PRICE[item.rarity];
  const chalk = chalkBalance();
  const at = ownedAt(item.id);
  const cardW = Math.min(width * 0.56, 230);
  // Aperçu sur la carte du joueur, avec ce qu'il porte déjà.
  const look = {
    frame: (item.kind === 'contour' ? item.ref : equipped('contour')) as FrameId | null,
    backdrop: (item.kind === 'fond' ? item.ref : equipped('fond')) as BackdropId | null,
    title: (item.kind === 'titre' ? item.ref : equipped('titre')) as TitleId | null,
    skin: (item.kind === 'costume' ? item.ref : player.skin) as SkinId,
  };
  const blurb = item.kind === 'celebration' ? CELEBRATIONS.find((c) => c.id === item.ref)?.blurb : undefined;
  const equipLabel =
    item.kind === 'costume'
      ? 'Enfiler ce costume'
      : item.kind === 'theme'
        ? 'Appliquer ce thème'
        : item.kind === 'celebration'
          ? 'Choisir cette célébration'
          : 'Mettre sur ma carte';
  const footer = mine ? (
    worn ? (
      item.kind === 'costume' || item.kind === 'theme' ? (
        <Button label="Déjà porté" icon="check" variant="secondary" onPress={onClose} />
      ) : (
        <Button
          label="Retirer"
          variant="secondary"
          onPress={() => {
            onRemove(item);
            refresh((n) => n + 1);
          }}
        />
      )
    ) : (
      <Button
        label={equipLabel}
        icon="check"
        onPress={() => {
          onEquip(item);
          refresh((n) => n + 1);
        }}
      />
    )
  ) : (
    <Button
      label={`Acheter · ${price} magnésie`}
      icon="water_drop"
      disabled={chalk < price}
      onPress={() => {
        if (buy(item.id)) {
          onBought(item);
          refresh((n) => n + 1);
        }
      }}
    />
  );
  return (
    <Sheet visible onClose={onClose} title={item.name} footer={<View style={s.sheetFooter}>{footer}</View>}>
      <View style={s.sheetPreview}>
        {item.kind === 'celebration' ? (
          <CelebrationArt id={item.ref as CelebrationId} w={cardW * 1.1} h={cardW * 1.1} t={t} />
        ) : item.kind === 'theme' ? (
          <ThemePreview id={item.ref as ThemeId} w={cardW} h={cardW * 0.8} />
        ) : (
          <PlayerCardView card={player.card} name={player.name} skin={look.skin} frame={look.frame} backdrop={look.backdrop} title={look.title} width={cardW} />
        )}
      </View>
      <View style={s.sheetInfo}>
        <View style={[s.rarityChip, { backgroundColor: r.light }]}>
          <View style={[s.rarityDot, { backgroundColor: r.color }]} />
          <Text style={[s.rarityChipText, { color: r.dark }]}>{r.name}</Text>
        </View>
        <Text style={s.kindText}>{kindOf(item.kind).name}</Text>
      </View>
      <Text style={s.sheetText}>{blurb ?? DESCRIPTION[item.kind]}</Text>
      {mine ? (
        <Text style={s.sheetMuted}>{at ? `Obtenu le ${new Date(at).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })}.` : 'Déjà à toi.'}</Text>
      ) : (
        <Text style={s.sheetMuted}>
          Pas encore obtenu. Il peut sortir d’un pack, ou s’acheter avec la magnésie que donnent les doublons
          {chalk < price ? ` (il te manque ${price - chalk} magnésie).` : '.'}
        </Text>
      )}
    </Sheet>
  );
}

const s = themedStyles({
  list: { padding: space.lg, paddingBottom: 48, gap: GAP },
  head: { gap: space.lg, marginBottom: space.xs },
  summary: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  bigCount: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
  bigTotal: { fontSize: 18, fontWeight: '700', color: colors.muted },
  muted: { fontSize: 13, color: colors.muted },
  chalk: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  chalkText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surface, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  packTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  tabs: { gap: space.sm, paddingRight: space.lg },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.text },
  tabCount: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.onPrimary },
  freshDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.successSoft },
  toastText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  rarityHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  rarityDot: { width: 10, height: 10, borderRadius: 5 },
  rarityName: { ...type.headline, flex: 1 },
  rarityCount: { fontSize: 14, fontWeight: '700', color: colors.muted },
  row: { flexDirection: 'row', gap: GAP, paddingTop: 4 },
  sheetPreview: { alignItems: 'center', paddingVertical: space.sm },
  sheetInfo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rarityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  rarityChipText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  kindText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  sheetText: { ...type.body },
  sheetMuted: { ...type.caption, lineHeight: 18 },
  sheetFooter: { paddingTop: space.md },
});
