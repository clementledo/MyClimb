import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, Icon, Segmented, styles as ui } from '@/components/ui';
import {
  DISCIPLINE_LABELS,
  DISCIPLINE_SYSTEMS,
  FEEL_LABELS,
  GRADE_SYSTEM_LABELS,
  GRADES,
  HOLD_COLORS,
  HOLD_TYPES,
  isFirstTry,
  MOVE_TYPES,
  RESULT_LABELS,
  ROPE_LABELS,
  STYLES,
  type BlockResult,
  type Discipline,
  type Feel,
  type GradeSystem,
  type Rope,
} from '@/lib/climbing';
import {
  getGym,
  getSetting,
  listSavedGyms,
  listSites,
  saveGym,
  setSetting,
  type BlockInput,
  type Gym,
} from '@/lib/db';
import { searchGyms } from '@/lib/google';
import { currentPosition, distanceM } from '@/lib/location';
import { deletePhoto, pickPhoto } from '@/lib/photos';
import type { Session } from '@/lib/session';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

const today = () => new Date().toISOString().slice(0, 10);
// Une salle à moins de 300 m est considérée comme celle où tu te trouves.
const HERE_RADIUS_M = 300;

const systemSettingKey = (d: Discipline) => (d === 'bloc' ? 'gradeSystem' : 'gradeSystemVoie');

