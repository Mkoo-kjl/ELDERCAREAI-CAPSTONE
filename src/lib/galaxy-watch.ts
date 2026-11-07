import type { VitalLog } from '@/src/providers/HealthDataProvider';
import type { VitalMetric } from '@/src/lib/vital-time';
import type {MapPosition} from '@/src/lib/location-map';

export const watchMetrics = ['heart_rate_bpm', 'spo2_percent', 'skin_temp_celsius', 'hrv_rmssd_ms', 'steps_count','sleep_hours'] as const;
export type WatchLiveState = {
  stress_score?: number | null; stress_baseline_rmssd?: number | null; stress_reference_count?: number;
  elderly_id: string; device_id: string;
  heart_rate_bpm: number | null; heart_rate_measured_at: string | null;
  latitude: number | null; longitude: number | null; accuracy_m: number | null;
  gps_measured_at: string | null; battery_percent: number | null;
  monitoring: boolean; status_at: string; received_at: string;
  spo2_percent?: number | null; spo2_measured_at?: string | null;
  skin_temp_celsius?: number | null; skin_temp_measured_at?: string | null;
  hrv_rmssd_ms?: number | null; hrv_measured_at?: string | null;
  steps_count?: number | null; steps_measured_at?: string | null;
  sleep_hours?: number | null; sleep_measured_at?: string | null;
  location_source?: 'watch_gps' | 'fused' | 'network' | null;
  gps_status?: string | null; sensor_status?: Record<string, string>;
};

export function locationSourceLabel(state: WatchLiveState | null) {
  return state?.gps_measured_at?trackingSourceLabel(state.location_source):'Waiting for location';
}
export function trackingSourceLabel(source:WatchLiveState['location_source']){
  return source==='watch_gps'?'Watch satellite GPS':source==='fused'?'Fused location (may use paired phone)':source==='network'?'Network location estimate':'Location source unavailable';
}
/** Hybrid estimates retain their source rather than claiming all points are watch GPS. */
export function watchMapPosition(state:WatchLiveState|null|undefined):MapPosition|null {
  const source=state?.location_source;
  if(!state||source!=='watch_gps'&&source!=='fused'&&source!=='network'||state.latitude==null||state.longitude==null||!state.gps_measured_at||
    !Number.isFinite(state.latitude)||Math.abs(state.latitude)>90||!Number.isFinite(state.longitude)||Math.abs(state.longitude)>180||
    !Number.isFinite(Date.parse(state.gps_measured_at))||state.accuracy_m!=null&&(!Number.isFinite(state.accuracy_m)||state.accuracy_m<0))return null;
  return{latitude:state.latitude,longitude:state.longitude,accuracy_m:state.accuracy_m,measured_at:state.gps_measured_at,location_source:source};
}
export function watchGpsPosition(state:WatchLiveState|null|undefined):MapPosition|null{return state?.location_source==='watch_gps'?watchMapPosition(state):null;}

export function watchMetricStatus(state: WatchLiveState | null, metric: VitalMetric, saved?: VitalLog | null) {
  if (metric === 'sleep_hours') return state?.sleep_hours!=null||saved?.sleep_hours!=null?'Recorded sleep imported from Health history.':'Connect Health history in Profile to import sleep from the patient’s watch.';
  return state?.sensor_status?.[metric] ?? ({
    spo2_percent: 'Measure blood oxygen on the watch for a spot reading.',
    hrv_rmssd_ms: 'Waiting for valid beat intervals; keep still for 30–60 seconds.',
    skin_temp_celsius: 'Waiting for Samsung skin-temperature sensor.',
    steps_count: 'Allow Physical activity permission on the watch.',
    heart_rate_bpm: 'Wear the watch and start monitoring.',
  }[metric]);
}

/** Cards use the same saved events as details, even after a watch snapshot is reset.
 * Each value keeps its original measurement time; live status still comes only
 * from watch telemetry, never from this combined display record.
 */
