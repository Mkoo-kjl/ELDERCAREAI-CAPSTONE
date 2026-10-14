import * as Location from 'expo-location';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, AppState, Linking } from 'react-native';

import ProfileScreen from '@/app/(tabs)/profile';
import { ensureNotificationPermission, hasNotificationPermission } from '@/src/lib/notifications';
import { supabase } from '@/src/lib/supabase';

const mockSession = { user: { id: 'caregiver-1', email: 'alex@example.com' } };
const mockElderly = { elderly_id: 'patient-1', full_name: 'Maria', photo_url: null };
const mockRefresh = jest.fn();
const mockRefreshOnboarding = jest.fn();
const mockUpsert = jest.fn();
let mockOnboarding = { wearable_status: 'connected', paired_device_count: 1, location_permission: 'denied' };

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  },
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: jest.fn(), requestForegroundPermissionsAsync: jest.fn() }));
jest.mock('@/src/providers/AuthProvider', () => ({
  useAuth: () => ({ session: mockSession, onboarding: mockOnboarding, refreshOnboarding: mockRefreshOnboarding, signOut: jest.fn() }),
}));
jest.mock('@/src/providers/HealthDataProvider', () => ({ useHealthData: () => ({ elderly: mockElderly, refresh: mockRefresh }) }));
jest.mock('@/src/providers/ThemePreferenceProvider', () => ({ useThemePreference: () => ({ isDark: false, toggleDarkMode: jest.fn() }) }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/src/lib/notifications', () => ({ hasNotificationPermission: jest.fn(), ensureNotificationPermission: jest.fn() }));
jest.mock('@/src/lib/pdf-reports', () => ({ exportHealthReportPdf: jest.fn(), exportMedicationReportPdf: jest.fn() }));
jest.mock('@/src/components/ProfilePhotoPicker', () => ({ ProfilePhotoPicker: () => null }));
jest.mock('@/src/components/GradientButton', () => ({ GradientButton: () => null }));

const denied = { granted: false, canAskAgain: true, status: 'denied', expires: 'never' };
const granted = { granted: true, canAskAgain: true, status: 'granted', expires: 'never' };

beforeEach(() => {
  mockOnboarding = { wearable_status: 'connected', paired_device_count: 1, location_permission: 'denied' };
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue(denied);
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
  (hasNotificationPermission as jest.Mock).mockResolvedValue(false);
  (ensureNotificationPermission as jest.Mock).mockResolvedValue(true);
  mockUpsert.mockResolvedValue({ error: null });
  mockRefreshOnboarding.mockResolvedValue(null);
  (supabase.from as jest.Mock).mockImplementation(() => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: mockUpsert,
    };
    return query;
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

async function renderSettings() {
  const view = await render(<ProfileScreen />);
  await waitFor(() => expect(view.queryAllByText('Checking phone permission')).toHaveLength(0));
  return view;
}

it('shows current notification and phone-location permission states', async () => {
  const view = await renderSettings();
  expect(view.getByText('Allow phone location for manual syncs')).toBeTruthy();
  expect(view.getByText('Allow appointment, medication and health alerts')).toBeTruthy();
});

it('requests phone location and stores consent for manual syncs', async () => {
  const view = await renderSettings();
  await act(async () => { fireEvent.press(view.getByText('Phone location')); });
  expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
    user_id: 'caregiver-1', location_permission: 'granted', location_consent_at: expect.any(String),
  }), { onConflict: 'user_id' });
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  expect(mockRefreshOnboarding).toHaveBeenCalled();
});

it('directs the user to phone settings when location cannot be requested again', async () => {
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ ...denied, canAskAgain: false });
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  const view = await renderSettings();
  await act(async () => { fireEvent.press(view.getByText('Phone location')); });
  expect(Alert.alert).toHaveBeenCalledWith('Phone location is off', expect.any(String), expect.any(Array));
  const actions = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
  actions[1].onPress();
  expect(openSettings).toHaveBeenCalled();
  expect(mockUpsert).not.toHaveBeenCalled();
});

it('enables notifications and refreshes statuses after returning from phone settings', async () => {
  let onAppStateChange: ((state: string) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    onAppStateChange = listener as (state: string) => void;
    return { remove: jest.fn() };
  });
  const view = await renderSettings();
  await act(async () => { fireEvent.press(view.getByText('Care notifications')); });
  expect(ensureNotificationPermission).toHaveBeenCalled();
  expect(view.getByText('App notifications allowed; tap to manage')).toBeTruthy();

  (hasNotificationPermission as jest.Mock).mockResolvedValue(false);
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
  await act(async () => { onAppStateChange?.('active'); });
  expect(view.getByText('Allow appointment, medication and health alerts')).toBeTruthy();
  expect(view.getByText('Phone access allowed; enable sync location')).toBeTruthy();
});
