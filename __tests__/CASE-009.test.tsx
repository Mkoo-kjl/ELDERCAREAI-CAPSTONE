import { getPostAuthRoute } from '@/src/lib/onboarding-route';
import type { OnboardingProgress } from '@/src/providers/AuthProvider';

const completed: OnboardingProgress = {
  user_id: 'caregiver-1',
  intro_completed_at: '2026-10-07T00:00:00Z',
  caregiver_completed_at: '2026-10-07T00:00:00Z',
  elderly_completed_at: '2026-10-07T00:00:00Z',
  wearable_status: 'connected',
  paired_device_count: 1,
  wearable_completed_at: '2026-10-07T00:00:00Z',
  location_permission: 'granted',
  location_consent_at: '2026-10-07T00:00:00Z',
  completed_at: '2026-10-07T00:00:00Z',
};

describe('Onboarding route', () => {
  test('CASE-009 missing location consent prevents home access', () => {
    expect(getPostAuthRoute({ ...completed, location_consent_at: null })).toBe('/setup/location');
  });
});
