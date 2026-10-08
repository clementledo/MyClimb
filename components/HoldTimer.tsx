import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, Vibration, View } from 'react-native';

import { Button, Sheet } from '@/components/ui';
import { colors, radius, space, themedStyles } from '@/lib/theme';
import { formatSeconds, type Dose, type Exercise } from '@/lib/training';

type Phase = { kind: 'prep' | 'work' | 'restRep' | 'rest' | 'switch'; seconds: number; set: number; rep: number; side?: string };

const LABEL: Record<Phase['kind'], string> = {
  prep: 'Prépare-toi',
  work: 'Tiens',
  restRep: 'Lâche',
  rest: 'Repos',
  switch: 'Change de côté',
};

/** Déroulé d'un exercice tenu : séries, répétitions, repos, et l'autre côté s'il y en a un. */
function phasesOf(d: Dose): Phase[] {
  const out: Phase[] = [{ kind: 'prep', seconds: 5, set: 1, rep: 1 }];
  const sides = d.sides ? ['gauche', 'droit'] : [undefined];
  sides.forEach((side, si) => {
    if (si > 0) out.push({ kind: 'switch', seconds: 10, set: 1, rep: 1, side });
    for (let set = 1; set <= d.sets; set++) {
      for (let rep = 1; rep <= d.reps; rep++) {
        out.push({ kind: 'work', seconds: d.work, set, rep, side });
        if (rep < d.reps && d.restRep) out.push({ kind: 'restRep', seconds: d.restRep, set, rep, side });
      }
      if (set < d.sets && d.rest > 0) out.push({ kind: 'rest', seconds: d.rest, set, rep: d.reps, side });
    }
  });
  return out;
}

/** Les exercices qu'on tient un certain temps (planche, suspensions, étirements) ont un minuteur. */
export const hasTimer = (x: Exercise) => x.dose.work > 0;

/** Minuteur facultatif, dans un panneau : vibre à chaque changement et garde l'écran allumé. */
export function HoldTimer({ exercise, onClose, onDone }: { exercise: Exercise; onClose: () => void; onDone?: () => void }) {
  useKeepAwake();
  const phases = useMemo(() => phasesOf(exercise.dose), [exercise]);
  const [index, setIndex] = useState(0);
  const [start, setStart] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const beep = useRef(-1);

  const phase = phases[index];
  const left = Math.max(0, phase.seconds - ((pausedAt ?? now) - start) / 1000);
  // Copie lue par l'horloge (qui tourne hors du rendu).
  const live = useRef({ index: 0, start });

  const goTo = useCallback(
    (i: number) => {
      beep.current = -1;
      if (i >= phases.length) {
        Vibration.vibrate([0, 300, 150, 300, 150, 600]);
        setDone(true);
        onDone?.();
        return;
      }
      Vibration.vibrate(phases[i].kind === 'work' ? 400 : [0, 120, 100, 120]);
      const t = Date.now();
      live.current = { index: i, start: t };
      setIndex(i);
      setStart(t);
      setPausedAt(null);
    },
    [phases, onDone],
  );

  // Horloge : rafraîchit l'affichage, petites vibrations les 3 dernières secondes, puis phase suivante.
  useEffect(() => {
    if (done || pausedAt !== null) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const L = live.current;
      const ph = phases[L.index];
      const rem = ph.seconds - (t - L.start) / 1000;
      const sec = Math.ceil(rem);
      if (sec <= 3 && sec > 0 && sec !== beep.current && ph.seconds >= 6) {
        beep.current = sec;
        Vibration.vibrate(60);
      }
      if (rem <= 0) goTo(L.index + 1);
    }, 100);
    return () => clearInterval(timer);
  }, [done, pausedAt, phases, goTo]);

  const d = exercise.dose;
  const tint = phase.kind === 'work' ? colors.primary : phase.kind === 'prep' || phase.kind === 'switch' ? colors.text : colors.success;
  const counter = [
    d.sets > 1 ? `Série ${phase.set}/${d.sets}` : null,
    d.reps > 1 ? `Répétition ${phase.rep}/${d.reps}` : null,
    phase.side ? `Côté ${phase.side}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Sheet visible onClose={onClose} title={exercise.name}>
      {done ? (
        <View style={s.center}>
          <Text style={[s.phase, { color: colors.success }]}>TERMINÉ</Text>
          <Text style={s.big}>Bravo !</Text>
          <Button label="Fermer" icon="check" onPress={onClose} />
        </View>
      ) : (
        <View style={s.center}>
          <Text style={[s.phase, { color: tint }]}>{LABEL[phase.kind].toUpperCase()}</Text>
          <Text style={[s.big, { color: tint }]}>{left >= 60 ? formatSeconds(Math.ceil(left)) : Math.ceil(left)}</Text>
          <View style={s.track}>
            <View style={[s.fill, { width: `${(1 - left / phase.seconds) * 100}%`, backgroundColor: tint }]} />
          </View>
          {counter ? <Text style={s.counter}>{counter}</Text> : null}
          <View style={s.row}>
            <Button
              label={pausedAt !== null ? 'Reprendre' : 'Pause'}
              icon={pausedAt !== null ? 'play_arrow' : 'pause'}
              style={s.flex}
              onPress={() => {
                if (pausedAt !== null) {
                  const t = start + (Date.now() - pausedAt);
                  live.current = { index, start: t };
                  setStart(t);
                  setPausedAt(null);
                } else setPausedAt(Date.now());
              }}
            />
            <Button label="Passer" icon="skip_next" variant="secondary" style={s.flex} onPress={() => goTo(index + 1)} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

const s = themedStyles({
  center: { alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  phase: { fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  big: { fontSize: 72, fontWeight: '800', letterSpacing: -2, color: colors.text },
  track: { alignSelf: 'stretch', height: 8, borderRadius: radius.pill, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: 8 },
  counter: { fontSize: 15, fontWeight: '600', color: colors.muted },
  row: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginTop: space.sm },
  flex: { flex: 1 },
});
