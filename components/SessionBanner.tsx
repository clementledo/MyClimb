import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { getGym } from '@/lib/db';
import { getSession, type Session } from '@/lib/session';
import { colors, radius, space, themedStyles } from '@/lib/theme';

export function sessionPlace(session: Session) {
  return session.gymId ? (getGym(session.gymId)?.name ?? 'Salle') : (session.site ?? 'Extérieur');
}

/** Bandeau « Séance en cours » qui ramène à la séance. */
export function SessionBanner() {
  const [session, setSession] = useState<Session | null>(null);
  useFocusEffect(useCallback(() => setSession(getSession()), []));
  if (!session) return null;
  return (
    <Pressable style={({ pressed }) => [s.banner, pressed && { opacity: 0.85 }]} onPress={() => router.push('/session')}>
      <View style={s.pulse}>
        <Icon name="timer" size={20} color={colors.primary} />
      </View>
      <View style={s.body}>
        <Text style={s.label}>Séance en cours</Text>
        <Text style={s.place} numberOfLines={1}>
          {sessionPlace(session)}
        </Text>
      </View>
      <Text style={s.action}>Reprendre</Text>
      <Icon name="chevron_right" size={20} color={colors.onPrimary} />
    </Pressable>
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
    backgroundColor: colors.primary,
  },
  pulse: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.onPrimary,
  },
  body: { flex: 1, gap: 1 },
  label: { fontSize: 12, fontWeight: '600', color: colors.onPrimary, opacity: 0.85 },
  place: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
  action: { fontSize: 14, fontWeight: '800', color: colors.onPrimary },
});
