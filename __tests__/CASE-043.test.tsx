import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import CareScreen from '@/app/(tabs)/care';
import { supabase } from '@/src/lib/supabase';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn(), useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'caregiver-1' } } }) }));
jest.mock('@/src/providers/HealthDataProvider', () => ({ useHealthData: () => ({ elderly: { elderly_id: 'patient-1', full_name: 'Maria' } }) }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/src/lib/notifications', () => ({
  cancelCareNotifications: jest.fn(),
  hasNotificationPermission: jest.fn().mockResolvedValue(false),
  isValidReminderTime: (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
  scheduleAppointmentNotification: jest.fn(),
  scheduleMedicationNotifications: jest.fn(),
  secondDailyTime: jest.fn(),
}));
jest.mock('@/src/components/PickerModal', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return { PickerModal: ({ visible, mode, onChange }: { visible: boolean; mode: string; onChange: (date: Date) => void }) => visible && mode === 'time'
    ? React.createElement(Pressable, { onPress: () => { const selected = new Date(); selected.setHours(17, 30); onChange(selected); } }, React.createElement(Text, null, 'Pick 5:30 PM'))
    : null };
});

beforeEach(() => { jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); });
afterEach(() => jest.restoreAllMocks());

describe('Care plan screen', () => {
  test('CASE-043 medication time is set with a time picker', async () => {
    await render(<CareScreen />);
    await fireEvent.press(screen.getByLabelText('Add Medication'));
    await fireEvent.press(screen.getByLabelText('Choose medication reminder time'));
    await fireEvent.press(screen.getByText('Pick 5:30 PM'));
    expect(screen.getAllByText(/5:30\s*PM/i).length).toBeGreaterThan(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
