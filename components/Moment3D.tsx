import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Climb3D, type Progress } from '@/components/Climb3D';
import { G } from '@/components/ManagerUi';
import { Icon } from '@/components/ui';
import type { Moment } from '@/lib/manager';
import { planRoute, type Plan } from '@/lib/planner';
import { demoRoute, type SimRoute } from '@/lib/simRoutes';
import { themedStyles } from '@/lib/theme';

// La voie de démonstration n'est préparée qu'une fois par lancement de l'app.
let cached: Promise<{ route: SimRoute; plan: Plan }> | null = null;
function scene() {
  cached ??= demoRoute().then((route) => ({ route, plan: planRoute({ ...route, angle: 'devers' }, 1.75) }));
  return cached;
}

/** Moment clé d'une compétition, rejoué en 3D avec le costume du grimpeur. */
export function Moment3D({ moment, onClose }: { moment: Moment | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const [data, setData] = useState<{ route: SimRoute; plan: Plan } | null>(null);
  const [playing, setPlaying] = useState(true);
  const [fell, setFell] = useState(false);

  useEffect(() => {
    if (!moment) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nouveau moment : on repart du début.
    setPlaying(true);
    setFell(false);
    scene()
      .then(setData)
      .catch(() => setData(null));
  }, [moment]);

  const onProgress = (p: Progress) => {
    // Une chute : on s'arrête juste avant la dernière prise.
    if (moment?.kind === 'chute' && p.total > 0 && p.index >= p.total - 1 && !fell) {
      setPlaying(false);
      setFell(true);
    }
  };

  return (
    <Modal visible={!!moment} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.screen, { paddingTop: top }]}>
        <View style={{ width, height: height * 0.72 }}>
          {data && moment && (
            <Climb3D
              route={data.route}
              plan={data.plan}
              skin={moment.skin}
              celebration={moment.kind === 'chute' ? null : moment.kind === 'record' ? 'confettis' : moment.kind === 'flash' ? 'eclairs' : 'poing'}
              playing={playing}
              speed={1.6}
              restartKey={0}
              viewKey={0}
              seek={{ t: 0, n: 0 }}
              step={0}
              onProgress={onProgress}
              onEnd={() => setPlaying(false)}
            />
          )}
          {fell && (
            <View style={s.fall} pointerEvents="none">
              <Text style={s.fallText}>CHUTE !</Text>
            </View>
          )}
        </View>
        <View style={[s.bottom, { paddingBottom: bottom + 16 }]}>
          <Text style={s.over}>{moment?.kind === 'chute' ? 'SI PRÈS DU BUT' : moment?.kind === 'flash' ? 'FLASH !' : 'MOMENT CLÉ'}</Text>
          <Text style={s.text}>{moment?.text}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" style={s.close}>
            <Icon name="close" size={20} color={G.bg} />
            <Text style={s.closeText}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = themedStyles({
  screen: { flex: 1, backgroundColor: G.bg },
  bottom: { flex: 1, paddingHorizontal: 20, gap: 8, justifyContent: 'center' },
  over: { color: G.gold, fontWeight: '900', letterSpacing: 2, fontSize: 13 },
  text: { color: G.text, fontWeight: '800', fontSize: 18, lineHeight: 24 },
  close: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 14, backgroundColor: G.gold, marginTop: 8 },
  closeText: { color: G.bg, fontWeight: '800', fontSize: 16 },
  fall: { position: 'absolute', top: 30, left: 0, right: 0, alignItems: 'center' },
  fallText: { color: G.red, fontWeight: '900', fontSize: 40, letterSpacing: 3, textShadowColor: '#000', textShadowRadius: 8 },
});
