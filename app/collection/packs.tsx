/**
 * Ouverture des packs, façon cartes à collectionner : le pack flotte, tremble et s'illumine de la
 * couleur de sa meilleure carte, puis éclate ; cinq cartes face cachée arrivent, on les retourne
 * une à une (ou toutes d'un coup), et les Légendaires et Mythiques ont droit à leur entrée.
 * Les cartes sont enregistrées dès l'ouverture : quitter en cours de route ne fait rien perdre.
 */
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, useWindowDimensions, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { CardBack, ITEM_RATIO, ItemCard, PackArt } from '@/components/Collectible';
import { useSvgIds } from '@/components/PlayerCard';
import { Button, Icon } from '@/components/ui';
import { equip, isEquipped, openPack, PACK_CHALK, PACKS, pendingPacks, type OpenedPack, type PulledCard } from '@/lib/collection';
import { getSetting, listBlocks, listTrainingLogs } from '@/lib/db';
import { playerCard, type Tier } from '@/lib/playerCard';
import { rarityOf, rarityRank } from '@/lib/rarity';
import { DEFAULT_SKIN, isSkin, SKIN_KEY, type SkinId } from '@/lib/skins';
import { todayIso } from '@/lib/stats';
import { ThemeSwitch, themedStyles, type ThemeId } from '@/lib/theme';
import { useTicker } from '@/lib/useTicker';

/** Couleurs fixes de l'écran (sombre, comme une salle de spectacle), quel que soit le thème. */
const BG: [string, string] = ['#0D0F1F', '#2A1B52'];
const GAP = 12;
const abs = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;

type Phase = 'idle' | 'charging' | 'cards';

const readPlayer = () => {
  const v = getSetting(SKIN_KEY);
  const skin: SkinId = isSkin(v) ? v : DEFAULT_SKIN;
  return { skin, tier: playerCard(listBlocks(), listTrainingLogs(), todayIso()).tier };
};

/** Faisceaux de lumière autour d'un point, de la couleur donnée. */
const Rays = memo(function Rays({ size, color }: { size: number; color: string }) {
  const ids = useSvgIds();
  const c = size / 2;
  const n = 18;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={ids('ray')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={color} stopOpacity={0.9} />
          <Stop offset="0.6" stopColor={color} stopOpacity={0.25} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const w = i % 2 ? 0.05 : 0.09;
        const p = (k: number) => `${(c + Math.cos(a + k) * c).toFixed(1)} ${(c + Math.sin(a + k) * c).toFixed(1)}`;
        return <Path key={i} d={`M${c} ${c}L${p(-w)}L${p(w)}Z`} fill={`url(#${ids('ray')})`} opacity={i % 2 ? 0.6 : 1} />;
      })}
    </Svg>
  );
});

/** Halo rond et doux. */
const Glow = memo(function Glow({ size, color }: { size: number; color: string }) {
  const ids = useSvgIds();
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={ids('glow')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={color} stopOpacity={0.95} />
          <Stop offset="0.45" stopColor={color} stopOpacity={0.45} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${ids('glow')})`} />
    </Svg>
  );
});

/** Étincelles qui jaillissent du centre en boucle (temps `t` en secondes). */
function Sparkles({ size, color, t, n = 34 }: { size: number; color: string; t: number; n?: number }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      {Array.from({ length: n }, (_, i) => {
        const r1 = ((i * 7919) % 101) / 101;
        const r2 = ((i * 3571) % 97) / 97;
        const k = (t * (0.35 + r2 * 0.3) + r1) % 1;
        const a = r1 * Math.PI * 2 + i;
        const d = c * (0.15 + k * 0.85);
        const x = c + Math.cos(a) * d;
        const y = c + Math.sin(a) * d;
        const s = 2 + r2 * 4 * (1 - k);
        const fill = i % 3 === 0 ? '#FFFFFF' : i % 3 === 1 ? color : '#FFE066';
        return (
          <Path
            key={i}
            d={`M${x} ${y - s}L${x + s * 0.25} ${y - s * 0.25}L${x + s} ${y}L${x + s * 0.25} ${y + s * 0.25}L${x} ${y + s}L${x - s * 0.25} ${y + s * 0.25}L${x - s} ${y}L${x - s * 0.25} ${y - s * 0.25}Z`}
            fill={fill}
            opacity={Math.min(1, (1 - k) * 1.6)}
          />
        );
      })}
    </Svg>
  );
}

/** Fond de l'écran : dégradé sombre et quelques étoiles. */
const Backdrop = memo(function Backdrop({ w, h }: { w: number; h: number }) {
  const ids = useSvgIds();
  return (
    <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <LinearGradient id={ids('bg')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BG[0]} />
          <Stop offset="1" stopColor={BG[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill={`url(#${ids('bg')})`} />
      {Array.from({ length: 40 }, (_, i) => (
        <Circle key={i} cx={((i * 7919) % 1000) / 1000 * w} cy={((i * 3571) % 1000) / 1000 * h} r={0.6 + (i % 3) * 0.5} fill="#FFFFFF" opacity={0.15 + (i % 4) * 0.1} />
      ))}
    </Svg>
  );
});

