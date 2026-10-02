import { getSetting, setSetting } from './db';

/** Séance en cours : dans une salle, ou sur un site en extérieur. */
export type Session = { gymId: string | null; site: string | null; startedAt: number };

const KEY = 'session';

export function getSession(): Session | null {
  const raw = getSetting(KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function startSession(place: { gymId: string } | { site: string }): Session {
  const session: Session = {
    gymId: 'gymId' in place ? place.gymId : null,
    site: 'site' in place ? place.site : null,
    startedAt: Date.now(),
  };
  setSetting(KEY, JSON.stringify(session));
  return session;
}

export function endSession() {
  setSetting(KEY, '');
}
