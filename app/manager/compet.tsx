import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CruxGame, type Crux } from '@/components/CruxGame';
import { G, GameBackground, GameHeader, GButton, Panel } from '@/components/ManagerUi';
import { Moment3D } from '@/components/Moment3D';
import { Icon } from '@/components/ui';
import {
  autoLineup,
  chanceOf,
  energyLeft,
  EVENTS,
  eventName,
  eventRows,
  eventStats,
  finishCompetition,
  LEAGUES,
  loadClub,
  nameOf,
  ratingOf,
  startCompetition,
  teamTotals,
  upcoming,
  type Club,
  type CompEvent,
  type CompResult,
  type Draft,
  type Lineup,
  type Moment,
} from '@/lib/manager';
import { BLOCKS, MSTATS } from '@/lib/managerData';
import { themedStyles } from '@/lib/theme';

const pct = (c: number) => Math.round(c * 100);
const chanceColor = (c: number) => (c >= 0.6 ? G.green : c >= 0.3 ? G.gold : G.red);
const EVENT_ICON = { bloc: 'landscape', voie: 'height' } as const;

export default function CompetitionScreen() {
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(loadClub);
  const [boost, setBoost] = useState<string | null>(null);
  const [lineup, setLineup] = useState<Lineup>(() => {
    const c = loadClub();
    return c ? autoLineup(c) : [];
  });
  const [draft, setDraft] = useState<Draft | null>(null);

  if (!club) return <View style={s.screen} />;
  if (draft)
    return (
      <Live
        club={club}
        draft={draft}
        onReplay={() => {
          const c = loadClub();
          setClub(c);
          setBoost(null);
          setLineup(c ? autoLineup(c) : []);
          setDraft(null);
        }}
        onExit={() => router.back()}
      />
    );
  return (
    <Prep
      club={club}
      lineup={lineup}
      setLineup={setLineup}
      boost={boost}
      setBoost={setBoost}
      onStart={() => {
        setDraft(startCompetition(club, lineup, boost));
        setClub(loadClub());
      }}
    />
  );
}

/* ---------- Préparation ---------- */

