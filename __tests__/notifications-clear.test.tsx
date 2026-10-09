import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import AlertsScreen from '@/app/(tabs)/alerts';
import { supabase } from '@/src/lib/supabase';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
    useLocalSearchParams: () => ({ tab: 'Notifications' }),
  };
});
jest.mock('expo-audio', () => ({ useAudioPlayer: () => ({ seekTo: jest.fn(), play: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => {
  const session = { user: { id: 'caregiver-1' } };
  return { useAuth: () => ({ session }) };
});
jest.mock('@/src/providers/HealthDataProvider', () => {
  const elderly = { elderly_id: 'patient-1', full_name: 'Maria' };
  return { useHealthData: () => ({ elderly, vital: null }) };
});
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const notifications = [
  { id: 'n1', title: 'Medication due', body: 'Take medication', is_read: false, sent_at: '2026-10-09T06:00:00Z', delivery_status: 'sent' },
  { id: 'n2', title: 'Appointment soon', body: 'Visit the doctor', is_read: true, sent_at: '2026-10-09T05:00:00Z', delivery_status: 'sent' },
];
const deleteCalls: Array<{ table: string; filters: Array<[string, string]> }> = [];

function queryFor(table: string) {
  const filters: Array<[string, string]> = [];
  const query = {
    select: () => query,
    eq: () => query,
    order: () => Promise.resolve({ data: table === 'caregiver_notifications' ? notifications : [], error: null }),
    delete: () => ({
      eq: (column: string, value: string) => {
        filters.push([column, value]);
        const deletion = {
          eq: (nextColumn: string, nextValue: string) => {
            filters.push([nextColumn, nextValue]);
            deleteCalls.push({ table, filters });
            return Promise.resolve({ error: null });
          },
          then: (resolve: (result: { error: null }) => void) => {
            deleteCalls.push({ table, filters });
            return Promise.resolve({ error: null }).then(resolve);
          },
        };
        return deletion;
      },
    }),
  };
  return query;
}

beforeEach(() => {
  deleteCalls.length = 0;
  (supabase.from as jest.Mock).mockImplementation(queryFor);
});
afterEach(() => jest.restoreAllMocks());

it('clears one saved notification without deleting health alerts', async () => {
  await render(<AlertsScreen />);
  await waitFor(() => expect(screen.getByText('Medication due')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByLabelText('Clear Medication due')); });
  await waitFor(() => expect(screen.queryByText('Medication due')).toBeNull());
  expect(screen.getByText('Appointment soon')).toBeTruthy();
  expect(deleteCalls).toEqual([{ table: 'caregiver_notifications', filters: [['id', 'n1'], ['caregiver_id', 'caregiver-1']] }]);
});

it('confirms before clearing all of this caregiver\'s notifications', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await render(<AlertsScreen />);
  await waitFor(() => expect(screen.getByText('Medication due')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Clear all notifications'));
  expect(screen.getByText('Medication due')).toBeTruthy();
  const buttons = alertSpy.mock.calls[0][2];
  await act(async () => { buttons?.find((button) => button.text === 'Clear all')?.onPress?.(); });
  await waitFor(() => expect(screen.getByText('No notifications')).toBeTruthy());
  expect(deleteCalls).toEqual([{ table: 'caregiver_notifications', filters: [['caregiver_id', 'caregiver-1']] }]);
});
