import { reading, showHealth } from '../test-support/integration/health-screen-harness';

test('INT-005 low oxygen reaches the Health insight card', async () => {
  const screen = await showHealth([reading(1, { spo2_percent: 92 })], 'AI Insights');
  expect(screen.getByText('Critical · Recheck now')).toBeTruthy();
});
