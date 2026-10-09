import type { AndroidSymbol } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Icon } from '@/components/ui';
import { energyLeft, ENERGY_PER_DAY, type Club } from '@/lib/manager';
import { themedStyles } from '@/lib/theme';

/** Couleurs fixes du jeu (ambiance stade de nuit), indépendantes du thème de l'app. */
export const G = {
  bg: '#0B1030',
  bg2: '#141B45',
  panel: '#1A2257',
  line: '#2A347A',
  text: '#FFFFFF',
  muted: '#9AA3D6',
  gold: '#FFD43B',
  accent: '#FF7A3D',
  green: '#51CF66',
  red: '#FF6B6B',
  blue: '#4DABF7',
};

/** Fond du jeu : dégradé nuit, projecteurs et un mur aux couleurs du club. */
export function GameBackground({ colors }: { colors?: [string, string] }) {
  return (
    <Svg style={s.fill} viewBox="0 0 100 200" preserveAspectRatio="xMidYMid slice" pointerEvents="none">
      <Defs>
        <LinearGradient id="gbg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={G.bg2} />
          <Stop offset="1" stopColor={G.bg} />
        </LinearGradient>
        <LinearGradient id="gwall" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors?.[0] ?? G.accent} stopOpacity="0.28" />
          <Stop offset="1" stopColor={colors?.[0] ?? G.accent} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="200" fill="url(#gbg)" />
      <Path d="M-10 0 L30 0 L60 200 L-10 200 Z" fill="#FFFFFF" opacity={0.03} />
      <Path d="M70 0 L110 0 L110 200 L40 200 Z" fill="#FFFFFF" opacity={0.03} />
      <Path d="M0 30 L40 18 L70 26 L100 12 L100 90 L0 90 Z" fill="url(#gwall)" />
    </Svg>
  );
}

/** En-tête du jeu : retour, titre, pièces et énergie. */
export function GameHeader({ title, club, right }: { title: string; club?: Club | null; right?: ReactNode }) {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: top + 8 }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Retour" style={s.round}>
        <Icon name="arrow_back" size={22} color={G.text} />
      </Pressable>
      <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {title}
      </Text>
      {club && (
        <>
          <Chip icon="bolt" color={G.blue} text={`${energyLeft(club)}/${ENERGY_PER_DAY}`} label="Énergie" />
          <Chip icon="paid" color={G.gold} text={club.coins.toLocaleString('fr-CA')} label="Pièces" />
        </>
      )}
      {right}
    </View>
  );
}

export function Chip({ icon, color, text, label }: { icon: AndroidSymbol; color: string; text: string; label: string }) {
  return (
    <View style={s.chip} accessibilityLabel={`${label} ${text}`}>
      <Icon name={icon} size={16} color={color} />
      <Text style={s.chipText}>{text}</Text>
    </View>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.panel, style]}>{children}</View>;
}

