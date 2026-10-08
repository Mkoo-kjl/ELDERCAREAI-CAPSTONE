export function watchSyncDelayed(lastSyncTime: string | null | undefined, now = Date.now(), latestVitalTime?: string | null) {
  if (!lastSyncTime) return false;
  const syncedAt = Date.parse(lastSyncTime);
  const measuredAt = Date.parse(latestVitalTime ?? '');
  const lastKnownActivity = Number.isFinite(measuredAt) ? Math.max(syncedAt, measuredAt) : syncedAt;
  return Number.isFinite(syncedAt) && now - lastKnownActivity > 60 * 60 * 1000;
}
