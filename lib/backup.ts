/**
 * Sauvegarde et restauration de toutes les données de l'app dans un seul fichier :
 * les tables de la base (séances, grimpes, salles, spots, réglages, voies de simulation)
 * et les photos, encodées dans le fichier.
 */
import { Directory, File } from 'expo-file-system';

import { db } from './db';
import { photoDir } from './photos';

const FORMAT = 1;
/** Le cache des cartes se reconstruit tout seul : inutile de le sauvegarder. */
const SKIP = new Set(['cache']);

const tables = () =>
  db
    .getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .map((t) => t.name)
    .filter((t) => !SKIP.has(t));

const photoFiles = () => photoDir().list().filter((f): f is File => f instanceof File);

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}h${p(d.getMinutes())}`;
};

/**
 * Écrit la sauvegarde dans un dossier choisi par l'utilisateur (Téléchargements, Drive…).
 * Renvoie le nom du fichier, ou null si l'utilisateur a annulé.
 */
export async function exportBackup(): Promise<{ name: string; photos: number } | null> {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return null;
  }
  const name = `MyClimb-sauvegarde-${stamp()}.json`;
  const out = dir.createFile(name, 'application/json');
  const data: Record<string, unknown[]> = {};
  for (const t of tables()) data[t] = db.getAllSync(`SELECT * FROM "${t}"`);
  const head = {
    app: 'MyClimb',
    format: FORMAT,
    date: new Date().toISOString(),
    photoBase: photoDir().uri,
    tables: data,
  };
  const json = JSON.stringify(head);
  out.write(json.slice(0, -1) + ',"photos":{');
  // Les photos une par une, pour ne pas tout charger en mémoire d'un coup.
  const photos = photoFiles();
  photos.forEach((f, i) => {
    out.write(`${i ? ',' : ''}${JSON.stringify(f.name)}:"${f.base64Sync()}"`, { append: true });
  });
  out.write('}}', { append: true });
  return { name, photos: photos.length };
}

type Backup = {
  app: string;
  format: number;
  date: string;
  photoBase: string;
  tables: Record<string, Record<string, unknown>[]>;
  photos: Record<string, string>;
};

/** Lit un fichier de sauvegarde choisi par l'utilisateur. Null si annulé. */
export async function pickBackup(): Promise<Backup | null> {
  const res = await File.pickFileAsync({ mimeTypes: ['application/json', 'application/octet-stream', '*/*'] });
  if (res.canceled) return null;
  let backup: Backup;
  try {
    backup = JSON.parse(await res.result.text());
  } catch {
    throw new Error('Ce fichier n’est pas une sauvegarde MyClimb.');
  }
  if (backup?.app !== 'MyClimb' || typeof backup.tables !== 'object') {
    throw new Error('Ce fichier n’est pas une sauvegarde MyClimb.');
  }
  if (backup.format > FORMAT) throw new Error('Cette sauvegarde vient d’une version plus récente de l’app : mets-la à jour.');
  return backup;
}

/** Remplace toutes les données de l'app par celles de la sauvegarde. */
export function restoreBackup(backup: Backup) {
  const dir = photoDir();
  // Les chemins des photos changent d'un téléphone à l'autre : on les fait pointer vers ce téléphone.
  const fix = (v: unknown) =>
    typeof v === 'string' && backup.photoBase && v.includes(backup.photoBase) ? v.split(backup.photoBase).join(dir.uri) : v;
  for (const [name, b64] of Object.entries(backup.photos ?? {})) {
    if (name.includes('/')) continue;
    const f = new File(dir, name);
    if (!f.exists) f.create();
    f.write(b64, { encoding: 'base64' });
  }
  const local = new Set(tables());
  db.withTransactionSync(() => {
    for (const [table, rows] of Object.entries(backup.tables)) {
      if (!local.has(table)) continue;
      const cols = new Set(db.getAllSync<{ name: string }>(`PRAGMA table_info("${table}")`).map((c) => c.name));
      db.runSync(`DELETE FROM "${table}"`);
      for (const row of rows) {
        const keys = Object.keys(row).filter((k) => cols.has(k));
        if (!keys.length) continue;
        db.runSync(
          `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map((k) => fix(row[k]) as string | number | null),
        );
      }
    }
  });
}
