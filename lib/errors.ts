/** Transforme une erreur technique (souvent en anglais) en message clair pour l'utilisateur. */
export function friendlyError(e: unknown, fallback = 'Une erreur est survenue. Réessaie dans un instant.'): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/^Autorise la localisation/.test(msg)) return msg;
  if (/location|position|Google Play services|LocationServices/i.test(msg)) {
    return 'Ta position n’est pas disponible. Vérifie que la localisation est activée, puis réessaie.';
  }
  if (/network|internet|timed? ?out|failed to fetch|unable to resolve/i.test(msg)) {
    return 'Pas de connexion internet. Vérifie ton réseau, puis réessaie.';
  }
  if (/^Google a répondu/.test(msg)) return 'Google Maps ne répond pas pour le moment. Réessaie dans un instant.';
  return fallback;
}
