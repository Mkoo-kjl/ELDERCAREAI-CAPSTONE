import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

import { buildHealthSnapshot, snapshotChanged, type HealthResults } from '@/supabase/functions/_shared/health-snapshot';
import { matchesWebhookSecret, webhookHealthUsers } from '@/supabase/functions/_shared/health-webhook';
import { verifyHealthSignature } from '@/supabase/functions/_shared/health-signature';
import { supabase } from '@/src/lib/supabase';
import { vitalTimeLabel } from '@/src/lib/vital-time';
import { watchSyncDelayed } from '@/src/lib/watch-sync';
import { HealthDataProvider, useHealthData, type VitalLog } from '@/src/providers/HealthDataProvider';

jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({
  session: { user: { id: 'caregiver-1' } }, onboarding: { wearable_status: 'connected' },
}) }));
jest.mock('@/src/lib/notifications', () => ({ notifyAbnormalVital: jest.fn() }));

let mockReceiveVital: ((payload: { eventType: string; new: VitalLog }) => void) | undefined;
let mockAppStateChange: ((state: string) => void) | undefined;
let mockDatabaseRows: VitalLog[] = [];
let latestRefresh: ReturnType<typeof useHealthData>['refresh'];
jest.mock('@/src/lib/supabase', () => ({ supabase: {
  from: jest.fn((table: string) => {
    const query: any = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      limit: jest.fn((count: number) => table === 'vital_sign_logs'
        ? Promise.resolve({ data: mockDatabaseRows.slice(0, count), error: null }) : query),
      maybeSingle: jest.fn(async () => ({ data: { elderly_id: 'patient-1', full_name: 'Maria' }, error: null })),
    };
    return query;
  }),
  channel: jest.fn(() => {
    const channel: any = {
      on: jest.fn((_event, _filter, callback) => { mockReceiveVital = callback; return channel; }),
      subscribe: jest.fn((callback) => { callback('SUBSCRIBED'); return channel; }),
    };
    return channel;
  }),
  removeChannel: jest.fn(async () => undefined),
  functions: { invoke: jest.fn() },
} }));
const invoke = supabase.functions.invoke as jest.Mock;

const first: VitalLog = {
  id: 'vital-1', elderly_id: 'patient-1', heart_rate_bpm: 81, spo2_percent: null,
  hrv_rmssd_ms: null, skin_temp_celsius: null, steps_count: null, sleep_hours: null,
  overall_status: 'normal', ai_risk_score: 0, source: 'google_health_v4',
  recorded_at: '2026-10-08T09:00:00.000Z', synced_at: '2026-10-08T09:01:00.000Z',
  measurement_times: { heart_rate_bpm: '2026-10-08T09:00:00.000Z' },
};

function ReadingProbe() {
  const { vital, refreshing, error, watchSync, refresh } = useHealthData();
  latestRefresh = refresh;
  return <><Text>{vital?.heart_rate_bpm ?? '--'} bpm</Text><Text>{refreshing ? 'Refreshing' : 'Quiet'}</Text><Text>{error ?? 'No error'}</Text><Text>{watchSync?.deviceVersion ?? 'No watch status'}</Text></>;
}

beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, callback) => {
    if (event === 'change') mockAppStateChange = callback as (state: string) => void;
    return { remove: jest.fn() };
  });
  mockDatabaseRows = [first];
  mockReceiveVital = undefined;
  mockAppStateChange = undefined;
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { changed: false, checkedAt: first.synced_at }, error: null });
});
afterEach(() => jest.restoreAllMocks());

