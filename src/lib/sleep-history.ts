import type { SleepSession } from '@/src/providers/HealthDataProvider';

export function recentNightlySleep(sessions: SleepSession[], now = new Date()) {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  const lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const byDate = new Map<string, SleepSession>();
  for (const session of sessions) {
    const end = new Date(session.session_end_at);
    if (!Number.isFinite(end.getTime()) || end.getTime() < firstDay || end.getTime() >= lastDay || session.minutes_asleep <= 0) continue;
    const dateKey = `${end.getFullYear()}-${end.getMonth()}-${end.getDate()}`;
    const saved = byDate.get(dateKey);
    if (!saved || (session.is_main_sleep && !saved.is_main_sleep)
      || (session.is_main_sleep === saved.is_main_sleep && session.minutes_asleep > saved.minutes_asleep)) byDate.set(dateKey, session);
  }
  return [...byDate.values()].sort((left, right) => Date.parse(right.session_end_at) - Date.parse(left.session_end_at));
}

export function sleepDateLabel(value: string, now = new Date()) {
  const date = new Date(value);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (day === today) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  if (day === yesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function sleepEfficiency(session: SleepSession) {
  const period = session.minutes_in_sleep_period;
  return period && period >= session.minutes_asleep
    ? Math.round((session.minutes_asleep / period) * 100) : null;
}
