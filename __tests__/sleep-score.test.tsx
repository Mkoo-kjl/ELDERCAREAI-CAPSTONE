import { render, screen } from '@testing-library/react-native';

import { MetricCard } from '@/src/components/MetricCard';
import { formatSleepDuration, sleepDurationContext } from '@/src/lib/sleep-score';

describe('sleep duration context', () => {
  it('does not grade 9.4 hours of sleep as Fair', () => {
    expect(sleepDurationContext(9.4)?.label).toBe('Above the 7-8h guide');
    expect(sleepDurationContext(9.4)?.note).toContain('not, by itself, poor sleep');
    expect(sleepDurationContext(7.5)?.label).toBe('Within the 7-8h guide');
  });

  it('does not invent missing values or scores', () => {
    expect(sleepDurationContext(5)?.label).toBe('Below the 7-8h guide');
    expect(sleepDurationContext(null)).toBeNull();
    expect(sleepDurationContext(Number.NaN)).toBeNull();
    expect(sleepDurationContext(25)).toBeNull();
    expect(formatSleepDuration(564)).toBe('9h 24m');
  });

  it('shows duration context on the card', async () => {
    await render(<MetricCard icon="moon-outline" title="Sleep" value="9.4" unit="hours" timestamp="Measured today" color="#8763a4" annotation="Above the 7-8h guide" />);
    expect(screen.getByText('9.4')).toBeTruthy();
    expect(screen.getByText('Above the 7-8h guide')).toBeTruthy();
  });
});