export function GButton({
  label,
  icon,
  onPress,
  tone = 'gold',
  disabled,
  style,
}: {
  label: string;
  icon?: AndroidSymbol;
  onPress: () => void;
  tone?: 'gold' | 'accent' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'gold' ? G.gold : tone === 'accent' ? G.accent : 'transparent';
  const fg = tone === 'ghost' ? G.text : G.bg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderWidth: tone === 'ghost' ? 1.5 : 0 }, disabled && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.97 }] }, style]}>
      {icon && <Icon name={icon} size={20} color={fg} />}
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Écusson du club, à ses deux couleurs. */
export function Crest({ colors, size, letter }: { colors: [string, string]; size: number; letter: string }) {
  return (
    <View style={{ width: size, height: size * 1.15 }}>
      <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
        <Path d="M50 2 L96 16 L92 70 Q86 98 50 113 Q14 98 8 70 L4 16 Z" fill={colors[0]} stroke={colors[1]} strokeWidth={6} />
        <Path d="M50 20 L78 72 L22 72 Z" fill={colors[1]} opacity={0.9} />
        <Path d="M50 20 L60 40 L54 38 L50 46 L45 37 L40 40 Z" fill={colors[0]} />
      </Svg>
      <Text style={[s.crestLetter, { fontSize: size * 0.24, top: size * 0.8 }]}>{letter.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function StatBar({ label, value, max = 99, color = G.accent, extra = 0 }: { label: string; value: number; max?: number; color?: string; extra?: number }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View style={s.statRow}>
      <Text style={s.statLabel}>{label}</Text>
      <View style={s.track}>
        <View style={[s.bar, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.statValue}>
        {Math.floor(value)}
        {extra > 0 && <Text style={{ color: G.green }}> +{extra}</Text>}
      </Text>
    </View>
  );
}

const s = themedStyles({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  title: { flex: 1, color: G.text, fontSize: 20, fontWeight: '800' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)' },
  chipText: { color: G.text, fontWeight: '800', fontSize: 13 },
  panel: { backgroundColor: 'rgba(26,34,87,0.85)', borderRadius: 20, borderWidth: 1, borderColor: G.line, padding: 16, gap: 10 },
  btn: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderColor: 'rgba(255,255,255,0.3)' },
  btnText: { fontSize: 16, fontWeight: '800' },
  crestLetter: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: '#FFFFFF', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statLabel: { width: 78, color: G.muted, fontSize: 13, fontWeight: '700' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  statValue: { width: 46, textAlign: 'right', color: G.text, fontWeight: '800', fontSize: 14 },
});

/** Onglets du jeu (sur fond sombre). */
export function GTabs<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={t.row}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: o.value === value }} accessibilityLabel={o.label} style={[t.tab, o.value === value && t.on]}>
          <Text style={[t.text, o.value === value && t.textOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const t = themedStyles({
  row: { flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)' },
  tab: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: G.gold },
  text: { color: G.muted, fontWeight: '800', fontSize: 14 },
  textOn: { color: G.bg },
});

/** Explications du jeu, affichées par les « ? ». */
export const HELP = {
  equipe: { title: 'Ton équipe', text: 'Touche une carte pour ouvrir la fiche du grimpeur : programme d’entraînement, matériel, compétences. La barre sous la carte montre sa fatigue : verte, il est frais ; jaune ou rouge, il grimpe moins bien.' },
  objets: { title: 'Tes objets', text: 'Matériel : des stats en plus tant qu’un grimpeur le porte (2 au plus). Boost : un bonus pour une compétition, utilisé une fois. Coach : entraînement plus rapide dans sa stat. Sponsor : des pièces en plus à chaque compétition. Stage : apprend une compétence.' },
  ligue: { title: 'La ligue', text: '10 manches par saison. Chaque manche rapporte des points selon ton classement. À la fin, les 3 premiers montent de ligue et on descend à partir de la 8ᵉ place. Les rivaux progressent un peu à chaque manche.' },
  programme: { title: 'Entraînement', text: 'Il s’entraîne même app fermée : la stat choisie gagne environ +1 toutes les 3 h, plus lentement près du potentiel. Ça fatigue un peu. Au repos, la fatigue passe de 100 à 0 en 4 h ; sans programme, en 8 h.' },
  fatigue: { title: 'Fatigue', text: 'De 0 à 100. Au-dessus de 45, il grimpe moins bien ; à 80 et plus, il ne progresse presque plus. Chaque épreuve de compétition ajoute 12. Au repos, il récupère tout en 4 h.' },
  potentiel: { title: 'Potentiel', text: 'Le plafond de ses stats : l’entraînement ne peut pas aller au-delà. Il monte de 1 tous les 100 XP gagnés en compétition, et chaque top rapporte de l’XP en plus.' },
  stats: { title: 'Stats', text: 'Chaque épreuve utilise certaines stats, affichées sur sa carte avant la compétition (par exemple Dévers : Force, Puissance, Doigts). La voie demande surtout de l’Endurance. Le chiffre en plus vient du matériel porté.' },
  materiel: { title: 'Matériel', text: 'Jusqu’à 2 objets par grimpeur. Un objet n’est porté que par un grimpeur à la fois : touche-le pour l’équiper ou le retirer.' },
  competences: { title: 'Compétences', text: 'Une compétence donne +8 sur le type de bloc qui lui correspond (par exemple Talon pour le dévers). Elles s’apprennent avec les stages trouvés dans les packs.' },
  competition: { title: 'La compétition', text: '3 blocs puis une voie, connus à l’avance. Choisis un grimpeur par épreuve : le % est sa chance de réussir, selon ses stats utiles, sa fatigue et ton boost. Un top vaut 25 points, une zone 10, et la voie jusqu’à 25 selon la hauteur atteinte. Une compétition coûte 1 énergie (10 par jour).' },
  boost: { title: 'Boost', text: 'Son bonus s’ajoute à tous tes grimpeurs pour cette compétition, puis il disparaît.' },
  packs: { title: 'Les packs', text: 'Chaque pack contient 4 ou 5 cartes : grimpeurs, objets ou pièces. Plus il est cher, meilleures sont les cartes. Si ton équipe est pleine (12 grimpeurs), le grimpeur en trop est vendu automatiquement.' },
} as const;

/** Petit « ? » qui ouvre une bulle d'explication. */
export function HelpTip({ topic }: { topic: keyof typeof HELP }) {
  const [open, setOpen] = useState(false);
  const h = HELP[topic];
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Aide : ${h.title}`} style={hs.q}>
        <Text style={hs.qText}>?</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={hs.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fermer l’aide">
          <View style={hs.bubble}>
            <Text style={hs.title}>{h.title}</Text>
            <Text style={hs.text}>{h.text}</Text>
            <Text style={hs.ok}>Compris</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const hs = themedStyles({
  q: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: G.gold, alignItems: 'center', justifyContent: 'center' },
  qText: { color: G.gold, fontWeight: '900', fontSize: 13, lineHeight: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 28 },
  bubble: { backgroundColor: G.panel, borderRadius: 20, padding: 20, gap: 10, borderWidth: 1.5, borderColor: G.gold },
  title: { color: G.gold, fontWeight: '900', fontSize: 18 },
  text: { color: G.text, fontSize: 15, lineHeight: 22 },
  ok: { color: G.gold, fontWeight: '800', fontSize: 15, alignSelf: 'flex-end', marginTop: 4 },
});
