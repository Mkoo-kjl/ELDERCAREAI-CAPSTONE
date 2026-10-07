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
jest.mock('@/src/components/PickerModal', () => ({ PickerModal: () => null }));

beforeEach(() => { jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); });
afterEach(() => jest.restoreAllMocks());

describe('Care plan screen', () => {
  test('CASE-043 malformed medication time is rejected before saving', async () => {
    await render(<CareScreen />);
    await fireEvent.press(screen.getByLabelText('Add Medication'));
    await fireEvent.changeText(screen.getByLabelText('Medication name'), 'Losartan');
    await fireEvent.changeText(screen.getByLabelText('Reminder time (24-hour HH:MM)'), '25:00');
    await fireEvent.press(screen.getByText('Save'));
    expect(Alert.alert).toHaveBeenCalledWith('Invalid reminder time', expect.stringContaining('HH:MM'));
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
