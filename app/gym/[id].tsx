import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { BlockRow } from '@/components/BlockRow';
import { openSessionAt } from '@/components/startSession';
import { Button, Empty, Section, Segmented } from '@/components/ui';
import { formatPrice } from '@/lib/climbing';
import { getGym, listBlocks, type Block } from '@/lib/db';
import {
  formatDistance,
  formatDuration,
  gymDetails,
  navigationUrl,
  routeTo,
  TRAVEL_MODE_LABELS,
  type GymDetails,
  type LatLng,
  type Route,
  type TravelMode,
} from '@/lib/google';
import { gymPrices } from '@/lib/gymPrices';
import { currentPosition } from '@/lib/location';
import { getSession } from '@/lib/session';
import { colors, themedStyles } from '@/lib/theme';

const MODES: TravelMode[] = ['WALK', 'TRANSIT', 'DRIVE'];

export default function GymScreen() {
  const params = useLocalSearchParams<{ id: string; mode?: TravelMode }>();
  const gym = getGym(params.id);
  const [mode, setMode] = useState<TravelMode>(params.mode ?? 'WALK');
  const [position, setPosition] = useState<LatLng | null>(null);
  // Trajet calculé pour un mode donné : tant qu'il ne correspond pas au mode affiché, on charge.
  const [routeFor, setRouteFor] = useState<{ mode: TravelMode; route: Route | null } | null>(null);
  const routeLoading = routeFor?.mode !== mode;
  const route = routeLoading ? null : routeFor.route;
  const [details, setDetails] = useState<GymDetails | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [sessionHere, setSessionHere] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const map = useRef<MapView>(null);

  useEffect(() => {
    currentPosition().then(setPosition).catch((e) => setError(e.message));
    if (gym) gymDetails(gym.id).then(setDetails).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (!gym || !position) return;
    routeTo(position, gym, mode)
      .then((r) => {
        setRouteFor({ mode, route: r });
        if (r && r.path.length > 1) {
          map.current?.fitToCoordinates(r.path, {
            edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
            animated: true,
          });
        }
      })
      .catch((e) => {
        setError(e.message);
        setRouteFor({ mode, route: null });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, mode, params.id]);

  useFocusEffect(
    useCallback(() => {
      setBlocks(listBlocks(params.id));
      setSessionHere(getSession()?.gymId === params.id);
    }, [params.id]),
  );

  if (!gym) return <Empty text="Salle introuvable." />;
  const prices = gymPrices(gym);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Stack.Screen options={{ title: gym.name }} />
      <MapView
        ref={map}
        style={s.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        initialRegion={{ latitude: gym.lat, longitude: gym.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
        <Marker coordinate={{ latitude: gym.lat, longitude: gym.lng }} title={gym.name} pinColor={colors.primary} />
        {route && route.path.length > 1 && (
          <Polyline coordinates={route.path} strokeColor={colors.primary} strokeWidth={4} />
        )}
      </MapView>

      <View style={s.body}>
        <Segmented
          options={MODES.map((m) => ({ value: m, label: TRAVEL_MODE_LABELS[m] }))}
          value={mode}
          onChange={setMode}
        />

        <View style={s.travel}>
          {routeLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : route ? (
            <Text style={s.travelText}>
              <Text style={s.duration}>{formatDuration(route.durationSec)}</Text>
              {'  ·  '}
              {formatDistance(route.distanceM)}
            </Text>
          ) : (
            <Text style={s.muted}>Pas de trajet trouvé dans ce mode.</Text>
          )}
        </View>
        {error && <Text style={s.error}>{error}</Text>}

        <View style={s.actions}>
          <Button
            label="Y aller"
            style={{ flex: 1 }}
            onPress={() => Linking.openURL(navigationUrl(gym, mode))}
          />
          <Button
            label={details && !details.website ? 'Pas de site web' : 'Site web'}
            variant="secondary"
            style={{ flex: 1 }}
            disabled={!details?.website}
            onPress={() => details?.website && Linking.openURL(details.website)}
          />
        </View>

        <Button
          label={sessionHere ? 'Reprendre la séance en cours' : 'Démarrer une séance ici'}
          onPress={() => openSessionAt({ gymId: gym.id })}
        />

        <Section title="Tarifs">
          {prices ? (
            <>
              <View style={s.prices}>
                <View style={s.priceLine}>
                  <Text style={[s.text, { fontWeight: '700' }]}>Entrée</Text>
                  <Text style={[s.text, { fontWeight: '700' }]}>{formatPrice(prices.entry)}</Text>
                </View>
                {prices.others.map((p) => (
                  <View key={p.label} style={s.priceLine}>
                    <Text style={[s.text, { flex: 1 }]}>{p.label}</Text>
                    <Text style={s.text}>{formatPrice(p.amount)}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.muted} onPress={() => Linking.openURL(prices.source)}>
                {prices.taxes ? `${prices.taxes}. ` : ''}Relevé sur le site de la salle en {prices.checkedOn}.{' '}
                <Text style={{ color: colors.primary }}>Voir les tarifs à jour</Text>
              </Text>
            </>
          ) : (
            <Text style={s.muted}>Tarifs non disponibles pour cette salle.</Text>
          )}
        </Section>

        <Section title="Infos">
          {gym.address && <Text style={s.text}>{gym.address}</Text>}
          {details ? (
            <>
              {details.openNow !== null && (
                <Text style={[s.text, { color: details.openNow ? colors.success : colors.danger, fontWeight: '600' }]}>
                  {details.openNow ? 'Ouvert maintenant' : 'Fermé maintenant'}
                </Text>
              )}
              {details.rating !== null && (
                <Text style={s.text}>
                  ★ {details.rating.toFixed(1).replace('.', ',')}
                  {details.ratingCount ? ` (${details.ratingCount} avis)` : ''}
                </Text>
              )}
              {details.hours.map((h) => (
                <Text key={h} style={s.muted}>
                  {h}
                </Text>
              ))}
            </>
          ) : (
            <ActivityIndicator color={colors.muted} style={{ alignSelf: 'flex-start' }} />
          )}
        </Section>

        {blocks.length > 0 && <Text style={s.sectionTitle}>Mes grimpes ici ({blocks.length})</Text>}
      </View>
      {blocks.map((b) => (
        <BlockRow key={b.id} block={b} showGym={false} />
      ))}
    </ScrollView>
  );
}

const s = themedStyles({
  container: { flex: 1, backgroundColor: colors.background },
  map: { height: 260 },
  body: { padding: 16, gap: 16 },
  travel: { alignItems: 'center', minHeight: 28, justifyContent: 'center' },
  travelText: { fontSize: 16, color: colors.text },
  duration: { fontSize: 22, fontWeight: '800' },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  prices: { gap: 6, padding: 12, borderRadius: 10, backgroundColor: colors.surface },
  priceLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  error: { color: colors.danger },
  sectionTitle: { fontWeight: '700', fontSize: 15, color: colors.text },
});