export function latestWatchVital(elderlyId: string | undefined, state: WatchLiveState | null, history: VitalLog[]): VitalLog | null {
  if (!elderlyId) return null;
  const live = state?.elderly_id === elderlyId ? watchVitalFromState(state) : null;
  const rows = [live, ...keepMetricHistory(history.filter(row => row.elderly_id === elderlyId && row.source === 'galaxy_watch'))]
    .filter((row): row is VitalLog => row !== null);
  const result: VitalLog = { id: `latest:${elderlyId}`, elderly_id: elderlyId, source: 'galaxy_watch',
    heart_rate_bpm: null, spo2_percent: null, skin_temp_celsius: null, hrv_rmssd_ms: null, steps_count: null, sleep_hours: null,
    overall_status: null, ai_risk_score: null, recorded_at: '', synced_at: null, measurement_times: {} };
  for (const metric of watchMetrics) {
    const latest = rows.filter(row => (row !== live || Boolean(row.measurement_times?.[metric])) &&
      typeof row[metric] === 'number' && Number.isFinite(row[metric]) &&
      Number.isFinite(Date.parse(row.measurement_times?.[metric] ?? row.recorded_at)))
      .sort((a,b) => Date.parse(b.measurement_times?.[metric] ?? b.recorded_at) - Date.parse(a.measurement_times?.[metric] ?? a.recorded_at))[0];
    if (!latest) continue;
    const measuredAt = latest.measurement_times?.[metric] ?? latest.recorded_at;
    result[metric] = latest[metric];
    result.measurement_times![metric] = measuredAt;
    if (!result.recorded_at || Date.parse(measuredAt) > Date.parse(result.recorded_at)) result.recorded_at = measuredAt;
    if (latest.synced_at && (!result.synced_at || Date.parse(latest.synced_at) > Date.parse(result.synced_at))) result.synced_at = latest.synced_at;
    if (metric === 'hrv_rmssd_ms') {
      result.stress_score = latest.stress_score; result.stress_baseline_rmssd = latest.stress_baseline_rmssd;
      result.stress_reference_count = latest.stress_reference_count;
    }
  }
  return result.recorded_at ? result : null;
}

export function watchVitalFromState(state: WatchLiveState | null): VitalLog | null {
  if (!state) return null;
  const times: VitalLog['measurement_times'] = {};
  const keys = { heart_rate_bpm: 'heart_rate_measured_at', spo2_percent: 'spo2_measured_at',
    skin_temp_celsius: 'skin_temp_measured_at', hrv_rmssd_ms: 'hrv_measured_at', steps_count: 'steps_measured_at',sleep_hours:'sleep_measured_at' } as const;
  for (const metric of watchMetrics) {
    const time = state[keys[metric]];
    if (time && state[metric] != null) times[metric] = time;
  }
  const measured = Object.values(times).sort();
  if (!measured.length) return null;
  return { id: `watch:${state.device_id}`, elderly_id: state.elderly_id, source: 'galaxy_watch',
    stress_score: state.stress_score, stress_baseline_rmssd: state.stress_baseline_rmssd, stress_reference_count: state.stress_reference_count,
    heart_rate_bpm: state.heart_rate_bpm ?? null, spo2_percent: state.spo2_percent ?? null,
    skin_temp_celsius: state.skin_temp_celsius ?? null, hrv_rmssd_ms: state.hrv_rmssd_ms ?? null,
    steps_count: state.steps_count ?? null, sleep_hours: state.sleep_hours??null, overall_status: null, ai_risk_score: null,
    recorded_at: measured.at(-1)!, synced_at: state.received_at, measurement_times: times };
}

/** Bound the UI cache per metric, not per second of heart-rate traffic. Database retains every sample. */
export function keepMetricHistory(rows: VitalLog[], count = 30) {
  const revisions=new Map<string,number>();
  for(const row of rows)if(row.source_record_key&&row.source_revision_at){const key=`${row.source_device_id}:${row.source_record_key}`;revisions.set(key,Math.max(revisions.get(key)??0,Date.parse(row.source_revision_at)));}
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  return [...rows].sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at)).filter((row) => {
    if(row.is_superseded || row.source_record_key&&row.source_revision_at&&Date.parse(row.source_revision_at)!==revisions.get(`${row.source_device_id}:${row.source_record_key}`))return false;
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    let keep = false;
    for (const metric of watchMetrics) if (typeof row[metric] === 'number') {
      const key = `${metric}:${row.measurement_times?.[metric] ?? row.recorded_at}`;
      if (!seen.has(key) && (counts.get(metric) ?? 0) < count) {
        seen.add(key); counts.set(metric, (counts.get(metric) ?? 0) + 1); keep = true;
      }
    }
    return keep;
  });
}

export function watchReadingFresh(timestamp: string | null | undefined, now: number, maxAgeMs: number) {
  const time = Date.parse(timestamp ?? '');
  return Number.isFinite(time) && time <= now + 5 * 60_000 && now - time < maxAgeMs;
}

export function watchLiveLabel(state: WatchLiveState | null, now = Date.now()) {
  if (!state) return 'Waiting for watch';
  if (!watchReadingFresh(state.received_at, now, 30_000) || !watchReadingFresh(state.status_at, now, 30_000)) return 'Watch offline';
  if (!state.monitoring) return 'Monitoring stopped';
  if (!watchReadingFresh(state.heart_rate_measured_at, now, 30_000)) return 'Waiting for heart rate';
  return 'Live heart rate';
}

/** A display label must never convert milliseconds into a claimed stress score. */
export function stressContextValue(hrv: number | null | undefined) {
  return typeof hrv === 'number' && Number.isFinite(hrv) ? `HRV ${hrv.toFixed(0)}` : '--';
}
