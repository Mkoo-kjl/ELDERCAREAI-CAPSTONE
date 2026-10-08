import { relativeTime, timeAgo } from './format';

export type VitalMetric = 'heart_rate_bpm' | 'spo2_percent' | 'sleep_hours' | 'steps_count' | 'skin_temp_celsius' | 'hrv_rmssd_ms';
export type MeasurementTimes = Partial<Record<VitalMetric, string>>;

type TimedVital = {
  source: string | null;
  recorded_at: string;
  measurement_times?: MeasurementTimes | null;
} & Partial<Record<VitalMetric, number | null>>;

export function vitalTimeLabel(vital: TimedVital | null, metric: VitalMetric) {
  if (!vital || typeof vital[metric] !== 'number') return 'No reading';
  const measuredAt = vital.measurement_times?.[metric];
  if (measuredAt) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(measuredAt)) {
      const date = new Date(`${measuredAt}T12:00:00`);
      return Number.isFinite(date.getTime())
        ? `Daily reading ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
        : 'Sample time unavailable';
    }
    const age = timeAgo(measuredAt);
    return age ? `Measured ${age}` : 'Sample time unavailable';
  }
  return vital.source === 'google_health_v4' ? 'Sample time unavailable' : relativeTime(vital.recorded_at);
}
