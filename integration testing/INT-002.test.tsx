import { routeSignedInCaregiver } from '../test-support/integration/auth-route-harness';

test('INT-002 completed onboarding routes authenticated caregiver home', async () => {
  expect(await routeSignedInCaregiver({
    intro_completed_at: '2026-10-01T00:00:00Z', caregiver_completed_at: '2026-10-01T00:00:00Z',
    elderly_completed_at: '2026-10-01T00:00:00Z', wearable_completed_at: '2026-10-01T00:00:00Z',
    location_consent_at: '2026-10-01T00:00:00Z', completed_at: '2026-10-01T00:00:00Z',
  })).toBe('/home');
});
