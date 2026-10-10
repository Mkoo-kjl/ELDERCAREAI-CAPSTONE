import type { SupabaseClient } from '@supabase/supabase-js';

import { syncGoogleHealthForUser } from '@/supabase/functions/_shared/google-health-sync';

const sampleTime = '2026-10-08T09:05:00Z';
const heartPoint = { heartRate: { beatsPerMinute: '78', sampleTime: { physicalTime: sampleTime } } };

function database(latest: Record<string, unknown> | null = null) {
  const insert = jest.fn((row: Record<string, unknown>) => ({
    select: () => ({ single: async () => ({ data: { id: 'saved-vital', ...row }, error: null }) }),
  }));
  const update = jest.fn((row: Record<string, unknown>) => ({
    eq: () => ({ select: () => ({ single: async () => ({ data: { id: latest?.id, ...row }, error: null }) }) }),
  }));
  const admin = {
    from: jest.fn((table: string) => {
      const query: any = {
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn(async () => ({
          data: table === 'google_health_tokens'
            ? { google_access_token: 'test-token', google_refresh_token: 'unused', token_expires_at: '2999-01-01T00:00:00Z' }
            : table === 'elderly_profiles' ? { elderly_id: 'patient-1' } : latest,
          error: null,
        })),
        insert, update,
      };
      return query;
    }),
  };
  return { admin: admin as unknown as SupabaseClient, insert, update };
}

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('a new Google Health heart-rate sample is written to the database', async () => {
  globalThis.fetch = jest.fn(async (input: string | URL | Request) => new Response(JSON.stringify({
    dataPoints: String(input).endsWith('/heart-rate/dataPoints?pageSize=1') ? [heartPoint] : [],
  }), { status: 200 })) as typeof fetch;
  const { admin, insert, update } = database();

  const result = await syncGoogleHealthForUser(admin, 'caregiver-1', 'client-id', 'client-secret');

  expect(result.changed).toBe(true);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({
    elderly_id: 'patient-1', source: 'google_health_v4', heart_rate_bpm: 78,
    recorded_at: '2026-10-08T09:05:00.000Z',
    measurement_times: { heart_rate_bpm: '2026-10-08T09:05:00.000Z' },
  }));
  expect(update).not.toHaveBeenCalled();
});

test('sync stores distinct Google Health sleep sessions in the vital log', async () => {
  const sleepPoint = (id: string, start: string, end: string, minutes: string) => ({
    name: `users/me/dataTypes/sleep/dataPoints/${id}`,
    sleep: { interval: { startTime: start, endTime: end }, summary: { minutesAsleep: minutes, minutesInSleepPeriod: '600' }, metadata: { mainSleep: true, processed: true } },
  });
  globalThis.fetch = jest.fn(async (input: string | URL | Request) => new Response(JSON.stringify({
    dataPoints: String(input).includes('/sleep/dataPoints') ? [
      sleepPoint('night-1', '2026-10-08T21:00:00Z', '2026-10-09T07:00:00Z', '564'),
      sleepPoint('night-2', '2026-10-07T21:00:00Z', '2026-10-08T07:00:00Z', '520'),
    ] : String(input).includes('/heart-rate/dataPoints') ? [heartPoint] : [],
  }), { status: 200 })) as typeof fetch;
  const { admin, insert } = database();

  await syncGoogleHealthForUser(admin, 'caregiver-1', 'client-id', 'client-secret');

  expect(insert).toHaveBeenCalledWith(expect.objectContaining({
    sleep_history: [
      expect.objectContaining({ source_key: 'users/me/dataTypes/sleep/dataPoints/night-1', minutes_asleep: 564 }),
      expect.objectContaining({ source_key: 'users/me/dataTypes/sleep/dataPoints/night-2', minutes_asleep: 520 }),
    ],
  }));
});

test('sync reports the paired tracker last-sync time without exposing device identifiers', async () => {
  globalThis.fetch = jest.fn(async (input: string | URL | Request) => new Response(JSON.stringify(
    String(input).includes('/pairedDevices')
      ? { pairedDevices: [
        { deviceType: 'SCALE', deviceVersion: 'Scale', lastSyncTime: '2026-10-08T10:00:00Z' },
        { deviceType: 'TRACKER', deviceVersion: 'Inspire 3', lastSyncTime: '2026-10-08T09:00:00Z', macAddress: 'private' },
      ] }
      : { dataPoints: String(input).includes('/heart-rate/') ? [heartPoint] : [] },
  ), { status: 200 })) as typeof fetch;
  const { admin } = database();

  const result = await syncGoogleHealthForUser(admin, 'caregiver-1', 'client-id', 'client-secret', true);

  expect(result.watchSync).toEqual({ deviceVersion: 'Inspire 3', lastSyncTime: '2026-10-08T09:00:00Z' });
  expect(JSON.stringify(result.watchSync)).not.toContain('private');
});

