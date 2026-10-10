export type SleepDurationContext = { label: string; note: string };

// Duration is not a sleep-quality score. The guide is context, not a target to grade.
export function sleepDurationContext(hours: number | null | undefined): SleepDurationContext | null {
  if (hours == null || !Number.isFinite(hours) || hours < 0 || hours > 24) return null;
  if (hours < 7) return { label: 'Below the 7-8h guide', note: 'The recorded duration is shorter than the general older-adult guide. Duration alone does not show sleep quality.' };
  if (hours <= 8) return { label: 'Within the 7-8h guide', note: 'The recorded duration is within the general older-adult guide. Duration alone does not show sleep quality.' };
  return { label: 'Above the 7-8h guide', note: 'The recorded duration is longer than the general older-adult guide. A longer night is not, by itself, poor sleep.' };
}

export function formatSleepDuration(minutes: number) {
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60)}h ${String(rounded % 60).padStart(2, '0')}m`;
}