test('a webhook-created row appears through Realtime without another API call or spinner', async () => {
  await render(<HealthDataProvider><ReadingProbe /></HealthDataProvider>);
  await waitFor(() => expect(screen.getByText('81 bpm')).toBeTruthy());
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Quiet')).toBeTruthy();
  const refreshBeforeReload = latestRefresh;
  await act(async () => { await latestRefresh(false, true); });
  expect(latestRefresh).toBe(refreshBeforeReload);
  const next = { ...first, id: 'vital-2', heart_rate_bpm: 78,
    recorded_at: '2026-10-08T09:05:00.000Z', synced_at: '2026-10-08T09:06:00.000Z',
    measurement_times: { heart_rate_bpm: '2026-10-08T09:05:00.000Z' } };
  await act(async () => { mockReceiveVital?.({ eventType: 'INSERT', new: next }); });
  expect(screen.getByText('78 bpm')).toBeTruthy();
  expect(screen.getByText('Quiet')).toBeTruthy();
  expect(invoke).toHaveBeenCalledTimes(1);
});

test('returning to the foreground reconciles Google Health without a pull gesture', async () => {
  render(<HealthDataProvider><ReadingProbe /></HealthDataProvider>);
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  mockDatabaseRows = [{ ...first, id: 'vital-2', heart_rate_bpm: 78,
    recorded_at: '2026-10-08T09:05:00.000Z', synced_at: '2026-10-08T09:06:00.000Z' }];
  await act(async () => {
    mockAppStateChange?.('background');
    mockAppStateChange?.('active');
  });
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByText('78 bpm')).toBeTruthy());
  expect(screen.getByText('Quiet')).toBeTruthy();
});

test('automatic sync follows the displayed check age and retries after a failed check', async () => {
  let now = Date.parse(first.synced_at!);
  let tick: (() => void) | undefined;
  const actualSetInterval = global.setInterval;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  invoke.mockImplementation(async () => ({ data: { changed: false, checkedAt: new Date(now).toISOString() }, error: null }));
  jest.spyOn(global, 'setInterval').mockImplementation((handler, timeout, ...args) => {
    if (timeout === 60 * 1000) tick = handler as () => void;
    return actualSetInterval(handler, timeout, ...args);
  });
  render(<HealthDataProvider><ReadingProbe /></HealthDataProvider>);
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));

  now += 14 * 60 * 1000;
  await act(async () => { tick?.(); });
  expect(invoke).toHaveBeenCalledTimes(1);
  invoke.mockResolvedValueOnce({ data: null, error: new Error('temporary sync failure') });
  now += 60 * 1000;
  await act(async () => { tick?.(); });
  expect(invoke).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Quiet')).toBeTruthy();

  now += 60 * 1000;
  await act(async () => { tick?.(); });
  expect(invoke).toHaveBeenCalledTimes(2);

  mockDatabaseRows = [{ ...first, id: 'vital-2', heart_rate_bpm: 78,
    recorded_at: '2026-10-08T09:17:00.000Z', synced_at: '2026-10-08T09:18:00.000Z' }];
  now += 60 * 1000;
  await act(async () => { tick?.(); });
  expect(invoke).toHaveBeenCalledTimes(3);
  await waitFor(() => expect(screen.getByText('78 bpm')).toBeTruthy());
  expect(screen.getByText('Quiet')).toBeTruthy();

  now += 15 * 60 * 1000;
  await act(async () => { tick?.(); });
  expect(invoke).toHaveBeenCalledTimes(4);
});

test('a foreground sync exposes the watch status while a webhook still updates the reading', async () => {
  invoke.mockResolvedValue({ data: { changed: false, checkedAt: first.synced_at,
    watchSync: { deviceVersion: 'Inspire 3', lastSyncTime: '2026-10-08T09:00:00Z' } }, error: null });
  render(<HealthDataProvider><ReadingProbe /></HealthDataProvider>);
  await waitFor(() => expect(screen.getByText('Inspire 3')).toBeTruthy());
  await act(async () => { mockReceiveVital?.({ eventType: 'INSERT', new: { ...first, id: 'vital-2', heart_rate_bpm: 79 } }); });
  expect(screen.getByText('79 bpm')).toBeTruthy();
  expect(screen.getByText('Inspire 3')).toBeTruthy();
  expect(invoke).toHaveBeenCalledTimes(1);
});

