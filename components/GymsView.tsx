import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { Button, Empty, Segmented } from '@/components/ui';
import { formatPrice } from '@/lib/climbing';
import { countBlocksByGym, getSetting, saveGym, setSetting, type Gym } from '@/lib/db';
import {
  ANDROID_HEADERS,
  formatDistance,
  formatDuration,
  photoUrl,
  searchGyms,
  travelTimes,
  TRAVEL_MODE_LABELS,
  type LatLng,
  type Travel,
  type TravelMode,
} from '@/lib/google';
import { gymPrices } from '@/lib/gymPrices';
import { currentPosition, distanceM } from '@/lib/location';
import { colors } from '@/lib/theme';

const MODES: TravelMode[] = ['WALK', 'TRANSIT', 'DRIVE'];

async function nearbyGyms() {
  const pos = await currentPosition();
  return { pos, gyms: await searchGyms(pos) };
}

/** Salles autour de toi, en liste ou sur une carte. */
export function GymsView() {
  const [mode, setMode] = useState<TravelMode>(() => (getSetting('travelMode') as TravelMode) ?? 'WALK');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [position, setPosition] = useState<LatLng | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  // Temps de trajet du mode affiché ; ceux d'un autre mode sont ignorés le temps du calcul.
  const [timesFor, setTimesFor] = useState<{ mode: TravelMode; data: Record<string, Travel> } | null>(null);
  const times = useMemo(() => (timesFor?.mode === mode ? timesFor.data : {}), [timesFor, mode]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<'distance' | 'price'>(
    () => (getSetting('gymSort') as 'distance' | 'price') ?? 'distance',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGyms = useCallback(
    () =>
      nearbyGyms()
        .then(({ pos, gyms }) => {
          setPosition(pos);
          setGyms(gyms);
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false)),
    [],
  );

  const reload = () => {
    setLoading(true);
    setError(null);
    fetchGyms();
  };

  useEffect(() => {
    fetchGyms();
  }, [fetchGyms]);

  useEffect(() => {
    if (!position || gyms.length === 0) return;
    travelTimes(position, gyms, mode)
      .then((data) => setTimesFor({ mode, data }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [position, gyms, mode]);

  useFocusEffect(
    useCallback(() => {
      setCounts(countBlocksByGym());
    }, []),
  );

  const changeSort = (v: 'distance' | 'price') => {
    setSortBy(v);
    setSetting('gymSort', v);
  };

  const changeMode = (m: TravelMode) => {
    setMode(m);
    setSetting('travelMode', m);
  };

  const sorted = useMemo(() => {
    const crow = (g: Gym) =>
      position ? distanceM(position, { latitude: g.lat, longitude: g.lng }) : 0;
    const time = (g: Gym) => times[g.id]?.durationSec ?? Number.POSITIVE_INFINITY;
    // Par prix : les salles sans tarif renseigné passent en dernier.
    const price = (g: Gym) => gymPrices(g)?.entry ?? Number.POSITIVE_INFINITY;
    const byDistance = (a: Gym, b: Gym) => time(a) - time(b) || crow(a) - crow(b);
    return [...gyms].sort(
      sortBy === 'price' ? (a, b) => price(a) - price(b) || byDistance(a, b) : byDistance,
    );
  }, [gyms, times, position, sortBy]);

  const open = (gym: Gym) => {
    saveGym(gym);
    router.push({ pathname: '/gym/[id]', params: { id: gym.id, mode } });
  };

  return (
    <View style={s.container}>
      <View style={s.controls}>
        <Segmented
          options={MODES.map((m) => ({ value: m, label: TRAVEL_MODE_LABELS[m] }))}
          value={mode}
          onChange={changeMode}
        />
        <Segmented
          options={[
            { value: 'list', label: 'Liste' },
            { value: 'map', label: 'Carte' },
          ]}
          value={view}
          onChange={setView}
        />
        {view === 'list' && (
          <View style={s.sortRow}>
            <Text style={s.sortLabel}>Trier par</Text>
            <View style={{ flex: 1 }}>
              <Segmented
                options={[
                  { value: 'distance', label: 'Distance' },
                  { value: 'price', label: "Prix d'entrée" },
                ]}
                value={sortBy}
                onChange={changeSort}
              />
            </View>
          </View>
        )}
      </View>

      {error && (
        <View style={s.error}>
          <Text style={s.errorText}>{error}</Text>
          <Button label="Réessayer" variant="secondary" onPress={reload} />
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : view === 'list' ? (
        <FlatList
          data={sorted}
          keyExtractor={(g) => g.id}
          onRefresh={reload}
          refreshing={false}
          ListEmptyComponent={!error ? <Empty text="Aucune salle trouvée autour de toi." /> : null}
          renderItem={({ item }) => {
            const t = times[item.id];
            const n = counts[item.id] ?? 0;
            const entry = gymPrices(item)?.entry;
            return (
              <Pressable style={s.row} onPress={() => open(item)}>
                {item.photoName ? (
                  <Image
                    source={{ uri: photoUrl(item.photoName), headers: ANDROID_HEADERS }}
                    style={s.photo}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={150}
                  />
                ) : (
                  <View style={[s.photo, s.photoEmpty]}>
                    <Text style={s.photoLetter}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.name}</Text>
                  {item.address && (
                    <Text style={s.sub} numberOfLines={1}>
                      {item.address}
                    </Text>
                  )}
                  <Text style={s.price}>
                    {entry !== undefined ? `Entrée ${formatPrice(entry)}` : 'Prix non disponible'}
                    {n > 0 ? `  ·  ${n} grimpe${n > 1 ? 's' : ''}` : ''}
                  </Text>
                </View>
                <View style={s.time}>
                  {t ? (
                    <>
                      <Text style={s.duration}>{formatDuration(t.durationSec)}</Text>
                      <Text style={s.sub}>{formatDistance(t.distanceM)}</Text>
                    </>
                  ) : (
                    <ActivityIndicator size="small" color={colors.muted} />
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        position && (
          <MapView
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            showsUserLocation
            initialRegion={{ ...position, latitudeDelta: 0.15, longitudeDelta: 0.15 }}>
            {sorted.map((g) => (
              <Marker
                key={g.id}
                coordinate={{ latitude: g.lat, longitude: g.lng }}
                title={g.name}
                description={times[g.id] ? formatDuration(times[g.id].durationSec) : undefined}
                pinColor={colors.primary}
                onCalloutPress={() => open(g)}
              />
            ))}
          </MapView>
        )
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  controls: { padding: 12, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  photo: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.surface },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  photoLetter: { fontSize: 24, fontWeight: '800', color: colors.primary },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { color: colors.muted, fontSize: 13 },
  price: { color: colors.primary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortLabel: { color: colors.muted, fontSize: 13 },
  time: { alignItems: 'flex-end', minWidth: 64 },
  duration: { fontSize: 16, fontWeight: '700', color: colors.text },
  error: { margin: 12, padding: 12, gap: 8, borderRadius: 10, backgroundColor: '#FFF5F5' },
  errorText: { color: colors.danger },
});
