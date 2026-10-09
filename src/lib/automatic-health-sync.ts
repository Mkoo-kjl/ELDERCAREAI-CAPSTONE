import { timeAgo } from './format';

export const AUTOMATIC_SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const AUTOMATIC_SYNC_RETRY_MS = 2 * 60 * 1000;
const RECENTLY_STALE_WINDOW_MS = 30 * 60 * 1000;
const EXTENDED_STALE_WINDOW_MS = 2 * 60 * 60 * 1000;
const RECENTLY_STALE_RETRY_MS = 60 * 1000;
const EXTENDED_STALE_RETRY_MS = 5 * 60 * 1000;

type AutomaticSyncStatus = {
  now: number;
  watchLastSyncAt: string | null;
  heartMeasuredAt: string | null;
  lastCheckedAt: string | null;
  lastAttemptAt: number;
  lastAttemptFailed: boolean;
};

export function automaticHealthSyncDue(status: AutomaticSyncStatus) {
  const markers = [status.watchLastSyncAt, status.heartMeasuredAt]
    .map((value) => Date.parse(value ?? ''))
    .filter(Number.isFinite);
  const staleAt = markers.length ? Math.min(...markers) + AUTOMATIC_SYNC_INTERVAL_MS : Number.NaN;
  const lastChecked = Date.parse(status.lastCheckedAt ?? '');
  const visibleAges = [status.watchLastSyncAt, status.heartMeasuredAt]
    .map((value) => timeAgo(value, status.now)).filter((value) => value !== null);
  const markerDue = visibleAges.some((age) => {
    const match = /^(\d+)([mhd]) ago$/.exec(age);
    return Boolean(match && (match[2] !== 'm' || Number(match[1]) >= 15));
  });
  const checkDue = !Number.isFinite(lastChecked) || status.now - lastChecked >= AUTOMATIC_SYNC_INTERVAL_MS;
  if (visibleAges.length ? !markerDue : !checkDue) return false;
  if (!status.lastAttemptAt) return true;
  if (status.lastAttemptFailed) return status.now - status.lastAttemptAt >= AUTOMATIC_SYNC_RETRY_MS;
  if (markerDue && status.lastAttemptAt < staleAt) return true;
  if (markerDue) {
    const staleFor = status.now - staleAt;
    const retryAfter = staleFor < RECENTLY_STALE_WINDOW_MS ? RECENTLY_STALE_RETRY_MS
      : staleFor < EXTENDED_STALE_WINDOW_MS ? EXTENDED_STALE_RETRY_MS : AUTOMATIC_SYNC_INTERVAL_MS;
    return status.now - status.lastAttemptAt >= retryAfter;
  }
  return status.now - status.lastAttemptAt >= AUTOMATIC_SYNC_INTERVAL_MS;
}

