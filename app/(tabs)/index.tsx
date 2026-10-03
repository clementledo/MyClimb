import { useState } from 'react';
import { View } from 'react-native';

import { GymsView } from '@/components/GymsView';
import { OutdoorView } from '@/components/OutdoorView';
import { SessionBanner } from '@/components/SessionBanner';
import { UpdateBanner } from '@/components/UpdateBanner';
import { Segmented } from '@/components/ui';
import { colors, space, themedStyles } from '@/lib/theme';

type Where = 'gym' | 'outdoor';

export default function ClimbScreen() {
  const [where, setWhere] = useState<Where>('gym');

  return (
    <View style={s.container}>
      <UpdateBanner />
      <SessionBanner />
      <View style={s.switcher}>
        <Segmented
          options={[
            { value: 'gym', label: 'En salle', icon: 'fitness_center' },
            { value: 'outdoor', label: 'Extérieur', icon: 'park' },
          ]}
          value={where}
          onChange={setWhere}
        />
      </View>
      {where === 'gym' ? <GymsView /> : <OutdoorView />}
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1, backgroundColor: colors.background },
  switcher: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.md },
});
