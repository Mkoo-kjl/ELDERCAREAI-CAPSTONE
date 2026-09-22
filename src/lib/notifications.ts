import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'care-reminders';
const STORAGE_PREFIX = 'eldercare-notification';
const HEALTH_COOLDOWN_KEY = `${STORAGE_PREFIX}:health-warning`;

export type CareNotificationKind = 'appointment' | 'medication';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function initializeNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Care reminders',
      description: 'Medication, appointment, and health notifications from ElderCareAI.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: '#38BDF8',
      sound: 'default',
      enableVibrate: true,
    });
  }
}

export async function hasNotificationPermission() {
  if (Platform.OS === 'web') return false;
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted;
}

export async function ensureNotificationPermission() {
  if (Platform.OS === 'web') return false;
  await initializeNotifications();
  if (await hasNotificationPermission()) return true;
  const permission = await Notifications.requestPermissionsAsync();
  return permission.granted;
}

function storageKey(kind: CareNotificationKind, entityId: string) {
  return `${STORAGE_PREFIX}:${kind}:${entityId}`;
}

async function saveIdentifiers(kind: CareNotificationKind, entityId: string, identifiers: string[]) {
  await AsyncStorage.setItem(storageKey(kind, entityId), JSON.stringify(identifiers));
}

export async function cancelCareNotifications(kind: CareNotificationKind, entityId: string) {
  const key = storageKey(kind, entityId);
  const saved = await AsyncStorage.getItem(key);
  if (saved) {
    const identifiers = JSON.parse(saved) as string[];
    await Promise.all(identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined)));
  }
  await AsyncStorage.removeItem(key);
}

export async function scheduleAppointmentNotification(input: {
  id: string;
  title: string;
  appointmentAt: string;
  elderlyName: string;
  doctorName?: string | null;
  location?: string | null;
}, requestPermission = true) {
  await cancelCareNotifications('appointment', input.id);
  const allowed = requestPermission ? await ensureNotificationPermission() : await hasNotificationPermission();
  if (!allowed) return false;
  const date = new Date(input.appointmentAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return false;
  const details = [input.doctorName, input.location].filter(Boolean).join(' • ');
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Appointment now: ${input.title}`,
      body: `${input.elderlyName}${details ? ` • ${details}` : ''}`,
      sound: 'default',
      data: { url: '/care?tab=Appointments', entityId: input.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: CHANNEL_ID,
    },
  });
  await saveIdentifiers('appointment', input.id, [identifier]);
  return true;
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
}

export function secondDailyTime(value: string) {
  const parsed = parseTime(value);
  if (!parsed) return value;
  const minutes = (parsed.hour * 60 + parsed.minute + 12 * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function isValidReminderTime(value: string) {
  return parseTime(value) !== null;
}

export async function scheduleMedicationNotifications(input: {
  id: string;
  medicationName: string;
  dosage?: string | null;
  frequency: string;
  timesOfDay: string[];
  elderlyName: string;
  startDate?: string | null;
}, requestPermission = true) {
  await cancelCareNotifications('medication', input.id);
  if (input.frequency.toLowerCase() === 'as needed' || !input.timesOfDay.length) return true;
  const allowed = requestPermission ? await ensureNotificationPermission() : await hasNotificationPermission();
  if (!allowed) return false;
  const identifiers: string[] = [];
  const weekly = input.frequency.toLowerCase() === 'weekly';
  const weekday = (input.startDate ? new Date(`${input.startDate}T12:00:00`) : new Date()).getDay() + 1;
  for (const value of input.timesOfDay) {
    const time = parseTime(value);
    if (!time) continue;
    const trigger = weekly
      ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: time.hour, minute: time.minute, channelId: CHANNEL_ID } as const
      : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: time.hour, minute: time.minute, channelId: CHANNEL_ID } as const;
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medication reminder',
        body: `${input.elderlyName}: Time for ${input.medicationName}${input.dosage ? ` (${input.dosage})` : ''}.`,
        sound: 'default',
        data: { url: '/care?tab=Medications', entityId: input.id },
      },
      trigger,
    });
    identifiers.push(identifier);
  }
  await saveIdentifiers('medication', input.id, identifiers);
  return identifiers.length > 0;
}

export async function notifyAbnormalVital(vital: { heart_rate_bpm?: number | null; spo2_percent?: number | null }, elderlyName: string) {
  if (!(await hasNotificationPermission())) return;
  const warnings: string[] = [];
  if (vital.heart_rate_bpm != null && (vital.heart_rate_bpm > 110 || vital.heart_rate_bpm < 50)) warnings.push(`heart rate ${vital.heart_rate_bpm} bpm`);
  if (vital.spo2_percent != null && vital.spo2_percent < 95) warnings.push(`SpO₂ ${vital.spo2_percent.toFixed(1)}%`);
  if (!warnings.length) return;
  const signature = warnings.join('|');
  const previous = await AsyncStorage.getItem(HEALTH_COOLDOWN_KEY);
  if (previous) {
    const parsed = JSON.parse(previous) as { signature: string; at: number };
    if (parsed.signature === signature && Date.now() - parsed.at < 60 * 60 * 1000) return;
  }
  await initializeNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Health reading needs attention',
      body: `${elderlyName}: ${warnings.join(' and ')}. Confirm the reading and seek qualified guidance when appropriate.`,
      sound: 'default',
      data: { url: '/alerts?tab=Alerts' },
    },
    trigger: null,
  });
  await AsyncStorage.setItem(HEALTH_COOLDOWN_KEY, JSON.stringify({ signature, at: Date.now() }));
}
