import { render, screen, waitFor } from '@testing-library/react-native';

import DashboardScreen from '@/app/(tabs)/dashboard';
import { supabase } from '@/src/lib/supabase';

const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockPush = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react');
  return { useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]), useRouter: () => ({ push: mockPush }) };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'caregiver-1' } }, onboarding: { wearable_status: 'connected' } }) }));
jest.mock('@/src/providers/HealthDataProvider', () => ({ useHealthData: () => ({ elderly: { elderly_id: 'patient-1', full_name: 'Maria Santos', age: 78 }, vital: null, history: [], refreshing: false, error: null, syncState: 'idle', lastSuccessfulSyncAt: null, watchSync: null, watchSyncIssue: null, refresh: mockRefresh }) }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/src/hooks/useMinuteClock', () => ({ useMinuteClock: jest.fn() }));
jest.mock('@/src/components/MetricCard', () => ({ MetricCard: () => null }));
jest.mock('@/src/components/VitalDetailModal', () => ({ VitalDetailModal: () => null }));
jest.mock('@/src/components/GradientButton', () => ({ GradientButton: () => null }));
jest.mock('@/src/components/LocationMapPreview', () => ({ LocationMapPreview: () => null }));

const pastAppointment = { id: 'appt-1', title: 'Follow-up visit', doctor_name: null, appointment_at: '2025-05-10T10:00:00.000Z', status: 'scheduled' };

function queryFor(table: string) {
  let past = false;
  const query = {
    select: () => query,
    eq: () => query,
    gte: () => query,
    lt: () => { past = true; return query; },
    order: () => query,
    limit: () => query,
    maybeSingle: () => Promise.resolve(table === 'doctor_contacts'
      ? { data: null, error: { message: 'Doctor contact unavailable' } }
      : { data: null, error: null }),
    then: (resolve: (result: { data: unknown[]; error: null }) => void) => {
      const data = table === 'appointments' ? (past ? [pastAppointment] : [])
        : table === 'medication_schedules' ? [{ id: 'med-1', medication_name: 'Losartan', dosage: '50 mg', frequency: 'Daily', times_of_day: ['17:00'] }]
          : table === 'caregiver_notes' ? [{ id: 'note-1', title: 'Call family', content: 'Check in tonight', is_pinned: false, updated_at: '2025-05-10T00:00:00.000Z' }]
            : [];
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };
  return query;
}

test('Home shows care items independently and falls back to the most recent appointment', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  (supabase.from as jest.Mock).mockImplementation(queryFor);
  await render(<DashboardScreen />);
  await waitFor(() => expect(screen.getByText('Follow-up visit')).toBeTruthy());
  expect(screen.getByText('Losartan')).toBeTruthy();
  expect(screen.getByText('Call family')).toBeTruthy();
  expect(screen.getByText(/Previous appointment/)).toBeTruthy();
  jest.restoreAllMocks();
});
