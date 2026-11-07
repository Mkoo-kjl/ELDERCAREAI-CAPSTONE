import { render, screen } from '@testing-library/react-native';

import LoginScreen from '@/app/login';
import type { OnboardingProgress } from '@/src/providers/AuthProvider';

let mockProgress: OnboardingProgress | null = null;

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
    useRouter: () => ({ replace: jest.fn() }),
  };
});
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: ({ children, ...props }: { children: React.ReactNode }) => React.createElement(View, props, children) };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({
  session: { user: { id: 'caregiver-1' } }, onboarding: mockProgress,
  isLoading: false, isOnboardingLoading: false,
}) }));
jest.mock('@/src/lib/supabase', () => ({ isSupabaseConfigured: true }));

export async function routeSignedInCaregiver(progress: Partial<OnboardingProgress>) {
  mockProgress = progress as OnboardingProgress;
  await render(<LoginScreen />);
  return screen.getByTestId('redirect').props.children as string;
}
