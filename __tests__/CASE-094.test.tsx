import { watchLiveLabel, watchReadingFresh, watchVitalFromState, keepMetricHistory, locationSourceLabel, watchGpsPosition, watchMapPosition, stressContextValue, type WatchLiveState } from '../src/lib/galaxy-watch';
import { validateWatchPayload } from '../supabase/functions/_shared/watch-payload';

const now = Date.parse('2026-11-02T10:00:00.000Z');
const at = (seconds: number) => new Date(now - seconds * 1000).toISOString();
const state: WatchLiveState = {
  elderly_id: 'patient', device_id: 'watch', heart_rate_bpm: 75, heart_rate_measured_at: at(2),
  latitude: 0, longitude: 0, accuracy_m: 0, gps_measured_at: at(5), battery_percent: 0,
  monitoring: true, status_at: at(1), received_at: at(0),
};
const base = { upload_id: '12345678-1234-1234-1234-123456789012', captured_at: at(0), monitoring: true };

describe('Galaxy Watch measurement freshness and upload validation', () => {
  it('does not label an old heart rate live when new heartbeats arrive', () => {
    expect(watchLiveLabel(state, now)).toBe('Live heart rate');
    expect(watchLiveLabel({ ...state, heart_rate_measured_at: at(45) }, now)).toBe('Waiting for heart rate');
    expect(watchLiveLabel({ ...state, received_at: at(40) }, now)).toBe('Watch offline');
    expect(watchLiveLabel({ ...state, status_at: at(40) }, now)).toBe('Watch offline');
    expect(watchLiveLabel({ ...state, monitoring: false }, now)).toBe('Monitoring stopped');
  });
  it('handles missing and impossible future timestamps', () => {
    expect(watchReadingFresh(null, now, 30_000)).toBe(false);
    expect(watchReadingFresh('invalid', now, 30_000)).toBe(false);
    expect(watchReadingFresh(new Date(now + 600_000).toISOString(), now, 30_000)).toBe(false);
    expect(watchLiveLabel(null, now)).toBe('Waiting for watch');
  });
  it('accepts independent heart-rate and GPS updates, including zero coordinates and battery', () => {
    expect(validateWatchPayload({ ...base, heart_rate_bpm: 78, heart_rate_measured_at: at(2) }, now).samples[0].value).toBe(78);
    const gps = validateWatchPayload({ ...base, latitude: 0, longitude: 0, accuracy_m: 0, gps_measured_at: at(5), location_source:'watch_gps', battery_percent: 0 }, now);
    expect(gps.latitude).toBe(0);
    expect(gps.battery_percent).toBe(0);
    expect(gps.samples).toHaveLength(0);
  });
  it('requires each sample timestamp and rejects nonfinite or malformed readings', () => {
    for (const bad of [
      { heart_rate_bpm: 75 }, { heart_rate_bpm: Number.NaN, heart_rate_measured_at: at(0) },
      { latitude: 91, longitude: 0, accuracy_m: 4, gps_measured_at: at(0) },
      { latitude: 10, longitude: 20, gps_measured_at: at(0) },
      { heart_rate_bpm: 0, heart_rate_measured_at: at(0) }, { battery_percent: 42.5 },
    ]) expect(() => validateWatchPayload({ ...base, ...bad }, now)).toThrow();
  });
  it('rejects stale, future, and missing collection times rather than freshening them on receipt', () => {
    for (const captured_at of [at(90_000), at(-600), undefined, 'not-a-time']) {
      expect(() => validateWatchPayload({ ...base, captured_at }, now)).toThrow();
    }
  });
  it('drops caller-supplied ownership and unsupported metrics', () => {
    const result = validateWatchPayload({ ...base, elderly_id: 'someone-else', spo2_percent: 99, source: 'fake' }, now);
    expect(result).not.toHaveProperty('elderly_id');
    expect(result).not.toHaveProperty('spo2_percent');
    expect(result).not.toHaveProperty('source');
  });
});

