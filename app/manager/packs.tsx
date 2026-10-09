import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, Text, useWindowDimensions, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G as SvgG, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ManagerCard } from '@/components/ManagerCard';
import { Crest, G, GameBackground, GameHeader, GButton, Panel } from '@/components/ManagerUi';
import { Icon } from '@/components/ui';
import { buyPack, itemText, loadClub, openPack, PACKS, ratingOf, tierOf, type Club, type PackCard, type PackKind } from '@/lib/manager';
import { STYLES } from '@/lib/managerData';
import { themedStyles } from '@/lib/theme';

const SHOP: PackKind[] = ['bronze', 'argent', 'or'];
const ITEM_ICON = { materiel: 'checkroom', boost: 'bolt', coach: 'sports', sponsor: 'handshake', competence: 'school' } as const;
const LEVEL_COLORS = ['#7D8A97', '#2F80ED', '#9B45E4', '#E9A100'];

export default function ManagerPacks() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const [club, setClub] = useState<Club | null>(loadClub);
  const [opened, setOpened] = useState<{ kind: PackKind; cards: PackCard[] } | null>(null);
  const [index, setIndex] = useState(0);

  if (!club) return <View style={s.screen} />;

  const open = () => {
    const r = openPack(club, 0);
    if (!r) return;
    Vibration.vibrate([0, 40, 60, 90]);
    setOpened(r);
    setIndex(0);
    setClub(loadClub());
  };
  const buy = (k: PackKind) => {
    if (club.coins < PACKS[k].price) return Alert.alert('Pas assez de pièces', `Il te faut ${PACKS[k].price.toLocaleString('fr-CA')} pièces. Gagne des compétitions pour en avoir plus.`);
    buyPack(club, k);
    setClub(loadClub());
  };

  if (opened) {
    const done = index >= opened.cards.length;
    return (
      <View style={s.screen}>
        <GameBackground colors={club.colors} />
        {done ? (
          <Summary club={club} opened={opened} onNext={club.packs.length ? open : null} onClose={() => setOpened(null)} />
        ) : (
          <Reveal key={index} club={club} card={opened.cards[index]} n={index + 1} total={opened.cards.length} onNext={() => setIndex(index + 1)} onSkip={() => setIndex(opened.cards.length)} />
        )}
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <GameBackground colors={club.colors} />
      <GameHeader title="Packs" club={club} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}>
        {club.packs.length > 0 && (
          <Panel style={s.pending}>
            <PackArt kind={club.packs[0]} width={150} />
            <Text style={s.title}>{PACKS[club.packs[0]].name}</Text>
            <Text style={s.muted}>
              {club.packs.length > 1 ? `${club.packs.length} packs à ouvrir · ` : ''}
              {PACKS[club.packs[0]].text}
            </Text>
            <GButton label="Ouvrir le pack" icon="redeem" onPress={open} style={{ alignSelf: 'stretch' }} />
          </Panel>
        )}
        <Text style={s.section}>Boutique</Text>
        {SHOP.map((k) => (
          <Pressable key={k} onPress={() => buy(k)} accessibilityRole="button" accessibilityLabel={`Acheter ${PACKS[k].name}`} style={({ pressed }) => [s.shopRow, pressed && { transform: [{ scale: 0.98 }] }]}>
            <PackArt kind={k} width={64} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.shopName}>{PACKS[k].name}</Text>
              <Text style={s.muted}>{PACKS[k].text}</Text>
            </View>
            <View style={[s.price, club.coins < PACKS[k].price && { opacity: 0.45 }]}>
              <Icon name="paid" size={16} color={G.bg} />
              <Text style={s.priceText}>{PACKS[k].price.toLocaleString('fr-CA')}</Text>
            </View>
          </Pressable>
        ))}
        <Text style={s.muted}>Effectif complet (12 grimpeurs) : un nouveau grimpeur est revendu tout de suite, à petit prix. Libère des grimpeurs depuis leur fiche pour faire de la place.</Text>
        <GButton label="Retour au club" tone="ghost" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}

/* ---------- Révélation d'une carte, façon FIFA ---------- */