export default function PacksScreen() {
  const router = useRouter();
  const switcher = useContext(ThemeSwitch);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [queue, setQueue] = useState(pendingPacks);
  const [opened, setOpened] = useState<OpenedPack | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [walkout, setWalkout] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);
  const [player] = useState(readPlayer);

  // Animations du pack.
  const float = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const charge = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const cardsIn = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;
  const flips = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [float, spin]);

  const pack = opened?.pack ?? queue[0];
  const best = opened ? rarityOf(opened.best) : null;
  const packW = Math.min(210, width * 0.52);
  const cw = Math.min(118, Math.floor((width - 2 * 20 - 2 * GAP) / 3));
  const ch = Math.round(cw * ITEM_RATIO);
  const stageH = 2 * ch + 16;
  const all = opened ? revealed.length === opened.cards.length && revealed.every(Boolean) : false;

  /** Toucher le pack : il tremble de plus en plus fort et s'illumine, puis éclate. */
  const open = () => {
    if (phase !== 'idle' || !queue[0]) return;
    const res = openPack(queue[0].id);
    if (!res) return;
    setOpened(res);
    setRevealed(res.cards.map(() => false));
    setPhase('charging');
    const top = rarityRank(res.best);
    Vibration.vibrate([0, 25, 160, 25, 120, 35, 90, 45]);
    const wobble = (to: number, d: number) => Animated.timing(shake, { toValue: to, duration: d, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    Animated.parallel([
      Animated.sequence([wobble(0.4, 90), wobble(-0.4, 90), wobble(0.6, 80), wobble(-0.6, 80), wobble(0.8, 70), wobble(-0.8, 70), wobble(1, 60), wobble(-1, 60), wobble(1, 50), wobble(0, 50)]),
      Animated.timing(charge, { toValue: 1, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      Vibration.vibrate(top >= 3 ? [0, 90, 70, 140] : 70);
      Animated.timing(burst, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      setPhase('cards');
      Animated.stagger(
        110,
        cardsIn.map((v) => Animated.spring(v, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true })),
      ).start();
    });
  };

  /** Retourne une carte ; une Légendaire ou une Mythique fait son entrée en grand. */
  const reveal = (i: number) => {
    if (!opened || revealed[i]) {
      if (opened && revealed[i]) setWalkout(i);
      return;
    }
    const rank = rarityRank(opened.cards[i].item.rarity);
    Vibration.vibrate(rank >= 3 ? [0, 60, 50, 60, 50, 120] : rank === 2 ? [0, 35, 60, 35] : 20);
    setRevealed((r) => r.map((x, k) => x || k === i));
    Animated.timing(flips[i], { toValue: 1, duration: rank >= 2 ? 620 : 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      if (rank >= 3) setWalkout(i);
    });
  };

  // « Tout révéler » : les cartes se retournent l'une après l'autre (la meilleure en dernier),
  // en s'arrêtant le temps d'une entrée de Légendaire.
  useEffect(() => {
    if (!auto || !opened || walkout !== null) return;
    const next = revealed.findIndex((x) => !x);
    if (next < 0) {
      setAuto(false);
      return;
    }
    const t = setTimeout(() => reveal(next), 380);
    return () => clearTimeout(t);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const nextPack = () => {
    [shake, charge, burst, ...cardsIn, ...flips].forEach((v) => v.setValue(0));
    setOpened(null);
    setRevealed([]);
    setWalkout(null);
    setAuto(false);
    setQueue(pendingPacks());
    setPhase('idle');
  };

  const dupes = opened ? opened.cards.filter((c) => !c.isNew) : [];
  const fresh = opened ? opened.cards.length - dupes.length : 0;

  /** Cases des cartes : 3 en haut, 2 en dessous. */
  const slot = (i: number) => {
    const row = i < 3 ? 0 : 1;
    const inRow = row ? 2 : 3;
    const j = row ? i - 3 : i;
    const left = width / 2 - (inRow * cw + (inRow - 1) * GAP) / 2 + j * (cw + GAP);
    return { left, top: row * (ch + 16) };
  };

  if (!pack && !opened) return <NoPacks onClose={() => router.back()} insets={insets} w={width} h={height} />;

  const packRotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] });
  const packScale = Animated.add(
    charge.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }),
    burst.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
  );
  const packOpacity = burst.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0, 0] });
  const glowColor = best?.color ?? PACKS[pack.kind].colors[0];
  const raysOpacity = phase === 'idle' ? 0.25 : burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1, 0.45] });

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <Backdrop w={width} h={height + insets.top + insets.bottom} />

      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{PACKS[pack.kind].name}</Text>
          <Text style={s.sub} numberOfLines={1}>
            {pack.reason}
          </Text>
        </View>
        {queue.length > 1 && !opened && <Text style={s.left}>{`${queue.length} packs`}</Text>}
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Fermer" style={({ pressed }) => [s.close, pressed && { opacity: 0.6 }]}>
          <Icon name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={s.stage}>
        {/* Lumière derrière le pack (la couleur de la meilleure carte quand il s'ouvre). */}
        <Animated.View
          pointerEvents="none"
          style={[s.center, { opacity: raysOpacity, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
          <Rays size={width * 1.5} color={phase === 'idle' ? '#B197FC' : glowColor} />
        </Animated.View>

        {phase !== 'cards' && (
          <>
            <Animated.View
              pointerEvents="none"
              style={[s.center, { opacity: charge, transform: [{ scale: charge.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.25] }) }] }]}>
              <Glow size={packW * 2.2} color={glowColor} />
            </Animated.View>
            <Animated.View
              style={{
                opacity: packOpacity,
                transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }, { rotate: packRotate }, { scale: packScale }],
              }}>
              <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Ouvrir le pack" disabled={phase !== 'idle'}>
                <ShinyPack kind={pack.kind} w={packW} active={phase === 'idle'} />
              </Pressable>
            </Animated.View>
            {phase === 'idle' && (
              <View style={s.hintWrap}>
                <Text style={s.hint}>Touche le pack pour l’ouvrir</Text>
                <Text style={s.blurb}>{PACKS[pack.kind].blurb}</Text>
              </View>
            )}
          </>
        )}

        {phase === 'cards' && opened && (
          <CardsStage
            opened={opened}
            revealed={revealed}
            cw={cw}
            stageH={stageH}
            width={width}
            slot={slot}
            cardsIn={cardsIn}
            flips={flips}
            onReveal={reveal}
            tier={player.tier}
            skin={player.skin}
          />
        )}

        {/* Étincelles de l'ouverture. */}
        {phase === 'cards' && (
          <Animated.View pointerEvents="none" style={[s.center, { opacity: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }) }]}>
            <BurstSparks size={width} color={glowColor} progress={burst} />
          </Animated.View>
        )}
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {phase === 'cards' && opened && !all && (
          <Button label="Tout révéler" icon="auto_awesome" onPress={() => setAuto(true)} disabled={auto} />
        )}
        {phase === 'cards' && opened && all && (
          <>
            <View style={s.summary}>
              <Text style={s.summaryText}>
                {fresh > 0 ? `${fresh} nouveau${fresh > 1 ? 'x' : ''}` : 'Que des doublons'}
                {dupes.length > 0 && fresh > 0 ? ` · ${dupes.length} doublon${dupes.length > 1 ? 's' : ''}` : ''}
              </Text>
              <View style={s.chalkRow}>
                <Icon name="water_drop" size={16} color="#FFE066" />
                <Text style={s.chalkText}>+{opened.chalk} magnésie</Text>
                <Text style={s.chalkMuted}>{dupes.length ? `(dont ${PACK_CHALK} du pack)` : '(cadeau du pack)'}</Text>
              </View>
            </View>
            {pendingPacks().length > 0 ? (
              <>
                <Button label={`Ouvrir le pack suivant (${pendingPacks().length})`} icon="redeem" onPress={nextPack} />
                <Button label="Voir ma collection" variant="ghost" onPress={() => router.replace('/collection')} style={s.ghost} />
              </>
            ) : (
              <>
                <Button label="Voir ma collection" icon="collections_bookmark" onPress={() => router.replace('/collection')} />
                <Button label="Terminer" variant="ghost" onPress={() => router.back()} style={s.ghost} />
              </>
            )}
          </>
        )}
      </View>

      {/* Éclair blanc à l'ouverture, sur tout l'écran. */}
      <Animated.View pointerEvents="none" style={[abs, s.flash, { opacity: burst.interpolate({ inputRange: [0, 0.12, 0.5, 1], outputRange: [0, 0.95, 0.12, 0] }) }]} />

      {walkout !== null && opened && (
        <Walkout
          card={opened.cards[walkout]}
          width={width}
          height={height}
          tier={player.tier}
          skin={player.skin}
          onClose={() => setWalkout(null)}
          onEquip={(c) => {
            if (c.item.kind === 'theme') {
              setWalkout(null);
              switcher.theme(c.item.ref as ThemeId, '/collection');
              return;
            }
            equip(c.item.kind, c.item.ref);
            setWalkout(null);
          }}
        />
      )}
    </View>
  );
}

