import { reading, showHealth } from '../test-support/integration/health-screen-harness';

test('INT-004 recorded sleep duration reaches the Health context label', async () => {
  const screen = await showHealth([reading(1, { sleep_hours: 5.5 })]);
  expect(screen.getByText('Below the 7-8h guide')).toBeTruthy();
});
