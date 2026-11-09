import { reading, showHealth } from '../test-support/integration/health-screen-harness';

test('INT-008 four distinct readings produce a Health trend projection', async () => {
  const screen = await showHealth([reading(4), reading(3), reading(2), reading(1)], 'Predictions');
  expect(screen.getByText('Heart-rate trend projection')).toBeTruthy();
});
