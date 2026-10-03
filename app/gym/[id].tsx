import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { BlockRow } from '@/components/BlockRow';
import { openSessionAt } from '@/components/startSession';
import { Badge, Button, Card, Empty, Icon, Section, Segmented } from '@/components/ui';
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
import { friendlyError } from '@/lib/errors';
import { colors, space, themedStyles, type } from '@/lib/theme';

const MODES: TravelMode[] = ['WALK', 'TRANSIT', 'DRIVE'];
const MODE_ICONS = { WALK: 'directions_walk', TRANSIT: 'directions_transit', DRIVE: 'directions_car' } as const;

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
    currentPosition()
      .then(setPosition)
      .catch((e) => setError(friendlyError(e)));
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
        setError(friendlyError(e, 'Impossible de calculer le trajet.'));
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

  if (!gym) return <Empty icon="search_off" text="Salle introuvable." />;
  const prices = gymPrices(gym);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <Stack.Screen options={{ title: '' }} />
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
        <View style={s.titleBlock}>
          <Text style={s.title}>{gym.name}</Text>
          {gym.address && <Text style={s.address}>{gym.address}</Text>}
          {details && (details.openNow !== null || details.rating !== null) && (
            <View style={s.badges}>
              {details.openNow !== null && (
                <Badge label={details.openNow ? 'Ouvert maintenant' : 'Fermé maintenant'} tone={details.openNow ? 'success' : 'danger'} />
              )}
              {details.rating !== null && (
                <Badge
                  tone="neutral"
                  label={`★ ${details.rating.toFixed(1).replace('.', ',')}${details.ratingCount ? ` · ${details.ratingCount} avis` : ''}`}
                />
              )}
            </View>
          )}
        </View>

        <Card style={s.travelCard}>
          <Segmented
            options={MODES.map((m) => ({ value: m, label: TRAVEL_MODE_LABELS[m], icon: MODE_ICONS[m] }))}
            value={mode}
            onChange={setMode}
          />
          <View style={s.travel}>
            {routeLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : route ? (
              <>
                <Text style={s.duration}>{formatDuration(route.durationSec)}</Text>
                <Text style={s.distance}>{formatDistance(route.distanceM)}</Text>
              </>
            ) : (
              <Text style={s.muted}>Pas de trajet trouvé dans ce mode.</Text>
            )}
          </View>
          {error && <Text style={s.error}>{error}</Text>}
          <View style={s.actions}>
            <Button
              label="Y aller"
              icon="navigation"
              style={{ flex: 1 }}
              onPress={() => Linking.openURL(navigationUrl(gym, mode))}
            />
            <Button
              label={details && !details.website ? 'Pas de site' : 'Site web'}
              icon="language"
              variant="secondary"
              style={{ flex: 1 }}
              disabled={!details?.website}
              onPress={() => details?.website && Linking.openURL(details.website)}
            />
          </View>
        </Card>

        <Button
          label={sessionHere ? 'Reprendre la séance en cours' : 'Démarrer une séance ici'}
          icon="play_arrow"
          onPress={() => openSessionAt({ gymId: gym.id })}
        />

        <Section title="Tarifs">
          <Card style={s.listCard}>
            {prices ? (
              <>
                <View style={s.priceLine}>
                  <Text style={s.priceMain}>Entrée</Text>
                  <Text style={s.priceMainValue}>{formatPrice(prices.entry)}</Text>
                </View>
                {prices.others.map((p) => (
                  <View key={p.label} style={s.priceLine}>
                    <Text style={[s.text, { flex: 1 }]}>{p.label}</Text>
                    <Text style={s.text}>{formatPrice(p.amount)}</Text>
                  </View>
                ))}
                <Text style={s.note} onPress={() => Linking.openURL(prices.source)}>
                  {prices.taxes ? `${prices.taxes}. ` : ''}Relevé sur le site de la salle en {prices.checkedOn}.{' '}
                  <Text style={s.noteLink}>Voir les tarifs à jour</Text>
                </Text>
              </>
            ) : (
              <Text style={s.muted}>Tarifs non disponibles pour cette salle.</Text>
            )}
          </Card>
        </Section>

        <Section title="Horaires">
          <Card style={s.listCard}>
            {details ? (
              details.hours.length > 0 ? (
                details.hours.map((h) => {
                  const [day, ...rest] = h.split(': ');
                  return (
                    <View key={h} style={s.hourLine}>
                      <Text style={s.hourDay}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                      <Text style={s.hourValue}>{rest.join(': ')}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={s.muted}>Horaires non disponibles.</Text>
              )
            ) : (
              <ActivityIndicator color={colors.muted} style={{ alignSelf: 'flex-start' }} />
            )}
          </Card>
        </Section>

        {blocks.length > 0 && (
          <Section title={`Mes grimpes ici · ${blocks.length}`}>
            <View style={s.blocks}>
              {blocks.map((b) => (
                <BlockRow key={b.id} block={b} showGym={false} />
              ))}
            </View>
          </Section>
        )}
        {blocks.length === 0 && (
          <View style={s.hint}>
            <Icon name="info" size={18} color={colors.muted} />
            <Text style={s.hintText}>Tes grimpes dans cette salle apparaîtront ici.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  map: { height: 220 },
  body: { padding: space.lg, gap: space.xl },
  titleBlock: { gap: 4 },
  title: { ...type.display },
  address: { ...type.subhead },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  travelCard: { gap: space.lg },
  travel: { alignItems: 'center', minHeight: 56, justifyContent: 'center', gap: 2 },
  duration: { fontSize: 34, fontWeight: '800', letterSpacing: -1, color: colors.text },
  distance: { ...type.subhead },
  text: { fontSize: 15, fontWeight: '400', color: colors.text },
  muted: { fontSize: 14, fontWeight: '400', color: colors.muted },
  actions: { flexDirection: 'row', gap: space.sm },
  listCard: { gap: 10 },
  priceLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  priceMain: { fontSize: 16, fontWeight: '700', color: colors.text },
  priceMainValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
  note: { fontSize: 12, fontWeight: '400', lineHeight: 17, color: colors.muted, marginTop: 4 },
  noteLink: { color: colors.primary, fontWeight: '700' },
  hourLine: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  hourDay: { fontSize: 14, fontWeight: '600', color: colors.text },
  hourValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '400', color: colors.muted },
  error: { fontSize: 13, fontWeight: '500', color: colors.danger, textAlign: 'center' },
  blocks: { gap: 10 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center' },
  hintText: { fontSize: 13, fontWeight: '400', color: colors.muted },
});
