import { useEffect, useRef, useState } from 'react';

/**
 * Temps qui avance (en secondes) pour les petites animations dessinées en SVG : redessine
 * `fps` fois par seconde tant que `active`, et garde le temps acquis quand on met en pause.
 */
export function useTicker(active: boolean, fps = 24) {
  const [t, setT] = useState(0);
  const elapsed = useRef(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let prev: number | null = null;
    let acc = 0;
    const tick = (now: number) => {
      if (prev !== null) {
        // Après une pause (appli en arrière-plan), on reprend sans sauter.
        const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000));
        elapsed.current += dt;
        acc += dt;
        if (acc >= 1 / fps) {
          acc = 0;
          setT(elapsed.current);
        }
      }
      prev = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, fps]);
  return t;
}
