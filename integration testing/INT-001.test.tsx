import { routeSignedInCaregiver } from '../test-support/integration/auth-route-harness';

test('INT-001 authenticated caregiver with incomplete profile enters caregiver setup', async () => {
  expect(await routeSignedInCaregiver({ intro_completed_at: '2026-10-01T00:00:00Z' })).toBe('/setup/caregiver');
});
