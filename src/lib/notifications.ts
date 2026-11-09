import {formatCareDateTime,parseCareTime,careZoneParts,medicationDayDoses} from './care-time';
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
let reminderEpoch=0;
export type CareNotificationKind = 'appointment' | 'medication';
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data=notification.request.content.data;
    const local=AppState.currentState==='active'&&data?.care_local_version===3&&['medication','appointment'].includes(String(data?.care_kind));
    const remote=AppState.currentState==='active'&&Boolean(data?.care_notification_id)&&['vital','sos','medication','appointment'].includes(String(data?.care_kind));
    return {
      // The foreground queue presents scoped local reminders in order, with audio.
      // Android still keeps every event in the notification list and presents
      // separate banners normally when the app is backgrounded.
      shouldShowBanner: !local,
      shouldShowList: true,
      shouldPlaySound: !local&&!remote,
      shouldSetBadge: true,
    };
  },
});
type ReminderOwner={caregiverId?:string;elderlyId?:string};
function reminderData(kind:CareNotificationKind,input:ReminderOwner&{id:string},scheduledTime?:string){
  return {url:`/care?tab=${kind==='medication'?'Medications':'Appointments'}`,entityId:input.id,care_kind:kind,
    ...(input.caregiverId&&input.elderlyId?{care_local_version:3,caregiver_id:input.caregiverId,elderly_id:input.elderlyId}:{}),
    ...(scheduledTime?{scheduled_time:scheduledTime}:{}),
  };
}
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
async function cancelCareNotificationsNow(kind: CareNotificationKind, entityId: string) {
  const key = storageKey(kind, entityId);
  const saved = await AsyncStorage.getItem(key);
  if (saved) {
    const identifiers = JSON.parse(saved) as string[];
    await Promise.all(identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined)));
  }
  await AsyncStorage.removeItem(key);
}
export async function cancelAllCareNotifications() {
  reminderEpoch++;
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
async function scheduleAppointmentNotificationNow(input: ReminderOwner & {
  id: string;
  title: string;
  appointmentAt: string;
  elderlyName: string;
  doctorName?: string | null;
  location?: string | null;
  purpose?: string | null;
}, requestPermission = true) {
  const epoch=reminderEpoch;
  await cancelCareNotificationsNow('appointment', input.id);
  const allowed = requestPermission ? await ensureNotificationPermission() : await hasNotificationPermission();
  if (!allowed) return false;
  await initializeNotifications();
  const date = new Date(input.appointmentAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return false;
  const details = [input.doctorName, input.location].filter(Boolean).join(' • ');
  const identifier = await Notifications.scheduleNotificationAsync({
    identifier: `appointment:${input.id}:${date.getTime()}`,
    content: {
      title: `Appointment now: ${input.title}`,
      body: `${input.elderlyName} • ${formatCareDateTime(date)}${details ? ` • ${details}` : ''}${input.purpose ? ` • ${input.purpose}` : ''}`,
      sound: APPOINTMENT_SOUND,
      data: reminderData('appointment',input,date.toISOString()),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: APPOINTMENT_CHANNEL_ID,
    },
  });
  const identifiers=[identifier];
  const advance=new Date(date.getTime()-15*60_000);
  if(advance.getTime()>Date.now())identifiers.push(await Notifications.scheduleNotificationAsync({
    identifier:`appointment:${input.id}:${date.getTime()}:15`,
    content:{title:`Appointment in 15 minutes: ${input.title}`,body:`${input.elderlyName} • ${formatCareDateTime(date)}${details?` • ${details}`:''}${input.purpose?` • ${input.purpose}`:''}`,sound:APPOINTMENT_SOUND,data:reminderData('appointment',input,date.toISOString())},
    trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:advance,channelId:APPOINTMENT_CHANNEL_ID},
  }));
  if(epoch!==reminderEpoch){await Promise.all(identifiers.map(id=>Notifications.cancelScheduledNotificationAsync(id).catch(()=>undefined)));return false;}
  await saveIdentifiers('appointment', input.id, identifiers);
  return true;
}
const parseTime = parseCareTime;
export function secondDailyTime(value: string) {
  const parsed = parseTime(value);
  if (!parsed) return value;
  const minutes = (parsed.hour * 60 + parsed.minute + 12 * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export function isValidReminderTime(value: string) {
  return parseTime(value) !== null;
}
async function scheduleMedicationNotificationsNow(input: ReminderOwner & {
  id: string;
  medicationName: string;
  dosage?: string | null;
  frequency: string;
  timesOfDay: string[];
  elderlyName: string;
  startDate?: string | null;
  endDate?: string | null;
  reminderEnabled?: boolean | null;
  timezone?:string;
}, requestPermission = true) {
  const epoch=reminderEpoch;
  await cancelCareNotificationsNow('medication', input.id);
  if (input.reminderEnabled === false || input.frequency.toLowerCase() === 'as needed' || !input.timesOfDay.length) return true;
  const allowed = requestPermission ? await ensureNotificationPermission() : await hasNotificationPermission();
  if (!allowed) return false;
  await initializeNotifications();
  const identifiers: string[] = [];
  const weekly = input.frequency.toLowerCase() === 'weekly';
  const weekday = (input.startDate ? new Date(`${input.startDate}T12:00:00`) : new Date()).getDay() + 1;
  for (const value of [...new Set(input.timesOfDay.map(value=>parseTime(value)?.canonical).filter((value):value is string=>Boolean(value)))]) {
    const time = parseTime(value);
    if (!time) continue;
    const trigger = weekly
      ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: time.hour, minute: time.minute, channelId: MEDICATION_CHANNEL_ID } as const
      : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: time.hour, minute: time.minute, channelId: MEDICATION_CHANNEL_ID } as const;
    const deviceZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Manila';
    const scheduleZone=input.timezone??deviceZone;
    const today=careZoneParts(new Date(),scheduleZone).day;
    const bounded=Boolean(input.endDate)||(input.startDate??'')>today||scheduleZone!==deviceZone;
    if(bounded){
      for(let offset=0;offset<28;offset++){
        const day=new Date(`${today}T12:00:00Z`);day.setUTCDate(day.getUTCDate()+offset);
        const due=medicationDayDoses({id:input.id,frequency:input.frequency,times_of_day:[time.canonical],start_date:input.startDate,end_date:input.endDate,timezone:scheduleZone},day.toISOString().slice(0,10))[0];
        if(!due||due.getTime()<=Date.now())continue;
        const id=await Notifications.scheduleNotificationAsync({identifier:`medication:${input.id}:${due.getTime()}`,content:{title:'Medication reminder',body:`${input.elderlyName}: Time for ${input.medicationName}${input.dosage?` (${input.dosage})`:''}.`,sound:MEDICATION_SOUND,data:reminderData('medication',input,due.toISOString())},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:due,channelId:MEDICATION_CHANNEL_ID}});
        identifiers.push(id);
      }
      continue;
    }
    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: `medication:${input.id}:${weekly ? weekday : 'daily'}:${time.canonical}`,
      content: {
        title: 'Medication reminder',
        body: `${input.elderlyName}: Time for ${input.medicationName}${input.dosage ? ` (${input.dosage})` : ''}.`,
        sound: MEDICATION_SOUND,
        data: reminderData('medication',input),
      },
      trigger,
    });
    identifiers.push(identifier);
  }
  if(epoch!==reminderEpoch){await Promise.all(identifiers.map(id=>Notifications.cancelScheduledNotificationAsync(id).catch(()=>undefined)));return false;}
  await saveIdentifiers('medication', input.id, identifiers);
  return identifiers.length > 0 || Boolean(input.endDate) || (input.startDate??'')>careZoneParts(new Date(),input.timezone).day;
}
// A refresh and save can reconcile the same entity concurrently. Serialize by
// entity, and use distinct OS identifiers for different entities at one instant.
const reminderLocks=new Map<string,Promise<unknown>>();
function serializeReminder<T>(key:string,operation:()=>Promise<T>):Promise<T>{
  const previous=reminderLocks.get(key)??Promise.resolve();
  const next=previous.catch(()=>undefined).then(operation);reminderLocks.set(key,next);
  void next.finally(()=>{if(reminderLocks.get(key)===next)reminderLocks.delete(key);}).catch(()=>undefined);return next;
}
export function cancelCareNotifications(kind:CareNotificationKind,id:string){return serializeReminder(`${kind}:${id}`,()=>cancelCareNotificationsNow(kind,id));}
export function scheduleAppointmentNotification(...args:Parameters<typeof scheduleAppointmentNotificationNow>){return serializeReminder(`appointment:${args[0].id}`,()=>scheduleAppointmentNotificationNow(...args));}
export function scheduleMedicationNotifications(...args:Parameters<typeof scheduleMedicationNotificationsNow>){return serializeReminder(`medication:${args[0].id}`,()=>scheduleMedicationNotificationsNow(...args));}
