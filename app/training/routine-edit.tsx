import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Icon, IconButton, ListRow, Section, Sheet, styles as ui } from '@/components/ui';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';
import { EXERCISES, exerciseById, FOCUS, ROUTINE_KINDS, type Focus, type RoutineKind } from '@/lib/training';
import { customRoutines, deleteCustomRoutine, routineMinutes, saveCustomRoutine } from '@/lib/trainingPlan';

/** Créer ou modifier une routine perso : un nom, un type, et des exercices dans l'ordre. */
export default function RoutineEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const existing = id ? customRoutines().find((r) => r.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<RoutineKind>(existing?.kind ?? 'souplesse');
  const [items, setItems] = useState<string[]>(existing?.items ?? []);
  const [picker, setPicker] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  const toggle = (x: string) => setItems(items.includes(x) ? items.filter((i) => i !== x) : [...items, x]);
  const minutes = routineMinutes(items);

  const save = () => {
    saveCustomRoutine({
      id: existing?.id ?? `perso-${Date.now()}`,
      name: name.trim() || 'Ma routine',
      goal: `${items.length} exercice${items.length > 1 ? 's' : ''} choisis par toi`,
      icon: 'star',
      minutes,
      kind,
      when: 'Ma routine',
      daily: kind !== 'force',
      items,
    });
    router.back();
  };
  const remove = () =>
    Alert.alert('Supprimer cette routine ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          if (existing) deleteCustomRoutine(existing.id);
          router.dismissTo('/entrainement');
        },
      },
    ]);

  const pickable = EXERCISES.filter((x) => !focus || x.focus === focus);

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: existing ? 'Modifier la routine' : 'Nouvelle routine' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.group}>
          <Text style={s.label}>Nom</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ma routine du matin"
            placeholderTextColor={colors.muted}
            style={ui.input}
            maxLength={40}
          />
        </View>
        <View style={s.group}>
          <Text style={s.label}>Type</Text>
          <View style={s.chips}>
            {(Object.keys(ROUTINE_KINDS) as RoutineKind[]).map((k) => (
              <Chip key={k} label={ROUTINE_KINDS[k].label} icon={ROUTINE_KINDS[k].icon} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
        </View>

        <Section title={items.length ? `Exercices · environ ${minutes} min` : 'Exercices'}>
          {items.length > 0 && (
            <View style={s.listCard}>
              {items.map((xid, i) => {
                const x = exerciseById(xid);
                if (!x) return null;
                return (
                  <ListRow
                    key={xid}
                    left={
                      <View style={s.num}>
                        <Text style={s.numText}>{i + 1}</Text>
                      </View>
                    }
                    title={x.name}
                    subtitle={x.doseText}
                    right={
                      <View style={s.rowActions}>
                        <IconButton icon="arrow_upward" label={`Monter ${x.name}`} onPress={() => move(i, -1)} />
                        <IconButton icon="close" label={`Retirer ${x.name}`} onPress={() => toggle(xid)} />
                      </View>
                    }
                    last={i === items.length - 1}
                  />
                );
              })}
            </View>
          )}
          <Button label="Ajouter des exercices" icon="add" variant="secondary" onPress={() => setPicker(true)} />
        </Section>
      </ScrollView>
      <View style={[s.bar, { paddingBottom: bottom + space.md }]}>
        <Button label="Enregistrer la routine" icon="check" disabled={items.length === 0} onPress={save} />
        {existing && <Button label="Supprimer la routine" variant="ghost" onPress={remove} />}
      </View>

      <Sheet visible={picker} onClose={() => setPicker(false)} title="Ajouter des exercices">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.focusRow}>
          <Chip label="Tous" selected={!focus} onPress={() => setFocus(null)} />
          {(Object.keys(FOCUS) as Focus[]).map((f) => (
            <Chip key={f} label={FOCUS[f].label} selected={focus === f} onPress={() => setFocus(f)} />
          ))}
        </ScrollView>
        <View style={s.listCard}>
          {pickable.map((x, i, arr) => {
            const on = items.includes(x.id);
            return (
              <ListRow
                key={x.id}
                left={<Icon name={on ? 'check_circle' : 'add_circle'} size={26} color={on ? colors.success : colors.primary} />}
                title={x.name}
                subtitle={`${FOCUS[x.focus].label} · ${x.doseText}`}
                onPress={() => toggle(x.id)}
                chevron={false}
                last={i === arr.length - 1}
              />
            );
          })}
        </View>
        <Button label={`Terminé (${items.length})`} onPress={() => setPicker(false)} />
      </Sheet>
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  group: { gap: space.sm },
  label: { ...type.callout },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  focusRow: { flexDirection: 'row', gap: space.sm },
  listCard: { borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: space.md },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  numText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  rowActions: { flexDirection: 'row', gap: 6 },
  bar: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xs, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
});
