import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Chip, Empty, Section } from '@/components/ui';
import { getGym, getGymPrices, saveGymPrices } from '@/lib/db';
import { gymDetails } from '@/lib/google';
import { colors } from '@/lib/theme';

const SUGGESTIONS = ['Carnet 10 entrées', 'Abonnement mensuel', 'Abonnement 3 mois', 'Abonnement annuel', 'Tarif étudiant'];

const toText = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));
const parseAmount = (t: string): number | null => {
  const n = parseFloat(t.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

export default function GymPricesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gym = getGym(id);
  const initial = getGymPrices(id);
  const [entry, setEntry] = useState(toText(initial.entry));
  const [subs, setSubs] = useState(
    initial.subscriptions.map((s) => ({ label: s.label, amount: toText(s.amount) })),
  );

  if (!gym) return <Empty text="Salle introuvable." />;

  const update = (i: number, field: 'label' | 'amount', value: string) =>
    setSubs((cur) => cur.map((s, j) => (j === i ? { ...s, [field]: value } : s)));

  const openWebsite = async () => {
    try {
      const d = await gymDetails(gym.id);
      if (d.website) Linking.openURL(d.website);
      else Alert.alert('Site web', "Cette salle n'a pas de site web sur Google.");
    } catch (e) {
      Alert.alert('Site web', e instanceof Error ? e.message : String(e));
    }
  };

  const save = () => {
    const entryAmount = entry.trim() ? parseAmount(entry) : null;
    if (entry.trim() && entryAmount === null) return Alert.alert('Prix', "Le prix d'une entrée n'est pas un nombre.");
    const cleaned = [];
    for (const s of subs) {
      if (!s.label.trim() && !s.amount.trim()) continue;
      const amount = parseAmount(s.amount);
      if (!s.label.trim() || amount === null) {
        return Alert.alert('Abonnements', 'Chaque abonnement a besoin d\'un nom et d\'un prix.');
      }
      cleaned.push({ label: s.label.trim(), amount });
    }
    saveGymPrices(gym.id, { entry: entryAmount, subscriptions: cleaned });
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: `Tarifs · ${gym.name}` }} />
      <Text style={s.help}>
        Google ne donne pas les prix des salles. Recopie-les depuis le site de la salle : ils servent au tri par prix.
      </Text>
      <Button label="Ouvrir le site de la salle" variant="secondary" onPress={openWebsite} />

      <Section title="Prix d'une entrée">
        <View style={s.priceRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={entry}
            onChangeText={setEntry}
            placeholder="ex. 15,50"
            keyboardType="decimal-pad"
          />
          <Text style={s.euro}>€</Text>
        </View>
      </Section>

      <Section title="Abonnements et carnets">
        {subs.map((sub, i) => (
          <View key={i} style={s.priceRow}>
            <TextInput
              style={[s.input, { flex: 2 }]}
              value={sub.label}
              onChangeText={(t) => update(i, 'label', t)}
              placeholder="Nom"
            />
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={sub.amount}
              onChangeText={(t) => update(i, 'amount', t)}
              placeholder="Prix"
              keyboardType="decimal-pad"
            />
            <Text style={s.euro}>€</Text>
            <Pressable onPress={() => setSubs((cur) => cur.filter((_, j) => j !== i))} hitSlop={8}>
              <Text style={s.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
        <View style={s.wrap}>
          {SUGGESTIONS.filter((l) => !subs.some((sub) => sub.label === l)).map((l) => (
            <Chip key={l} label={`+ ${l}`} selected={false} onPress={() => setSubs((c) => [...c, { label: l, amount: '' }])} />
          ))}
          <Chip label="+ Autre" selected={false} onPress={() => setSubs((c) => [...c, { label: '', amount: '' }])} />
        </View>
      </Section>

      <Button label="Enregistrer" onPress={save} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 48 },
  help: { color: colors.muted, lineHeight: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  euro: { fontSize: 16, color: colors.muted },
  remove: { fontSize: 18, color: colors.danger, paddingHorizontal: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