/** Le pack, avec son reflet qui passe (animé seulement tant qu'on l'attend). */
function ShinyPack({ kind, w, active }: { kind: OpenedPack['pack']['kind']; w: number; active: boolean }) {
  const t = useTicker(active, 30);
  return <PackArt kind={kind} w={w} t={t} />;
}

/** Les cinq cartes : elles arrivent du pack, puis se retournent. */
function CardsStage(p: {
  opened: OpenedPack;
  revealed: boolean[];
  cw: number;
  stageH: number;
  width: number;
  slot: (i: number) => { left: number; top: number };
  cardsIn: Animated.Value[];
  flips: Animated.Value[];
  onReveal: (i: number) => void;
  tier: Tier;
  skin: SkinId;
}) {
  const ch = Math.round(p.cw * ITEM_RATIO);
  // Les dos des Épiques et mieux respirent, les objets mythiques et les célébrations bougent.
  const moving = p.opened.cards.some((c, i) => (!p.revealed[i] ? rarityRank(c.item.rarity) >= 2 : c.item.rarity === 'mythique' || c.item.kind === 'celebration'));
  const t = useTicker(moving, 24);
  return (
    <View style={{ width: p.width, height: p.stageH }}>
      {p.opened.cards.map((c, i) => {
        const { left, top } = p.slot(i);
        const dx = p.width / 2 - (left + p.cw / 2);
        const dy = p.stageH / 2 - (top + ch / 2);
        const back = p.flips[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '90deg'] });
        const face = p.flips[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-90deg', '-90deg', '0deg'] });
        const isOn = p.revealed[i];
        const needsT = isOn ? c.item.rarity === 'mythique' || c.item.kind === 'celebration' : rarityRank(c.item.rarity) >= 2;
        return (
          <Animated.View
            key={c.item.id}
            style={{
              position: 'absolute',
              left,
              top,
              width: p.cw,
              height: ch,
              opacity: p.cardsIn[i],
              transform: [
                { translateX: p.cardsIn[i].interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) },
                { translateY: p.cardsIn[i].interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
                { scale: p.cardsIn[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              ],
            }}>
            <Pressable onPress={() => p.onReveal(i)} accessibilityRole="button" accessibilityLabel={isOn ? c.item.name : `Carte ${i + 1}`} style={{ flex: 1 }}>
              <Animated.View style={[abs, { opacity: p.flips[i].interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [1, 1, 0, 0] }), transform: [{ perspective: 900 }, { rotateY: back }] }]}>
                <CardBack w={p.cw} rarity={c.item.rarity} t={needsT ? t : 0} />
              </Animated.View>
              {/* La face n'existe qu'une fois la carte touchée : rien à dessiner (ni à deviner) avant. */}
              {isOn && (
                <Animated.View
                  pointerEvents="none"
                  style={[abs, { opacity: p.flips[i].interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1] }), transform: [{ perspective: 900 }, { rotateY: face }] }]}>
                  <ItemCard item={c.item} width={p.cw} fresh={c.isNew} tier={p.tier} skin={p.skin} t={needsT ? t : 0} />
                </Animated.View>
              )}
            </Pressable>
            {isOn && !c.isNew && (
              <View style={s.dupe} pointerEvents="none">
                <Icon name="water_drop" size={11} color="#FFE066" />
                <Text style={s.dupeText}>+{c.chalk}</Text>
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Gerbe d'étincelles de l'ouverture (pilotée par `progress`, de 0 à 1). */
const BurstSparks = memo(function BurstSparks({ size, color, progress }: { size: number; color: string; progress: Animated.Value }) {
  return (
    <View style={{ width: size, height: size }}>
      {Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2 + (i % 3) * 0.2;
        const d = size * (0.28 + ((i * 37) % 10) / 40);
        const dot = 4 + (i % 4) * 2;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: size / 2 - dot / 2,
              top: size / 2 - dot / 2,
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: i % 3 === 0 ? '#FFFFFF' : i % 3 === 1 ? color : '#FFE066',
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * d] }) },
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * d] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
});

/** Entrée d'une grande carte : rayons, étincelles, la carte en grand et ce qu'on en fait. */
function Walkout({
  card,
  width,
  height,
  tier,
  skin,
  onClose,
  onEquip,
}: {
  card: PulledCard;
  width: number;
  height: number;
  tier: Tier;
  skin: SkinId;
  onClose: () => void;
  onEquip: (c: PulledCard) => void;
}) {
  const appear = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const t = useTicker(true, 30);
  const r = rarityOf(card.item.rarity);
  const big = Math.min(width * 0.6, 250);
  const rank = rarityRank(card.item.rarity);
  useEffect(() => {
    Animated.spring(appear, { toValue: 1, friction: 6, tension: 45, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [appear, spin]);
  const worn = isEquipped(card.item);
  return (
    <Pressable style={[abs, s.walkout]} onPress={onClose} accessibilityLabel="Continuer">
      <Animated.View
        pointerEvents="none"
        style={[s.center, { opacity: appear, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
        <Rays size={Math.max(width, height) * 1.3} color={r.color} />
      </Animated.View>
      {rank >= 3 && (
        <View pointerEvents="none" style={s.center}>
          <Sparkles size={width * 1.1} color={r.color} t={t} n={rank === 4 ? 46 : 32} />
        </View>
      )}
      <Animated.Text
        style={[s.walkTitle, { color: r.color, opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [2.2, 1] }) }] }]}>
        {rank >= 3 ? `${r.name} !` : r.name}
      </Animated.Text>
      <Animated.View style={{ transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { rotate: appear.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) }] }}>
        <ItemCard item={card.item} width={big} fresh={card.isNew} tier={tier} skin={skin} t={t} />
      </Animated.View>
      <Text style={s.walkText}>{card.isNew ? 'Nouveau dans ta collection' : `Doublon : +${card.chalk} magnésie`}</Text>
      <View style={s.walkButtons}>
        {!worn && (
          <Button
            label={card.item.kind === 'theme' ? 'Appliquer' : card.item.kind === 'costume' ? 'Enfiler' : 'Choisir'}
            icon="check"
            onPress={() => onEquip(card)}
            style={s.walkButton}
          />
        )}
        <Button label="Continuer" variant="secondary" onPress={onClose} style={s.walkButton} />
      </View>
    </Pressable>
  );
}

/** Rien à ouvrir : comment gagner des packs. */
function NoPacks({ onClose, insets, w, h }: { onClose: () => void; insets: { top: number; bottom: number }; w: number; h: number }) {
  const router = useRouter();
  const ways: { icon: Parameters<typeof Icon>[0]['name']; text: string }[] = [
    { icon: 'landscape', text: 'Une séance validée (5 grimpes ou plus dans la journée) : un pack Séance.' },
    { icon: 'fitness_center', text: 'Trois jours d’entraînement dans la même semaine : un pack Entraînement.' },
    { icon: 'emoji_events', text: 'Un record, un flash à ton niveau, 4 semaines d’affilée avec 2 séances, ou une nouvelle carte : un pack Exploit, aux meilleures chances.' },
    { icon: 'water_drop', text: 'Chaque doublon donne de la magnésie, pour acheter l’objet de ton choix dans la collection.' },
  ];
  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <Backdrop w={w} h={h + insets.top + insets.bottom} />
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[s.title, { flex: 1 }]}>Packs</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fermer" style={({ pressed }) => [s.close, pressed && { opacity: 0.6 }]}>
          <Icon name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={s.empty}>
        <View style={{ opacity: 0.45 }}>
          <PackArt kind="seance" w={110} />
        </View>
        <Text style={s.emptyTitle}>Aucun pack à ouvrir</Text>
        <View style={s.ways}>
          {ways.map((x) => (
            <View key={x.text} style={s.way}>
              <Icon name={x.icon} size={20} color="#FFE066" />
              <Text style={s.wayText}>{x.text}</Text>
            </View>
          ))}
        </View>
        <Button label="Voir ma collection" icon="collections_bookmark" onPress={() => router.replace('/collection')} />
      </View>
    </View>
  );
}

