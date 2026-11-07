export const watchMetricRanges = {
  heart_rate_bpm: [1, 350], spo2_percent: [1, 100], skin_temp_celsius: [-10, 60],
  hrv_rmssd_ms: [0, 1000], steps_count: [0, 1_000_000],
} as const;
export type WatchMetric = keyof typeof watchMetricRanges;
export type WatchSample = { id: string; metric: WatchMetric; value: number; measured_at: string };
export type WatchPayload = {
  captured_at: string; monitoring: boolean; upload_id: string; samples: WatchSample[];
  latitude?: number; longitude?: number; accuracy_m?: number; gps_measured_at?: string;
  location_source?: 'watch_gps' | 'fused' | 'network'; gps_status?: string;
  sensor_status?: Record<string, string>; battery_percent?: number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate every sensor event. A batch is atomic; retries retain the same sample IDs. */
export function validateWatchPayload(input: Record<string, unknown>, now = Date.now()): WatchPayload {
  function instant(value: unknown, recent = false) {
    const time = typeof value === 'string' ? Date.parse(value) : NaN;
    const earliest = recent ? now - 24 * 60 * 60_000 : Date.UTC(2020, 0, 1);
    if (!Number.isFinite(time) || time > now + 5 * 60_000 || time < earliest) throw new Error('Invalid measurement timestamp. Check the watch clock.');
    return new Date(time).toISOString();
  }
  function number(value: unknown, min: number, max: number) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('A reading is outside the accepted range.');
    return value;
  }
  if (typeof input.monitoring !== 'boolean') throw new Error('Monitoring status is required.');
  if (typeof input.upload_id !== 'string' || !uuid.test(input.upload_id)) throw new Error('An upload ID is required.');
  const result: WatchPayload = { captured_at: instant(input.captured_at, true), monitoring: input.monitoring, upload_id: input.upload_id, samples: [] };
  if (input.samples !== undefined) {
    if (!Array.isArray(input.samples) || input.samples.length > 120) throw new Error('A batch must contain at most 120 samples.');
    const seen = new Set<string>();
    result.samples = input.samples.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid sample.');
      const sample = item as Record<string, unknown>;
      if (typeof sample.id !== 'string' || !uuid.test(sample.id) || seen.has(sample.id)) throw new Error('Each sample needs a unique ID.');
      seen.add(sample.id);
      if (typeof sample.metric !== 'string' || !Object.prototype.hasOwnProperty.call(watchMetricRanges, sample.metric)) throw new Error('Unsupported watch metric.');
      const metric = sample.metric as WatchMetric;
      const [min, max] = watchMetricRanges[metric];
      const value = number(sample.value, min, max);
      if (metric === 'steps_count' && !Number.isInteger(value)) throw new Error('Steps must be an integer.');
      return { id: sample.id, metric, value, measured_at: instant(sample.measured_at) };
    });
  } else if (input.heart_rate_bpm !== undefined || input.heart_rate_measured_at !== undefined) {
    // Keep installed v1 watches working during upgrade; database measurement keys deduplicate them.
    result.samples.push({ id: input.upload_id, metric: 'heart_rate_bpm', value: number(input.heart_rate_bpm, 1, 350), measured_at: instant(input.heart_rate_measured_at) });
  }
  let ignoredUnknownLocation=false;
  if (input.latitude !== undefined || input.longitude !== undefined || input.gps_measured_at !== undefined) {
    const latitude=number(input.latitude,-90,90),longitude=number(input.longitude,-180,180);
    const accuracy=number(input.accuracy_m,0,100_000),measured=instant(input.gps_measured_at);
    const source=input.location_source;
    if (source!==undefined&&source!=='watch_gps'&&source!=='fused'&&source!=='network') throw new Error('Invalid location source.');
    // Preserve the reported hybrid source; an unknown source must never be relabeled GPS.
    if(source!==undefined)Object.assign(result,{latitude,longitude,accuracy_m:accuracy,gps_measured_at:measured,location_source:source});
    else ignoredUnknownLocation=true;
  }
  if (input.battery_percent !== undefined) {
    result.battery_percent = number(input.battery_percent, 0, 100);
    if (!Number.isInteger(result.battery_percent)) throw new Error('Battery percentage must be an integer.');
  }
  if (input.gps_status !== undefined) {
    if (typeof input.gps_status !== 'string' || input.gps_status.length > 240) throw new Error('Invalid location status.');
    result.gps_status = input.gps_status;
  }
  if(ignoredUnknownLocation)result.gps_status='The location source is unavailable. Restart monitoring on the updated watch.';
  if (input.sensor_status !== undefined) {
    if (!input.sensor_status || typeof input.sensor_status !== 'object' || Array.isArray(input.sensor_status)) throw new Error('Invalid sensor status.');
    result.sensor_status = {};
    for (const metric of [...Object.keys(watchMetricRanges), 'sleep_hours', 'sdk']) {
      const value = (input.sensor_status as Record<string, unknown>)[metric];
      if (value !== undefined) {
        if (typeof value !== 'string' || value.length > 240) throw new Error('Invalid sensor status.');
        result.sensor_status[metric] = value;
      }
    }
  }
  return result;
}
