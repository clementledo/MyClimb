import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { Badge, Banner, Empty, Icon, IconButton, Segmented, Sheet } from '@/components/ui';
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
import { friendlyError } from '@/lib/errors';
import { currentPosition, distanceM } from '@/lib/location';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

const MODES: TravelMode[] = ['WALK', 'TRANSIT', 'DRIVE'];
const MODE_ICONS = { WALK: 'directions_walk', TRANSIT: 'directions_transit', DRIVE: 'directions_car' } as const;

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
  const [filters, setFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGyms = useCallback(
    () =>
      nearbyGyms()
        .then(({ pos, gyms }) => {
          setPosition(pos);
          setGyms(gyms);
        })
        .catch((e) => setError(friendlyError(e, 'Impossible de charger les salles. Réessaie dans un instant.')))
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

  const summary = `${TRAVEL_MODE_LABELS[mode]} · triées par ${sortBy === 'price' ? 'prix' : 'distance'}`;

  return (
    <View style={s.container}>
      <View style={s.toolbar}>
        <Pressable style={s.summary} onPress={() => setFilters(true)} accessibilityLabel="Filtres">
          <Icon name={MODE_ICONS[mode]} size={18} color={colors.primary} />
          <Text style={s.summaryText} numberOfLines={1}>
            {summary}
          </Text>
          <Icon name="expand_more" size={18} color={colors.muted} />
        </Pressable>
        <IconButton
          icon={view === 'list' ? 'map' : 'view_list'}
          label={view === 'list' ? 'Voir la carte' : 'Voir la liste'}
          onPress={() => setView(view === 'list' ? 'map' : 'list')}
        />
      </View>

      <Sheet visible={filters} onClose={() => setFilters(false)} title="Filtres">
        <View style={s.filterGroup}>
          <Text style={s.filterLabel}>Se déplacer</Text>
          <Segmented
            options={MODES.map((m) => ({ value: m, label: TRAVEL_MODE_LABELS[m], icon: MODE_ICONS[m] }))}
            value={mode}
            onChange={changeMode}
          />
        </View>
        <View style={s.filterGroup}>
          <Text style={s.filterLabel}>Trier les salles par</Text>
          <Segmented
            options={[
              { value: 'distance', label: 'Distance', icon: 'near_me' },
              { value: 'price', label: "Prix d'entrée", icon: 'payments' },
            ]}
            value={sortBy}
            onChange={changeSort}
          />
        </View>
      </Sheet>

      {error && (
        <Banner
          tone="danger"
          title="Oups"
          text={error}
          action={{ label: 'Réessayer', onPress: reload }}
          style={s.error}
        />
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
      ) : view === 'list' ? (
        <FlatList
          data={sorted}
          keyExtractor={(g) => g.id}
          onRefresh={reload}
          refreshing={false}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            !error ? (
              <Empty icon="location_off" title="Aucune salle trouvée" text="Aucune salle d'escalade autour de toi pour le moment." />
            ) : null
          }
          renderItem={({ item }) => {
            const t = times[item.id];
            const n = counts[item.id] ?? 0;
            const entry = gymPrices(item)?.entry;
            return (
              <Pressable style={({ pressed }) => [s.card, pressed && s.cardPressed]} onPress={() => open(item)}>
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
                <View style={s.info}>
                  <Text style={s.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.address && (
                    <Text style={s.sub} numberOfLines={1}>
                      {item.address}
                    </Text>
                  )}
                  <View style={s.badges}>
                    {entry !== undefined && <Badge label={formatPrice(entry)} />}
                    {n > 0 && <Badge tone="neutral" label={`${n} grimpe${n > 1 ? 's' : ''}`} />}
                  </View>
                </View>
                <View style={s.time}>
                  {t ? (
                    <>
                      <Text style={s.duration}>{formatDuration(t.durationSec)}</Text>
                      <Text style={s.distance}>{formatDistance(t.distanceM)}</Text>
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
          <View style={s.mapWrap}>
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
          </View>
        )
      )}
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  summary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  summaryText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  filterGroup: { gap: space.sm },
  filterLabel: { ...type.callout },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.surface },
  photo: { width: 68, height: 68, borderRadius: radius.md, backgroundColor: colors.surface },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  photoLetter: { fontSize: 26, fontWeight: '800', color: colors.primary },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: colors.text },
  sub: { fontSize: 13, fontWeight: '400', color: colors.muted },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  time: { alignItems: 'flex-end', minWidth: 60, gap: 2 },
  duration: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: colors.text },
  distance: { fontSize: 12, fontWeight: '500', color: colors.muted },
  error: { marginHorizontal: space.lg, marginBottom: space.md },
  mapWrap: { flex: 1, marginHorizontal: space.lg, marginBottom: space.lg, borderRadius: radius.lg, overflow: 'hidden' },
});
