import { reading, showHealth } from '../test-support/integration/health-screen-harness';

test('INT-003 synchronized vital data appears in the Health vitals view', async () => {
  const screen = await showHealth([reading(1, { heart_rate_bpm: 88, spo2_percent: 97.5 })]);
  expect(screen.getByText('Heart Rate')).toBeTruthy();
  expect(screen.getByText('Blood Oxygen')).toBeTruthy();
  expect(screen.getByText(/88 bpm/)).toBeTruthy();
  expect(screen.getByText(/97.5 %/)).toBeTruthy();
});
