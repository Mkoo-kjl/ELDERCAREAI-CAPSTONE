import { render } from '@testing-library/react-native';
import IntroSetupScreen from '@/app/setup/intro';

jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/src/providers/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'caregiver-1' } }, refreshOnboarding: jest.fn() }),
}));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

it('keeps all intro copy available in scrollable slides', async () => {
  const view = await render(<IntroSetupScreen />);

  expect(view.getByText(/caregivers can review patient patterns without typing them in manually/)).toBeTruthy();
  expect(view.getByText(/Heart rate, blood oxygen, sleep, steps/)).toBeTruthy();
  expect(view.getByText(/After setup, Home and Elle can use saved care details/)).toBeTruthy();
  expect(view.getAllByTestId('intro-slide')).toHaveLength(3);
  expect(view.getAllByTestId('intro-feature-row')).toHaveLength(4);
  view.getAllByTestId('intro-feature-row').forEach((row) => {
    expect(row.children).toHaveLength(2);
  });
});
