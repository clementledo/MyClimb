import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { colors } from '@/lib/theme';

// L'app s'ouvre sur les salles, même si l'onglet Jeux est à gauche.
export const unstable_settings = { initialRouteName: 'index' };

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen
        name="jeux"
        options={{
          title: 'Jeux',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'dice', android: 'casino', web: 'casino' }} tintColor={color} size={26} />
          ),
        }}
      />
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
      <Tabs.Screen
        name="progression"
        options={{
          title: 'Progression',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
    </Tabs>
  );
}
