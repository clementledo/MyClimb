import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Chip, Section, Segmented } from '@/components/ui';
import {
  GRADE_SYSTEM_LABELS,
  GRADES,
  HOLD_COLORS,
  RESULT_LABELS,
  STYLES,
  type BlockResult,
  type GradeSystem,
} from '@/lib/climbing';
import { getGym, getSetting, listSavedGyms, saveGym, setSetting, type BlockInput, type Gym } from '@/lib/db';
import { searchGyms } from '@/lib/google';
import { currentPosition, distanceM } from '@/lib/location';
import { deletePhoto, pickPhoto } from '@/lib/photos';
import { colors } from '@/lib/theme';

const today = () => new Date().toISOString().slice(0, 10);
// Une salle à moins de 300 m est considérée comme celle où tu te trouves.
const HERE_RADIUS_M = 300;

export function BlockForm({
  initial,
  gymId,
  onSave,
}: {
  initial?: BlockInput;
  gymId?: string;
  onSave: (b: BlockInput) => void;
}) {
  const [gyms, setGyms] = useState<Gym[]>(() => listSavedGyms());
  const [selectedGym, setSelectedGym] = useState<string | null>(initial?.gymId ?? gymId ?? null);
  const [photoUri, setPhotoUri] = useState<string | null>(initial?.photoUri ?? null);
  const [color, setColor] = useState<string | null>(initial?.color ?? null);
  const [gradeSystem, setGradeSystem] = useState<GradeSystem>(
    initial?.gradeSystem ?? ((getSetting('gradeSystem') as GradeSystem) || 'font'),
  );
  const [grade, setGrade] = useState<string | null>(initial?.grade ?? null);
  const [styles, setStyles] = useState<string[]>(initial?.styles ?? []);
  const [result, setResult] = useState<BlockResult>(initial?.result ?? 'sent');
  const [attempts, setAttempts] = useState(initial?.attempts ?? 1);
  const [date, setDate] = useState(initial?.date ?? today());
  const [note, setNote] = useState(initial?.note ?? '');

  // Salles proches : la plus proche est présélectionnée si tu es dedans.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pos = await currentPosition();
        const nearby = await searchGyms(pos);
        if (cancelled) return;
        const dist = (g: Gym) => distanceM(pos, { latitude: g.lat, longitude: g.lng });
        const merged = new Map<string, Gym>();
        for (const g of [...nearby].sort((a, b) => dist(a) - dist(b))) merged.set(g.id, g);
        for (const g of listSavedGyms()) merged.set(g.id, g);
        const current = selectedGym ? getGym(selectedGym) : null;
        if (current) merged.set(current.id, current);
        setGyms([...merged.values()]);
        const closest = [...merged.values()].sort((a, b) => dist(a) - dist(b))[0];
        if (!selectedGym && closest && dist(closest) < HERE_RADIUS_M) setSelectedGym(closest.id);
      } catch {
        // Hors ligne ou sans localisation : on garde les salles déjà enregistrées.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderedGyms = useMemo(() => {
    const sel = gyms.find((g) => g.id === selectedGym);
    return sel ? [sel, ...gyms.filter((g) => g.id !== selectedGym)] : gyms;
  }, [gyms, selectedGym]);

  const changeSystem = (sys: GradeSystem) => {
    setGradeSystem(sys);
    setGrade(null);
  };

  const toggleStyle = (st: string) =>
    setStyles((cur) => (cur.includes(st) ? cur.filter((x) => x !== st) : [...cur, st]));

  const takePhoto = async (source: 'camera' | 'library') => {
    try {
      const uri = await pickPhoto(source);
      if (uri) {
        if (photoUri && photoUri !== initial?.photoUri) deletePhoto(photoUri);
        setPhotoUri(uri);
      }
    } catch (e) {
      Alert.alert('Photo', e instanceof Error ? e.message : String(e));
    }
  };

  const save = () => {
    const gym = gyms.find((g) => g.id === selectedGym);
    if (!gym) return Alert.alert('Salle manquante', 'Choisis la salle du bloc.');
    if (!grade) return Alert.alert('Cotation manquante', 'Choisis la cotation du bloc.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Date', 'Format attendu : AAAA-MM-JJ.');
    saveGym(gym);
    setSetting('gradeSystem', gradeSystem);
    onSave({
      gymId: gym.id,
      photoUri,
      color,
      grade,
      gradeSystem,
      styles,
      result,
      attempts: result === 'flash' ? 1 : attempts,
      date,
      note: note.trim() || null,
    });
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={s.content}>
      <Section title="Photo">
        {photoUri && <Image source={{ uri: photoUri }} style={s.photo} contentFit="cover" />}
        <View style={s.row}>
          <Button label="Prendre une photo" variant="secondary" style={{ flex: 1 }} onPress={() => takePhoto('camera')} />
          <Button label="Galerie" variant="secondary" style={{ flex: 1 }} onPress={() => takePhoto('library')} />
        </View>
      </Section>

      <Section title="Salle">
        {orderedGyms.length === 0 ? (
          <Text style={s.muted}>Recherche des salles autour de toi…</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.wrapRow}>
            {orderedGyms.map((g) => (
              <Chip key={g.id} label={g.name} selected={g.id === selectedGym} onPress={() => setSelectedGym(g.id)} />
            ))}
          </ScrollView>
        )}
      </Section>

      <Section title="Couleur des prises">
        <View style={s.wrap}>
          {HOLD_COLORS.map((c) => (
            <Chip
              key={c.name}
              label={c.name}
              dot={c.hex}
              selected={color === c.name}
              onPress={() => setColor(color === c.name ? null : c.name)}
            />
          ))}
        </View>
      </Section>

      <Section title="Cotation">
        <Segmented
          options={(Object.keys(GRADES) as GradeSystem[]).map((sys) => ({
            value: sys,
            label: GRADE_SYSTEM_LABELS[sys],
          }))}
          value={gradeSystem}
          onChange={changeSystem}
        />
        <View style={s.wrap}>
          {GRADES[gradeSystem].map((g) => (
            <Chip key={g} label={g} selected={grade === g} onPress={() => setGrade(g)} />
          ))}
        </View>
      </Section>

      <Section title="Styles">
        <View style={s.wrap}>
          {STYLES.map((st) => (
            <Chip key={st} label={st} selected={styles.includes(st)} onPress={() => toggleStyle(st)} />
          ))}
        </View>
      </Section>

      <Section title="Résultat">
        <Segmented
          options={(Object.keys(RESULT_LABELS) as BlockResult[]).map((r) => ({ value: r, label: RESULT_LABELS[r] }))}
          value={result}
          onChange={setResult}
        />
        {result !== 'flash' && (
          <View style={s.stepper}>
            <Text style={s.label}>Nombre d&apos;essais</Text>
            <Pressable style={s.stepBtn} onPress={() => setAttempts((a) => Math.max(1, a - 1))}>
              <Text style={s.stepText}>−</Text>
            </Pressable>
            <Text style={s.stepValue}>{attempts}</Text>
            <Pressable style={s.stepBtn} onPress={() => setAttempts((a) => a + 1)}>
              <Text style={s.stepText}>+</Text>
            </Pressable>
          </View>
        )}
      </Section>

      <Section title="Date">
        <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-JJ" />
      </Section>

      <Section title="Note">
        <TextInput
          style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
          value={note}
          onChangeText={setNote}
          placeholder="Méthode, sensations…"
          multiline
        />
      </Section>

      <Button label="Enregistrer" onPress={save} />
      <Button label="Annuler" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 48 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10 },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wrapRow: { gap: 8 },
  muted: { color: colors.muted },
  label: { flex: 1, color: colors.text, fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 22, color: colors.primary, fontWeight: '700' },
  stepValue: { fontSize: 18, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
});