function savedSystem(d: Discipline): GradeSystem {
  const saved = getSetting(systemSettingKey(d)) as GradeSystem | null;
  return saved && DISCIPLINE_SYSTEMS[d].includes(saved) ? saved : DISCIPLINE_SYSTEMS[d][0];
}

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function BlockForm({
  initial,
  session,
  onSave,
}: {
  initial?: BlockInput;
  /** Grimpe ajoutée pendant une séance : le lieu et la date sont ceux de la séance. */
  session?: Session;
  onSave: (b: BlockInput) => void;
}) {
  const [discipline, setDiscipline] = useState<Discipline>(
    initial?.discipline ?? ((getSetting('discipline') as Discipline) || 'bloc'),
  );
  const [outdoor, setOutdoor] = useState(initial?.outdoor ?? (session ? session.site !== null : false));
  const [gyms, setGyms] = useState<Gym[]>(() => {
    const saved = listSavedGyms();
    const current = session?.gymId ? getGym(session.gymId) : null;
    return current && !saved.some((g) => g.id === current.id) ? [current, ...saved] : saved;
  });
  const [selectedGym, setSelectedGym] = useState<string | null>(initial?.gymId ?? session?.gymId ?? null);
  const [sites] = useState<string[]>(() => listSites());
  const [site, setSite] = useState(initial?.site ?? session?.site ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(initial?.photoUri ?? null);
  const [color, setColor] = useState<string | null>(initial?.color ?? null);
  const [gradeSystem, setGradeSystem] = useState<GradeSystem>(initial?.gradeSystem ?? savedSystem(discipline));
  const [grade, setGrade] = useState<string | null>(initial?.grade ?? null);
  const [styles, setStyles] = useState<string[]>(initial?.styles ?? []);
  const [holds, setHolds] = useState<string[]>(initial?.holds ?? []);
  const [moves, setMoves] = useState<string[]>(initial?.moves ?? []);
  const [rope, setRope] = useState<Rope>(initial?.rope ?? 'lead');
  const [feel, setFeel] = useState<Feel | null>(initial?.feel ?? null);
  const [result, setResult] = useState<BlockResult>(initial?.result ?? 'sent');
  const [attempts, setAttempts] = useState(initial?.attempts ?? 1);
  const [date, setDate] = useState(initial?.date ?? today());
  const [note, setNote] = useState(initial?.note ?? '');

  const kind = discipline === 'bloc' ? 'bloc' : 'voie';
  const insets = useSafeAreaInsets();

  // Salles proches : la plus proche est présélectionnée si tu es dedans.
  useEffect(() => {
    if (session) return;
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
        if (!session && !selectedGym && closest && dist(closest) < HERE_RADIUS_M) {
          setSelectedGym(closest.id);
          if (!initial) setOutdoor(false);
        }
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

  const changeDiscipline = (d: Discipline) => {
    setDiscipline(d);
    setGradeSystem(savedSystem(d));
    setGrade(null);
    if (d === 'bloc' && result === 'onsight') setResult('flash');
  };

  const changeSystem = (sys: GradeSystem) => {
    setGradeSystem(sys);
    setGrade(null);
  };

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
    const gym = outdoor ? null : gyms.find((g) => g.id === selectedGym);
    if (!outdoor && !gym) return Alert.alert('Salle manquante', `Choisis la salle du ${kind}.`);
    if (outdoor && !site.trim()) return Alert.alert('Site manquant', 'Indique le site ou le secteur.');
    if (!grade) return Alert.alert('Cotation manquante', `Choisis la cotation du ${kind}.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Date', 'Format attendu : AAAA-MM-JJ.');
    if (gym) saveGym(gym);
    setSetting(systemSettingKey(discipline), gradeSystem);
    setSetting('discipline', discipline);
    onSave({
      discipline,
      outdoor,
      gymId: gym?.id ?? null,
      site: outdoor ? site.trim() : null,
      name: name.trim() || null,
      photoUri,
      color: outdoor ? null : color,
      grade,
      gradeSystem,
      styles,
      holds,
      moves,
      rope: discipline === 'voie' ? rope : null,
      feel,
      result,
      attempts: isFirstTry(result) ? 1 : attempts,
      date,
      note: note.trim() || null,
    });
  };

  const results = (Object.keys(RESULT_LABELS) as BlockResult[]).filter(
    (r) => discipline === 'voie' || r !== 'onsight',
  );

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.group}>
          <Segmented
            options={(Object.keys(DISCIPLINE_LABELS) as Discipline[]).map((d) => ({
              value: d,
              label: DISCIPLINE_LABELS[d],
              icon: d === 'bloc' ? 'landscape' : 'height',
            }))}
            value={discipline}
            onChange={changeDiscipline}
          />
          {!session && (
            <Segmented
              options={[
                { value: 'in', label: 'En salle', icon: 'fitness_center' },
                { value: 'out', label: 'Extérieur', icon: 'park' },
              ]}
              value={outdoor ? 'out' : 'in'}
              onChange={(v) => setOutdoor(v === 'out')}
            />
          )}
        </View>

        <FormCard title="Cotation">
          <Segmented
            options={DISCIPLINE_SYSTEMS[discipline].map((sys) => ({ value: sys, label: GRADE_SYSTEM_LABELS[sys] }))}
            value={gradeSystem}
            onChange={changeSystem}
          />
          <View style={s.wrap}>
            {GRADES[gradeSystem].map((g) => (
              <Chip key={g} label={g} selected={grade === g} onPress={() => setGrade(g)} />
            ))}
          </View>
        </FormCard>

        <FormCard title="Résultat">
          <View style={s.wrap}>
            {results.map((r) => (
              <Chip key={r} label={RESULT_LABELS[r]} selected={result === r} onPress={() => setResult(r)} />
            ))}
          </View>
          {!isFirstTry(result) && (
            <View style={s.stepper}>
              <Text style={s.label}>Nombre d&apos;essais</Text>
              <Pressable
                style={s.stepBtn}
                onPress={() => setAttempts((a) => Math.max(1, a - 1))}
                accessibilityLabel="Un essai de moins">
                <Icon name="remove" size={18} color={colors.text} />
              </Pressable>
              <Text style={s.stepValue}>{attempts}</Text>
              <Pressable style={s.stepBtn} onPress={() => setAttempts((a) => a + 1)} accessibilityLabel="Un essai de plus">
                <Icon name="add" size={18} color={colors.text} />
              </Pressable>
            </View>
          )}
          {discipline === 'voie' && (
            <>
              <Text style={s.subTitle}>Grimpée en</Text>
              <Segmented
                options={(Object.keys(ROPE_LABELS) as Rope[]).map((r) => ({ value: r, label: ROPE_LABELS[r] }))}
                value={rope}
                onChange={setRope}
              />
            </>
          )}
        </FormCard>

        <FormCard title="Photo">
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={s.photo} contentFit="cover" />
          ) : (
            <View style={s.photoEmpty}>
              <Icon name="add_a_photo" size={30} color={colors.muted} />
              <Text style={s.muted}>Une photo t&apos;aide à retrouver le {kind}.</Text>
            </View>
          )}
          <View style={s.row}>
            <Button
              label="Appareil photo"
              icon="photo_camera"
              size="sm"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => takePhoto('camera')}
            />
            <Button
              label="Galerie"
              icon="photo_library"
              size="sm"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => takePhoto('library')}
            />
          </View>
        </FormCard>

        {session ? null : outdoor ? (
          <FormCard title="Site ou secteur">
            <TextInput
              style={ui.input}
              value={site}
              onChangeText={setSite}
              placeholder="Ex. Val-David, Dame Blanche"
              placeholderTextColor={colors.muted}
            />
            {sites.length > 0 && (
              <View style={s.wrap}>
                {sites.map((x) => (
                  <Chip key={x} label={x} selected={site.trim() === x} onPress={() => setSite(x)} />
                ))}
              </View>
            )}
          </FormCard>
        ) : (
          <FormCard title="Salle">
            {orderedGyms.length === 0 ? (
              <Text style={s.muted}>Recherche des salles autour de toi…</Text>
            ) : (
              <View style={s.wrap}>
                {orderedGyms.map((g) => (
                  <Chip key={g.id} label={g.name} selected={g.id === selectedGym} onPress={() => setSelectedGym(g.id)} />
                ))}
              </View>
            )}
          </FormCard>
        )}

        {!outdoor && (
          <FormCard title="Couleur des prises">
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
          </FormCard>
        )}

        <FormCard title="Détails" hint="facultatif">
          <TextInput
            style={ui.input}
            value={name}
            onChangeText={setName}
            placeholder={discipline === 'bloc' ? 'Nom du bloc' : 'Nom de la voie'}
            placeholderTextColor={colors.muted}
          />
          <ChipGroup title="Profil du mur" items={STYLES} selected={styles} onChange={setStyles} />
          <ChipGroup title="Types de prises" items={HOLD_TYPES} selected={holds} onChange={setHolds} />
          <ChipGroup title="Mouvements" items={MOVE_TYPES} selected={moves} onChange={setMoves} />
          <Text style={s.subTitle}>Cotation ressentie</Text>
          <View style={s.wrap}>
            {(Object.keys(FEEL_LABELS) as Feel[]).map((f) => (
              <Chip key={f} label={FEEL_LABELS[f]} selected={feel === f} onPress={() => setFeel(feel === f ? null : f)} />
            ))}
          </View>
          {!session && (
            <>
              <Text style={s.subTitle}>Date</Text>
              <TextInput
                style={ui.input}
                value={date}
                onChangeText={setDate}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor={colors.muted}
              />
            </>
          )}
          <Text style={s.subTitle}>Note</Text>
          <TextInput
            style={[ui.input, { minHeight: 96, textAlignVertical: 'top' }]}
            value={note}
            onChangeText={setNote}
            placeholder="Méthode, sensations…"
            placeholderTextColor={colors.muted}
            multiline
          />
        </FormCard>
      </ScrollView>

      <View style={[s.bar, { paddingBottom: insets.bottom + space.md }]}>
        <Button label="Annuler" variant="secondary" onPress={() => router.back()} style={s.cancel} />
        <Button label="Enregistrer" icon="check" onPress={save} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function FormCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card style={s.card}>
      <Text style={s.cardTitle}>
        {title}
        {hint ? <Text style={s.hint}>{`  ${hint}`}</Text> : null}
      </Text>
      {children}
    </Card>
  );
}

function ChipGroup({
  title,
  items,
  selected,
  onChange,
}: {
  title: string;
  items: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <>
      <Text style={s.subTitle}>{title}</Text>
      <View style={s.wrap}>
        {items.map((it) => (
          <Chip key={it} label={it} selected={selected.includes(it)} onPress={() => onChange(toggle(selected, it))} />
        ))}
      </View>
    </>
  );
}

const s = themedStyles({
  screen: { flex: 1 },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  group: { gap: space.sm },
  card: { gap: space.md },
  cardTitle: { ...type.headline },
  hint: { fontSize: 13, fontWeight: '500', color: colors.muted },
  subTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: space.xs },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md },
  photoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.xl,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  muted: { fontSize: 14, fontWeight: '400', color: colors.muted, textAlign: 'center' },
  label: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: 18, fontWeight: '700', minWidth: 28, textAlign: 'center', color: colors.text },
  bar: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancel: { paddingHorizontal: space.xl },
});
