import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

const LATEST = 'https://api.github.com/repos/clementledo/MyClimb/releases/latest';

export type Update = { version: string; url: string; size: number };

/** Numéro de fabrication : 12 pour « v1.0.12 ». */
const buildOf = (v: string | null | undefined) => Number(/(\d+)\s*$/.exec(v ?? '')?.[1] ?? 0);

export const currentVersion = () => Constants.expoConfig?.version ?? '1.0.0';

/** Cherche une version plus récente publiée sur GitHub. */
export async function checkForUpdate(): Promise<Update | null> {
  if (Platform.OS !== 'android') return null;
  const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const release: { tag_name: string; assets: { name: string; browser_download_url: string; size: number }[] } =
    await res.json();
  const apk = release.assets.find((a) => a.name.endsWith('.apk'));
  if (!apk || buildOf(release.tag_name) <= buildOf(currentVersion())) return null;
  return { version: release.tag_name, url: apk.browser_download_url, size: apk.size };
}

/** Télécharge l'APK puis ouvre l'installateur Android. */
export async function installUpdate(update: Update, onProgress: (ratio: number) => void) {
  const dest = new File(Paths.cache, 'MyClimb-update.apk');
  try {
    const file = await File.downloadFileAsync(update.url, dest, {
      idempotent: true,
      onProgress: ({ bytesWritten, totalBytes }) => {
        const total = totalBytes > 0 ? totalBytes : update.size;
        if (total > 0) onProgress(Math.min(1, bytesWritten / total));
      },
    });
    await startActivityAsync('android.intent.action.VIEW', {
      data: file.contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
  } catch {
    // En dernier recours, le navigateur télécharge l'APK.
    await Linking.openURL(update.url);
  }
}
