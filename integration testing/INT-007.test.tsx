import { reading, showHealth } from '../test-support/integration/health-screen-harness';

test('INT-007 insufficient synchronized history keeps Health predictions pending', async () => {
  const screen = await showHealth([reading(2), reading(1)], 'Predictions');
  expect(screen.getByText('Building personal trends')).toBeTruthy();
});
