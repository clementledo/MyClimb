import { useState } from 'react';
import { View } from 'react-native';

import { GymsView } from '@/components/GymsView';
import { OutdoorView } from '@/components/OutdoorView';
import { SessionBanner } from '@/components/SessionBanner';
import { UpdateBanner } from '@/components/UpdateBanner';
import { Segmented } from '@/components/ui';
import { colors, themedStyles } from '@/lib/theme';

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

const s = themedStyles({
  container: { flex: 1, backgroundColor: colors.background },
  switcher: { paddingHorizontal: 12, paddingTop: 12 },
});
