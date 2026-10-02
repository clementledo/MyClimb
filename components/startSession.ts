import { router } from 'expo-router';
import { Alert } from 'react-native';

import { getSession, startSession, type Session } from '@/lib/session';

const samePlace = (s: Session, place: { gymId: string } | { site: string }) =>
  'gymId' in place ? s.gymId === place.gymId : s.site === place.site;

/**
 * Ouvre la séance de ce lieu : reprend celle en cours si c'est le même endroit,
 * sinon en démarre une nouvelle (après confirmation si une autre est en cours).
 */
export function openSessionAt(place: { gymId: string } | { site: string }, opts?: { replace?: boolean }) {
  const go = () => (opts?.replace ? router.replace('/session') : router.push('/session'));
  const current = getSession();
  if (current && samePlace(current, place)) return go();
  if (!current) {
    startSession(place);
    return go();
  }
  Alert.alert('Une séance est déjà en cours', 'La terminer et en démarrer une nouvelle ici ?', [
    { text: 'Annuler', style: 'cancel' },
    {
      text: 'Démarrer ici',
      onPress: () => {
        startSession(place);
        go();
      },
    },
  ]);
}