const s = themedStyles({
  screen: { flex: 1, backgroundColor: BG[0] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  sub: { color: '#C9C3E8', fontSize: 14, fontWeight: '600', marginTop: 2 },
  left: { color: '#FFE066', fontSize: 13, fontWeight: '800' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  hintWrap: { position: 'absolute', bottom: 24, alignItems: 'center', gap: 4 },
  hint: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  blurb: { color: '#C9C3E8', fontSize: 13, fontWeight: '600' },
  flash: { backgroundColor: '#FFFFFF' },
  bottom: { paddingHorizontal: 20, gap: 8, minHeight: 80, justifyContent: 'flex-end' },
  summary: { alignItems: 'center', gap: 4, marginBottom: 6 },
  summaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  chalkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chalkText: { color: '#FFE066', fontSize: 14, fontWeight: '800' },
  chalkMuted: { color: '#C9C3E8', fontSize: 12, fontWeight: '600' },
  ghost: { minHeight: 44 },
  dupe: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#1D1B33',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#4C4473',
  },
  dupeText: { color: '#FFE066', fontSize: 11, fontWeight: '800' },
  walkout: { backgroundColor: 'rgba(8,8,20,0.92)', alignItems: 'center', justifyContent: 'center', gap: 18 },
  walkTitle: { fontSize: 34, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12 },
  walkText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  walkButtons: { flexDirection: 'row', gap: 12, paddingHorizontal: 24 },
  walkButton: { minWidth: 130 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 28 },
  emptyTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  ways: { gap: 14, alignSelf: 'stretch' },
  way: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  wayText: { flex: 1, color: '#E9E6FA', fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
