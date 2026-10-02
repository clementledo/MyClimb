import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { getSetting, setSetting } from './db';
import { DEMO_WALL_JPEG } from './demoWall';
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

/** Voie d'exemple (photo fournie avec l'app) pour essayer la simulation sans photo. */
export async function demoRoute(): Promise<SimRoute> {
  const bin = atob(DEMO_WALL_JPEG);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dest = new File(photoDir(), `sim-demo-${Date.now()}.jpg`);
  dest.create();
  dest.write(bytes);
  return {
    id: `demo-${Date.now()}`,
    photo: dest.uri,
    width: 900,
    height: 1200,
    size: 1,
    hands: [
      { x: 0.45, y: 0.62 },
      { x: 0.62, y: 0.48 },
      { x: 0.38, y: 0.36 },
      { x: 0.58, y: 0.22 },
      { x: 0.5, y: 0.08 },
    ],
    feet: [
      { x: 0.4, y: 0.9 },
      { x: 0.6, y: 0.84 },
      { x: 0.42, y: 0.72 },
      { x: 0.63, y: 0.66 },
      { x: 0.4, y: 0.52 },
    ],
  };
}
