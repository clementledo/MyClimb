import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/lib/theme';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
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
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  dot?: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  style,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}>
      <Text style={[styles.buttonText, variant === 'secondary' && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.background, elevation: 1 },
  segmentText: { color: colors.muted, fontWeight: '500' },
  segmentTextActive: { color: colors.primary, fontWeight: '700' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.text },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonSecondary: { backgroundColor: colors.primarySoft },
  buttonDanger: { backgroundColor: colors.danger },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  section: { gap: 8 },
  sectionTitle: { fontWeight: '700', fontSize: 15, color: colors.text },
  empty: { color: colors.muted, textAlign: 'center', padding: 24, lineHeight: 20 },
});
