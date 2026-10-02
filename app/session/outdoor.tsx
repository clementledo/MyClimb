import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { openSessionAt } from '@/components/startSession';
import { Button, Chip, Section } from '@/components/ui';
import { listSites } from '@/lib/db';
import { colors } from '@/lib/theme';

export default function OutdoorSessionScreen() {
  const [sites] = useState(() => listSites());
  const [site, setSite] = useState('');
  const name = site.trim();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Section title="Site ou secteur">
        <TextInput
          style={s.input}
          value={site}
          onChangeText={setSite}
          placeholder="Ex. Val-David, Dame Blanche"
          autoFocus
        />
        {sites.length > 0 && (
          <View style={s.wrap}>
            {sites.map((x) => (
              <Chip key={x} label={x} selected={name === x} onPress={() => setSite(x)} />
            ))}
          </View>
        )}
      </Section>
      <Button
        label="Démarrer la séance"
        disabled={!name}
        onPress={() => openSessionAt({ site: name }, { replace: true })}
      />
      <Text style={s.muted}>Tu pourras ajouter des blocs et des voies pendant la séance.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 20 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muted: { color: colors.muted, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
});