function Prep(p: { club: Club; lineup: Lineup; setLineup: (l: Lineup) => void; boost: string | null; setBoost: (b: string | null) => void; onStart: () => void }) {
  const { club, lineup, setLineup, boost, setBoost } = p;
  const { bottom } = useSafeAreaInsets();
  const [choosing, setChoosing] = useState<number | null>(null);
  const events = upcoming(club);
  const L = LEAGUES[club.league];
  const boosts = club.items.filter((i) => i.kind === 'boost');
  const bv = boosts.find((b) => b.id === boost)?.value ?? 0;
  const chances = events.map((e, i) => (lineup[i] ? chanceOf(club, lineup[i]!, i, lineup, bv) : 0));
  const ready = lineup.length === EVENTS && lineup.every(Boolean);

  return (
    <View style={s.screen}>
      <GameBackground colors={club.colors} />
      <GameHeader title={`Manche ${club.season.round + 1}`} club={club} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 110 }]}>
        <Panel>
          <Text style={s.over}>{L.name.toUpperCase()}</Text>
          <Text style={s.title}>3 blocs puis une voie</Text>
          <Text style={[s.muted, { textAlign: 'center' }]}>Choisis un grimpeur par épreuve. Le pourcentage est sa chance de réussir (top), selon ses stats utiles, sa fatigue et ton boost.</Text>
        </Panel>

        {events.map((e, i) => {
          const c = club.climbers.find((x) => x.id === lineup[i]);
          const double = !!c && lineup.indexOf(c.id) !== i;
          return (
            <Pressable key={i} onPress={() => setChoosing(i)} accessibilityRole="button" accessibilityLabel={`Épreuve ${i + 1} : ${eventName(e)}`} style={({ pressed }) => [s.event, pressed && { transform: [{ scale: 0.98 }] }]}>
              <View style={s.eventHead}>
                <View style={s.eventIcon}>
                  <Icon name={EVENT_ICON[e.kind]} size={22} color={G.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.over}>{e.kind === 'voie' ? 'DIFFICULTÉ' : `BLOC ${i + 1}`}</Text>
                  <Text style={s.eventTitle}>
                    {eventName(e)} · niveau {e.difficulty}
                  </Text>
                </View>
              </View>
              <StatChips e={e} />
              <View style={s.assign}>
                {c ? (
                  <>
                    <Text style={s.rating}>{ratingOf(c)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>
                        {c.flag} {nameOf(c)}
                      </Text>
                      <Text style={[s.muted, double && { color: G.gold }]}>{double ? '2ᵉ épreuve : moins frais' : `Fatigue ${Math.round(c.fatigue)}`}</Text>
                    </View>
                    <ChanceBadge c={chances[i]} />
                  </>
                ) : (
                  <Text style={[s.name, { flex: 1 }]}>Choisir un grimpeur</Text>
                )}
                <Icon name="chevron_right" size={22} color={G.muted} />
              </View>
            </Pressable>
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
        <GButton label="Composition automatique" icon="auto_awesome" tone="ghost" onPress={() => setLineup(autoLineup(club, bv))} />
      </ScrollView>
      <View style={[s.footer, { paddingBottom: bottom + 12 }]}>
        <GButton label={energyLeft(club) > 0 ? 'Lancer la compétition' : 'Plus d’énergie aujourd’hui'} icon="play_arrow" tone="accent" disabled={!ready || energyLeft(club) <= 0} onPress={p.onStart} />
      </View>

      <Modal visible={choosing !== null} transparent animationType="slide" onRequestClose={() => setChoosing(null)}>
        <Pressable style={s.backdrop} onPress={() => setChoosing(null)} accessibilityLabel="Fermer" />
        {choosing !== null && (
          <View style={[s.sheet, { paddingBottom: bottom + 16 }]}>
            <Text style={s.over}>{eventName(events[choosing]).toUpperCase()} · NIVEAU {events[choosing].difficulty}</Text>
            <Text style={s.section}>Qui grimpe ?</Text>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
              {club.climbers
                .map((c) => {
                  const next = lineup.map((x, k) => (k === choosing ? c.id : x));
                  return { c, chance: chanceOf(club, c.id, choosing, next, bv), double: next.filter((x) => x === c.id).length > 1 };
                })
                .sort((a, b) => b.chance - a.chance)
                .map(({ c, chance, double }) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setLineup(lineup.map((x, k) => (k === choosing ? c.id : x)));
                      setChoosing(null);
                    }}
                    accessibilityLabel={`${nameOf(c)}, ${pct(chance)} %`}
                    style={[s.pickRow, lineup[choosing] === c.id && s.pickOn]}>
                    <Text style={s.rating}>{ratingOf(c)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>
                        {c.flag} {nameOf(c)}
                      </Text>
                      <Text style={[s.muted, double && { color: G.gold }]}>
                        {eventStats(events[choosing])
                          .map((k) => `${MSTATS.find((m) => m.id === k)!.short} ${Math.round(c.stats[k])}`)
                          .join(' · ')}
                        {double ? ' · déjà pris' : c.fatigue > 45 ? ` · fatigue ${Math.round(c.fatigue)}` : ''}
                      </Text>
                    </View>
                    <ChanceBadge c={chance} />
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

function StatChips({ e }: { e: CompEvent }) {
  const skill = e.kind === 'bloc' ? BLOCKS[e.type!].skill : null;
  return (
    <View style={s.chips}>
      {eventStats(e).map((k) => {
        const m = MSTATS.find((x) => x.id === k)!;
        return (
          <View key={k} style={s.statChip}>
            <Icon name={m.icon} size={14} color={G.blue} />
            <Text style={s.statText}>{m.name}</Text>
          </View>
        );
      })}
      {skill && (
        <View style={[s.statChip, { borderColor: 'rgba(255,212,59,0.4)' }]}>
          <Icon name="school" size={14} color={G.gold} />
          <Text style={s.statText}>+ compétence</Text>
        </View>
      )}
    </View>
  );
}

function ChanceBadge({ c }: { c: number }) {
  return (
    <View style={[s.chance, { backgroundColor: chanceColor(c) }]}>
      <Text style={s.chanceText}>{pct(c)} %</Text>
    </View>
  );
}

/* ---------- Direct ---------- */

function Live(p: { club: Club; draft: Draft; onReplay: () => void; onExit: () => void }) {
  const { club, draft } = p;
  const { bottom } = useSafeAreaInsets();
  const [cur, setCur] = useState(0);
  const [bonus, setBonus] = useState<(number | undefined)[]>([]);
  const [crux, setCrux] = useState<Crux | null>(null);
  const [result, setResult] = useState<CompResult | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [fade] = useState(() => new Animated.Value(0));

  const needsCrux = (i: number) => draft.cruxes.includes(i) && bonus[i] === undefined;
  const revealed = cur < EVENTS && !needsCrux(cur);

  const finish = (b: (number | undefined)[]) => {
    const r = finishCompetition(club, draft, b.map((x) => x ?? 0));
    setResult(r);
    setCur(EVENTS);
    Vibration.vibrate(r.rank <= 3 ? [0, 60, 80, 120] : 40);
  };

  // Ouvre le mini-jeu quand mon grimpeur bloque, sinon passe à l'épreuve suivante après un moment.
  useEffect(() => {
    if (result || cur >= EVENTS) return;
    if (needsCrux(cur)) {
      const mine = draft.rolls[cur].find((x) => x.mine)!;
      const e = draft.events[cur];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- le mini-jeu démarre avec l'épreuve.
      setCrux({ name: mine.name, skin: mine.skin, title: eventName(e), gap: e.difficulty - mine.perf, league: club.league });
      return;
    }
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start();
    const t = setTimeout(() => (cur + 1 >= EVENTS ? finish(bonus) : setCur(cur + 1)), 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- piloté par l'épreuve en cours et les bonus.
  }, [cur, bonus, result]);

  const skip = () => {
    const next = draft.cruxes.find((i) => i > cur && bonus[i] === undefined);
    if (next !== undefined) setCur(next);
    else finish(bonus);
  };

  const shown = Math.min(cur, EVENTS - 1);
  const e = draft.events[shown];
  const rows = eventRows(draft, shown, bonus[shown] ?? 0);
  const mineRow = rows.find((r) => r.mine);
  const table = result ? result.teams : teamTotals(club, draft, revealed ? cur + 1 : cur, bonus.map((x) => x ?? 0));
  const medal = result ? (result.rank === 1 ? '#FFD43B' : result.rank === 2 ? '#CED4DA' : result.rank === 3 ? '#E8A06A' : G.muted) : G.muted;
  const label = (r: (typeof rows)[number]) => (e.kind === 'voie' ? (r.top ? 'TOP !' : `${r.height} %`) : r.top ? (r.tries === 1 ? 'FLASH' : `TOP en ${r.tries}`) : r.zone ? 'Zone' : 'Raté');
  const tone = (r: (typeof rows)[number]) => (r.top ? G.green : r.zone ? G.gold : G.red);

  return (
    <View style={s.screen}>
      <GameBackground colors={club.colors} />
      <GameHeader title={result ? 'Résultats' : 'En direct'} club={club} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 120 }]}>
        {result ? (
          <View style={s.podium}>
            <Icon name="emoji_events" size={64} color={medal} />
            <Text style={[s.rank, { color: medal }]}>{result.rank}ᵉ</Text>
            <Text style={s.title}>{result.rank === 1 ? 'Victoire !' : result.rank <= 3 ? 'Sur le podium !' : result.rank <= 6 ? 'Pas mal, on peut faire mieux' : 'Dur dur… entraîne ton équipe'}</Text>
            <View style={s.gains}>
              <View style={s.gain}>
                <Icon name="paid" size={18} color={G.gold} />
                <Text style={s.gainText}>+{result.coins}</Text>
              </View>
              <View style={s.gain}>
                <Icon name="trending_up" size={18} color={G.green} />
                <Text style={s.gainText}>+{result.xp} XP</Text>
              </View>
            </View>
          </View>
        ) : (
          <Animated.View style={[s.stage, revealed && { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
            <Text style={s.over}>{e.kind === 'voie' ? 'DIFFICULTÉ' : `BLOC ${shown + 1}/3`}</Text>
            <Text style={s.stageTitle}>
              {eventName(e)} · niveau {e.difficulty}
            </Text>
            {mineRow && (
              <View style={s.mineRow}>
                <Text style={[s.liveName, { fontSize: 17 }]} numberOfLines={1}>
                  {mineRow.flag} {mineRow.name}
                </Text>
                {revealed ? (
                  <View style={[s.badge, { backgroundColor: tone(mineRow) }]}>
                    <Text style={s.badgeText}>{label(mineRow)}</Text>
                  </View>
                ) : (
                  <Text style={s.muted}>en difficulté…</Text>
                )}
              </View>
            )}
            {revealed && mineRow?.top && (
              <Pressable onPress={() => setMoment({ kind: mineRow.tries === 1 ? 'flash' : 'top', climber: mineRow.name, skin: mineRow.skin, text: `${mineRow.name} sort ${e.kind === 'voie' ? 'la voie' : `le bloc ${eventName(e)}`} !` })} accessibilityRole="button" accessibilityLabel="Voir en 3D" style={s.see3d}>
                <Icon name="view_in_ar" size={18} color={G.bg} />
                <Text style={s.see3dText}>Voir en 3D</Text>
              </Pressable>
            )}
            {revealed &&
              rows
                .filter((r) => !r.mine)
                .slice(0, 3)
                .map((r) => (
                  <View key={r.club} style={s.liveRow}>
                    <Text style={s.rivalName} numberOfLines={1}>
                      {r.flag} {r.name} · {r.club}
                    </Text>
                    <Text style={[s.rivalRes, { color: tone(r) }]}>{label(r)}</Text>
                  </View>
                ))}
          </Animated.View>
        )}

        {!result && (
          <View style={s.dots}>
            {Array.from({ length: EVENTS }, (_, i) => (
              <View key={i} style={[s.dotStep, i <= cur && { backgroundColor: G.gold }]} />
            ))}
          </View>
        )}

        {result?.seasonEnd && (
          <Panel style={{ borderColor: result.seasonEnd.up ? G.green : result.seasonEnd.down ? G.red : G.line, borderWidth: 2 }}>
            <Text style={s.over}>FIN DE SAISON</Text>
            <Text style={s.title}>
              {result.seasonEnd.rank}ᵉ du classement · {result.seasonEnd.up ? `Montée en ${LEAGUES[loadClub()?.league ?? club.league].short} !` : result.seasonEnd.down ? `Descente en ${LEAGUES[loadClub()?.league ?? club.league].short}` : 'Tu restes dans ta ligue'}
            </Text>
            <Text style={s.muted}>
              +{result.seasonEnd.coins} pièces{result.seasonEnd.pack ? ' · un pack en récompense' : ''}. Une nouvelle saison commence avec de nouveaux rivaux.
            </Text>
          </Panel>
        )}

        {result && (
          <Panel>
            <Text style={s.section}>Pourquoi ce résultat</Text>
            {result.lines.map((l) => (
              <View key={l.event} style={s.why}>
                <Icon name={l.good ? 'check_circle' : 'cancel'} size={20} color={l.good ? G.green : G.red} />
                <Text style={s.whyText}>{l.text}</Text>
              </View>
            ))}
          </Panel>
        )}

        {result && result.moments.length > 0 && (
          <Panel>
            <Text style={s.section}>Moments clés</Text>
            {result.moments.map((m) => (
              <Pressable key={m.text} onPress={() => setMoment(m)} accessibilityRole="button" accessibilityLabel={`Voir en 3D : ${m.text}`} style={s.moment}>
                <Icon name={m.kind === 'chute' ? 'trending_down' : 'view_in_ar'} size={22} color={m.kind === 'chute' ? G.red : G.gold} />
                <Text style={s.momentText}>{m.text}</Text>
                <Text style={s.momentCta}>3D</Text>
              </Pressable>
            ))}
          </Panel>
        )}

        <Panel>
          <Text style={s.section}>{result ? 'Classement' : 'Classement en direct'}</Text>
          {table.map((t, i) => (
            <View key={t.id} style={[s.tableRow, t.mine && s.tableMine]}>
              <Text style={s.pos}>{i + 1}</Text>
              <View style={[s.teamDot, { backgroundColor: t.color }]} />
              <Text style={[s.teamName, t.mine && { color: G.gold }]} numberOfLines={1}>
                {t.name}
              </Text>
              <Text style={s.points}>{t.total}</Text>
            </View>
          ))}
        </Panel>
      </ScrollView>
      <View style={[s.footer, { paddingBottom: bottom + 12 }]}>
        {result ? (
          <View style={s.footRow}>
            <GButton label="Retour au club" tone="ghost" onPress={p.onExit} style={{ flex: 1 }} />
            <GButton label="Manche suivante" icon="play_arrow" tone="accent" disabled={energyLeft(loadClub() ?? club) <= 0} onPress={p.onReplay} style={{ flex: 1 }} />
          </View>
        ) : (
          <GButton label="Passer" icon="fast_forward" tone="ghost" onPress={skip} />
        )}
      </View>
      <CruxGame
        crux={crux}
        onDone={(b) => {
          setCrux(null);
          setBonus((old) => {
            const n = [...old];
            n[cur] = b;
            return n;
          });
        }}
      />
      <Moment3D moment={moment} onClose={() => setMoment(null)} />
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
  event: { padding: 14, gap: 10, borderRadius: 18, borderWidth: 1.5, borderColor: G.line, backgroundColor: 'rgba(26,34,87,0.85)' },
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,212,59,0.12)' },
  eventTitle: { color: G.text, fontWeight: '900', fontSize: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(77,171,247,0.4)' },
  statText: { color: G.text, fontSize: 12, fontWeight: '600' },
  assign: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' },
  rating: { color: G.text, fontWeight: '900', fontSize: 22, width: 34, textAlign: 'center' },
  name: { color: G.text, fontWeight: '800', fontSize: 15 },
  chance: { paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center', minWidth: 58, alignItems: 'center' },
  chanceText: { color: G.bg, fontWeight: '900', fontSize: 14 },
  segWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segOn: { backgroundColor: G.gold },
  segText: { color: G.text, fontWeight: '700', fontSize: 13 },
  segTextOn: { color: G.bg },
  boost: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: G.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 8 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1.5, borderColor: G.line },
  pickOn: { borderColor: G.gold },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(11,16,48,0.94)' },
  footRow: { flexDirection: 'row', gap: 10 },
  stage: { padding: 20, gap: 12, borderRadius: 22, backgroundColor: 'rgba(26,34,87,0.9)', borderWidth: 1, borderColor: G.line },
  stageTitle: { color: G.text, fontWeight: '900', fontSize: 22 },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,212,59,0.1)' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveName: { flex: 1, color: G.text, fontWeight: '800', fontSize: 15 },
  rivalName: { flex: 1, color: G.muted, fontSize: 13 },
  rivalRes: { fontWeight: '800', fontSize: 13 },
  badge: { paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center', minWidth: 80, alignItems: 'center' },
  badgeText: { color: G.bg, fontWeight: '900', fontSize: 13 },
  see3d: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: G.gold },
  see3dText: { color: G.bg, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dotStep: { width: 36, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  podium: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  rank: { fontSize: 56, fontWeight: '900' },
  gains: { flexDirection: 'row', gap: 12, marginTop: 6 },
  gain: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)' },
  gainText: { color: G.text, fontWeight: '800', fontSize: 15 },
  why: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  whyText: { flex: 1, color: G.text, fontSize: 14, lineHeight: 20 },
  moment: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  momentText: { flex: 1, color: G.text, fontSize: 14, lineHeight: 19 },
  momentCta: { color: G.gold, fontWeight: '900' },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, borderRadius: 10, paddingHorizontal: 6 },
  tableMine: { backgroundColor: 'rgba(255,212,59,0.12)' },
  pos: { width: 20, color: G.muted, fontWeight: '800', textAlign: 'center' },
  teamDot: { width: 12, height: 12, borderRadius: 6 },
  teamName: { flex: 1, color: G.text, fontWeight: '700' },
  points: { color: G.text, fontWeight: '900' },
});
