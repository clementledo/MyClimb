import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { getSetting, setSetting } from './db';
import { deletePhoto, photoDir } from './photos';
import type { Pt } from './simulation';

/** Une voie à simuler : une photo et les prises touchées dessus (coordonnées de 0 à 1). */
export type SimRoute = {
  id: string;
  photo: string;
  width: number;
  height: number;
  hands: Pt[];
  feet: Pt[];
  /** Taille du grimpeur, en multiple de la taille calculée. */
  size: number;
};

const KEY = 'simulation';

export function listSimRoutes(): SimRoute[] {
  try {
    return JSON.parse(getSetting(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveSimRoutes(routes: SimRoute[]) {
  setSetting(KEY, JSON.stringify(routes));
}

export function removeSimRoute(routes: SimRoute[], id: string) {
  const r = routes.find((x) => x.id === id);
  if (r) deletePhoto(r.photo);
  return routes.filter((x) => x.id !== id);
}

const MAX_SIDE = 1280;

/** Prend une photo ou en choisit plusieurs ; elles sont réduites et copiées dans l'app. */
export async function pickRoutePhotos(source: 'camera' | 'library'): Promise<SimRoute[]> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Autorisation refusée.');
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: 10,
        });
  if (res.canceled) return [];

  const routes: SimRoute[] = [];
  for (const [i, asset] of res.assets.entries()) {
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > MAX_SIDE) {
      ctx.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const img = await ctx.renderAsync();
    const saved = await img.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    const dest = new File(photoDir(), `sim-${Date.now()}-${i}.jpg`);
    new File(saved.uri).copy(dest);
    routes.push({
      id: `${Date.now()}-${i}`,
      photo: dest.uri,
      width: saved.width,
      height: saved.height,
      hands: [],
      feet: [],
      size: 1,
    });
  }
  return routes;
}
