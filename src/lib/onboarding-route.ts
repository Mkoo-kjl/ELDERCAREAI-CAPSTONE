import type { Href } from 'expo-router';

import type { OnboardingProgress } from '@/src/providers/AuthProvider';

export function getPostAuthRoute(progress: OnboardingProgress | null): Href {
  if (!progress?.caregiver_completed_at) return '/setup/caregiver';
  if (!progress.elderly_completed_at) return '/setup/elderly';
  if (!progress.wearable_completed_at) return '/setup/fitness';
  if (!progress.location_consent_at || !progress.completed_at) return '/setup/location';
  return '/home';
}
