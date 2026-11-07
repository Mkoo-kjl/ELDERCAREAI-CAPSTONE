import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { HealthDataProvider, useHealthData, type VitalLog } from '@/src/providers/HealthDataProvider';
import { supabase } from '@/src/lib/supabase';
import type { WatchLiveState } from '@/src/lib/galaxy-watch';
const mockReload = jest.fn(async () => undefined);
let mockState: WatchLiveState | null = null;
let mockReceive: ((payload: any) => void) | undefined;
let mockRows: VitalLog[] = [];
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'caregiver' } },
  onboarding: { wearable_provider: 'galaxy_watch', wearable_status: 'connected' } }) }));
jest.mock('@/src/hooks/useGalaxyWatch', () => ({ useGalaxyWatch: () => ({ state: mockState, error: null,
  reload: mockReload, status: 'Live heart rate', heartRateFresh: true, gpsFresh: false }) }));
jest.mock('@/src/lib/supabase', () => ({ supabase: {
  from: jest.fn((table: string) => {
    let metric = '';
    const query: any = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      not: jest.fn((column) => { metric = column; return query; }),
      limit: jest.fn(() => table === 'vital_sign_logs' ? Promise.resolve({ data: mockRows.filter((row: any) => row[metric] != null), error: null }) : query),
      maybeSingle: jest.fn(async () => ({ data: { elderly_id: 'patient', full_name: 'Maria' }, error: null })),
    }; return query;
  }),
  channel: jest.fn(() => { const channel: any = { on: jest.fn((_event, _filter, callback) => { mockReceive = callback; return channel; }),
    subscribe: jest.fn(() => channel) }; return channel; }),
  removeChannel: jest.fn(async () => undefined), functions: { invoke: jest.fn() },
} }));
function Probe() {
  const { vital, history, refreshing } = useHealthData();
  return <><Text>{vital?.heart_rate_bpm ?? '--'} bpm</Text><Text>{vital?.skin_temp_celsius ?? '--'} skin</Text>
    <Text>{vital?.hrv_rmssd_ms ?? '--'} hrv</Text><Text>{vital?.spo2_percent ?? '--'} oxygen</Text>
    <Text>{history.length} saved</Text><Text>{refreshing ? 'Refreshing' : 'Quiet'}</Text></>;
}
beforeEach(() => {
  mockRows = []; mockReceive = undefined;
  mockState = { elderly_id: 'patient', device_id: 'watch', heart_rate_bpm: 78, heart_rate_measured_at: new Date().toISOString(),
    skin_temp_celsius: 33.5, skin_temp_measured_at: new Date().toISOString(), hrv_rmssd_ms: 42, hrv_measured_at: new Date().toISOString(),
    spo2_percent: 97, spo2_measured_at: new Date().toISOString(), latitude: null, longitude: null, accuracy_m: null,
    gps_measured_at: null, battery_percent: 50, monitoring: true, status_at: new Date().toISOString(), received_at: new Date().toISOString() };
});
test('all watch metrics reach the app without a cloud health sync or refresh spinner', async () => {
  await render(<HealthDataProvider><Probe /></HealthDataProvider>);
  await waitFor(() => expect(screen.getByText('78 bpm')).toBeTruthy());
  expect(screen.getByText('33.5 skin')).toBeTruthy(); expect(screen.getByText('42 hrv')).toBeTruthy();
  expect(screen.getByText('97 oxygen')).toBeTruthy(); expect(screen.getByText('Quiet')).toBeTruthy();
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
test('a new sparse sensor event appears once in saved history', async () => {
  await render(<HealthDataProvider><Probe /></HealthDataProvider>);
  await waitFor(() => expect(mockReceive).toBeDefined());
  const row: VitalLog = { id: 'skin1', elderly_id: 'patient', source: 'galaxy_watch', recorded_at: new Date().toISOString(), synced_at: new Date().toISOString(),
    heart_rate_bpm: null, spo2_percent: null, hrv_rmssd_ms: null, skin_temp_celsius: 33.6, steps_count: null,
    sleep_hours: null, overall_status: null, ai_risk_score: null };
  await act(async () => { mockReceive?.({ eventType: 'INSERT', new: row }); mockReceive?.({ eventType: 'INSERT', new: row }); });
  expect(screen.getByText('1 saved')).toBeTruthy();
  expect(screen.getByText('Quiet')).toBeTruthy();
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
