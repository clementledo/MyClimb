import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { openSessionAt } from '@/components/startSession';
import { Button, Chip, Section } from '@/components/ui';
import { listSpots, saveSpot } from '@/lib/db';
import type { LatLng } from '@/lib/google';
import { currentPosition, distanceM, placeName } from '@/lib/location';
import { colors } from '@/lib/theme';

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
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLocating(false));
  }, []);

  const start = () => {
    saveSpot(name, pos);
    openSessionAt({ site: name }, { replace: true });
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Section title="Où es-tu ?">
        {locating ? (
          <View style={s.locating}>
            <ActivityIndicator color={colors.primary} />
            <Text style={s.muted}>Recherche de ta position…</Text>
          </View>
        ) : error ? (
          <Text style={s.error}>{error} Tu peux quand même taper le nom du spot.</Text>
        ) : null}
        <TextInput style={s.input} value={site} onChangeText={setSite} placeholder="Nom du spot ou du secteur" />
        {spots.length > 0 && (
          <View style={s.wrap}>
            {spots.map((sp) => (
              <Chip key={sp.name} label={sp.name} selected={name === sp.name} onPress={() => setSite(sp.name)} />
            ))}
          </View>
        )}
      </Section>
      <Button label="Démarrer la séance" disabled={!name} onPress={start} />
      <Text style={s.muted}>Tu pourras ajouter des blocs et des voies pendant la séance.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 20 },
  locating: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
});
