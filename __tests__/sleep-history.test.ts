import { recentNightlySleep, sleepDateLabel, sleepEfficiency } from '@/src/lib/sleep-history';
import type { SleepSession } from '@/src/providers/HealthDataProvider';

const now = new Date('2026-10-10T12:00:00');
const session = (id: string, end: string, minutes: number, main = false): SleepSession => ({
  source_key: id, session_start_at: new Date(Date.parse(end) - minutes * 60000).toISOString(),
  session_end_at: end, minutes_asleep: minutes, minutes_in_sleep_period: null,
  is_main_sleep: main, is_processed: true,
});

test('keeps one main sleep per day and ignores naps and old sessions', () => {
  const nights = recentNightlySleep([
    session('old', '2026-09-30T06:00:00', 480, true),
    session('main', '2026-10-09T06:00:00', 564, true),
    session('duplicate', '2026-10-09T06:00:00', 564, false),
    session('nap', '2026-10-09T16:00:00', 60),
    session('previous', '2026-10-08T06:00:00', 440, true),
  ], now);
  expect(nights.map((item) => item.source_key)).toEqual(['main', 'previous']);
  expect(sleepDateLabel(nights[0].session_end_at, now)).toBe('Yesterday');
});

test('shows efficiency only when actual time-in-bed data is available', () => {
  expect(sleepEfficiency(session('one', '2026-10-09T06:00:00', 564))).toBeNull();
  expect(sleepEfficiency({ ...session('two', '2026-10-09T06:00:00', 540), minutes_in_sleep_period: 600 })).toBe(90);
});

test('keeps a short main sleep rather than hiding an important night', () => {
  expect(recentNightlySleep([session('short', '2026-10-09T06:00:00', 125, true)], now).map((item) => item.source_key)).toEqual(['short']);
});