const sample = (metric = 'heart_rate_bpm', value = 78, seconds = 2) => ({ id: base.upload_id, metric, value, measured_at: at(seconds) });
test('supports timestamped skin temperature, RMSSD, spot oxygen and zero steps', () => {
  for (const [metric, value] of [['skin_temp_celsius', 33.4], ['hrv_rmssd_ms', 0], ['spo2_percent', 97], ['steps_count', 0]] as const) {
    expect(validateWatchPayload({ ...base, samples: [sample(metric, value)] }, now).samples[0].value).toBe(value);
  }
});
test('keeps queued timestamps and rejects malformed or overlarge batches', () => {
  expect(validateWatchPayload({ ...base, samples: [sample('heart_rate_bpm', 78, 172800)] }, now).samples[0].measured_at).toBe(at(172800));
  for (const samples of [[sample('stress_score', 75)], [sample('spo2_percent', 101)], [sample('steps_count', 1.5)],
    [sample(), sample()], [sample('skin_temp_celsius', NaN)], Array(121).fill(sample())]) {
    expect(() => validateWatchPayload({ ...base, samples }, now)).toThrow();
  }
});
test('all metrics reach live cards with independent timestamps and zero values', () => {
  const vital = watchVitalFromState({ ...state, skin_temp_celsius: 33.5, skin_temp_measured_at: at(4),
    hrv_rmssd_ms: 42, hrv_measured_at: at(6), spo2_percent: 97, spo2_measured_at: at(120), steps_count: 0, steps_measured_at: at(10) });
  expect(vital).toMatchObject({ skin_temp_celsius: 33.5, hrv_rmssd_ms: 42, spo2_percent: 97, steps_count: 0, sleep_hours: null });
  expect(vital?.measurement_times?.spo2_percent).toBe(at(120));
  expect(vital?.measurement_times?.heart_rate_bpm).toBe(at(2));
});
test('frequent heart updates do not evict sparse oxygen history', () => {
  const template = watchVitalFromState(state)!;
  const rows: NonNullable<ReturnType<typeof watchVitalFromState>>[] = Array.from({ length: 60 }, (_, i) => ({ ...template, id: `hr-${i}`, recorded_at: at(i), measurement_times: { heart_rate_bpm: at(i) } }));
  rows.push({ ...template, id: 'oxygen', heart_rate_bpm: null, spo2_percent: 97, recorded_at: at(300), measurement_times: { spo2_percent: at(300) } } as typeof template);
  const history = keepMetricHistory(rows);
  expect(history).toHaveLength(31);
  expect(history.find((row) => row.id === 'oxygen')?.spo2_percent).toBe(97);
});
test('fused coordinates are never labeled satellite GPS', () => {
  expect(locationSourceLabel({ ...state, location_source: 'fused' })).toContain('paired phone');
  expect(locationSourceLabel({ ...state, location_source: 'watch_gps' })).toBe('Watch satellite GPS');
  expect(locationSourceLabel(state)).toBe('Location source unavailable');
});

test('the GPS-specific helper does not relabel hybrid estimates as GPS',()=>{
  expect(watchGpsPosition({...state,location_source:'watch_gps'})).toMatchObject({latitude:0,longitude:0,location_source:'watch_gps'});
  for(const location_source of ['fused','network',null,undefined] as const)expect(watchGpsPosition({...state,location_source})).toBeNull();
  expect(watchGpsPosition({...state,location_source:'watch_gps',latitude:NaN})).toBeNull();
});

test('hybrid coordinates retain their source without losing vital samples',()=>{
  for(const location_source of ['fused','network'] as const){
    const result=validateWatchPayload({...base,samples:[sample()],latitude:10,longitude:123,accuracy_m:3,gps_measured_at:at(0),location_source,gps_status:'Live fused position'},now);
    expect(result.samples).toHaveLength(1);expect(result.samples[0].value).toBe(78);
    expect(result.latitude).toBe(10);expect(result.location_source).toBe(location_source);
    expect(watchMapPosition({...state,location_source})).toMatchObject({location_source});
  }
  const unknown=validateWatchPayload({...base,samples:[sample()],latitude:10,longitude:123,accuracy_m:3,gps_measured_at:at(0)},now);
  expect(unknown).not.toHaveProperty('latitude');expect(unknown.samples).toHaveLength(1);
});

test('the Stress level card identifies HRV without inventing a stress score',()=>{
  expect(stressContextValue(42)).toBe('HRV 42');
  expect(stressContextValue(null)).toBe('--');
  expect(stressContextValue(Number.NaN)).toBe('--');
});
