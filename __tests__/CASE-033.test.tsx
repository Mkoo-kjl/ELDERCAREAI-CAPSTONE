import { buildHealthAnomalies, buildHealthInsights, buildHealthPredictions } from '@/src/lib/health-analysis';
import type { VitalLog } from '@/src/providers/HealthDataProvider';

function reading(index: number, fields: Partial<VitalLog> = {}): VitalLog {
  return {
    id: `reading-${index}`,
    elderly_id: 'patient-1',
    heart_rate_bpm: null,
    spo2_percent: null,
    hrv_rmssd_ms: null,
    skin_temp_celsius: null,
    steps_count: null,
    sleep_hours: null,
    overall_status: null,
    ai_risk_score: null,
    source: 'google-health',
    recorded_at: new Date(2026, 9, index + 1).toISOString(),
    synced_at: null,
    ...fields,
  };
}

describe('Health analysis', () => {
  test('CASE-033 abnormal heart rate and oxygen are both flagged', () => {
    const results = buildHealthAnomalies([reading(1, { heart_rate_bpm: 120, spo2_percent: 93 })]);
    expect(results.map((item) => item.id)).toEqual(expect.arrayContaining(['heart-threshold', 'low-spo2']));
  });
});
