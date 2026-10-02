import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { colors } from '@/lib/theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Salles',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'map', android: 'map', web: 'map' }} tintColor={color} size={26} />
          ),
        }}
      />
      <Tabs.Screen
        name="blocs"
        options={{
          title: 'Blocs',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'figure.climbing', android: 'landscape', web: 'landscape' }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
    </Tabs>
  );
}
