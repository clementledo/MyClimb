import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { BlockRow } from '@/components/BlockRow';
import { Button, Empty, Section, Segmented } from '@/components/ui';
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
import { currentPosition } from '@/lib/location';
import { colors } from '@/lib/theme';

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

  useFocusEffect(useCallback(() => setBlocks(listBlocks(params.id)), [params.id]));

  if (!gym) return <Empty text="Salle introuvable." />;

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

        <Section title={`Mes blocs ici (${blocks.length})`}>
          <Button
            label="+ Ajouter un bloc ici"
            variant="secondary"
            onPress={() => router.push({ pathname: '/block/new', params: { gymId: gym.id } })}
          />
        </Section>
      </View>
      {blocks.map((b) => (
        <BlockRow key={b.id} block={b} showGym={false} />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { height: 260 },
  body: { padding: 16, gap: 16 },
  travel: { alignItems: 'center', minHeight: 28, justifyContent: 'center' },
  travelText: { fontSize: 16, color: colors.text },
  duration: { fontSize: 22, fontWeight: '800' },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  error: { color: colors.danger },
});
