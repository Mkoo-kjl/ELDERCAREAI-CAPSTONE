import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ElderlySetupScreen from '@/app/setup/elderly';
import { supabase } from '@/src/lib/supabase';

const mockReplace = jest.fn();
const mockInsert = jest.fn();
const mockUpsert = jest.fn();
const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
  insert: mockInsert,
  upsert: mockUpsert,
};

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, href),
    useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
    useLocalSearchParams: () => ({}),
  };
});
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'caregiver-1' } }, refreshOnboarding: jest.fn().mockResolvedValue(null) }) }));
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

beforeEach(() => {
  (supabase.from as jest.Mock).mockReturnValue(mockQuery);
  mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockUpsert.mockResolvedValue({ error: null });
});

async function fillValidPatient() {
  await fireEvent.changeText(screen.getByLabelText('Full name'), 'Maria Santos');
  await fireEvent.changeText(screen.getByLabelText('Age'), '78');
  await fireEvent.press(screen.getByText('Female'));
  await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '65');
  await fireEvent.changeText(screen.getByLabelText('Height (cm)'), '160');
  await fireEvent.press(screen.getByText('O+'));
  await fireEvent.changeText(screen.getByLabelText('Emergency contact name'), 'Alex Santos');
  await fireEvent.changeText(screen.getByLabelText('Emergency contact phone'), '+63 917 123 4567');
}

describe('Older-adult profile setup', () => {
  test('CASE-023 valid patient saves and advances to wearable setup', async () => {
    await render(<ElderlySetupScreen />);
    await fillValidPatient();
    await fireEvent.press(screen.getByText('Save profile'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/setup/fitness'));
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ full_name: 'Maria Santos', age: 78, blood_type: 'O+' }));
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});
