import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { checkForUpdate, installUpdate, type Update } from '@/lib/update';
import { colors } from '@/lib/theme';

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

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#E7F5EC',
  },
  text: { flex: 1, gap: 2 },
  title: { fontWeight: '700', color: colors.success, fontSize: 15 },
  sub: { color: colors.muted, fontSize: 13 },
  later: { color: colors.muted, fontWeight: '600' },
  button: { backgroundColor: colors.success, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
