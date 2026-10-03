import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui';

import { checkForUpdate, installUpdate, type Update } from '@/lib/update';
import { colors, radius, space, themedStyles } from '@/lib/theme';

// Une seule vérification par lancement de l'app.
let pending: Promise<Update | null> | null = null;

/** Bandeau « Nouvelle version disponible » : télécharge et installe l'APK d'un toucher. */
export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    pending ??= checkForUpdate().catch(() => null);
    pending.then(setUpdate);
  }, []);

  if (!update || hidden) return null;

  const start = async () => {
    setProgress(0);
    await installUpdate(update, setProgress);
    setProgress(null);
  };

  return (
    <View style={s.banner}>
      <Icon name="system_update" size={24} color={colors.success} />
      <View style={s.text}>
        <Text style={s.title}>Nouvelle version {update.version}</Text>
        <Text style={s.sub}>
          {progress === null
            ? `${Math.round(update.size / 1e6)} Mo, s'installe par-dessus`
            : `Téléchargement… ${Math.round(progress * 100)} %`}
        </Text>
      </View>
      {progress === null && (
        <>
          <Pressable onPress={() => setHidden(true)} hitSlop={8}>
            <Text style={s.later}>Plus tard</Text>
          </Pressable>
          <Pressable onPress={start} style={({ pressed }) => [s.button, pressed && { opacity: 0.7 }]}>
            <Text style={s.buttonText}>Installer</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const s = themedStyles({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.successSoft,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: colors.success },
  sub: { fontSize: 13, fontWeight: '400', color: colors.muted },
  later: { fontSize: 14, fontWeight: '600', color: colors.muted },
  button: { backgroundColor: colors.success, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.sm },
  buttonText: { fontSize: 14, fontWeight: '700', color: colors.onPrimary },
});
