import Constants from 'expo-constants';

import { readCache, writeCache, type Gym } from './db';

const API_KEY: string = Constants.expoConfig?.extra?.googleMapsApiKey ?? '';

// Identité de l'app Android, exigée par Google quand la clé est restreinte à cette app.
// L'empreinte SHA-1 sera ajoutée quand la clé de signature définitive existera.
export const ANDROID_HEADERS = {
  'X-Android-Package': 'com.clementledo.myclimb',
};

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const GYM_LIST_TTL = 7 * DAY;
const TRAVEL_TTL = 15 * MINUTE;
const DETAILS_TTL = DAY;
const SEARCH_RADIUS_M = 25000;

export type TravelMode = 'WALK' | 'TRANSIT' | 'DRIVE';

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  WALK: 'À pied',
  TRANSIT: 'Transports',
  DRIVE: 'Voiture',
};

export type LatLng = { latitude: number; longitude: number };

export type Travel = { durationSec: number; distanceM: number };

export type GymDetails = {
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  hours: string[];
  phone: string | null;
  website: string | null;
};

export class MissingApiKeyError extends Error {
  constructor() {
    super('Clé Google Maps absente de cette version de l\'app.');
  }
}

async function post<T>(url: string, fieldMask: string, body: unknown): Promise<T> {
  if (!API_KEY) throw new MissingApiKeyError();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...ANDROID_HEADERS,
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google a répondu ${res.status} : ${await res.text()}`);
  return res.json() as Promise<T>;
}

// Positions arrondies pour réutiliser le cache quand on bouge peu
// (0,01° ≈ 1 km pour la liste des salles, 0,005° ≈ 500 m pour les trajets).
const round = (n: number, step: number) => (Math.round(n / step) * step).toFixed(3);
const posKey = (p: LatLng, step: number) => `${round(p.latitude, step)},${round(p.longitude, step)}`;

const seconds = (d: string | undefined) => (d ? parseInt(d, 10) : NaN);

/** Salles d'escalade autour de `origin` (Places API New, recherche texte). */
export async function searchGyms(origin: LatLng): Promise<Gym[]> {
  const key = `gyms-v2:${posKey(origin, 0.01)}`;
  const cached = readCache<Gym[]>(key, GYM_LIST_TTL);
  if (cached) return cached;

  type Resp = {
    places?: {
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      location: { latitude: number; longitude: number };
      photos?: { name: string }[];
    }[];
  };
  const data = await post<Resp>(
    'https://places.googleapis.com/v1/places:searchText',
    'places.id,places.displayName,places.formattedAddress,places.location,places.photos',
    {
      textQuery: "salle d'escalade bloc",
      languageCode: 'fr',
      pageSize: 20,
      locationBias: { circle: { center: origin, radius: SEARCH_RADIUS_M } },
    },
  );
  const gyms: Gym[] = (data.places ?? []).map((p) => ({
    id: p.id,
    name: p.displayName?.text ?? 'Salle sans nom',
    address: p.formattedAddress ?? null,
    lat: p.location.latitude,
    lng: p.location.longitude,
    photoName: p.photos?.[0]?.name ?? null,
  }));
  writeCache(key, gyms);
  return gyms;
}

/** Temps de trajet depuis `origin` vers chaque salle (Routes API, matrice). */
export async function travelTimes(
  origin: LatLng,
  gyms: Gym[],
  mode: TravelMode,
): Promise<Record<string, Travel>> {
  if (gyms.length === 0) return {};
  const key = `times:${mode}:${posKey(origin, 0.005)}:${gyms.map((g) => g.id).join(',')}`;
  const cached = readCache<Record<string, Travel>>(key, TRAVEL_TTL);
  if (cached) return cached;

  type Elem = {
    originIndex?: number;
    destinationIndex?: number;
    duration?: string;
    distanceMeters?: number;
    condition?: string;
  };
  const body: Record<string, unknown> = {
    origins: [{ waypoint: { location: { latLng: origin } } }],
    destinations: gyms.map((g) => ({
      waypoint: { location: { latLng: { latitude: g.lat, longitude: g.lng } } },
    })),
    travelMode: mode,
  };
  if (mode === 'DRIVE') body.routingPreference = 'TRAFFIC_UNAWARE';

  const elems = await post<Elem[]>(
    'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
    'originIndex,destinationIndex,duration,distanceMeters,condition',
    body,
  );
  const result: Record<string, Travel> = {};
  for (const e of elems) {
    const gym = gyms[e.destinationIndex ?? 0];
    if (!gym || e.condition !== 'ROUTE_EXISTS') continue;
    result[gym.id] = { durationSec: seconds(e.duration), distanceM: e.distanceMeters ?? 0 };
  }
  writeCache(key, result);
  return result;
}

export type Route = Travel & { path: LatLng[] };

/** Trajet détaillé vers une salle, pour le tracer sur la carte. */
export async function routeTo(origin: LatLng, gym: Gym, mode: TravelMode): Promise<Route | null> {
  const key = `route:${mode}:${posKey(origin, 0.005)}:${gym.id}`;
  const cached = readCache<Route | null>(key, TRAVEL_TTL);
  if (cached) return cached;

  type Resp = {
    routes?: { duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }[];
  };
  const body: Record<string, unknown> = {
    origin: { location: { latLng: origin } },
    destination: { location: { latLng: { latitude: gym.lat, longitude: gym.lng } } },
    travelMode: mode,
    languageCode: 'fr',
  };
  if (mode === 'DRIVE') body.routingPreference = 'TRAFFIC_UNAWARE';

  const data = await post<Resp>(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
    body,
  );
  const r = data.routes?.[0];
  const route: Route | null = r
    ? {
        durationSec: seconds(r.duration),
        distanceM: r.distanceMeters ?? 0,
        path: decodePolyline(r.polyline?.encodedPolyline ?? ''),
      }
    : null;
  writeCache(key, route);
  return route;
}

/** Horaires, note et contact d'une salle (Place Details). */
export async function gymDetails(placeId: string): Promise<GymDetails> {
  const key = `details:${placeId}`;
  const cached = readCache<GymDetails>(key, DETAILS_TTL);
  if (cached) return cached;
  if (!API_KEY) throw new MissingApiKeyError();

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=fr`, {
    headers: {
      ...ANDROID_HEADERS,
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask':
        'rating,userRatingCount,currentOpeningHours.openNow,regularOpeningHours.weekdayDescriptions,nationalPhoneNumber,websiteUri',
    },
  });
  if (!res.ok) throw new Error(`Google a répondu ${res.status} : ${await res.text()}`);
  const p = await res.json();
  const details: GymDetails = {
    rating: p.rating ?? null,
    ratingCount: p.userRatingCount ?? null,
    openNow: p.currentOpeningHours?.openNow ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
  };
  writeCache(key, details);
  return details;
}

/** Adresse de la photo d'une salle (Place Photos), à la taille voulue. */
export function photoUrl(photoName: string, maxWidthPx = 240): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${API_KEY}`;
}

/** Lien qui ouvre Google Maps en navigation vers la salle. */
export function navigationUrl(gym: Gym, mode: TravelMode): string {
  const travelmode = { WALK: 'walking', TRANSIT: 'transit', DRIVE: 'driving' }[mode];
  const params = new URLSearchParams({
    api: '1',
    destination: `${gym.lat},${gym.lng}`,
    destination_place_id: gym.id,
    travelmode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Décodage du format « encoded polyline » de Google. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 'lat') lat += delta;
      else lng += delta;
    }
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec)) return '–';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m.toString().padStart(2, '0')}` : `${h} h`;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