test('watch delay uses its last device sync, not the time the API was checked', () => {
  const now = Date.parse('2026-10-08T10:00:00Z');
  expect(watchSyncDelayed('2026-10-08T09:01:00Z', now)).toBe(false);
  expect(watchSyncDelayed('2026-10-08T08:59:00Z', now)).toBe(true);
  expect(watchSyncDelayed('2026-10-08T08:00:00Z', now, '2026-10-08T09:30:00Z')).toBe(false);
  expect(watchSyncDelayed('2026-10-08T08:00:00Z', now, '2026-10-08T08:30:00Z')).toBe(true);
  expect(watchSyncDelayed(null, now)).toBe(false);
  expect(watchSyncDelayed('invalid', now)).toBe(false);
});

test('the measurement age is not replaced by the latest sync time', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-08T09:10:00.000Z'));
  expect(vitalTimeLabel(first, 'heart_rate_bpm')).toBe('Measured 10m ago');
  const legacyVital: VitalLog = { ...first, measurement_times: null, synced_at: '2026-10-08T09:10:00.000Z' };
  expect(vitalTimeLabel(legacyVital, 'heart_rate_bpm'))
    .toBe('Sample time unavailable');
  jest.useRealTimers();
});

test('unchanged Google readings do not create another vital event', () => {
  const results: HealthResults = {
    heart: { dataPoints: [{ heartRate: { beatsPerMinute: '81', sampleTime: { physicalTime: '2026-10-08T09:00:00Z' } } }] },
    oxygen: {}, dailyOxygen: {}, sleep: {}, steps: {}, temperature: {}, hrv: {},
  };
  const firstSnapshot = buildHealthSnapshot(results, '2026-10-08T09:01:00Z');
  const laterCheck = buildHealthSnapshot(results, '2026-10-08T09:10:00Z');
  expect(firstSnapshot.recorded_at).toBe('2026-10-08T09:00:00.000Z');
  expect(snapshotChanged(firstSnapshot, laterCheck)).toBe(false);
  const newSample = buildHealthSnapshot({ ...results, heart: { dataPoints: [{ heartRate: { beatsPerMinute: '78', sampleTime: { physicalTime: '2026-10-08T09:05:00Z' } } }] } }, '2026-10-08T09:10:00Z');
  expect(snapshotChanged(firstSnapshot, newSample)).toBe(true);
});

test('webhook accepts only authorized relevant data types', () => {
  expect(matchesWebhookSecret('Bearer expected', 'Bearer expected')).toBe(true);
  expect(matchesWebhookSecret('Bearer wrong', 'Bearer expected')).toBe(false);
  expect(webhookHealthUsers([
    { data: { healthUserId: 'health-1', operation: 'UPSERT', dataType: 'heart-rate' } },
    { data: { healthUserId: 'health-1', operation: 'DELETE', dataType: 'sleep' } },
    { data: { healthUserId: 'health-2', operation: 'UPSERT', dataType: 'weight' } },
  ])).toEqual(['health-1']);
});

test('a Google-style signature verifies the exact body and rejects tampering', async () => {
  const { createPublicKey, generateKeyPairSync, sign, webcrypto } = require('crypto') as typeof import('crypto');
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = createPublicKey(privateKey).export({ format: 'jwk' });
  const protobuf = Buffer.concat([
    Buffer.from([0x1a, 0x20]), Buffer.from(jwk.x!, 'base64url'),
    Buffer.from([0x22, 0x20]), Buffer.from(jwk.y!, 'base64url'),
  ]);
  const body = '{"data":{"healthUserId":"health-1"}}';
  const signature = Buffer.concat([Buffer.from([1, 0, 0, 0, 7]), sign('sha256', Buffer.from(body), privateKey)]).toString('base64');
  const keys = { key: [{ keyId: 7, status: 'ENABLED', keyData: { value: protobuf.toString('base64') } }] };
  expect(await verifyHealthSignature(body, signature, keys, webcrypto.subtle as SubtleCrypto)).toBe(true);
  expect(await verifyHealthSignature(`${body} `, signature, keys, webcrypto.subtle as SubtleCrypto)).toBe(false);
});
