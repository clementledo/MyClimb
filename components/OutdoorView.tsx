import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { formatDate } from '@/components/BlockRow';
import { openSessionAt } from '@/components/startSession';
import { Button, Empty, Segmented } from '@/components/ui';
import { getSetting, listSpots, saveSpot, setSetting, type Spot } from '@/lib/db';
import { colors, themedStyles } from '@/lib/theme';

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

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Button label="Démarrer une séance ici" onPress={() => router.push('/session/outdoor')} />
        {spots.length > 0 && (
          <>
            <Text style={s.title}>Mes spots</Text>
            <Segmented
              options={[
                { value: 'list', label: 'Liste' },
                { value: 'map', label: 'Carte' },
              ]}
              value={view}
              onChange={changeView}
            />
          </>
        )}
      </View>

      {spots.length === 0 ? (
        <Empty text={'Tes spots apparaîtront ici après ta première séance dehors.'} />
      ) : view === 'list' ? (
        <FlatList
          data={spots}
          keyExtractor={(sp) => sp.name}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => relaunch(item)}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.sub}>
                  {item.climbs} grimpe{item.climbs > 1 ? 's' : ''} · dernière fois le{' '}
                  {formatDate(new Date(item.lastUsed).toISOString().slice(0, 10))}
                </Text>
              </View>
              <Text style={s.action}>Y grimper</Text>
            </Pressable>
          )}
        />
      ) : located.length === 0 ? (
        <Empty text="Aucun de tes spots n'a encore de position. Elle est enregistrée au démarrage d'une séance." />
      ) : (
        <MapView
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          initialRegion={{
            latitude: located[0].lat!,
            longitude: located[0].lng!,
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
      )}
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  header: { padding: 12, gap: 10 },
  title: { fontWeight: '700', fontSize: 15, color: colors.text, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  action: { color: colors.primary, fontWeight: '700' },
});
