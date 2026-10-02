import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { getGym } from '@/lib/db';
import { getSession, type Session } from '@/lib/session';
import { colors } from '@/lib/theme';

export function sessionPlace(session: Session) {
  return session.gymId ? (getGym(session.gymId)?.name ?? 'Salle') : (session.site ?? 'Extérieur');
}

/** Bandeau « Séance en cours » qui ramène à la séance. */
export function SessionBanner() {
  const [session, setSession] = useState<Session | null>(null);
  useFocusEffect(useCallback(() => setSession(getSession()), []));
  if (!session) return null;
  return (
    <Pressable style={s.banner} onPress={() => router.push('/session')}>
      <Text style={s.text} numberOfLines={1}>
        Séance en cours · {sessionPlace(session)}
      </Text>
      <Text style={s.action}>Reprendre</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  text: { flex: 1, color: '#fff', fontWeight: '600' },
  action: { color: '#fff', fontWeight: '800' },
});
