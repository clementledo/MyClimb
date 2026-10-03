import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { formatDate } from '@/components/BlockRow';
import { openSessionAt } from '@/components/startSession';
import { Button, Card, Empty, Icon, IconButton, ListRow } from '@/components/ui';
import { getSetting, listSpots, saveSpot, setSetting, type Spot } from '@/lib/db';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

type SpotView = 'list' | 'map';

function relaunch(spot: Spot) {
  saveSpot(spot.name, null);
  openSessionAt({ site: spot.name });
}

/** Grimpe en extérieur : démarrer une séance là où tu es, ou sur un de tes spots. */
export function OutdoorView() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [view, setView] = useState<SpotView>(() => (getSetting('spotView') as SpotView) || 'list');

  useFocusEffect(useCallback(() => setSpots(listSpots()), []));

  const changeView = (v: SpotView) => {
    setView(v);
    setSetting('spotView', v);
  };

  const located = spots.filter((sp) => sp.lat !== null && sp.lng !== null);

  const map = (
    <View style={s.mapWrap}>
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        initialRegion={{
          latitude: located[0]?.lat ?? 45.5,
          longitude: located[0]?.lng ?? -73.57,
          latitudeDelta: 0.6,
          longitudeDelta: 0.6,
        }}>
        {located.map((sp) => (
          <Marker
            key={sp.name}
            coordinate={{ latitude: sp.lat!, longitude: sp.lng! }}
            title={sp.name}
            description={`${sp.climbs} grimpe${sp.climbs > 1 ? 's' : ''} · appuie pour y grimper`}
            pinColor={colors.primary}
            onCalloutPress={() => relaunch(sp)}
          />
        ))}
      </MapView>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Card style={s.hero}>
        <View style={s.heroIcon}>
          <Icon name="terrain" size={28} color={colors.primary} />
        </View>
        <Text style={s.heroTitle}>Grimper dehors</Text>
        <Text style={s.heroText}>Démarre une séance là où tu es : MyClimb retrouve le nom du spot tout seul.</Text>
        <Button label="Démarrer une séance ici" icon="play_arrow" onPress={() => router.push('/session/outdoor')} />
      </Card>

      <View style={s.head}>
        <Text style={s.title}>Mes spots</Text>
        {spots.length > 0 && (
          <IconButton
            icon={view === 'list' ? 'map' : 'view_list'}
            label={view === 'list' ? 'Voir la carte' : 'Voir la liste'}
            onPress={() => changeView(view === 'list' ? 'map' : 'list')}
          />
        )}
      </View>

      {spots.length === 0 ? (
        <Empty icon="place" text="Tes spots apparaîtront ici après ta première séance dehors." />
      ) : view === 'list' ? (
        <View style={s.listCard}>
          {spots.map((item, i) => (
            <ListRow
              key={item.name}
              icon="place"
              title={item.name}
              subtitle={`${item.climbs} grimpe${item.climbs > 1 ? 's' : ''} · dernière fois le ${formatDate(
                new Date(item.lastUsed).toISOString().slice(0, 10),
              )}`}
              value="Y grimper"
              onPress={() => relaunch(item)}
              last={i === spots.length - 1}
            />
          ))}
        </View>
      ) : located.length === 0 ? (
        <Empty icon="location_off" text="Aucun de tes spots n'a encore de position. Elle est enregistrée au démarrage d'une séance." />
      ) : (
        map
      )}
    </ScrollView>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.lg },
  hero: { gap: space.sm, padding: space.xl },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginBottom: space.xs,
  },
  heroTitle: { ...type.title },
  heroText: { ...type.body, color: colors.muted, marginBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.headline },
  listCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  mapWrap: { height: 380, borderRadius: radius.lg, overflow: 'hidden' },
});
