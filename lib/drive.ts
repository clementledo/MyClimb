/**
 * Sauvegarde sur le Google Drive de l'utilisateur, dans le dossier caché réservé à l'app
 * (appDataFolder) : gratuit, sans serveur, invisible dans la liste de ses fichiers.
 */
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { File } from 'expo-file-system';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export const DRIVE_NAME = 'MyClimb-sauvegarde.json';

let configured = false;
const setup = () => {
  if (configured) return;
  GoogleSignin.configure({ scopes: [SCOPE] });
  configured = true;
};

/** Message lisible pour une erreur de connexion Google. */
const explain = (e: unknown): Error => {
  if (isErrorWithCode(e)) {
    if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return new Error('Les services Google ne sont pas disponibles sur ce téléphone.');
    // 10 = DEVELOPER_ERROR : l'app n'est pas (encore) déclarée dans Google Cloud.
    if (String(e.code) === '10') return new Error('Google refuse la connexion : l’app n’est pas encore déclarée dans Google Cloud.');
    if (e.code === '7' || /network/i.test(e.message)) return new Error('Pas de connexion internet.');
  }
  return e instanceof Error ? e : new Error(String(e));
};

/** Connexion Google (choix du compte). Renvoie l'adresse du compte, ou null si annulé. */
export async function driveSignIn(): Promise<string | null> {
  setup();
  try {
    await GoogleSignin.hasPlayServices();
    const res = await GoogleSignin.signIn();
    return isSuccessResponse(res) ? res.data.user.email : null;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw explain(e);
  }
}

export async function driveSignOut() {
  setup();
  await GoogleSignin.signOut().catch(() => null);
}

async function token(): Promise<string> {
  setup();
  try {
    if (!GoogleSignin.getCurrentUser()) {
      const res = await GoogleSignin.signInSilently();
      if (res.type !== 'success') throw new Error('Reconnecte ton compte Google dans les Paramètres.');
    }
    return (await GoogleSignin.getTokens()).accessToken;
  } catch (e) {
    throw explain(e);
  }
}

/** Appel à l'API Drive, avec un nouvel essai si le jeton a expiré. */
async function call<T>(run: (auth: Record<string, string>) => Promise<{ status: number; body: () => Promise<T> }>): Promise<T> {
  let tok = await token();
  let res = await run({ Authorization: `Bearer ${tok}` });
  if (res.status === 401) {
    await GoogleSignin.clearCachedAccessToken(tok);
    tok = await token();
    res = await run({ Authorization: `Bearer ${tok}` });
  }
  if (res.status < 200 || res.status >= 300) throw new Error(`Google Drive a répondu ${res.status}.`);
  return res.body();
}

const json = (r: Response) => ({ status: r.status, body: () => r.json() });

type DriveFile = { id: string; modifiedTime?: string; size?: string };

/** La sauvegarde déjà présente sur le Drive, s'il y en a une. */
export async function driveFind(): Promise<DriveFile | null> {
  const q = encodeURIComponent(`name = '${DRIVE_NAME}'`);
  const res = await call<{ files: DriveFile[] }>(async (auth) =>
    json(await fetch(`${API}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime,size)&orderBy=modifiedTime desc`, { headers: auth })),
  );
  return res.files[0] ?? null;
}

/** Envoie le fichier sur le Drive (remplace la sauvegarde précédente). */
export async function driveUpload(file: File) {
  let id = (await driveFind())?.id;
  if (!id) {
    const created = await call<DriveFile>(async (auth) =>
      json(
        await fetch(API, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: DRIVE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' }),
        }),
      ),
    );
    id = created.id;
  }
  // Envoi direct depuis le fichier, sans le charger en mémoire.
  await call(async (auth) => {
    const r = await file.upload(`${UPLOAD}/${id}?uploadType=media`, {
      httpMethod: 'PATCH',
      headers: { ...auth, 'Content-Type': 'application/json' },
    });
    return { status: r.status, body: async () => r.body };
  });
}

/** Télécharge la sauvegarde du Drive dans `dest`. Faux s'il n'y en a pas. */
export async function driveDownload(dest: File): Promise<boolean> {
  const found = await driveFind();
  if (!found) return false;
  const tok = await token();
  await File.downloadFileAsync(`${API}/${found.id}?alt=media`, dest, {
    headers: { Authorization: `Bearer ${tok}` },
    idempotent: true,
  });
  return true;
}
