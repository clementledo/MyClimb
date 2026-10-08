/**
 * Rappel quotidien des routines : une notification locale à l'heure choisie (sans serveur).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getSetting, setSetting } from './db';

const KEY = 'routineReminder';
const CHANNEL = 'rappels';

export type Reminder = { on: boolean; hour: number; minute: number };

export function readReminder(): Reminder {
  try {
    const r = JSON.parse(getSetting(KEY) ?? '') as Reminder;
    if (typeof r.hour === 'number' && typeof r.minute === 'number') return r;
  } catch {
    // Pas encore réglé.
  }
  return { on: false, hour: 18, minute: 0 };
}

export const formatTime = (r: Reminder) => `${r.hour} h ${String(r.minute).padStart(2, '0')}`;

/** Enregistre le rappel et le programme. Renvoie false si Android refuse les notifications. */
export async function applyReminder(r: Reminder): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!r.on) {
    setSetting(KEY, JSON.stringify(r));
    return true;
  }
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) {
    setSetting(KEY, JSON.stringify({ ...r, on: false }));
    return false;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Rappels de routine',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ta routine du jour t’attend',
      body: 'Quelques minutes de force ou de souplesse pour progresser. On y va ?',
      data: { url: '/entrainement' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: CHANNEL },
  });
  setSetting(KEY, JSON.stringify(r));
  return true;
}
