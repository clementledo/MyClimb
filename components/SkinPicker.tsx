import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { ownsSkin, PRICE } from '@/lib/collection';
import { rarityOf } from '@/lib/rarity';
import { SKIN_IMAGES } from '@/lib/skinImages';
import { SKINS, type SkinId } from '@/lib/skins';
import { colors, radius, space, themedStyles } from '@/lib/theme';

/**
 * Les costumes du grimpeur en vignettes qui défilent ; celui porté est entouré. Ceux qu'on n'a
 * pas encore (à gagner dans les packs) suivent, grisés avec un cadenas.
 */
export function SkinPicker({ value, onChange }: { value: SkinId; onChange: (id: SkinId) => void }) {
  const router = useRouter();
  const list = [...SKINS].sort((a, b) => Number(!ownsSkin(a.id)) - Number(!ownsSkin(b.id)));
  const locked = (k: (typeof SKINS)[number]) => {
    const r = rarityOf(k.rarity!);
    Alert.alert(`${k.name} · ${r.name}`, `Ce costume se gagne dans les packs de cartes, ou s’achète ${PRICE[k.rarity!]} magnésie dans ta collection.`, [
      { text: 'OK', style: 'cancel' },
      { text: 'Voir la collection', onPress: () => router.push('/collection') },
    ]);
  };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {list.map((k) => {
        const on = k.id === value;
        const mine = ownsSkin(k.id);
        const img = SKIN_IMAGES[k.id]?.full;
        return (
          <Pressable
            key={k.id}
            onPress={() => (mine ? onChange(k.id) : locked(k))}
            accessibilityLabel={`Costume ${k.name}${mine ? '' : ', à gagner'}`}
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [s.item, on && s.itemOn, !mine && k.rarity && { borderColor: rarityOf(k.rarity).light }, pressed && { opacity: 0.7 }]}>
            <View style={!mine && s.dim}>{img ? <Image source={img} style={s.img} contentFit="contain" /> : <View style={s.img} />}</View>
            {!mine && (
              <View style={s.lock} pointerEvents="none">
                <Icon name="lock" size={16} color="#FFFFFF" />
              </View>
            )}
            <Text style={[s.name, on && s.nameOn, !mine && k.rarity && { color: rarityOf(k.rarity).dark }]} numberOfLines={1}>
              {k.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = themedStyles({
  row: { gap: space.sm, paddingVertical: 2 },
  item: {
    width: 86,
    alignItems: 'center',
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  itemOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  img: { width: 66, height: 110 },
  dim: { opacity: 0.3 },
  lock: {
    position: 'absolute',
    top: 48,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(20,24,31,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { marginTop: 4, fontSize: 12, fontWeight: '600', color: colors.muted },
  nameOn: { color: colors.primary, fontWeight: '800' },
});
