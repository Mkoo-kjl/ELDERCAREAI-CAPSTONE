import { reading, showHealth } from '../test-support/integration/health-screen-harness';

test('INT-009 normal vital data shows no current Health anomaly', async () => {
  const screen = await showHealth([reading(1)], 'Anomalies');
  expect(screen.getByText('No current anomalies detected')).toBeTruthy();
});
