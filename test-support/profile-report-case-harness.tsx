import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ProfileScreen from '@/app/(tabs)/profile';
import { exportHealthReportPdf, exportMedicationReportPdf } from '@/src/lib/pdf-reports';
import { supabase } from '@/src/lib/supabase';

const mockPatient = { elderly_id: 'patient-1', full_name: 'Maria', photo_url: null };
let mockElderly: typeof mockPatient | null = mockPatient;

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn(), useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'caregiver-1', email: 'alex@example.com' } }, onboarding: { wearable_status: 'connected', paired_device_count: 1 }, refreshOnboarding: jest.fn(), signOut: jest.fn() }) }));
jest.mock('@/src/providers/HealthDataProvider', () => ({ useHealthData: () => ({ elderly: mockElderly, refresh: jest.fn() }) }));
jest.mock('@/src/providers/ThemePreferenceProvider', () => ({ useThemePreference: () => ({ isDark: false, toggleDarkMode: jest.fn() }) }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));
jest.mock('@/src/lib/notifications', () => ({ hasNotificationPermission: jest.fn().mockResolvedValue(false), ensureNotificationPermission: jest.fn().mockResolvedValue(false) }));
jest.mock('@/src/lib/pdf-reports', () => ({ exportHealthReportPdf: jest.fn(), exportMedicationReportPdf: jest.fn() }));
jest.mock('@/src/components/ProfilePhotoPicker', () => ({ ProfilePhotoPicker: () => null }));
jest.mock('@/src/components/GradientButton', () => ({ GradientButton: () => null }));

export const patient = mockPatient;
export const healthPdf = exportHealthReportPdf as jest.Mock;
export const medicationPdf = exportMedicationReportPdf as jest.Mock;
export const from = supabase.from as jest.Mock;

export function prepareReportCase(options: { elderly?: typeof mockPatient | null; data?: unknown[] | null; error?: Error | null } = {}) {
  mockElderly = options.elderly === undefined ? mockPatient : options.elderly;
  const result = { data: options.data ?? [], error: options.error ?? null };
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve),
  };
  from.mockReturnValue(query);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  return query;
}

export async function pressReport(label: 'Health vitals PDF' | 'Medication schedule PDF') {
  await render(<ProfileScreen />);
  fireEvent.press(screen.getByText(label));
}

export async function expectAlert(title: string, message: string) {
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(title, message));
}
