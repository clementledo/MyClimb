import { Tabs, useRouter } from 'expo-router';
import type { AndroidSymbol } from 'expo-symbols';
import { useEffect } from 'react';
import { Text, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconButton } from '@/components/ui';
import { syncFromJournal } from '@/lib/collection';
import { colors, font } from '@/lib/theme';
import { useCollectionSummary } from '@/lib/useCollection';

export const unstable_settings = { initialRouteName: 'index' };

function TabIcon({ name, color }: { name: AndroidSymbol; color: ColorValue }) {
  return <Icon name={name} color={color} size={24} />;
}

/** Bouton engrenage en haut à droite : ouvre les paramètres. */
function SettingsButton() {
  const router = useRouter();
  return <IconButton icon="settings" label="Paramètres" onPress={() => router.push('/settings')} style={{ marginRight: 16 }} />;
}

export default function TabLayout() {
  // Place sous les onglets pour la barre système d'Android (boutons ou geste).
  const { bottom } = useSafeAreaInsets();
  // Pastille sur Progression tant qu'il reste des packs à ouvrir.
  const { packs } = useCollectionSummary();
  useEffect(() => {
    syncFromJournal();
  }, []);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64 + bottom,
          paddingTop: 6,
          paddingBottom: bottom + 6,
        },
        // Le libellé rétrécit un peu plutôt que d'être coupé sur les petits écrans (5 onglets).
        tabBarLabel: ({ color, children }) => (
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color, fontFamily: font.family, fontSize: 11, fontWeight: '600', paddingHorizontal: 2 }}>
            {children}
          </Text>
        ),
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: font.family, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
        headerRight: () => <SettingsButton />,
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Grimper', tabBarIcon: ({ color }) => <TabIcon name="landscape" color={color} /> }}
      />
      <Tabs.Screen
        name="entrainement"
        options={{ title: 'Entraînement', tabBarIcon: ({ color }) => <TabIcon name="fitness_center" color={color} /> }}
      />
      <Tabs.Screen
        name="progression"
        options={{
          title: 'Progression',
          tabBarIcon: ({ color }) => <TabIcon name="insights" color={color} />,
          tabBarBadge: packs > 0 ? packs : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary, fontSize: 11, fontWeight: '700' },
        }}
      />
      <Tabs.Screen
        name="simulation"
        options={{ title: 'Simulation', tabBarIcon: ({ color }) => <TabIcon name="view_in_ar" color={color} /> }}
      />
      <Tabs.Screen name="jeux" options={{ title: 'Jeux', tabBarIcon: ({ color }) => <TabIcon name="casino" color={color} /> }} />
    </Tabs>
  );
}
