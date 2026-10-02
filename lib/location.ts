import * as Location from 'expo-location';

import type { LatLng } from './google';

export async function currentPosition(): Promise<LatLng> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Autorise la localisation pour trouver les salles autour de toi.');
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

/** Distance à vol d'oiseau en mètres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nom du lieu (ville ou quartier) à cette position, d'après le géocodeur du téléphone. */
export async function placeName(pos: LatLng): Promise<string | null> {
  try {
    const [a] = await Location.reverseGeocodeAsync(pos);
    if (!a) return null;
    return a.city ?? a.district ?? a.subregion ?? a.region ?? null;
  } catch {
    return null;
  }
}
