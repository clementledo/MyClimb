import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GymsView } from '@/components/GymsView';
import { OutdoorView } from '@/components/OutdoorView';
import { SessionBanner } from '@/components/SessionBanner';
import { Segmented } from '@/components/ui';
import { colors } from '@/lib/theme';

type Where = 'gym' | 'outdoor';

export default function ClimbScreen() {
  // L'accueil peut ouvrir directement l'extérieur ; `t` distingue deux appuis successifs.
  const params = useLocalSearchParams<{ where?: Where; t?: string }>();
  const [where, setWhere] = useState<Where>(params.where ?? 'gym');
  const [lastT, setLastT] = useState(params.t);
  if (params.t !== lastT) {
    setLastT(params.t);
    if (params.where) setWhere(params.where);
  }

  return (
    <View style={s.container}>
      <SessionBanner />
      <View style={s.switcher}>
        <Segmented
          options={[
            { value: 'gym', label: 'En salle' },
            { value: 'outdoor', label: 'Extérieur' },
          ]}
          value={where}
          onChange={setWhere}
        />
      </View>
      {where === 'gym' ? <GymsView /> : <OutdoorView />}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  switcher: { paddingHorizontal: 12, paddingTop: 12 },
});
