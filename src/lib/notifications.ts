import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState, Linking, Platform } from 'react-native';

const CHANNEL_ID = 'care-reminders';
const MEDICATION_CHANNEL_ID = 'medication-reminders-v2';
const APPOINTMENT_CHANNEL_ID = 'appointment-reminders-v2';
const HEALTH_CHANNEL_ID = 'health-warnings-v2';
const SOS_CHANNEL_ID = 'watch-sos-v2';
const MEDICATION_SOUND = 'medication_reminder.wav';
const APPOINTMENT_SOUND = 'appointment_reminder.wav';
const HEALTH_SOUND = 'health_warning.wav';
const STORAGE_PREFIX = 'eldercare-notification';

export type CareNotificationKind = 'appointment' | 'medication';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner: true,
    shouldShowList: true,
    // The foreground observer plays these once for both Realtime and push.
    shouldPlaySound: !(AppState.currentState==='active'&&['vital','sos'].includes(String(notification.request.content.data?.care_kind))),
    shouldSetBadge: true,
  }),
});

export async function initializeNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Care reminders',
      description: 'Health notifications from ElderCareAI.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: '#38BDF8',
      sound: 'default',
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync(MEDICATION_CHANNEL_ID, {
      name: 'Medication reminders',
      description: 'Reminders for scheduled medication.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: '#38BDF8',
      sound: MEDICATION_SOUND,
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync(APPOINTMENT_CHANNEL_ID, {
      name: 'Appointment reminders',
      description: 'Reminders for scheduled appointments.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: '#38BDF8',
      sound: APPOINTMENT_SOUND,
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync(HEALTH_CHANNEL_ID, {
      name: 'Health reading warnings',
      description: 'New readings that need caregiver attention.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: '#38BDF8',
      sound: HEALTH_SOUND,
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync(SOS_CHANNEL_ID, {
      name: 'Watch SOS',
      description: 'Emergency requests from the paired Galaxy Watch.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#EF4444',
      sound: 'sos_alert.wav',
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

export async function openHealthSoundSettings(){
  await initializeNotifications();
  if(Platform.OS==='android'){
    try{
      await Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS',[
        {key:'android.provider.extra.APP_PACKAGE',value:'com.eldercareai.mobile'},
        {key:'android.provider.extra.CHANNEL_ID',value:HEALTH_CHANNEL_ID},
      ]);
      return;
    }catch{ /* Fall back to the app's settings page. */ }
  }
  await Linking.openSettings();
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

export async function cancelAllCareNotifications() {
  const keys = await AsyncStorage.getAllKeys();
  const careKeys = keys.filter((key) => key.startsWith(`${STORAGE_PREFIX}:medication:`) || key.startsWith(`${STORAGE_PREFIX}:appointment:`));
  await Promise.all(careKeys.map(async (key) => {
    const saved = await AsyncStorage.getItem(key);
    if (!saved) return;
    try {
      const identifiers = JSON.parse(saved) as string[];
      await Promise.all(identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined)));
    } catch { /* Ignore malformed local reminder metadata. */ }
  }));
  if (careKeys.length) await AsyncStorage.multiRemove(careKeys);
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
  await initializeNotifications();
  const date = new Date(input.appointmentAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return false;
  const details = [input.doctorName, input.location].filter(Boolean).join(' • ');
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Appointment now: ${input.title}`,
      body: `${input.elderlyName}${details ? ` • ${details}` : ''}`,
      sound: APPOINTMENT_SOUND,
      data: { url: '/care?tab=Appointments', entityId: input.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: APPOINTMENT_CHANNEL_ID,
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
  await initializeNotifications();
  const identifiers: string[] = [];
  const weekly = input.frequency.toLowerCase() === 'weekly';
  const weekday = (input.startDate ? new Date(`${input.startDate}T12:00:00`) : new Date()).getDay() + 1;
  for (const value of input.timesOfDay) {
    const time = parseTime(value);
    if (!time) continue;
    const trigger = weekly
      ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: time.hour, minute: time.minute, channelId: MEDICATION_CHANNEL_ID } as const
      : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: time.hour, minute: time.minute, channelId: MEDICATION_CHANNEL_ID } as const;
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medication reminder',
        body: `${input.elderlyName}: Time for ${input.medicationName}${input.dosage ? ` (${input.dosage})` : ''}.`,
        sound: MEDICATION_SOUND,
        data: { url: '/care?tab=Medications', entityId: input.id },
      },
      trigger,
    });
    identifiers.push(identifier);
  }
  await saveIdentifiers('medication', input.id, identifiers);
  return identifiers.length > 0;
}
