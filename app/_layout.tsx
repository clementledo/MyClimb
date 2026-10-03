import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { autoBackup } from '@/lib/backup';
import { applyTheme, colors, currentTheme, isDark, ThemeSwitch, type ThemeId } from '@/lib/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();
  // Compteur de redessins : changer de thème (ou restaurer une sauvegarde) redessine toute l'app.
  const [version, setVersion] = useState(0);
  const reopen = useRef(false);
  const switchTheme = useCallback((id: ThemeId) => {
    applyTheme(id);
    reopen.current = true;
    setVersion((v) => v + 1);
  }, []);
  useEffect(() => {
    if (!reopen.current) return;
    reopen.current = false;
    const t = setTimeout(() => router.push('/settings'), 50);
    return () => clearTimeout(t);
  }, [version, router]);

  // Sauvegarde automatique (si activée) : peu après l'ouverture et quand on quitte l'app, 6 h au plus souvent.
  useEffect(() => {
    const t = setTimeout(() => autoBackup(), 5000);
    const sub = AppState.addEventListener('change', (s) => s === 'background' && autoBackup());
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);

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
      <ThemeProvider value={theme} key={`${currentTheme()}-${version}`}>
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
