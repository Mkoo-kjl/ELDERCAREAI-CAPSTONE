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
  test('CASE-057 as-needed medication does not schedule a timed alert', async () => {
    const result = await scheduleMedicationNotifications({ id: 'med-1', medicationName: 'Pain relief', frequency: 'As needed', timesOfDay: [], elderlyName: 'Maria' });
    expect(result).toBe(true);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
