import { Tabs, useRouter } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Pressable, type ColorValue } from 'react-native';

import { colors } from '@/lib/theme';

export const unstable_settings = { initialRouteName: 'index' };

function TabIcon({ ios, android, color }: { ios: SFSymbol; android: AndroidSymbol; color: ColorValue }) {
  return <SymbolView name={{ ios, android, web: android }} tintColor={color} size={26} />;
}

/** Bouton engrenage en haut à droite : ouvre les paramètres. */
function SettingsButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={10}
      accessibilityLabel="Paramètres"
      style={({ pressed }) => ({ marginRight: 16, opacity: pressed ? 0.5 : 1 })}>
      <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} tintColor={colors.text} size={24} />
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerRight: () => <SettingsButton /> }}>
      <Tabs.Screen
        name="jeux"
        options={{ title: 'Jeux', tabBarIcon: ({ color }) => <TabIcon ios="dice" android="casino" color={color} /> }}
      />
      <Tabs.Screen
        name="index"
        options={{ title: 'Grimper', tabBarIcon: ({ color }) => <TabIcon ios="map" android="map" color={color} /> }}
      />
      <Tabs.Screen
        name="progression"
        options={{
          title: 'Progression',
          tabBarIcon: ({ color }) => <TabIcon ios="chart.bar.fill" android="bar_chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="simulation"
        options={{
          title: 'Simulation',
          headerTitle: 'Simulation (bêta)',
          tabBarIcon: ({ color }) => <TabIcon ios="figure.climbing" android="sports_gymnastics" color={color} />,
        }}
      />
    </Tabs>
  );
}
