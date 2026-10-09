import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Text, useWindowDimensions, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Climb3D, type Progress } from '@/components/Climb3D';
import { G, GButton } from '@/components/ManagerUi';
import { CRUX_BONUS } from '@/lib/manager';
import { planRoute, type Plan } from '@/lib/planner';
import type { SkinId } from '@/lib/skins';
import { demoRoute, type SimRoute } from '@/lib/simRoutes';
import { themedStyles } from '@/lib/theme';

let cached: Promise<{ route: SimRoute; plan: Plan }> | null = null;
function scene() {
  cached ??= demoRoute().then((route) => ({ route, plan: planRoute({ ...route, angle: 'devers' }, 1.75) }));
  return cached;
}

export type Crux = { name: string; skin: SkinId; title: string; /** Ce qu'il manque pour réussir sans aide. */ gap: number; league: number };
type Verdict = { label: string; bonus: number };

/**
 * Passage clé : le grimpeur bloque, une jauge va et vient,
 * il faut toucher quand le curseur est dans la zone verte.
 */
export function CruxGame({ crux, onDone }: { crux: Crux | null; onDone: (bonus: number) => void }) {
  const { width, height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const [data, setData] = useState<{ route: SimRoute; plan: Plan } | null>(null);
  const [phase, setPhase] = useState<'grimpe' | 'jauge' | 'suite' | 'fin'>('grimpe');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [cursor] = useState(() => new Animated.Value(0));
  const [pos] = useState(() => ({ v: 0 }));
  // Zone verte : plus étroite et plus rapide dans les ligues hautes.
  const [zone, setZone] = useState({ at: 0.5, size: 0.2 });

  useEffect(() => {
    if (!crux) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nouveau passage clé : on repart du début.
    setPhase('grimpe');
    setVerdict(null);
    setZone({ at: 0.25 + Math.random() * 0.5, size: [0.22, 0.18, 0.14][crux.league] ?? 0.18 });
    scene()
      .then(setData)
      .catch(() => setData(null));
  }, [crux]);

  useEffect(() => {
    if (phase !== 'jauge' || !crux) return;
    const id = cursor.addListener(({ value }) => (pos.v = value));
    const ms = [950, 800, 650][crux.league] ?? 800;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursor, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(cursor, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    cursor.setValue(0);
    loop.start();
    return () => {
      loop.stop();
      cursor.removeListener(id);
    };
  }, [phase, crux, cursor, pos]);

  // Sans les données 3D, on passe directement à la jauge.
  useEffect(() => {
    if (crux && !data && phase === 'grimpe') {
      const t = setTimeout(() => setPhase('jauge'), 1500);
      return () => clearTimeout(t);
    }
  }, [crux, data, phase]);

  const onProgress = (p: Progress) => {
    if (phase === 'grimpe' && p.total > 0 && p.index >= p.total - 2) setPhase('jauge');
  };

  const tap = () => {
    if (phase !== 'jauge' || !crux) return;
    const d = Math.abs(pos.v - zone.at);
    const v: Verdict = d <= zone.size * 0.18 ? { label: 'PARFAIT !', bonus: CRUX_BONUS.parfait } : d <= zone.size / 2 ? { label: 'BIEN !', bonus: CRUX_BONUS.bien } : d <= zone.size / 2 + 0.08 ? { label: 'JUSTE', bonus: CRUX_BONUS.juste } : { label: 'RATÉ', bonus: CRUX_BONUS.rate };
    setVerdict(v);
    Vibration.vibrate(v.bonus >= CRUX_BONUS.bien ? [0, 40, 60, 80] : 30);
    setPhase(v.bonus >= crux.gap ? 'suite' : 'fin');
  };

  const success = !!verdict && !!crux && verdict.bonus >= crux.gap;
  const barW = width - 48;

  return (
    <Modal visible={!!crux} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <Pressable style={[s.screen, { paddingTop: top }]} onPress={tap} disabled={phase !== 'jauge'} accessibilityLabel="Toucher au bon moment">
        <View style={{ width, height: height * 0.62 }}>
          {data && crux && (
            <Climb3D
              route={data.route}
              plan={data.plan}
              skin={crux.skin}
              celebration={success ? 'poing' : null}
              playing={phase === 'grimpe' || phase === 'suite'}
              speed={1.8}
              restartKey={0}
              viewKey={0}
              seek={{ t: 0, n: 0 }}
              step={0}
              onProgress={onProgress}
              onEnd={() => setPhase('fin')}
            />
          )}
          {verdict && (
            <View style={s.verdict} pointerEvents="none">
              <Text style={[s.verdictText, { color: verdict.bonus >= CRUX_BONUS.bien ? G.green : verdict.bonus > 0 ? G.gold : G.red }]}>{verdict.label}</Text>
              {phase === 'fin' && <Text style={s.sub}>{success ? 'Il sort le passage !' : 'Il tombe au passage clé…'}</Text>}
            </View>
          )}
        </View>
        <View style={[s.bottom, { paddingBottom: bottom + 16 }]}>
          <Text style={s.over}>PASSAGE CLÉ · {crux?.title.toUpperCase()}</Text>
          <Text style={s.title}>{crux?.name} est en difficulté !</Text>
          {phase === 'fin' ? (
            <GButton label="Continuer" icon="play_arrow" tone="accent" onPress={() => onDone(verdict?.bonus ?? 0)} />
          ) : (
            <>
              <Text style={s.muted}>{phase === 'jauge' ? 'Touche l’écran quand le curseur est dans la zone verte.' : 'Prépare-toi…'}</Text>
              <View style={[s.bar, { width: barW }]}>
                <View style={[s.zone, { left: (zone.at - zone.size / 2 - 0.08) * barW, width: (zone.size + 0.16) * barW, backgroundColor: 'rgba(255,212,59,0.35)' }]} />
                <View style={[s.zone, { left: (zone.at - zone.size / 2) * barW, width: zone.size * barW }]} />
                <View style={[s.zone, { left: (zone.at - zone.size * 0.18) * barW, width: zone.size * 0.36 * barW, backgroundColor: '#2BD96B' }]} />
                <Animated.View style={[s.cursor, { transform: [{ translateX: cursor.interpolate({ inputRange: [0, 1], outputRange: [0, barW - 6] }) }] }]} />
              </View>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const s = themedStyles({
  screen: { flex: 1, backgroundColor: G.bg },
  bottom: { flex: 1, paddingHorizontal: 24, gap: 10, justifyContent: 'center' },
  over: { color: G.gold, fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  title: { color: G.text, fontWeight: '900', fontSize: 22 },
  muted: { color: G.muted, fontSize: 14, lineHeight: 19 },
  sub: { color: G.text, fontWeight: '800', fontSize: 18, marginTop: 4 },
  bar: { height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 6 },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(81,207,102,0.65)' },
  cursor: { position: 'absolute', top: -2, bottom: -2, width: 6, borderRadius: 3, backgroundColor: '#fff' },
  verdict: { position: 'absolute', top: 30, left: 0, right: 0, alignItems: 'center' },
  verdictText: { fontWeight: '900', fontSize: 42, letterSpacing: 3, textShadowColor: '#000', textShadowRadius: 8 },
});
