/**
 * Composants d'interface communs : boutons, cartes, listes, pastilles, messages…
 * Tous les écrans s'en servent pour garder le même style partout.
 */
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space, themedStyles, type } from '@/lib/theme';

/* ---------- Icônes ---------- */

/** Icône Material (Android). Le nom iOS est facultatif : l'app vise Android. */
export function Icon({
  name,
  ios,
  size = 22,
  color = colors.text,
}: {
  name: AndroidSymbol;
  ios?: SFSymbol;
  size?: number;
  color?: ColorValue;
}) {
  return <SymbolView name={{ android: name, web: name, ios: ios ?? 'circle' }} tintColor={color} size={size} />;
}

/** Bouton rond avec une icône. */
export function IconButton({
  icon,
  onPress,
  label,
  active,
  style,
}: {
  icon: AndroidSymbol;
  onPress: () => void;
  /** Texte lu par l'accessibilité (et utilisé par les tests). */
  label: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, active && styles.iconButtonActive, pressed && styles.pressed, style]}>
      <Icon name={icon} size={20} color={active ? colors.onPrimary : colors.text} />
    </Pressable>
  );
}

/* ---------- Boutons ---------- */

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  size = 'md',
  loading,
  style,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: AndroidSymbol;
  size?: 'md' | 'sm';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const tint =
    disabled ? colors.muted : variant === 'primary' || variant === 'danger' ? colors.onPrimary : variant === 'ghost' ? colors.primary : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSmall,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={tint} size="small" />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} color={tint} />}
          <Text style={[styles.buttonText, size === 'sm' && styles.buttonTextSmall, { color: tint }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Lien discret (texte de couleur principale). */
export function TextLink({ label, onPress, color = colors.primary }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
      <Text style={[styles.link, { color }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Sélecteurs ---------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string; icon?: AndroidSymbol }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}>
            {o.icon && <Icon name={o.icon} size={17} color={active ? colors.text : colors.muted} />}
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  dot,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  dot?: string;
  icon?: AndroidSymbol;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
      {icon && <Icon name={icon} size={16} color={selected ? colors.onPrimary : colors.text} />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Mise en page ---------- */

/** Carte blanche aux coins arrondis. */
export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}>
      {children}
    </Pressable>
  );
}

/** Titre de section en petites capitales, avec une action facultative à droite. */
export function Section({
  title,
  action,
  children,
  style,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && <TextLink label={action.label} onPress={action.onPress} />}
      </View>
      {children}
    </View>
  );
}

/** Ligne de liste : icône teintée, titre, sous-titre, valeur à droite et chevron. */
export function ListRow({
  title,
  subtitle,
  icon,
  iconColor = colors.primary,
  left,
  right,
  value,
  onPress,
  chevron = !!onPress,
  last,
}: {
  title: string;
  subtitle?: string;
  icon?: AndroidSymbol;
  iconColor?: string;
  left?: ReactNode;
  right?: ReactNode;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  /** Dernière ligne d'une carte : pas de trait en dessous. */
  last?: boolean;
}) {
  const body = (
    <>
      {left}
      {icon && !left && (
        <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon name={icon} size={20} color={iconColor} />
        </View>
      )}
      <View style={[styles.rowBody, !last && styles.rowDivider]}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.rowSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {right}
        {chevron && <Icon name="chevron_right" size={20} color={colors.muted} />}
      </View>
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {body}
    </Pressable>
  );
}

/** Petite étiquette colorée. */
export function Badge({
  label,
  tone = 'primary',
}: {
  label: string;
  tone?: 'primary' | 'success' | 'danger' | 'neutral';
}) {
  const bg =
    tone === 'success' ? colors.successSoft : tone === 'danger' ? colors.dangerSoft : tone === 'neutral' ? colors.surface : colors.primarySoft;
  const fg = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : tone === 'neutral' ? colors.muted : colors.primary;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Message dans une carte teintée (info, réussite ou erreur), avec action facultative. */
export function Banner({
  tone = 'info',
  icon,
  title,
  text,
  action,
  style,
}: {
  tone?: 'info' | 'success' | 'danger';
  icon?: AndroidSymbol;
  title: string;
  text?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'success' ? colors.successSoft : tone === 'danger' ? colors.dangerSoft : colors.primarySoft;
  const fg = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : colors.primary;
  return (
    <View style={[styles.banner, { backgroundColor: bg }, style]}>
      <Icon name={icon ?? (tone === 'danger' ? 'error' : tone === 'success' ? 'check_circle' : 'info')} size={22} color={fg} />
      <View style={styles.bannerBody}>
        <Text style={[styles.bannerTitle, { color: fg }]}>{title}</Text>
        {text ? <Text style={styles.bannerText}>{text}</Text> : null}
      </View>
      {action && <TextLink label={action.label} onPress={action.onPress} color={fg} />}
    </View>
  );
}

/** État vide : grande icône, titre, explication et action facultative. */
export function Empty({
  text,
  title,
  icon,
  action,
}: {
  text: string;
  title?: string;
  icon?: AndroidSymbol;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      {icon && (
        <View style={styles.emptyIcon}>
          <Icon name={icon} size={30} color={colors.primary} />
        </View>
      )}
      {title && <Text style={styles.emptyTitle}>{title}</Text>}
      <Text style={styles.emptyText}>{text}</Text>
      {action && <Button label={action.label} onPress={action.onPress} variant="secondary" size="sm" style={styles.emptyAction} />}
    </View>
  );
}

/** Chiffre clé avec son libellé (statistiques, fiche…). */
export function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent && { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/** Panneau qui monte du bas de l'écran (filtres, choix…). */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <IconButton icon="close" label="Fermer" onPress={onClose} />
        </View>
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} bounces={false}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export const styles = themedStyles({
  pressed: { opacity: 0.6 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  iconButtonActive: { backgroundColor: colors.primary },
  button: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: colors.primary,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.sm },
  buttonSecondary: { backgroundColor: colors.primarySoft },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { backgroundColor: colors.surface },
  buttonText: { fontSize: 16, fontWeight: '700', letterSpacing: -0.1, color: colors.onPrimary },
  buttonTextSmall: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.card, elevation: 2 },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  segmentTextActive: { color: colors.text, fontWeight: '700' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextSelected: { color: colors.onPrimary },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.surface },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitle: { ...type.overline },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg },
  rowPressed: { backgroundColor: colors.surface },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 14,
    paddingRight: space.lg,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: colors.muted },
  rowValue: { fontSize: 15, fontWeight: '600', color: colors.muted },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '700' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14, borderRadius: radius.md },
  bannerBody: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerText: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: colors.text },
  empty: { alignItems: 'center', paddingHorizontal: space.xxl, paddingVertical: 40, gap: space.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginBottom: space.sm,
  },
  emptyTitle: { ...type.headline, textAlign: 'center' },
  emptyText: { fontSize: 14, fontWeight: '400', lineHeight: 20, color: colors.muted, textAlign: 'center' },
  emptyAction: { marginTop: space.sm, alignSelf: 'center' },
  stat: { flex: 1, minWidth: '45%', gap: 2 },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 13, fontWeight: '500', color: colors.muted },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    fontSize: 16,
    fontWeight: '400',
    color: colors.text,
  },
  backdrop: { flex: 1, backgroundColor: '#00000066' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.lg,
    maxHeight: '88%',
  },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { gap: space.lg, paddingBottom: space.xs },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { ...type.title },
});
