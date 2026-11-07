import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';

import ProfileScreen from '@/app/(tabs)/profile';
import { supabase } from '@/src/lib/supabase';

const mockDoctor = { id: 'doctor-1', full_name: 'Dr. Kevin', phone: '+639171234567', photo_url: null };

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn(), useRouter: () => ({ push: jest.fn() }) }));
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: false, canAskAgain: true }) }));
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

export function prepareDoctorCase({ saved = false, saveError = null }: { saved?: boolean; saveError?: Error | null } = {}) {
  const upsert = jest.fn();
  const update = jest.fn();
  const doctorQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: saved ? mockDoctor : null, error: null }),
    upsert,
    update,
  };
  const savedResult = { data: saveError ? null : { ...mockDoctor, full_name: 'Dr. Kevin Santos' }, error: saveError };
  const saveQuery = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(savedResult),
  };
  upsert.mockReturnValue(saveQuery);
  update.mockReturnValue(saveQuery);
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'doctor_contacts') return doctorQuery;
    if (table === 'caregivers') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    throw new Error(`Unexpected table ${table}`);
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  return { upsert, update, doctorQuery, saveQuery };
}

export async function openDoctorForm(saved = false) {
  await render(<ProfileScreen />);
  if (saved) {
    await act(async () => { (useFocusEffect as jest.Mock).mock.calls[0][0](); });
    await waitFor(() => expect(screen.getByText('Dr. Kevin')).toBeTruthy());
  }
  await fireEvent.press(screen.getByText(saved ? 'Edit' : 'Add'));
}

export { fireEvent, screen, waitFor, Alert };
