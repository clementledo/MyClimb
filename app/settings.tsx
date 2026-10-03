import { useContext, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Card, Icon, ListRow, Section } from '@/components/ui';

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
import {
  colors,
  currentFont,
  currentTheme,
  FONTS,
  radius,
  space,
  ThemeSwitch,
  THEMES,
  themedStyles,
  type,
  type FontId,
  type ThemeId,
} from '@/lib/theme';
import { checkForUpdate, currentVersion, installUpdate } from '@/lib/update';

const savedTheme = (): ThemeId => {
  const v = getSetting('theme');
  return v && v in THEMES ? (v as ThemeId) : 'classique';
};

const savedFont = (): FontId => {
  const v = getSetting('font');
  return v && v in FONTS ? (v as FontId) : 'inter';
};

const HEIGHT_KEY = 'climberHeight';
const readHeight = () => {
  const v = Number(getSetting(HEIGHT_KEY));
  return v >= 1.2 && v <= 2.2 && v !== 1.75 ? v : 1.8;
};

export default function SettingsScreen() {
  const switcher = useContext(ThemeSwitch);
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
              switcher.font(savedFont());
              switcher.theme(savedTheme());
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

  const fontId = currentFont();

  const themeGrid = (fun: boolean) => (
    <View style={s.grid}>
      {ids
        .filter((id) => THEMES[id].fun === fun)
        .map((id) => {
          const t = THEMES[id];
          const active = id === selected;
          return (
            <Pressable
              key={id}
              onPress={() => !active && switcher.theme(id)}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [s.theme, active && s.themeActive, pressed && { opacity: 0.7 }]}>
              {/* Aperçu miniature du thème */}
              <View style={[s.preview, { backgroundColor: t.colors.background, borderColor: t.colors.border }]}>
                <View style={[s.previewCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
                  <View style={[s.previewLine, { backgroundColor: t.colors.text, width: '70%' }]} />
                  <View style={[s.previewLine, { backgroundColor: t.colors.muted, width: '45%' }]} />
                </View>
                <View style={[s.previewButton, { backgroundColor: t.colors.primary }]} />
                {active && (
                  <View style={s.check}>
                    <Icon name="check" size={14} color={colors.onPrimary} />
                  </View>
                )}
              </View>
              <Text style={s.themeName} numberOfLines={1}>
                {t.name}
              </Text>
              <Text style={s.themeBlurb} numberOfLines={2}>
                {t.blurb}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Section title="Thème">
        <Text style={s.groupTitle}>Classiques</Text>
        {themeGrid(false)}
        <Text style={s.groupTitle}>Loufoques</Text>
        {themeGrid(true)}
      </Section>

      <Section title="Police">
        <View style={s.listCard}>
          {(Object.keys(FONTS) as FontId[]).map((id, i, all) => {
            const f = FONTS[id];
            const active = id === fontId;
            return (
              <ListRow
                key={id}
                left={
                  <View style={s.fontSample}>
                    <Text style={[s.fontSampleText, { fontFamily: f.family }]}>Aa</Text>
                  </View>
                }
                title={f.name}
                subtitle={f.blurb}
                right={active ? <Icon name="check_circle" size={22} color={colors.primary} /> : undefined}
                chevron={false}
                onPress={() => !active && switcher.font(id)}
                last={i === all.length - 1}
              />
            );
          })}
        </View>
      </Section>

      <Section title="Simulation">
        <Card style={s.heightCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>Ta taille</Text>
            <Text style={s.rowSub}>Sert à placer le grimpeur à la bonne échelle.</Text>
          </View>
          <View style={s.stepper}>
            <Pressable style={s.step} onPress={() => changeHeight(-0.05)} accessibilityLabel="Diminuer la taille">
              <Icon name="remove" size={18} color={colors.text} />
            </Pressable>
            <Text style={s.stepValue}>{height.toFixed(2).replace('.', ',')} m</Text>
            <Pressable style={s.step} onPress={() => changeHeight(0.05)} accessibilityLabel="Augmenter la taille">
              <Icon name="add" size={18} color={colors.text} />
            </Pressable>
          </View>
        </Card>
      </Section>

      <Section title="Mes données">
        <Card style={s.driveCard}>
          <View style={s.driveHead}>
            <View style={s.driveIcon}>
              <Icon name={account ? 'cloud_done' : 'cloud_upload'} size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.rowTitle}>Sauvegarde automatique sur Google Drive</Text>
              <Text style={s.rowSub}>{account ? `Activée sur ${account}` : 'Désactivée'}</Text>
            </View>
          </View>
          <Text style={s.driveText}>
            {account
              ? `Tes données partent sur ton Drive toutes les 6 heures au plus, à l’ouverture ou quand tu quittes l’app. Dernière sauvegarde : ${lastText}.`
              : 'Connecte ton compte Google une seule fois : l’app enverra une copie de tes séances, grimpes et photos dans un dossier caché de ton Drive, gratuitement.'}
          </Text>
          {account && autoError ? <Text style={s.autoErrorText}>Dernier essai raté : {autoError}</Text> : null}
          {account ? (
            <>
              <Button label="Sauvegarder maintenant" icon="cloud_upload" loading={busy === 'auto'} onPress={saveNow} disabled={busy !== null} />
              <View style={s.row}>
                <Button
                  label="Restaurer du Drive"
                  variant="secondary"
                  size="sm"
                  style={s.grow}
                  loading={busy === 'driveRestore'}
                  disabled={busy !== null}
                  onPress={() => restoreFrom('driveRestore')}
                />
                <Button label="Désactiver" variant="secondary" size="sm" style={s.grow} disabled={busy !== null} onPress={disconnectDrive} />
              </View>
            </>
          ) : (
            <>
              <Button label="Connecter Google Drive" icon="add_to_drive" loading={busy === 'auto'} onPress={connectDrive} disabled={busy !== null} />
              <Button
                label="Récupérer une sauvegarde du Drive"
                variant="ghost"
                size="sm"
                loading={busy === 'driveRestore'}
                disabled={busy !== null}
                onPress={() => restoreFrom('driveRestore')}
              />
            </>
          )}
        </Card>
        <View style={s.listCard}>
          <ListRow icon="save" title="Sauvegarder dans un fichier" subtitle="Un fichier à garder où tu veux" onPress={save} />
          <ListRow
            icon="folder_open"
            title="Restaurer depuis un fichier"
            subtitle="Remplace les données de l’app"
            onPress={() => restoreFrom('restore')}
            last
          />
        </View>
        <Text style={s.footnote}>
          Tes séances, grimpes, réglages et photos sont enregistrés sur ce téléphone. Garde une copie pour les retrouver si tu
          changes de téléphone.
        </Text>
      </Section>

      <Section title="Application">
        <View style={s.listCard}>
          <ListRow icon="info" title="Version" value={currentVersion()} />
          <ListRow
            icon="system_update"
            title={checking ? 'Recherche…' : 'Chercher une mise à jour'}
            onPress={check}
            last
          />
        </View>
      </Section>
    </ScrollView>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  content: { padding: space.lg, gap: space.xl, paddingBottom: 48 },
  groupTitle: { ...type.callout, marginTop: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  theme: { width: '47%', flexGrow: 1, gap: 4, padding: space.sm, borderRadius: radius.lg, borderWidth: 2, borderColor: 'transparent' },
  themeActive: { borderColor: colors.primary, backgroundColor: colors.card },
  preview: { height: 92, borderRadius: radius.md, borderWidth: 1, padding: 10, gap: 8, justifyContent: 'space-between' },
  previewCard: { borderRadius: 8, borderWidth: 1, padding: 8, gap: 5 },
  previewLine: { height: 5, borderRadius: 3 },
  previewButton: { height: 14, borderRadius: 7, width: '55%' },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  themeName: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
  themeBlurb: { fontSize: 12, fontWeight: '400', lineHeight: 16, color: colors.muted },
  listCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fontSample: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  fontSampleText: { fontSize: 16, color: colors.text, fontWeight: '700' },
  heightCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2, color: colors.text },
  rowSub: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: colors.muted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepValue: { fontSize: 16, fontWeight: '700', color: colors.text, minWidth: 64, textAlign: 'center' },
  driveCard: { gap: space.md },
  driveHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  driveIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  driveText: { fontSize: 14, fontWeight: '400', lineHeight: 20, color: colors.muted },
  autoErrorText: { fontSize: 13, fontWeight: '500', lineHeight: 18, color: colors.danger },
  row: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
  footnote: { fontSize: 12, fontWeight: '400', lineHeight: 17, color: colors.muted, paddingHorizontal: 4 },
});