function Reveal({ club, card, n, total, onNext, onSkip }: { club: Club; card: PackCard; n: number; total: number; onNext: () => void; onSkip: () => void }) {
  const { width } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const special = card.kind === 'grimpeur' && ratingOf(card.climber) >= 65;
  // Grimpeur argent ou mieux : drapeau, puis style, puis club, puis la carte.
  const [phase, setPhase] = useState(special ? 0 : 3);
  const [anim] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: phase === 3 ? 650 : 500, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
    if (phase === 3 && special) Vibration.vibrate([0, 80, 60, 160]);
    if (phase < 3) {
      const t = setTimeout(() => setPhase(phase + 1), 1100);
      return () => clearTimeout(t);
    }
  }, [phase, anim, special]);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const tier = card.kind === 'grimpeur' ? tierOf(ratingOf(card.climber)) : null;
  const glow = tier === 'legende' ? '#9580FF' : tier === 'or' ? '#FFD43B' : tier === 'argent' ? '#DEE2E6' : card.kind === 'objet' ? LEVEL_COLORS[card.item.level - 1] : '#E8A06A';
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable style={[s.reveal, { paddingTop: top + 16, paddingBottom: bottom + 24 }]} onPress={() => (phase < 3 ? setPhase(3) : onNext())} accessibilityLabel="Continuer">
      <View style={s.revealTop}>
        <Text style={s.counter}>
          Carte {n}/{total}
        </Text>
        <Pressable onPress={onSkip} hitSlop={10} accessibilityLabel="Tout voir">
          <Text style={s.skip}>Tout voir</Text>
        </Pressable>
      </View>
      <View style={s.stageBox}>
        <Animated.View style={[s.rays, { transform: [{ rotate: rot }] }]} pointerEvents="none">
          <Svg width={width * 1.6} height={width * 1.6} viewBox="-100 -100 200 200">
            {Array.from({ length: 16 }, (_, i) => (
              <Path key={i} d="M0 0 L-7 -100 L7 -100 Z" fill={glow} opacity={phase === 3 ? 0.22 : 0.1} transform={`rotate(${i * 22.5})`} />
            ))}
            <Circle r={34} fill={glow} opacity={0.18} />
          </Svg>
        </Animated.View>
        <Animated.View style={{ opacity: anim, transform: [{ scale }], alignItems: 'center', gap: 12 }}>
          {card.kind === 'grimpeur' && phase === 0 && <Text style={s.bigFlag}>{card.climber.flag}</Text>}
          {card.kind === 'grimpeur' && phase === 1 && (
            <>
              <Text style={s.bigFlag}>{card.climber.flag}</Text>
              <Text style={s.bigText}>{STYLES[card.climber.style].name}</Text>
            </>
          )}
          {card.kind === 'grimpeur' && phase === 2 && (
            <>
              <Crest colors={club.colors} size={110} letter={club.name} />
              <Text style={s.bigText}>Rejoint {club.name}</Text>
            </>
          )}
          {card.kind === 'grimpeur' && phase === 3 && (
            <>
              <ManagerCard climber={card.climber} club={club} width={Math.min(250, width * 0.66)} />
              <Text style={s.cardCaption}>{card.extra ? `Effectif complet : revendu pour des pièces` : card.climber.bio}</Text>
            </>
          )}
          {card.kind === 'objet' && (
            <View style={[s.itemCard, { borderColor: glow }]}>
              <View style={[s.itemIcon, { backgroundColor: glow }]}>
                <Icon name={ITEM_ICON[card.item.kind]} size={44} color="#fff" />
              </View>
              <Text style={s.itemKind}>{{ materiel: 'MATÉRIEL', boost: 'BOOST', coach: 'COACH', sponsor: 'SPONSOR', competence: 'STAGE' }[card.item.kind]}</Text>
              <Text style={s.itemName}>{card.item.name}</Text>
              <Text style={s.itemText}>{itemText(card.item)}</Text>
              <View style={s.stars}>
                {Array.from({ length: card.item.level }, (_, i) => (
                  <Icon key={i} name="star" size={18} color={glow} />
                ))}
              </View>
            </View>
          )}
          {card.kind === 'pieces' && (
            <View style={[s.itemCard, { borderColor: G.gold }]}>
              <View style={[s.itemIcon, { backgroundColor: G.gold }]}>
                <Icon name="paid" size={44} color={G.bg} />
              </View>
              <Text style={s.itemName}>+{card.coins} pièces</Text>
            </View>
          )}
        </Animated.View>
      </View>
      <Text style={s.tap}>{phase < 3 ? 'Touche pour révéler' : 'Touche pour continuer'}</Text>
    </Pressable>
  );
}

