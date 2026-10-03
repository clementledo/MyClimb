import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { colors, themedStyles } from '@/lib/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Introuvable' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Cette page n&apos;existe pas.</Text>
        <Link href="/" style={styles.link}>
          Retour aux salles
        </Link>
      </View>
    </>
  );
}

const styles = themedStyles({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '600', fontSize: 15 },
});
