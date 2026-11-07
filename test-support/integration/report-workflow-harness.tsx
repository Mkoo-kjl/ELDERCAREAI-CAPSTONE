import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ProfileScreen from '@/app/(tabs)/profile';
import { supabase } from '@/src/lib/supabase';

const mockPatient = {
  elderly_id: 'patient-1', full_name: 'Maria Santos', age: 74, gender: 'Female',
  weight_kg: 63, height_cm: 158, blood_type: 'O+', photo_url: null,
};

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn(), useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'caregiver-1', email: 'alex@example.com' } }, onboarding: { wearable_status: 'connected' }, refreshOnboarding: jest.fn(), signOut: jest.fn() }) }));
jest.mock('@/src/providers/HealthDataProvider', () => ({ useHealthData: () => ({ elderly: mockPatient, refresh: jest.fn() }) }));
jest.mock('@/src/providers/ThemePreferenceProvider', () => ({ useThemePreference: () => ({ isDark: false, toggleDarkMode: jest.fn() }) }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));
jest.mock('@/src/lib/notifications', () => ({ hasNotificationPermission: jest.fn().mockResolvedValue(false), ensureNotificationPermission: jest.fn().mockResolvedValue(false) }));
jest.mock('@/src/components/ProfilePhotoPicker', () => ({ ProfilePhotoPicker: () => null }));
jest.mock('@/src/components/GradientButton', () => ({ GradientButton: () => null }));
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ localUri: 'mock-logo', downloadAsync: jest.fn().mockResolvedValue(undefined) }) } }));
jest.mock('expo-file-system/legacy', () => ({ EncodingType: { Base64: 'base64' }, readAsStringAsync: jest.fn().mockResolvedValue('YWJj') }));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn().mockResolvedValue({ uri: 'file:///mock-report.pdf' }), printAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: jest.fn().mockResolvedValue(undefined) }));

export function prepareReportWorkflow(table: 'vital_sign_logs' | 'medication_schedules', data: Record<string, unknown>[]) {
  const result = { data, error: null };
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve),
  };
  (supabase.from as jest.Mock).mockImplementation((calledTable: string) => {
    if (calledTable !== table) throw new Error(`Unexpected table ${calledTable}`);
    return query;
  });
  return { query, from: supabase.from as jest.Mock };
}

export async function exportFromSettings(label: 'Health vitals PDF' | 'Medication schedule PDF') {
  await render(<ProfileScreen />);
  await fireEvent.press(screen.getByText(label));
  await waitFor(() => expect(Print.printToFileAsync).toHaveBeenCalled());
  return (Print.printToFileAsync as jest.Mock).mock.calls[0][0].html as string;
}

export { Print, Sharing, screen };
