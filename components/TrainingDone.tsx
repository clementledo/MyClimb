import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, IconButton, Sheet } from '@/components/ui';
import { FEEL_LABELS, type Feel } from '@/lib/climbing';
import { insertTrainingLog, type TrainingLog } from '@/lib/db';
import { todayIso } from '@/lib/stats';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

/** Panneau « Marquer comme fait » : durée et ressenti, puis enregistrement dans l'historique. */
export function TrainingDone({
  visible,
  onClose,
  onSaved,
  entry,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  entry: Pick<TrainingLog, 'kind' | 'ref' | 'name' | 'minutes' | 'intensity'>;
}) {
  const [minutes, setMinutes] = useState(entry.minutes);
  const [feel, setFeel] = useState<Feel | null>(null);

  const reset = () => {
    setMinutes(entry.minutes);
    setFeel(null);
  };
  const close = () => {
    reset();
    onClose();
  };
  const save = () => {
    insertTrainingLog({ ...entry, minutes, feel, date: todayIso() });
    reset();
    onSaved();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Bien joué !">
      <Text style={s.label}>Durée</Text>
      <View style={s.stepper}>
        <IconButton icon="remove" label="Moins" onPress={() => setMinutes(Math.max(5, minutes - 5))} />
        <Text style={s.value}>{minutes} min</Text>
        <IconButton icon="add" label="Plus" onPress={() => setMinutes(Math.min(240, minutes + 5))} />
      </View>
      <Text style={s.label}>Comment c’était ?</Text>
      <View style={s.chips}>
        {(Object.keys(FEEL_LABELS) as Feel[]).map((f) => (
          <Chip key={f} label={FEEL_LABELS[f]} selected={feel === f} onPress={() => setFeel(feel === f ? null : f)} />
        ))}
      </View>
      <Button label="Enregistrer" icon="check" onPress={save} />
    </Sheet>
  );
}

const s = themedStyles({
  label: { ...type.headline },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  value: { fontSize: 22, fontWeight: '800', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
});
