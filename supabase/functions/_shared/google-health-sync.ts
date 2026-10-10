import type { SupabaseClient } from '@supabase/supabase-js';

import { buildHealthSnapshot, sleepSessionRows, snapshotChanged, type HealthResults } from './health-snapshot.ts';

type Row = Record<string, any>;

export type WatchSyncStatus = {
  deviceVersion: string | null;
  lastSyncTime: string | null;
};

export type WatchSyncIssue = 'permission_required' | 'no_tracker' | 'unavailable' | null;

function latestTrackerStatus(devices: unknown): WatchSyncStatus | null {
  if (!Array.isArray(devices)) return null;
  const trackers = devices.filter((device): device is Record<string, unknown> =>
    Boolean(device && typeof device === 'object' && (device as Record<string, unknown>).deviceType === 'TRACKER'));
  if (!trackers.length) return null;
  const syncTime = (device: Record<string, unknown>) => {
    const time = Date.parse(String(device.lastSyncTime ?? ''));
    return Number.isFinite(time) ? time : 0;
  };
  const device = trackers.sort((left, right) => syncTime(right) - syncTime(left))[0];
  return {
    deviceVersion: typeof device.deviceVersion === 'string' ? device.deviceVersion : null,
    lastSyncTime: typeof device.lastSyncTime === 'string' && Number.isFinite(Date.parse(device.lastSyncTime))
      ? device.lastSyncTime : null,
  };
}

async function getWatchStatus(accessToken: string): Promise<{ watchSync: WatchSyncStatus | null; watchSyncIssue: WatchSyncIssue }> {
  try {
    const response = await fetch('https://health.googleapis.com/v4/users/me/pairedDevices?pageSize=100', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 403) return { watchSync: null, watchSyncIssue: 'permission_required' };
    if (!response.ok) return { watchSync: null, watchSyncIssue: 'unavailable' };
    const devices = await response.json();
    if (!Array.isArray(devices?.pairedDevices)) return { watchSync: null, watchSyncIssue: 'unavailable' };
    const watchSync = latestTrackerStatus(devices?.pairedDevices);
    return { watchSync, watchSyncIssue: watchSync ? (watchSync.lastSyncTime ? null : 'unavailable') : 'no_tracker' };
  } catch {
    return { watchSync: null, watchSyncIssue: 'unavailable' };
  }
}

export class HealthSyncError extends Error {
  constructor(message: string, readonly code: string, readonly details: unknown[] = [], readonly status = 422) {
    super(message);
  }
}

async function refreshGoogleToken(token: Row, clientId: string, clientSecret: string) {
  const expiresAt = token.token_expires_at ? new Date(token.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return token.google_access_token as string;
  if (!token.google_refresh_token) throw new HealthSyncError('Google Health authorization expired. Reconnect Google Health.', 'TOKEN_EXPIRED', [], 401);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description ?? 'Unable to refresh Google Health access.');
  return { accessToken: data.access_token as string, expiresIn: Number(data.expires_in ?? 3600) };
}

export async function syncGoogleHealthForUser(admin: SupabaseClient, userId: string, clientId: string, clientSecret: string, includeWatchSync = false) {
  const [{ data: token, error: tokenError }, { data: elderly, error: elderlyError }] = await Promise.all([
    admin.from('google_health_tokens').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('elderly_profiles').select('elderly_id').eq('caregiver_id', userId).order('created_at').limit(1).maybeSingle(),
  ]);
  if (tokenError || elderlyError) throw tokenError ?? elderlyError;
  if (!token) throw new HealthSyncError('Google Health is not connected.', 'NOT_CONNECTED', [], 409);
  if (!elderly) throw new HealthSyncError('Complete the older adult profile first.', 'NO_PATIENT', [], 409);

  const refreshed = await refreshGoogleToken(token, clientId, clientSecret);
  const accessToken = typeof refreshed === 'string' ? refreshed : refreshed.accessToken;
  if (typeof refreshed !== 'string') {
    const { error } = await admin.from('google_health_tokens').update({
      google_access_token: accessToken,
      token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
    if (error) throw error;
  }

  const getPoints = async (dataType: string, filter?: string, pageSize = 1) => {
    const url = new URL(`https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints`);
    url.searchParams.set('pageSize', String(pageSize));
    if (filter) url.searchParams.set('filter', filter);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      return {
        dataPoints: [],
        warning: { dataType, status: response.status, message: failure?.error?.message ?? `Google Health returned HTTP ${response.status}.` },
      };
    }
    return await response.json();
  };

  const checkedAt = new Date().toISOString();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [heart, oxygen, dailyOxygen, sleep, steps, temperature, hrv, watchStatus] = await Promise.all([
    getPoints('heart-rate'),
    getPoints('oxygen-saturation'),
    getPoints('daily-oxygen-saturation'),
    getPoints('sleep', undefined, 25),
    getPoints('steps', `steps.interval.start_time >= "${since}"`, 10000),
    getPoints('daily-sleep-temperature-derivations'),
    getPoints('heart-rate-variability'),
    includeWatchSync ? getWatchStatus(accessToken) : Promise.resolve({ watchSync: null, watchSyncIssue: null }),
  ]);
  const results = { heart, oxygen, dailyOxygen, sleep, steps, temperature, hrv } as HealthResults;
  const warnings = Object.values(results).map((result) => result.warning).filter(Boolean);
  if (warnings.some((warning: any) => warning.status === 429 || warning.status >= 500)) {
    throw new HealthSyncError('Google Health is temporarily unavailable. Please try again later.', 'GOOGLE_HEALTH_TEMPORARY', warnings, 503);
  }
  const snapshot = buildHealthSnapshot(results, checkedAt);
  if (!snapshot.hasData) {
    throw new HealthSyncError(
      warnings.length
        ? 'Google Health did not return any readable vitals. Review the API/scopes details below.'
        : 'Google Health is connected, but no readings are available yet. Keep the watch near its paired phone and check Google Health background-sync settings.',
      warnings.length ? 'GOOGLE_HEALTH_API_ERROR' : 'NO_HEALTH_DATA',
      warnings,
    );
  }

  const { data: latest, error: latestError } = await admin.from('vital_sign_logs')
    .select('*')
    .eq('elderly_id', elderly.elderly_id)
    .eq('source', 'google_health_v4')
    .order('synced_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;

  const sleepHistory = sleep.warning && Array.isArray(latest?.sleep_history)
    ? latest.sleep_history : sleepSessionRows(sleep.dataPoints ?? []);
  const changed = snapshotChanged(latest, snapshot)
    || JSON.stringify(latest?.sleep_history ?? []) !== JSON.stringify(sleepHistory);
  let vital = latest;
  if (changed) {
    const { hasData: _hasData, sleepDiagnostics: _sleepDiagnostics, ...values } = snapshot;
    const log = { ...values, sleep_history: sleepHistory, elderly_id: elderly.elderly_id, source: 'google_health_v4' };
    const saveQuery = latest && Date.parse(snapshot.recorded_at) <= Date.parse(latest.recorded_at)
      ? admin.from('vital_sign_logs').update(log).eq('id', latest.id)
      : admin.from('vital_sign_logs').insert(log);
    const { data: saved, error: saveError } = await saveQuery.select().single();
    if (saveError) throw saveError;
    vital = saved;
  }

  return { vital, changed, hasData: true, checkedAt, ...watchStatus, warnings, diagnostics: { sleep: snapshot.sleepDiagnostics } };
}
