import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ProfileScreen from '@/app/(tabs)/profile';
import { supabase } from '@/src/lib/supabase';

const mockUpsert = jest.fn();

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn(), useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'caregiver-1', email: 'alex@example.com' } }, onboarding: { wearable_status: 'connected', paired_device_count: 1 }, refreshOnboarding: jest.fn(), signOut: jest.fn() }) }));
jest.mock('@/src/providers/HealthDataProvider', () => ({ useHealthData: () => ({ elderly: { elderly_id: 'patient-1', full_name: 'Maria', photo_url: null }, refresh: jest.fn() }) }));
jest.mock('@/src/providers/ThemePreferenceProvider', () => ({ useThemePreference: () => ({ isDark: false, toggleDarkMode: jest.fn() }) }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));
jest.mock('@/src/lib/notifications', () => ({ hasNotificationPermission: jest.fn().mockResolvedValue(false), ensureNotificationPermission: jest.fn().mockResolvedValue(false) }));
jest.mock('@/src/lib/pdf-reports', () => ({ exportHealthReportPdf: jest.fn(), exportMedicationReportPdf: jest.fn() }));
jest.mock('@/src/components/ProfilePhotoPicker', () => ({ ProfilePhotoPicker: () => null }));
jest.mock('@/src/components/GradientButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return { GradientButton: ({ label, onPress }: { label: string; onPress: () => void }) => React.createElement(Pressable, { onPress }, React.createElement(Text, null, label)) };
});

beforeEach(() => {
  (supabase.from as jest.Mock).mockImplementation(() => ({ upsert: mockUpsert }));
  mockUpsert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 'doctor-1', full_name: 'Dr. Kevin', phone: '+639171234567', photo_url: null }, error: null }) }) });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

async function openDoctor() {
  await fireEvent.press(screen.getByText('Add'));
}

describe('Saved doctor contact', () => {
  test('CASE-060 Settings shows an empty doctor contact state', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText('No doctor saved')).toBeTruthy();
    expect(screen.getByText('Add')).toBeTruthy();
  });
});
