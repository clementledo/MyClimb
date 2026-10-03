import { useContext, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { getSetting, setSetting } from '@/lib/db';
import { colors, currentTheme, ThemeSwitch, THEMES, themedStyles, type ThemeId } from '@/lib/theme';
import { checkForUpdate, currentVersion, installUpdate } from '@/lib/update';

const HEIGHT_KEY = 'climberHeight';
const readHeight = () => {
  const v = Number(getSetting(HEIGHT_KEY));
  return v >= 1.2 && v <= 2.2 && v !== 1.75 ? v : 1.8;
};

export default function SettingsScreen() {
  const switchTheme = useContext(ThemeSwitch);
  const selected = currentTheme();
  const [height, setHeight] = useState(readHeight);
  const [checking, setChecking] = useState(false);
  const ids = Object.keys(THEMES) as ThemeId[];

  const changeHeight = (d: number) => {
    const v = Math.round(Math.min(2.2, Math.max(1.2, height + d)) * 100) / 100;
    setHeight(v);
    setSetting(HEIGHT_KEY, String(v));
  };
  const check = async () => {
    setChecking(true);
    const update = await checkForUpdate().catch(() => null);
    setChecking(false);
    if (!update) {
      Alert.alert('Mise à jour', 'Tu as déjà la dernière version.');
      return;
    }
    Alert.alert('Nouvelle version', `La version ${update.version} est disponible.`, [
      { text: 'Plus tard', style: 'cancel' },
      { text: 'Installer', onPress: () => installUpdate(update, () => {}) },
    ]);
  };

  const themeList = (fun: boolean) =>
    ids
      .filter((id) => THEMES[id].fun === fun)
      .map((id) => {
        const t = THEMES[id];
        const active = id === selected;
        return (
          <Pressable
            key={id}
            onPress={() => !active && switchTheme(id)}
            style={({ pressed }) => [
              s.theme,
              { backgroundColor: t.colors.background, borderColor: active ? colors.primary : t.colors.border },
              active && s.themeActive,
              pressed && { opacity: 0.7 },
            ]}>
            <View style={s.swatches}>
              {[t.colors.primary, t.colors.primarySoft, t.colors.surface, t.colors.text].map((c, i) => (
                <View key={i} style={[s.swatch, { backgroundColor: c, borderColor: t.colors.border }]} />
              ))}
            </View>
            <View style={s.themeBody}>
              <Text style={[s.themeName, { color: t.colors.text }]}>
                {t.name}
                {active ? '  ✓' : ''}
              </Text>
              <Text style={[s.themeBlurb, { color: t.colors.muted }]}>{t.blurb}</Text>
            </View>
          </Pressable>
        );
      });

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Thème</Text>
      <Text style={s.subtitle}>Classiques</Text>
      <View style={s.list}>{themeList(false)}</View>
      <Text style={s.subtitle}>Loufoques</Text>
      <View style={s.list}>{themeList(true)}</View>

      <Text style={s.title}>Simulation</Text>
      <View style={s.card}>
        <Text style={s.rowLabel}>Ta taille : {height.toFixed(2).replace('.', ',')} m</Text>
        <Pressable style={s.step} onPress={() => changeHeight(-0.05)}>
          <Text style={s.stepText}>−</Text>
        </Pressable>
        <Pressable style={s.step} onPress={() => changeHeight(0.05)}>
          <Text style={s.stepText}>+</Text>
        </Pressable>
      </View>

      <Text style={s.title}>Application</Text>
      <View style={s.card}>
        <Text style={s.rowLabel}>MyClimb v{currentVersion()}</Text>
        <Pressable style={s.action} onPress={check} disabled={checking}>
          <Text style={s.actionText}>{checking ? 'Recherche…' : 'Chercher une mise à jour'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = themedStyles({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 10 },
  subtitle: { fontSize: 14, fontWeight: '700', color: colors.muted, marginTop: 4 },
  list: { gap: 10 },
  theme: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  themeActive: { borderWidth: 3 },
  swatches: { flexDirection: 'row', gap: 4 },
  swatch: { width: 16, height: 36, borderRadius: 6, borderWidth: 1 },
  themeBody: { flex: 1, gap: 3 },
  themeName: { fontSize: 16, fontWeight: '800' },
  themeBlurb: { fontSize: 13, lineHeight: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  rowLabel: { flex: 1, color: colors.text, fontWeight: '600', fontSize: 15 },
  step: {
    width: 44,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
  },
  stepText: { color: colors.primary, fontWeight: '800', fontSize: 18 },
  action: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.primary },
  actionText: { color: colors.onPrimary, fontWeight: '700' },
});
