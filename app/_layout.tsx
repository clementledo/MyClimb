import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { autoBackup } from '@/lib/backup';
import { getSetting } from '@/lib/db';
import {
  applyFont,
  applyTheme,
  colors,
  currentFont,
  currentTheme,
  font,
  isDark,
  ThemeSwitch,
  type FontId,
  type ThemeId,
} from '@/lib/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();
  const path = usePathname();
  const pathname = useRef(path);
  useEffect(() => {
    pathname.current = path;
  }, [path]);
  // Compteur de redessins : changer de thème (ou restaurer une sauvegarde) redessine toute l'app.
  const [version, setVersion] = useState(0);
  // Écran à rouvrir après le redessin (Paramètres, collection…).
  const reopen = useRef<string | null>(null);
  const switcher = useMemo(() => {
    const redraw = (back?: string) => {
      reopen.current = back ?? pathname.current;
      setVersion((v) => v + 1);
    };
    return {
      theme: (id: ThemeId, back?: string) => {
        applyTheme(id);
        redraw(back);
      },
      font: (id: FontId) => {
        applyFont(id);
        redraw();
      },
    };
  }, []);
  useEffect(() => {
    const back = reopen.current;
    if (!back) return;
    reopen.current = null;
    // Le redessin garde parfois l'écran ouvert : on ne le rouvre que s'il a disparu. La collection
    // se rouvre par-dessus la Progression, d'où on y va.
    const t = setTimeout(() => {
      if (pathname.current === back) return;
      if (back.startsWith('/collection')) router.navigate('/progression');
      router.push(back as never);
    }, 50);
    return () => clearTimeout(t);
  }, [version, router]);

  // Premier lancement : écran de bienvenue.
  useEffect(() => {
    if (getSetting('welcomed')) return;
    const t = setTimeout(() => router.push('/welcome'), 300);
    return () => clearTimeout(t);
  }, [router]);

  // Toucher le rappel de routine ouvre l'onglet Entraînement.
  useEffect(() => {
    const open = (n: Notifications.Notification) => {
      const url = n.request.content.data?.url;
      if (typeof url === 'string') setTimeout(() => router.push(url as never), 300);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => sub.remove();
  }, [router]);

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
    fonts: {
      regular: { fontFamily: font.family, fontWeight: '400' as const },
      medium: { fontFamily: font.family, fontWeight: '500' as const },
      bold: { fontFamily: font.family, fontWeight: '700' as const },
      heavy: { fontFamily: font.family, fontWeight: '800' as const },
    },
  };

  return (
    <ThemeSwitch.Provider value={switcher}>
      <ThemeProvider value={theme} key={`${currentTheme()}-${currentFont()}-${version}`}>
        <StatusBar style={isDark() ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerTintColor: colors.text,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            headerTitleStyle: { fontFamily: font.family, fontWeight: '700', fontSize: 18 },
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Paramètres' }} />
          <Stack.Screen name="welcome" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="gym/[id]" options={{ title: 'Salle' }} />
          <Stack.Screen name="session/index" options={{ title: 'Séance' }} />
          <Stack.Screen name="session/outdoor" options={{ title: 'Séance en extérieur' }} />
          <Stack.Screen name="block/new" options={{ title: 'Nouvelle grimpe', presentation: 'modal' }} />
          <Stack.Screen name="block/[id]" options={{ title: 'Grimpe' }} />
          <Stack.Screen name="block/edit/[id]" options={{ title: 'Modifier la grimpe', presentation: 'modal' }} />
          <Stack.Screen name="training/[id]" options={{ title: 'Séance' }} />
          <Stack.Screen name="training/exercise/[id]" options={{ title: 'Exercice' }} />
          <Stack.Screen name="training/routine/[id]" options={{ title: 'Routine' }} />
          <Stack.Screen name="training/routine-edit" options={{ title: 'Nouvelle routine', presentation: 'modal' }} />
          <Stack.Screen name="collection/index" options={{ title: 'Ma collection' }} />
          <Stack.Screen name="manager/index" options={{ headerShown: false }} />
          <Stack.Screen name="manager/climber/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="manager/legendes" options={{ headerShown: false }} />
          <Stack.Screen name="manager/compet" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="manager/packs" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="collection/packs" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack>
      </ThemeProvider>
    </ThemeSwitch.Provider>
  );
}