test('device-status failure does not block a new heart-rate reading', async () => {
  globalThis.fetch = jest.fn(async (input: string | URL | Request) =>
    String(input).includes('/pairedDevices')
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify({ dataPoints: String(input).includes('/heart-rate/') ? [heartPoint] : [] }), { status: 200 })) as typeof fetch;
  const { admin, insert } = database();

  const result = await syncGoogleHealthForUser(admin, 'caregiver-1', 'client-id', 'client-secret', true);

  expect(result.changed).toBe(true);
  expect(result.watchSync).toBeNull();
  expect(result.watchSyncIssue).toBe('unavailable');
  expect(insert).toHaveBeenCalled();
});

test('a missing device permission is reported without blocking heart-rate sync', async () => {
  globalThis.fetch = jest.fn(async (input: string | URL | Request) =>
    String(input).includes('/pairedDevices')
      ? new Response('{}', { status: 403 })
      : new Response(JSON.stringify({ dataPoints: String(input).includes('/heart-rate/') ? [heartPoint] : [] }), { status: 200 })) as typeof fetch;
  const { admin, insert } = database();

  const result = await syncGoogleHealthForUser(admin, 'caregiver-1', 'client-id', 'client-secret', true);

  expect(result.watchSyncIssue).toBe('permission_required');
  expect(insert).toHaveBeenCalled();
});

test('an account without a paired tracker is reported separately', async () => {
  globalThis.fetch = jest.fn(async (input: string | URL | Request) => new Response(JSON.stringify(
    String(input).includes('/pairedDevices')
      ? { pairedDevices: [] }
      : { dataPoints: String(input).includes('/heart-rate/') ? [heartPoint] : [] },
  ), { status: 200 })) as typeof fetch;
  const { admin } = database();

  const result = await syncGoogleHealthForUser(admin, 'caregiver-1', 'client-id', 'client-secret', true);

  expect(result.watchSyncIssue).toBe('no_tracker');
});

test('a paired tracker without a last sync time does not leave status blank', async () => {
  globalThis.fetch = jest.fn(async (input: string | URL | Request) => new Response(JSON.stringify(
    String(input).includes('/pairedDevices')
      ? { pairedDevices: [{ deviceType: 'TRACKER', deviceVersion: 'Inspire 3' }] }
      : { dataPoints: String(input).includes('/heart-rate/') ? [heartPoint] : [] },
  ), { status: 200 })) as typeof fetch;
  const { admin } = database();

  const result = await syncGoogleHealthForUser(admin, 'caregiver-1', 'client-id', 'client-secret', true);

  expect(result.watchSync).toEqual({ deviceVersion: 'Inspire 3', lastSyncTime: null });
  expect(result.watchSyncIssue).toBe('unavailable');
});

test('a changed older sample updates the saved database snapshot', async () => {
  globalThis.fetch = jest.fn(async (input: string | URL | Request) => new Response(JSON.stringify({
    dataPoints: String(input).endsWith('/heart-rate/dataPoints?pageSize=1') ? [heartPoint] : [],
  }), { status: 200 })) as typeof fetch;
  const { admin, insert, update } = database({ id: 'old-vital', heart_rate_bpm: 81,
    recorded_at: '2026-10-08T09:10:00.000Z', measurement_times: {} });

  const result = await syncGoogleHealthForUser(admin, 'caregiver-1', 'client-id', 'client-secret');

  expect(result.changed).toBe(true);
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ heart_rate_bpm: 78 }));
  expect(insert).not.toHaveBeenCalled();
});

test('a temporary Google Health failure cannot silently overwrite a vital row', async () => {
  globalThis.fetch = jest.fn(async (input: string | URL | Request) =>
    String(input).endsWith('/heart-rate/dataPoints?pageSize=1')
      ? new Response(JSON.stringify({ error: { message: 'Busy' } }), { status: 503 })
      : new Response(JSON.stringify({ dataPoints: [heartPoint] }), { status: 200 })) as typeof fetch;
  const { admin, insert, update } = database();

  await expect(syncGoogleHealthForUser(admin, 'caregiver-1', 'client-id', 'client-secret'))
    .rejects.toMatchObject({ code: 'GOOGLE_HEALTH_TEMPORARY', status: 503 });
  expect(insert).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});
