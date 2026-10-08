import { Image } from 'expo-image';
import { Pressable, ScrollView, Text } from 'react-native';

import { SKIN_IMAGES } from '@/lib/skinImages';
import { SKINS, type SkinId } from '@/lib/skins';
import { colors, radius, space, themedStyles } from '@/lib/theme';

/** Les costumes du grimpeur en vignettes qui défilent ; celui porté est entouré. */
export function SkinPicker({ value, onChange }: { value: SkinId; onChange: (id: SkinId) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {SKINS.map((k) => {
        const on = k.id === value;
        return (
          <Pressable
            key={k.id}
            onPress={() => onChange(k.id)}
            accessibilityLabel={`Costume ${k.name}`}
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [s.item, on && s.itemOn, pressed && { opacity: 0.7 }]}>
            <Image source={SKIN_IMAGES[k.id].full} style={s.img} contentFit="contain" />
            <Text style={[s.name, on && s.nameOn]} numberOfLines={1}>
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
  name: { marginTop: 4, fontSize: 12, fontWeight: '600', color: colors.muted },
  nameOn: { color: colors.primary, fontWeight: '800' },
});
