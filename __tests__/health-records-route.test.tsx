import { render, screen } from '@testing-library/react-native';

import RootLayout from '@/app/_layout';
import TabLayout from '@/app/(tabs)/_layout';

let mockUserId = 'caregiver-1';
const mockProviderMounted = jest.fn();

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-notifications', () => ({
  getLastNotificationResponse: () => null,
  addNotificationResponseReceivedListener: () => ({ remove: jest.fn() }),
  clearLastNotificationResponse: jest.fn(),
}));
jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stack = ({ children }: { children: React.ReactNode }) => React.createElement(View, { testID: 'root-stack' }, children);
  Stack.Screen = () => null;
  const Tabs = ({ children }: { children: React.ReactNode }) => React.createElement(View, { testID: 'tabs' }, children);
  Tabs.Screen = () => null;
  return { Stack, Tabs, Redirect: () => null, router: { push: jest.fn() } };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/src/providers/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ session: { user: { id: mockUserId } }, onboarding: { completed_at: '2026-10-01' }, isLoading: false, isOnboardingLoading: false }),
}));
jest.mock('@/src/providers/ThemePreferenceProvider', () => ({ ThemePreferenceProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/src/providers/HealthDataProvider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { HealthDataProvider: ({ children }: { children: React.ReactNode }) => {
    React.useEffect(() => { mockProviderMounted(); }, []);
    return React.createElement(View, { testID: 'health-provider' }, children);
  } };
});
jest.mock('@/src/lib/notifications', () => ({ initializeNotifications: jest.fn() }));
jest.mock('@/src/theme/typography', () => ({ appFontAssets: {}, fontFamily: { medium: 'System', bold: 'System' } }));

beforeEach(() => { mockUserId = 'caregiver-1'; });

it('provides health data to root-stack routes, including Manage health records', async () => {
  await render(<RootLayout />);
  expect(screen.getByTestId('root-stack').parent?.props.testID).toBe('health-provider');
});

it('does not mount another health provider inside tabs', async () => {
  await render(<TabLayout />);
  expect(screen.getByTestId('tabs')).toBeTruthy();
  expect(screen.queryByTestId('health-provider')).toBeNull();
});

it('resets the shared provider when the signed-in caregiver changes', async () => {
  const view = await render(<RootLayout />);
  expect(mockProviderMounted).toHaveBeenCalledTimes(1);
  mockUserId = 'caregiver-2';
  await view.rerender(<RootLayout />);
  expect(mockProviderMounted).toHaveBeenCalledTimes(2);
});
