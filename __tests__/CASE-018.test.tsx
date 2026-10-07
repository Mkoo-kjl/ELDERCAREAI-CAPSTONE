import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import CaregiverSetupScreen from '@/app/setup/caregiver';
import { supabase } from '@/src/lib/supabase';

const mockReplace = jest.fn();
const mockUpsert = jest.fn();
const mockMaybeSingle = jest.fn();
const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: mockMaybeSingle,
  upsert: mockUpsert,
};
const mockRefreshOnboarding = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, href),
    useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
    useLocalSearchParams: () => ({}),
  };
});
jest.mock('@/src/providers/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'caregiver-1', email: 'alex@example.com', user_metadata: {} } },
    refreshOnboarding: mockRefreshOnboarding,
  }),
}));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/src/components/SetupScaffold', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { SetupScaffold: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children) };
});
jest.mock('@/src/components/ProfilePhotoPicker', () => ({ ProfilePhotoPicker: () => null }));
jest.mock('@/src/components/GradientButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return { GradientButton: ({ label, onPress }: { label: string; onPress: () => void }) => React.createElement(Pressable, { onPress }, React.createElement(Text, null, label)) };
});

const mockFrom = supabase.from as jest.Mock;

async function fillValidForm() {
  await fireEvent.changeText(screen.getByLabelText('Full name'), 'Alex Caregiver');
  await fireEvent.changeText(screen.getByLabelText('Phone'), '+63 917 123 4567');
  await fireEvent.changeText(screen.getByLabelText('Age'), '35');
  await fireEvent.press(screen.getByText('Female'));
}

beforeEach(() => {
  mockFrom.mockReturnValue(mockQuery);
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockUpsert.mockResolvedValue({ error: null });
  mockRefreshOnboarding.mockResolvedValue(null);
});

describe('Caregiver profile setup', () => {
  test('CASE-018 database failure shows an error and does not advance', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockUpsert.mockResolvedValueOnce({ error: { message: 'Save unavailable' } });
    await render(<CaregiverSetupScreen />);
    await fillValidForm();
    await fireEvent.press(screen.getByText('Next'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Unable to save', 'Caregiver profile save failed: Save unavailable'));
    expect(mockReplace).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
