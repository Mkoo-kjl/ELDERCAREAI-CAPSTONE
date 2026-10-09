import * as Notifications from 'expo-notifications';

import { notifyAbnormalVital, scheduleAppointmentNotification, scheduleMedicationNotifications } from '@/src/lib/notifications';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-1'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('custom care notification sounds', () => {
  it('uses happy bells for medication reminders', async () => {
    await scheduleMedicationNotifications({
      id: 'med-1', medicationName: 'Metformin', frequency: 'Daily',
      timesOfDay: ['17:00'], elderlyName: 'Maria',
    }, false);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({ sound: 'medication_reminder.wav' }),
      trigger: expect.objectContaining({ channelId: 'medication-reminders-v1' }),
    }));
  });

  it('uses marimba for appointment reminders', async () => {
    await scheduleAppointmentNotification({
      id: 'appt-1', title: 'Checkup', elderlyName: 'Maria',
      appointmentAt: new Date(Date.now() + 86_400_000).toISOString(),
    }, false);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({ sound: 'appointment_reminder.wav' }),
      trigger: expect.objectContaining({ channelId: 'appointment-reminders-v1' }),
    }));
  });

  it('uses the alarm only for a new out-of-range health reading', async () => {
    await notifyAbnormalVital({ heart_rate_bpm: 111, spo2_percent: 97 }, 'Maria');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({ sound: 'health_warning.wav' }),
      trigger: { channelId: 'health-warnings-v1' },
    }));
  });

  it('does not sound the alarm for a reading within the app thresholds', async () => {
    await notifyAbnormalVital({ heart_rate_bpm: 81, spo2_percent: 98 }, 'Maria');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not schedule duplicate alarms when sync and realtime report the same reading', async () => {
    await Promise.all([
      notifyAbnormalVital({ heart_rate_bpm: 113 }, 'Maria'),
      notifyAbnormalVital({ heart_rate_bpm: 113 }, 'Maria'),
    ]);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});
