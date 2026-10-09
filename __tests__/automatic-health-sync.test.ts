import { automaticHealthSyncDue } from '@/src/lib/automatic-health-sync';
import { timeAgo } from '@/src/lib/format';

const minute = 60 * 1000;
const at = (time: string) => Date.parse(`2026-10-08T${time}:00Z`);

function status(overrides: Partial<Parameters<typeof automaticHealthSyncDue>[0]> = {}) {
  return {
    now: at('09:14'),
    watchLastSyncAt: '2026-10-08T09:00:00Z',
    heartMeasuredAt: '2026-10-08T09:05:00Z',
    lastCheckedAt: '2026-10-08T09:11:00Z',
    lastAttemptAt: at('09:11'),
    lastAttemptFailed: false,
    ...overrides,
  };
}

test('refreshes as soon as either displayed age reaches 15 minutes', () => {
  expect(timeAgo('2026-10-08T09:00:00Z', at('09:15') - 1)).toBe('14m ago');
  expect(timeAgo('2026-10-08T09:00:00Z', at('09:15'))).toBe('15m ago');
  expect(automaticHealthSyncDue(status({ now: at('09:15') - 1 }))).toBe(false);
  expect(automaticHealthSyncDue(status({ now: at('09:15') }))).toBe(true);
  expect(automaticHealthSyncDue(status({
    now: at('09:15'), watchLastSyncAt: '2026-10-08T09:05:00Z', heartMeasuredAt: '2026-10-08T09:00:00Z',
  }))).toBe(true);
});

test('uses the displayed age instead of an older check when a reading is fresh', () => {
  expect(automaticHealthSyncDue(status({
    now: at('09:14'),
    watchLastSyncAt: '2026-10-08T09:10:00Z',
    heartMeasuredAt: '2026-10-08T09:11:00Z',
    lastCheckedAt: '2026-10-08T08:00:00Z',
    lastAttemptAt: at('08:00'),
  }))).toBe(false);
});

test('rechecks shortly after 15m ago remains on the screen', () => {
  expect(automaticHealthSyncDue(status({ now: at('09:16') - 1, lastCheckedAt: '2026-10-08T09:15:00Z', lastAttemptAt: at('09:15') }))).toBe(false);
  expect(automaticHealthSyncDue(status({ now: at('09:16'), lastCheckedAt: '2026-10-08T09:15:00Z', lastAttemptAt: at('09:15') }))).toBe(true);
});

test('backs off checks when the wearable remains stale for much longer', () => {
  expect(automaticHealthSyncDue(status({ now: at('09:50'), lastAttemptAt: at('09:46') }))).toBe(false);
  expect(automaticHealthSyncDue(status({ now: at('09:51'), lastAttemptAt: at('09:46') }))).toBe(true);
  expect(automaticHealthSyncDue(status({ now: at('11:15'), lastAttemptAt: at('11:01') }))).toBe(false);
  expect(automaticHealthSyncDue(status({ now: at('11:16'), lastAttemptAt: at('11:01') }))).toBe(true);
});

test('retries a failed stale check after two minutes', () => {
  expect(automaticHealthSyncDue(status({ now: at('09:16'), lastAttemptAt: at('09:15'), lastAttemptFailed: true }))).toBe(false);
  expect(automaticHealthSyncDue(status({ now: at('09:17'), lastAttemptAt: at('09:15'), lastAttemptFailed: true }))).toBe(true);
});

test('falls back to the last successful check when watch and BPM times are unavailable', () => {
  const missing = { watchLastSyncAt: null, heartMeasuredAt: null, lastCheckedAt: '2026-10-08T09:00:00Z', lastAttemptAt: at('09:00') };
  expect(automaticHealthSyncDue(status({ ...missing, now: at('09:15') - minute }))).toBe(false);
  expect(automaticHealthSyncDue(status({ ...missing, now: at('09:15') }))).toBe(true);
});
