import * as Notifications from 'expo-notifications';

import { isValidReminderTime, scheduleAppointmentNotification, scheduleMedicationNotifications, secondDailyTime } from '@/src/lib/notifications';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined), removeItem: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-1'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('Care reminders', () => {
  test('CASE-059 permitted appointment alert names the patient', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    const result = await scheduleAppointmentNotification({ id: 'visit-2', title: 'Checkup', appointmentAt: new Date(Date.now() + 86_400_000).toISOString(), elderlyName: 'Maria', doctorName: 'Dr. Kevin' }, false);
    expect(result).toBe(true);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ content: expect.objectContaining({ body: expect.stringContaining('Maria') }) }));
  });
});
