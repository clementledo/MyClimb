import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { G, GameBackground, GameHeader, GButton, Panel } from '@/components/ManagerUi';
import { Moment3D } from '@/components/Moment3D';
import { Icon } from '@/components/ui';
import {
  competitionPreview,
  energyLeft,
  LEAGUES,
  loadClub,
  nameOf,
  ratingOf,
  runCompetition,
  TEAM_SIZE,
  type Attitude,
  type Club,
  type CompResult,
  type Moment,
  type Pick,
  type Reading,
} from '@/lib/manager';
import { BLOCKS, STYLES } from '@/lib/managerData';
import { themedStyles } from '@/lib/theme';

const ATTITUDES: { value: Attitude; label: string; text: string }[] = [
  { value: 'forcer', label: 'Forcer', text: 'Plus fort, plus risqué, très fatigant' },
  { value: 'assurer', label: 'Assurer', text: 'Régulier' },
  { value: 'economiser', label: 'Économiser', text: 'Moins bien, mais garde de la fraîcheur' },
];

export default function CompetitionScreen() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const [club, setClub] = useState<Club | null>(loadClub);
  const [picks, setPicks] = useState<Pick[]>(() => {
    const c = loadClub();
    if (!c) return [];
    // Par défaut : les meilleurs, en tenant compte de la fatigue.
    return [...c.climbers]
      .sort((a, b) => ratingOf(b) - b.fatigue * 0.3 - (ratingOf(a) - a.fatigue * 0.3))
      .slice(0, TEAM_SIZE)
      .map((x) => ({ id: x.id, attitude: 'assurer', reading: 'court' }));
  });
  const [boost, setBoost] = useState<string | null>(null);
  const [result, setResult] = useState<CompResult | null>(null);
  const [step, setStep] = useState(0);
  const [moment, setMoment] = useState<Moment | null>(null);

  if (!club) return <View style={s.screen} />;
  const L = LEAGUES[club.league];
  const preview = competitionPreview(club);
  const boosts = club.items.filter((i) => i.kind === 'boost');

  const toggle = (id: string) =>
    setPicks((p) => (p.some((x) => x.id === id) ? p.filter((x) => x.id !== id) : p.length >= TEAM_SIZE ? p : [...p, { id, attitude: 'assurer', reading: 'court' }]));
  const setPick = (id: string, patch: Partial<Pick>) => setPicks((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const start = () => {
    const r = runCompetition(club, picks, boost);
    setClub(loadClub());
    setResult(r);
    setStep(0);
  };

  if (result) return <Live club={club} result={result} step={step} setStep={setStep} onMoment={setMoment} moment={moment} onReplay={() => { setResult(null); setBoost(null); }} onExit={() => router.back()} />;

  return (
    <View style={s.screen}>
      <GameBackground colors={club.colors} />
      <GameHeader title={`Manche ${preview.round}`} club={club} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 110 }]}>
        <Panel>
          <Text style={s.over}>{L.name.toUpperCase()}</Text>
          <Text style={s.title}>Combiné bloc + difficulté</Text>
          <Text style={s.muted}>
            4 blocs tirés au hasard (dévers, dalle, coordination, compression, réglettes, toit) de niveau {preview.difficulty} et plus, puis une voie. Choisis {TEAM_SIZE} grimpeurs et leur tactique.
          </Text>
        </Panel>

        <Text style={s.section}>Ton équipe ({picks.length}/{TEAM_SIZE})</Text>
        {[...club.climbers]
          .sort((a, b) => ratingOf(b) - ratingOf(a))
          .map((c) => {
            const p = picks.find((x) => x.id === c.id);
            return (
              <View key={c.id} style={[s.pick, p && s.pickOn]}>
                <Pressable onPress={() => toggle(c.id)} accessibilityRole="checkbox" accessibilityState={{ checked: !!p }} accessibilityLabel={nameOf(c)} style={s.pickHead}>
                  <View style={[s.check, p && s.checkOn]}>{p && <Icon name="check" size={16} color={G.bg} />}</View>
                  <Text style={s.rating}>{ratingOf(c)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>
                      {c.flag} {nameOf(c)}
                    </Text>
                    <Text style={s.muted}>
                      {STYLES[c.style].name} · fatigue {Math.round(c.fatigue)}
                    </Text>
                  </View>
                  <View style={[s.fat, { backgroundColor: c.fatigue > 70 ? G.red : c.fatigue > 45 ? G.gold : G.green }]} />
                </Pressable>
                {p && (
                  <View style={s.tactics}>
                    <View style={s.segRow}>
                      {ATTITUDES.map((a) => (
                        <Pressable key={a.value} onPress={() => setPick(c.id, { attitude: a.value })} accessibilityLabel={`${a.label} pour ${c.first}`} style={[s.seg, p.attitude === a.value && s.segOn]}>
                          <Text style={[s.segText, p.attitude === a.value && s.segTextOn]}>{a.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={s.hint}>{ATTITUDES.find((a) => a.value === p.attitude)!.text}</Text>
                    <View style={s.segRow}>
                      {(['court', 'long'] as Reading[]).map((r) => (
                        <Pressable key={r} onPress={() => setPick(c.id, { reading: r })} accessibilityLabel={`Lecture ${r} pour ${c.first}`} style={[s.seg, p.reading === r && s.segOn]}>
                          <Text style={[s.segText, p.reading === r && s.segTextOn]}>{r === 'court' ? 'Lecture rapide' : 'Observer longtemps'}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={s.hint}>{p.reading === 'long' ? 'Mieux sur les blocs, un peu moins frais pour la voie' : 'Garde de la fraîcheur pour la voie'}</Text>
                  </View>
                )}
              </View>
            );
          })}

        <Text style={s.section}>Boost (facultatif)</Text>
        {boosts.length === 0 ? (
          <Text style={s.muted}>Aucun boost. Il s’en trouve dans les packs.</Text>
        ) : (
          <View style={s.segWrap}>
            {boosts.map((b) => (
              <Pressable key={b.id} onPress={() => setBoost(boost === b.id ? null : b.id)} accessibilityLabel={b.name} style={[s.boost, boost === b.id && s.segOn]}>
                <Icon name="bolt" size={16} color={boost === b.id ? G.bg : G.gold} />
                <Text style={[s.segText, boost === b.id && s.segTextOn]}>
                  {b.name} +{b.value}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: bottom + 12 }]}>
        <GButton label={energyLeft(club) > 0 ? 'Lancer la compétition' : 'Plus d’énergie aujourd’hui'} icon="play_arrow" tone="accent" disabled={picks.length === 0 || energyLeft(club) <= 0} onPress={start} />
      </View>
    </View>
  );
}

/* ---------- Déroulé animé ---------- */

function Live(p: {
  club: Club;
  result: CompResult;
  step: number;
  setStep: (n: number) => void;
  moment: Moment | null;
  onMoment: (m: Moment | null) => void;
  onReplay: () => void;
  onExit: () => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const { result: r, step } = p;
  const stages = r.blocks.length + 1; // 4 blocs + la voie
  const done = step >= stages;
  const [fade] = useState(() => new Animated.Value(0));
  const { setStep } = p;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start();
    if (!done) timer.current = setTimeout(() => setStep(step + 1), 2300);
    else Vibration.vibrate(r.rank <= 3 ? [0, 60, 80, 120] : 40);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [step, done, fade, setStep, r.rank]);

  // Score cumulé de chaque équipe à l'étape en cours.
  const table = useMemo(() => {
    const upto = Math.min(step, stages);
    return r.teams
      .map((t) => {
        const cl = r.climbers.filter((c) => (t.mine ? c.mine : !c.mine && c.club === t.name));
        const total = cl.reduce((sum, c) => sum + c.blocks.slice(0, Math.min(upto, 4)).reduce((a, b) => a + b.points, 0) + (upto >= stages ? c.lead : 0), 0);
        return { ...t, now: Math.round(total * 10) / 10 };
      })
      .sort((a, b) => b.now - a.now);
  }, [r, step, stages]);

  const mine = r.climbers.filter((c) => c.mine);
  const cur = Math.min(step, stages - 1);
  const isLead = cur === r.blocks.length;
  const medal = r.rank === 1 ? '#FFD43B' : r.rank === 2 ? '#CED4DA' : r.rank === 3 ? '#E8A06A' : G.muted;

  return (
    <View style={s.screen}>
      <GameBackground colors={p.club.colors} />
      <GameHeader title={done ? 'Résultats' : 'En direct'} club={p.club} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 120 }]}>
        {done ? (
          <Animated.View style={[s.podium, { opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
            <Icon name="emoji_events" size={64} color={medal} />
            <Text style={[s.rank, { color: medal }]}>{r.rank}ᵉ</Text>
            <Text style={s.title}>{r.rank === 1 ? 'Victoire !' : r.rank <= 3 ? 'Sur le podium !' : r.rank <= 6 ? 'Pas mal, on peut faire mieux' : 'Dur dur… entraîne ton équipe'}</Text>
            <View style={s.gains}>
              <View style={s.gain}>
                <Icon name="paid" size={18} color={G.gold} />
                <Text style={s.gainText}>+{r.coins}</Text>
              </View>
              <View style={s.gain}>
                <Icon name="trending_up" size={18} color={G.green} />
                <Text style={s.gainText}>+{r.xp} XP</Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          <Animated.View style={[s.stage, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
            <Text style={s.over}>{isLead ? 'DIFFICULTÉ' : `BLOC ${cur + 1}/${r.blocks.length}`}</Text>
            <Text style={s.stageTitle}>{isLead ? 'La voie' : `${BLOCKS[r.blocks[cur].type].name} · niveau ${r.blocks[cur].difficulty}`}</Text>
            {mine.map((c) => {
              const b = isLead ? null : c.blocks[cur];
              const label = isLead ? (c.lead === 100 ? 'TOP !' : `${c.lead} pts`) : b!.top ? (b!.tries === 1 ? 'FLASH' : `TOP en ${b!.tries}`) : b!.zone ? 'Zone' : 'Raté';
              const good = isLead ? c.lead >= 70 : b!.top;
              return (
                <View key={c.name} style={s.liveRow}>
                  <Text style={s.liveName} numberOfLines={1}>
                    {c.flag} {c.name}
                  </Text>
                  <View style={[s.badge, { backgroundColor: good ? G.green : isLead || b!.zone ? G.gold : G.red }]}>
                    <Text style={s.badgeText}>{label}</Text>
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}

        {!done && (
          <View style={s.dots}>
            {Array.from({ length: stages }, (_, i) => (
              <View key={i} style={[s.dotStep, i <= step && { backgroundColor: G.gold }]} />
            ))}
          </View>
        )}

        {done && r.seasonEnd && (
          <Panel style={{ borderColor: r.seasonEnd.up ? G.green : r.seasonEnd.down ? G.red : G.line, borderWidth: 2 }}>
            <Text style={s.over}>FIN DE SAISON</Text>
            <Text style={s.title}>
              {r.seasonEnd.rank}ᵉ du classement · {r.seasonEnd.up ? `Montée en ${LEAGUES[p.club.league].short} !` : r.seasonEnd.down ? `Descente en ${LEAGUES[p.club.league].short}` : 'Tu restes dans ta ligue'}
            </Text>
            <Text style={s.muted}>
              +{r.seasonEnd.coins} pièces{r.seasonEnd.pack ? ' · un pack en récompense' : ''}. Une nouvelle saison commence avec de nouveaux rivaux.
            </Text>
          </Panel>
        )}

        {done && r.moments.length > 0 && (
          <Panel>
            <Text style={s.section}>Moments clés</Text>
            {r.moments.map((m) => (
              <Pressable key={m.text} onPress={() => p.onMoment(m)} accessibilityRole="button" accessibilityLabel={`Voir en 3D : ${m.text}`} style={s.moment}>
                <Icon name={m.kind === 'chute' ? 'trending_down' : 'view_in_ar'} size={22} color={m.kind === 'chute' ? G.red : G.gold} />
                <Text style={s.momentText}>{m.text}</Text>
                <Text style={s.momentCta}>3D</Text>
              </Pressable>
            ))}
          </Panel>
        )}

        <Panel>
          <Text style={s.section}>{done ? 'Classement' : 'Classement en direct'}</Text>
          {table.map((t, i) => (
            <View key={t.id} style={[s.tableRow, t.mine && s.tableMine]}>
              <Text style={s.pos}>{i + 1}</Text>
              <View style={[s.teamDot, { backgroundColor: t.color }]} />
              <Text style={[s.teamName, t.mine && { color: G.gold }]} numberOfLines={1}>
                {t.name}
              </Text>
              <Text style={s.points}>{t.now}</Text>
            </View>
          ))}
        </Panel>

        {done && (
          <Panel>
            <Text style={s.section}>Tes grimpeurs</Text>
            {mine.map((c) => (
              <View key={c.name} style={s.resRow}>
                <Text style={s.liveName} numberOfLines={1}>
                  {c.flag} {c.name}
                </Text>
                <Text style={s.muted}>
                  {c.blocks.filter((b) => b.top).length} tops · voie {c.lead} · {c.total} pts
                </Text>
              </View>
            ))}
          </Panel>
        )}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: bottom + 12 }]}>
        {done ? (
          <View style={s.footRow}>
            <GButton label="Retour au club" tone="ghost" onPress={p.onExit} style={{ flex: 1 }} />
            <GButton label="Manche suivante" icon="play_arrow" tone="accent" disabled={energyLeft(p.club) <= 0} onPress={p.onReplay} style={{ flex: 1 }} />
          </View>
        ) : (
          <GButton label="Passer" icon="fast_forward" tone="ghost" onPress={() => p.setStep(stages)} />
        )}
      </View>
      <Moment3D moment={p.moment} onClose={() => p.onMoment(null)} />
    </View>
  );
}

const s = themedStyles({
  screen: { flex: 1, backgroundColor: G.bg },
  content: { paddingHorizontal: 16, gap: 14 },
  over: { color: G.gold, fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  title: { color: G.text, fontWeight: '900', fontSize: 20, textAlign: 'center' },
  muted: { color: G.muted, fontSize: 13, lineHeight: 18 },
  section: { color: G.text, fontWeight: '800', fontSize: 17 },
  pick: { borderRadius: 16, borderWidth: 1.5, borderColor: G.line, backgroundColor: 'rgba(26,34,87,0.7)', overflow: 'hidden' },
  pickOn: { borderColor: G.gold },
  pickHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: G.muted, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: G.gold, borderColor: G.gold },
  rating: { color: G.text, fontWeight: '900', fontSize: 22, width: 34, textAlign: 'center' },
  name: { color: G.text, fontWeight: '800', fontSize: 15 },
  fat: { width: 10, height: 10, borderRadius: 5 },
  tactics: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  segRow: { flexDirection: 'row', gap: 6 },
  segWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seg: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  segOn: { backgroundColor: G.gold },
  segText: { color: G.text, fontWeight: '700', fontSize: 13 },
  segTextOn: { color: G.bg },
  hint: { color: G.muted, fontSize: 12, marginBottom: 2 },
  boost: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(11,16,48,0.94)' },
  footRow: { flexDirection: 'row', gap: 10 },
  stage: { padding: 20, gap: 12, borderRadius: 22, backgroundColor: 'rgba(26,34,87,0.9)', borderWidth: 1, borderColor: G.line },
  stageTitle: { color: G.text, fontWeight: '900', fontSize: 22 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveName: { flex: 1, color: G.text, fontWeight: '700', fontSize: 15 },
  badge: { paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center', minWidth: 80, alignItems: 'center' },
  badgeText: { color: G.bg, fontWeight: '900', fontSize: 13 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dotStep: { width: 28, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  podium: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  rank: { fontSize: 56, fontWeight: '900' },
  gains: { flexDirection: 'row', gap: 12, marginTop: 6 },
  gain: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)' },
  gainText: { color: G.text, fontWeight: '800', fontSize: 15 },
  moment: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  momentText: { flex: 1, color: G.text, fontSize: 14, lineHeight: 19 },
  momentCta: { color: G.gold, fontWeight: '900' },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, borderRadius: 10, paddingHorizontal: 6 },
  tableMine: { backgroundColor: 'rgba(255,212,59,0.12)' },
  pos: { width: 20, color: G.muted, fontWeight: '800', textAlign: 'center' },
  teamDot: { width: 12, height: 12, borderRadius: 6 },
  teamName: { flex: 1, color: G.text, fontWeight: '700' },
  points: { color: G.text, fontWeight: '900' },
  resRow: { gap: 2, paddingVertical: 4 },
});
