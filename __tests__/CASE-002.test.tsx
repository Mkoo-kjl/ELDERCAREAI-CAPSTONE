import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LoginScreen from '@/app/login';
import { useAuth } from '@/src/providers/AuthProvider';

const mockReplace = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
    useRouter: () => ({ replace: mockReplace }),
  };
});
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: ({ children, ...props }: { children: React.ReactNode }) => React.createElement(View, props, children) };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/src/lib/supabase', () => ({ isSupabaseConfigured: true }));

const mockUseAuth = useAuth as jest.Mock;
const signInWithGoogle = jest.fn();
const clearAuthError = jest.fn();

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    session: null,
    onboarding: null,
    isLoading: false,
    isOnboardingLoading: false,
    isSigningIn: false,
    authError: null,
    signInWithGoogle,
    clearAuthError,
  });
});

describe('Google caregiver sign-in', () => {
  test('CASE-002 starts Google sign-in and redirects only on success', async () => {
    signInWithGoogle.mockResolvedValue(true);
    await render(<LoginScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Sign in with Google' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(clearAuthError).toHaveBeenCalledTimes(1);
  });
});
