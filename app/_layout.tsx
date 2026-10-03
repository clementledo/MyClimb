import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';

import { applyTheme, colors, currentTheme, isDark, ThemeSwitch, type ThemeId } from '@/lib/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();
  const [themeId, setThemeId] = useState<ThemeId>(currentTheme);
  const reopen = useRef(false);
  // Changer de thème redessine toute l'app, puis rouvre les paramètres.
  const switchTheme = useCallback((id: ThemeId) => {
    applyTheme(id);
    reopen.current = true;
    setThemeId(id);
  }, []);
  useEffect(() => {
    if (!reopen.current) return;
    reopen.current = false;
    const t = setTimeout(() => router.push('/settings'), 50);
    return () => clearTimeout(t);
  }, [themeId, router]);

  const base = isDark() ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <ThemeSwitch.Provider value={switchTheme}>
      <ThemeProvider value={theme} key={themeId}>
        <StatusBar style={isDark() ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerTintColor: colors.text }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Paramètres' }} />
          <Stack.Screen name="gym/[id]" options={{ title: 'Salle' }} />
          <Stack.Screen name="session/index" options={{ title: 'Séance' }} />
          <Stack.Screen name="session/outdoor" options={{ title: 'Séance en extérieur' }} />
          <Stack.Screen name="block/new" options={{ title: 'Nouvelle grimpe', presentation: 'modal' }} />
          <Stack.Screen name="block/[id]" options={{ title: 'Grimpe' }} />
          <Stack.Screen name="block/edit/[id]" options={{ title: 'Modifier la grimpe', presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </ThemeSwitch.Provider>
  );
}
