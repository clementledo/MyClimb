import { useContext, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import {
  autoBackup,
  autoBackupError,
  disableAutoBackup,
  driveAccount,
  driveBackup,
  enableAutoBackup,
  exportBackup,
  lastAutoBackup,
  pickBackup,
  restoreBackup,
} from '@/lib/backup';
import { getSetting, setSetting } from '@/lib/db';
import { colors, currentTheme, ThemeSwitch, THEMES, themedStyles, type ThemeId } from '@/lib/theme';
import { checkForUpdate, currentVersion, installUpdate } from '@/lib/update';

const savedTheme = (): ThemeId => {
  const v = getSetting('theme');
  return v && v in THEMES ? (v as ThemeId) : 'classique';
};

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

  const [busy, setBusy] = useState<string | null>(null);
  const save = async () => {
    setBusy('save');
    try {
      const done = await exportBackup();
      if (done) {
        Alert.alert(
          'Sauvegarde faite',
          `Fichier « ${done.name} » créé (${done.photos} photo${done.photos > 1 ? 's' : ''}). Garde-le en lieu sûr, par exemple sur ton Drive.`,
        );
      }
    } catch (e) {
      Alert.alert('Sauvegarde impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const confirmRestore = (backup: NonNullable<Awaited<ReturnType<typeof pickBackup>>>) => {
    const when = new Date(backup.date).toLocaleString('fr-CA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    Alert.alert(
      'Restaurer cette sauvegarde ?',
      `Sauvegarde du ${when}. Toutes les données actuelles de l’app seront remplacées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Restaurer',
          style: 'destructive',
          onPress: () => {
            try {
              restoreBackup(backup);
              switchTheme(savedTheme());
            } catch (e) {
              Alert.alert('Restauration impossible', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  };
  const restoreFrom = async (kind: 'restore' | 'driveRestore') => {
    setBusy(kind);
    try {
      const backup = kind === 'restore' ? await pickBackup() : await driveBackup();
      if (backup) confirmRestore(backup);
    } catch (e) {
      Alert.alert('Restauration impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const [account, setAccount] = useState(driveAccount);
  const [last, setLast] = useState(lastAutoBackup);
  const [autoError, setAutoError] = useState(autoBackupError);
  const refreshAuto = () => {
    setAccount(driveAccount());
    setLast(lastAutoBackup());
    setAutoError(autoBackupError());
  };
  const connectDrive = async () => {
    setBusy('auto');
    try {
      await enableAutoBackup();
    } catch (e) {
      Alert.alert('Google Drive', e instanceof Error ? e.message : String(e));
    } finally {
      refreshAuto();
      setBusy(null);
    }
  };
  const saveNow = async () => {
    setBusy('auto');
    await autoBackup(true);
    refreshAuto();
    setBusy(null);
  };
  const disconnectDrive = async () => {
    await disableAutoBackup();
    refreshAuto();
  };
  const lastText = last
    ? last.toLocaleString('fr-CA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : 'pas encore';

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

      <Text style={s.title}>Mes données</Text>
      <View style={s.dataCard}>
        <Text style={s.dataText}>
          Tes séances, grimpes, réglages et photos restent sur ce téléphone. Garde une copie pour les retrouver si tu
          changes de téléphone : dans un fichier, ou automatiquement sur ton Google Drive.
        </Text>
        <Pressable style={s.action} onPress={save} disabled={busy !== null}>
          <Text style={s.actionText}>{busy === 'save' ? 'Sauvegarde…' : 'Sauvegarder dans un fichier'}</Text>
        </Pressable>
        <Pressable style={s.actionSoft} onPress={() => restoreFrom('restore')} disabled={busy !== null}>
          <Text style={s.actionSoftText}>{busy === 'restore' ? 'Lecture…' : 'Restaurer depuis un fichier'}</Text>
        </Pressable>
        <View style={s.autoBox}>
          <Text style={s.autoTitle}>Sauvegarde automatique sur Google Drive</Text>
          <Text style={s.autoText}>
            {account
              ? `Activée sur ${account}. L’app envoie tes données sur ton Drive toutes les 6 heures au plus, à l’ouverture ou quand tu quittes l’app. Dernière : ${lastText}.`
              : 'Connecte ton compte Google une seule fois : l’app enverra une copie de tes données dans un dossier caché de ton Drive, gratuitement.'}
          </Text>
          {account && autoError ? <Text style={s.autoErrorText}>Dernier essai raté : {autoError}</Text> : null}
          {account ? (
            <>
              <Pressable style={s.action} onPress={saveNow} disabled={busy !== null}>
                <Text style={s.actionText}>{busy === 'auto' ? 'Envoi…' : 'Sauvegarder maintenant'}</Text>
              </Pressable>
              <View style={s.row}>
                <Pressable style={[s.actionSoft, s.grow]} onPress={() => restoreFrom('driveRestore')} disabled={busy !== null}>
                  <Text style={s.actionSoftText}>{busy === 'driveRestore' ? 'Lecture…' : 'Restaurer du Drive'}</Text>
                </Pressable>
                <Pressable style={[s.actionSoft, s.grow]} onPress={disconnectDrive} disabled={busy !== null}>
                  <Text style={s.actionSoftText}>Désactiver</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable style={s.action} onPress={connectDrive} disabled={busy !== null}>
                <Text style={s.actionText}>{busy === 'auto' ? 'Connexion…' : 'Connecter Google Drive'}</Text>
              </Pressable>
              <Pressable style={s.actionSoft} onPress={() => restoreFrom('driveRestore')} disabled={busy !== null}>
                <Text style={s.actionSoftText}>
                  {busy === 'driveRestore' ? 'Lecture…' : 'Récupérer une sauvegarde du Drive'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
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
  actionText: { color: colors.onPrimary, fontWeight: '700', textAlign: 'center' },
  actionSoft: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.primarySoft },
  actionSoftText: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
  dataCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 10 },
  dataText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  autoBox: { gap: 8, marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  autoTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  autoText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  autoErrorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
});
