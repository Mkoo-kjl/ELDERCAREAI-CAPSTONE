import { render, screen } from '@testing-library/react-native';

import { MetricCard } from '@/src/components/MetricCard';
import { sleepDurationScore } from '@/src/lib/sleep-score';

describe('duration-only sleep score', () => {
  it('scores a seven-hour session as Good', () => {
    expect(sleepDurationScore(7)).toEqual({ score: 90, label: 'Good' });
    expect(sleepDurationScore(7.5)).toEqual({ score: 100, label: 'Excellent' });
  });

  it('scores short sleep lower and does not invent a missing score', () => {
    expect(sleepDurationScore(5)).toEqual({ score: 50, label: 'Low' });
    expect(sleepDurationScore(null)).toBeNull();
    expect(sleepDurationScore(Number.NaN)).toBeNull();
    expect(sleepDurationScore(25)).toBeNull();
  });

  it('shows the recorded duration and its score together on a sleep card', async () => {
    await render(<MetricCard icon="moon-outline" title="Sleep" value="7.0" unit="hours" timestamp="Measured today" color="#8763a4" annotation="Sleep score 90 - Good" />);
    expect(screen.getByText('7.0')).toBeTruthy();
    expect(screen.getByText('Sleep score 90 - Good')).toBeTruthy();
  });
});
