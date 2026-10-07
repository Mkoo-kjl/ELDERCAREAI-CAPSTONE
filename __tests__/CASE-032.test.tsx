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
  test('CASE-032 four readings yield a labeled statistical trend', () => {
    const history = [70, 72, 74, 76].map((heart, index) => reading(index, { heart_rate_bpm: heart }));
    const forecast = buildHealthPredictions(history).find((item) => item.id === 'heart-forecast');
    expect(forecast?.body).toContain('4 distinct readings');
    expect(forecast?.confidence).toBe('Low');
  });
});
