import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';

import { openSessionAt } from '@/components/startSession';
import { Banner, Button, Chip, Icon, Section, styles as ui } from '@/components/ui';
import { listSpots, saveSpot } from '@/lib/db';
import type { LatLng } from '@/lib/google';
import { currentPosition, distanceM, placeName } from '@/lib/location';
import { friendlyError } from '@/lib/errors';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

// Un spot connu à moins de 500 m est considéré comme celui où tu te trouves.
const SAME_SPOT_M = 500;

/** Nom proposé pour la position : le spot connu le plus proche, sinon la ville. */
async function locate(): Promise<{ pos: LatLng; name: string | null }> {
  const pos = await currentPosition();
  const near = listSpots()
    .filter((sp) => sp.lat !== null && sp.lng !== null)
    .map((sp) => ({ name: sp.name, d: distanceM(pos, { latitude: sp.lat!, longitude: sp.lng! }) }))
    .filter((sp) => sp.d < SAME_SPOT_M)
    .sort((a, b) => a.d - b.d)[0];
  return { pos, name: near?.name ?? (await placeName(pos)) };
}

export default function OutdoorSessionScreen() {
  const [spots] = useState(() => listSpots().slice(0, 8));
  const [site, setSite] = useState('');
  const [pos, setPos] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const name = site.trim();

  useEffect(() => {
    locate()
      .then((r) => {
        setPos(r.pos);
        if (r.name) setSite((cur) => cur || r.name!);
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLocating(false));
  }, []);

  const start = () => {
    saveSpot(name, pos);
    openSessionAt({ site: name }, { replace: true });
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.intro}>
        <View style={s.icon}>
          <Icon name="my_location" size={26} color={colors.primary} />
        </View>
        <Text style={s.title}>Où grimpes-tu ?</Text>
        <Text style={s.text}>Le nom du spot est proposé à partir de ta position. Tu peux le modifier.</Text>
      </View>
      {locating ? (
        <View style={s.locating}>
          <ActivityIndicator color={colors.primary} />
          <Text style={s.muted}>Recherche de ta position…</Text>
        </View>
      ) : error ? (
        <Banner tone="danger" title="Position introuvable" text={`${error} Tu peux quand même taper le nom du spot.`} />
      ) : null}
      <TextInput
        style={ui.input}
        value={site}
        onChangeText={setSite}
        placeholder="Nom du spot ou du secteur"
        placeholderTextColor={colors.muted}
      />
      {spots.length > 0 && (
        <Section title="Mes spots">
          <View style={s.wrap}>
            {spots.map((sp) => (
              <Chip key={sp.name} label={sp.name} selected={name === sp.name} onPress={() => setSite(sp.name)} />
            ))}
          </View>
        </Section>
      )}
      <Button label="Démarrer la séance" icon="play_arrow" disabled={!name} onPress={start} />
      <Text style={[s.muted, { textAlign: 'center' }]}>Tu ajouteras tes blocs et tes voies pendant la séance.</Text>
    </ScrollView>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  intro: { gap: 6, marginBottom: space.xs },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginBottom: space.xs,
  },
  title: { ...type.title },
  text: { ...type.body, color: colors.muted },
  locating: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  muted: { fontSize: 13, fontWeight: '400', color: colors.muted },
});