function Summary({ club, opened, onNext, onClose }: { club: Club; opened: { kind: PackKind; cards: PackCard[] }; onNext: (() => void) | null; onClose: () => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const w = Math.floor((width - 32 - 24) / 3);
  return (
    <ScrollView contentContainerStyle={[s.content, { paddingTop: top + 16, paddingBottom: bottom + 32 }]}>
      <Text style={s.over}>{PACKS[opened.kind].name.toUpperCase()}</Text>
      <Text style={s.title}>Ton butin</Text>
      <View style={s.sumGrid}>
        {opened.cards.map((c, i) =>
          c.kind === 'grimpeur' ? (
            <ManagerCard key={i} climber={c.climber} club={club} width={w} dim={c.extra} />
          ) : (
            <View key={i} style={[s.mini, { width: w, height: w * 1.42, borderColor: c.kind === 'objet' ? LEVEL_COLORS[c.item.level - 1] : G.gold }]}>
              <Icon name={c.kind === 'objet' ? ITEM_ICON[c.item.kind] : 'paid'} size={30} color={c.kind === 'objet' ? LEVEL_COLORS[c.item.level - 1] : G.gold} />
              <Text style={s.miniText} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>
                {c.kind === 'objet' ? c.item.name : `+${c.coins} pièces`}
              </Text>
            </View>
          ),
        )}
      </View>
      {onNext && <GButton label={`Ouvrir le pack suivant (${club.packs.length})`} icon="redeem" onPress={onNext} />}
      <GButton label="Voir mon équipe" tone="ghost" onPress={() => router.back()} />
      <GButton label="Boutique" tone="ghost" onPress={onClose} />
    </ScrollView>
  );
}

/** Pack aux couleurs de son type, avec le logo du jeu. */
function PackArt({ kind, width }: { kind: PackKind; width: number }) {
  const c = PACKS[kind].color;
  return (
    <Svg width={width} height={width * 1.4} viewBox="0 0 100 140">
      <Defs>
        <LinearGradient id={`pk-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c} />
          <Stop offset="1" stopColor="#0B1030" />
        </LinearGradient>
      </Defs>
      <Rect x="6" y="6" width="88" height="128" rx="10" fill={`url(#pk-${kind})`} stroke={c} strokeWidth="2" />
      <Path d="M6 30 L94 22 L94 34 L6 42 Z" fill="#fff" opacity={0.12} />
      <SvgG transform="translate(50 74)">
        <Circle r="24" fill="#fff" opacity={0.92} />
        <Path d="M-15 10 L-4 -10 L2 0 L7 -6 L16 10 Z" fill={c} />
      </SvgG>
      <Rect x="20" y="108" width="60" height="6" rx="3" fill="#fff" opacity={0.7} />
    </Svg>
  );
}

const s = themedStyles({
  screen: { flex: 1, backgroundColor: G.bg },
  content: { paddingHorizontal: 16, gap: 14 },
  over: { color: G.gold, fontWeight: '900', letterSpacing: 1.5, fontSize: 12, textAlign: 'center' },
  title: { color: G.text, fontWeight: '900', fontSize: 22, textAlign: 'center' },
  section: { color: G.text, fontWeight: '800', fontSize: 17 },
  muted: { color: G.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  pending: { alignItems: 'center' },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 18, backgroundColor: 'rgba(26,34,87,0.85)', borderWidth: 1, borderColor: G.line },
  shopName: { color: G.text, fontWeight: '800', fontSize: 16 },
  price: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: G.gold },
  priceText: { color: G.bg, fontWeight: '900' },
  reveal: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between' },
  revealTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { color: G.muted, fontWeight: '800' },
  skip: { color: G.gold, fontWeight: '800' },
  stageBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  bigFlag: { fontSize: 110 },
  bigText: { color: G.text, fontWeight: '900', fontSize: 28, textAlign: 'center' },
  cardCaption: { color: G.text, opacity: 0.85, fontSize: 14, fontStyle: 'italic', textAlign: 'center', maxWidth: 280 },
  itemCard: { width: 230, padding: 22, gap: 8, alignItems: 'center', borderRadius: 24, borderWidth: 3, backgroundColor: 'rgba(26,34,87,0.95)' },
  itemIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  itemKind: { color: G.muted, fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  itemName: { color: G.text, fontWeight: '900', fontSize: 20, textAlign: 'center' },
  itemText: { color: G.text, opacity: 0.85, fontSize: 14, textAlign: 'center' },
  stars: { flexDirection: 'row', gap: 2 },
  tap: { color: G.muted, textAlign: 'center', fontWeight: '700' },
  sumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  mini: { borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8, backgroundColor: 'rgba(26,34,87,0.9)' },
  miniText: { color: G.text, fontWeight: '700', fontSize: 12, textAlign: 'center' },
});
