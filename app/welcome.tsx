import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { AndroidSymbol } from 'expo-symbols';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon } from '@/components/ui';
import { setSetting } from '@/lib/db';
import { colors, radius, space, themedStyles, type } from '@/lib/theme';

const WELCOME_KEY = 'welcomed';

const FEATURES: { icon: AndroidSymbol; title: string; text: string }[] = [
  { icon: 'near_me', title: 'Trouve ta salle', text: 'Les salles autour de toi, avec le temps de trajet et le prix d’une séance.' },
  { icon: 'edit_note', title: 'Note tes grimpes', text: 'Cotation, couleur, photo et résultat, pendant ta séance, en quelques touches.' },
  { icon: 'insights', title: 'Suis ta progression', text: 'Ton niveau, ta pyramide et tes points faibles, semaine après semaine.' },
  { icon: 'view_in_ar', title: 'Simule une voie en 3D', text: 'Photographie une voie et regarde un grimpeur à ta taille la monter.' },
];

/** Écran d'accueil, affiché une seule fois au premier lancement. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const start = () => {
    setSetting(WELCOME_KEY, '1');
    router.back();
  };
  return (
    <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }]}>
      <ScrollView contentContainerStyle={s.content}>
        <Image source={require('@/assets/images/icon.png')} style={s.logo} />
        <Text style={s.title}>Bienvenue sur MyClimb</Text>
        <Text style={s.subtitle}>Ton carnet d’escalade, de la salle au rocher.</Text>
        <View style={s.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={s.feature}>
              <View style={s.featureIcon}>
                <Icon name={f.icon} size={24} color={colors.primary} />
              </View>
              <View style={s.featureBody}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={s.footer}>
        <Button label="Commencer" onPress={start} />
        <Text style={s.note}>Tes données restent sur ton téléphone. Change le thème et la police dans les Paramètres.</Text>
      </View>
    </View>
  );
}

const s = themedStyles({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xl, gap: space.sm },
  logo: { width: 64, height: 64, borderRadius: 18, marginBottom: space.md },
  title: { ...type.display, fontSize: 32 },
  subtitle: { ...type.body, fontSize: 17, color: colors.muted },
  features: { gap: space.lg, marginTop: space.xl },
  feature: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  featureBody: { flex: 1, gap: 3 },
  featureTitle: { ...type.headline },
  featureText: { fontSize: 14, fontWeight: '400', lineHeight: 20, color: colors.muted },
  footer: { paddingHorizontal: space.xl, gap: space.md },
  note: { fontSize: 12, fontWeight: '400', lineHeight: 17, color: colors.muted, textAlign: 'center' },
});
