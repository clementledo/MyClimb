import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/lib/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.background },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: colors.text }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="gym/[id]" options={{ title: 'Salle' }} />
        <Stack.Screen name="session/index" options={{ title: 'Séance' }} />
        <Stack.Screen name="session/outdoor" options={{ title: 'Séance en extérieur' }} />
        <Stack.Screen name="block/new" options={{ title: 'Nouvelle grimpe', presentation: 'modal' }} />
        <Stack.Screen name="block/[id]" options={{ title: 'Grimpe' }} />
        <Stack.Screen name="block/edit/[id]" options={{ title: 'Modifier la grimpe', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
