import { reading, showHealth } from '../test-support/integration/health-screen-harness';

test('INT-008 abnormal vital data appears in Health anomalies', async () => {
  const screen = await showHealth([reading(1, { heart_rate_bpm: 118, spo2_percent: 92 })], 'Anomalies');
  expect(screen.getByText('Low SpO₂ threshold crossed')).toBeTruthy();
  expect(screen.getByText('Heart-rate threshold crossed')).toBeTruthy();
});
