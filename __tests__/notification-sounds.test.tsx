import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';

import { initializeNotifications,scheduleAppointmentNotification, scheduleMedicationNotifications } from '@/src/lib/notifications';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4, MAX: 5 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-1'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('custom care notification sounds', () => {
  it('creates a fresh audible health channel for Android',async()=>{
    const previous=Platform.OS;Object.defineProperty(Platform,'OS',{value:'android',configurable:true});
    try{
      await initializeNotifications();
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('health-warnings-v2',expect.objectContaining({sound:'health_warning.wav',importance:4,enableVibrate:true}));
    }finally{Object.defineProperty(Platform,'OS',{value:previous,configurable:true});}
  });
  it('uses happy bells for medication reminders', async () => {
    await scheduleMedicationNotifications({
      id: 'med-1', medicationName: 'Metformin', frequency: 'Daily',
      timesOfDay: ['17:00'], elderlyName: 'Maria',
    }, false);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({ sound: 'medication_reminder.wav' }),
      trigger: expect.objectContaining({ channelId: 'medication-reminders-v2' }),
    }));
  });

  it('uses marimba for appointment reminders', async () => {
    await scheduleAppointmentNotification({
      id: 'appt-1', title: 'Checkup', elderlyName: 'Maria',
      appointmentAt: new Date(Date.now() + 86_400_000).toISOString(),
    }, false);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({ sound: 'appointment_reminder.wav' }),
      trigger: expect.objectContaining({ channelId: 'appointment-reminders-v2' }),
    }));
  });

});
