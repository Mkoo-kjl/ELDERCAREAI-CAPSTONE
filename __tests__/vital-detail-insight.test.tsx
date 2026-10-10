import { render, screen, waitFor } from '@testing-library/react-native';

import { VitalDetailModal } from '@/src/components/VitalDetailModal';
import { supabase } from '@/src/lib/supabase';
import type { VitalLog } from '@/src/providers/HealthDataProvider';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

const reading: VitalLog = {
  id: 'vital-1', elderly_id: 'patient-1', heart_rate_bpm: 78, spo2_percent: 97,
  sleep_hours: 7, steps_count: 3000, skin_temp_celsius: 33, hrv_rmssd_ms: 42,
  overall_status: 'normal', ai_risk_score: null, source: 'google_health_v4',
  recorded_at: '2026-10-09T06:00:00.000Z', synced_at: '2026-10-09T06:01:00.000Z',
  measurement_times: { sleep_hours: '2026-10-09T06:00:00.000Z' },
};

it('shows duration context and requests a reading-specific Elle insight', async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { reply: 'The patient slept 7 hours in the latest synced session.' }, error: null });
  await render(<VitalDetailModal visible metric="sleep_hours" history={[reading]} onClose={jest.fn()} />);

  expect(screen.getByText('Within the 7-8h guide')).toBeTruthy();
  expect(screen.getByText(/Duration alone does not show sleep quality/)).toBeTruthy();
  await waitFor(() => expect(screen.getByText('The patient slept 7 hours in the latest synced session.')).toBeTruthy());
  expect(supabase.functions.invoke).toHaveBeenCalledWith('ai-care-assistant', expect.objectContaining({
    body: expect.objectContaining({ insightMetric: 'sleep_hours', message: expect.stringContaining('7.0 hours') }),
  }));
});

it('does not request an insight when a reading is missing', async () => {
  await render(<VitalDetailModal visible metric="sleep_hours" history={[]} onClose={jest.fn()} />);
  expect(screen.getByText(/A synchronized sleep reading is needed/)).toBeTruthy();
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});

it('lists actual nightly sleep durations without making up a sleep-quality score', async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { reply: 'The patient slept 9.4 hours in the latest session.' }, error: null });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(7, 0, 0, 0);
  await render(<VitalDetailModal visible metric="sleep_hours" history={[{ ...reading, sleep_hours: 9.4 }]} sleepSessions={[{
    source_key: 'sleep-1', session_start_at: new Date(yesterday.getTime() - 600 * 60000).toISOString(),
    session_end_at: yesterday.toISOString(), minutes_asleep: 564, minutes_in_sleep_period: 600,
    is_main_sleep: true, is_processed: true,
  }]} onClose={jest.fn()} />);

  expect(screen.getByText('Above the 7-8h guide')).toBeTruthy();
  expect(screen.getByText('Last 7 days')).toBeTruthy();
  expect(screen.getByText('9h 24m')).toBeTruthy();
  expect(screen.getByText('Sleep efficiency 94%')).toBeTruthy();
  expect(screen.queryByText(/Sleep score/)).toBeNull();
});
