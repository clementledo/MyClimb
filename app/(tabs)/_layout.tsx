import { Tabs } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { colors } from '@/lib/theme';

export const unstable_settings = { initialRouteName: 'index' };

function TabIcon({ ios, android, color }: { ios: SFSymbol; android: AndroidSymbol; color: ColorValue }) {
  return <SymbolView name={{ ios, android, web: android }} tintColor={color} size={26} />;
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon ios="house.fill" android="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="jeux"
        options={{ title: 'Jeux', tabBarIcon: ({ color }) => <TabIcon ios="dice" android="casino" color={color} /> }}
      />
      <Tabs.Screen
        name="grimper"
        options={{ title: 'Grimper', tabBarIcon: ({ color }) => <TabIcon ios="map" android="map" color={color} /> }}
      />
      <Tabs.Screen
        name="progression"
        options={{
          title: 'Progression',
          tabBarIcon: ({ color }) => <TabIcon ios="chart.bar.fill" android="bar_chart" color={color} />,
        }}
      />
    </Tabs>
  );
}
