export type SleepDurationScore = {
  score: number;
  label: 'Excellent' | 'Good' | 'Fair' | 'Low';
};

// App-defined duration estimate centered on 7.5 hours, not a clinical sleep-quality score.
export function sleepDurationScore(hours: number | null | undefined): SleepDurationScore | null {
  if (hours == null || !Number.isFinite(hours) || hours < 0 || hours > 24) return null;
  const score = Math.max(0, Math.min(100, Math.round(100 - Math.abs(hours - 7.5) * 20)));
  const label = score >= 95 ? 'Excellent' : score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Low';
  return { score, label };
}
