import { fireEvent, render, screen } from '@testing-library/react-native';

import HealthScreen from '@/app/(tabs)/health';
import type { VitalLog } from '@/src/providers/HealthDataProvider';

let mockHistory: VitalLog[] = [];

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/hooks/useMinuteClock', () => ({ useMinuteClock: jest.fn() }));
jest.mock('@/src/components/VitalDetailModal', () => ({ VitalDetailModal: () => null }));
jest.mock('@/src/providers/HealthDataProvider', () => ({ useHealthData: () => ({
  vital: mockHistory[0] ?? null, history: mockHistory, sleepSessions: [], refreshing: false, refresh: jest.fn(),
}) }));

export function reading(index: number, overrides: Partial<VitalLog> = {}): VitalLog {
  return {
    id: `vital-${index}`, elderly_id: 'patient-1', heart_rate_bpm: 70 + index * 3,
    spo2_percent: 98, hrv_rmssd_ms: 42, skin_temp_celsius: 35.9,
    steps_count: 2500, sleep_hours: 7.5, overall_status: 'normal', ai_risk_score: 0,
    source: 'google_health_v4', recorded_at: `2026-10-${String(index + 10).padStart(2, '0')}T08:00:00Z`,
    synced_at: `2026-10-${String(index + 10).padStart(2, '0')}T08:01:00Z`,
    ...overrides,
  };
}

export async function showHealth(history: VitalLog[], tab: 'Vitals' | 'AI Insights' | 'Predictions' | 'Anomalies' = 'Vitals') {
  mockHistory = history;
  await render(<HealthScreen />);
  if (tab !== 'Vitals') await fireEvent.press(screen.getByText(tab));
  return screen;
}
