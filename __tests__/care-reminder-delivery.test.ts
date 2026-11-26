import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import {cancelCareNotifications,phoneAppointmentDelivery,scheduleAppointmentNotification,scheduleMedicationNotifications} from '@/src/lib/notifications';

const mockStore=new Map<string,string>();
const mockPending=new Map<string,any>();
jest.mock('@react-native-async-storage/async-storage',()=>({__esModule:true,default:{
  getItem:jest.fn(async(key:string)=>mockStore.get(key)??null),
  setItem:jest.fn(async(key:string,value:string)=>{mockStore.set(key,value);}),
  removeItem:jest.fn(async(key:string)=>{mockStore.delete(key);}),
}}));
jest.mock('expo-notifications',()=>({
  AndroidImportance:{HIGH:4,MAX:5},SchedulableTriggerInputTypes:{DATE:'date',DAILY:'daily',WEEKLY:'weekly'},
  setNotificationHandler:jest.fn(),setNotificationChannelAsync:jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync:jest.fn().mockResolvedValue({granted:true}),
  getAllScheduledNotificationsAsync:jest.fn(async()=>[...mockPending.values()]),
  scheduleNotificationAsync:jest.fn(async(request:any)=>{mockPending.set(request.identifier,request);return request.identifier;}),
  cancelScheduledNotificationAsync:jest.fn(async(id:string)=>{mockPending.delete(id);}),
}));
const due=new Date('2026-11-22T06:55:00Z');
const clock=`${String(due.getHours()).padStart(2,'0')}:${String(due.getMinutes()).padStart(2,'0')}`;
const medication={id:'same-id',caregiverId:'owner',elderlyId:'patient',medicationName:'Test prescription',frequency:'Daily',timesOfDay:[clock],elderlyName:'Patient'};
const appointment={id:'same-id',caregiverId:'owner',elderlyId:'patient',title:'Checkup',appointmentAt:due.toISOString(),elderlyName:'Patient'};
const originalPlatform=Platform.OS;
beforeEach(()=>{
  jest.useFakeTimers();jest.setSystemTime(new Date('2026-11-22T06:50:00Z'));
  Object.defineProperty(Platform,'OS',{value:'android',configurable:true});
  mockStore.clear();mockPending.clear();
});
afterEach(()=>{jest.useRealTimers();Object.defineProperty(Platform,'OS',{value:originalPlatform,configurable:true});});

test('same-time medication and appointment keep separate IDs, channels and phone delivery slots',async()=>{
  expect(await Promise.all([scheduleMedicationNotifications(medication,false),scheduleAppointmentNotification(appointment,false)])).toEqual([true,true]);
  const requests=[...mockPending.values()],med=requests.find(item=>item.content.data.care_kind==='medication'),visit=requests.find(item=>item.content.data.care_kind==='appointment');
  expect(requests).toHaveLength(2);
  expect(med.identifier).not.toBe(visit.identifier);
  expect(med.trigger.channelId).not.toBe(visit.trigger.channelId);
  expect(visit.trigger.date.getTime()-due.getTime()).toBe(8000);
  expect(visit.content.data.scheduled_time).toBe(due.toISOString());
});

test('a refresh immediately before due time does not cancel either unchanged alarm',async()=>{
  await Promise.all([scheduleMedicationNotifications(medication,false),scheduleAppointmentNotification(appointment,false)]);
  jest.setSystemTime(new Date(due.getTime()-500));
  (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
  (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();
  await Promise.all([scheduleMedicationNotifications(medication,false),scheduleAppointmentNotification(appointment,false)]);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(mockPending.size).toBe(2);
});

test('editing a medication reschedules only that medication and supports old stored IDs',async()=>{
  await Promise.all([scheduleMedicationNotifications(medication,false),scheduleAppointmentNotification(appointment,false)]);
  (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();
  await scheduleMedicationNotifications({...medication,dosage:'Updated saved dosage'},false);
  expect((Notifications.cancelScheduledNotificationAsync as jest.Mock).mock.calls.every(([id])=>id.startsWith('medication:'))).toBe(true);
  await AsyncStorage.setItem('eldercare-notification:medication:legacy',JSON.stringify(['old-alarm']));
  await cancelCareNotifications('medication','legacy');
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-alarm');
});

test('the phone-only gap preserves later seconds and does not alter iOS appointment times',()=>{
  const later=new Date('2026-11-22T06:55:20Z');
  expect(phoneAppointmentDelivery(later).getTime()).toBe(later.getTime());
  Object.defineProperty(Platform,'OS',{value:'ios',configurable:true});
  expect(phoneAppointmentDelivery(due).getTime()).toBe(due.getTime());
});

test('an already delivered advance reminder does not cancel the appointment due alarm',async()=>{
  const visit={...appointment,appointmentAt:'2026-11-22T07:55:00Z'};
  await scheduleAppointmentNotification(visit,false);
  const advance=[...mockPending.keys()].find(id=>id.endsWith(':15'))!;
  mockPending.delete(advance);
  jest.setSystemTime(new Date('2026-11-22T07:45:00Z'));
  (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();
  (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
  expect(await scheduleAppointmentNotification(visit,false)).toBe(true);
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(mockPending.size).toBe(1);
});
