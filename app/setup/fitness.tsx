import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, useColorScheme } from 'react-native';
import { AppText as Text } from '@/src/components/AppText';
import { GalaxyWatchConnection } from '@/src/components/GalaxyWatchConnection';
import { SetupScaffold } from '@/src/components/SetupScaffold';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme } from '@/src/theme/colors';

export default function FitnessSetupScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { session, refreshOnboarding } = useAuth();
  const theme = getTheme(useColorScheme() === 'dark');
  const [saving, setSaving] = useState(false);
  const done = useCallback(() => router.replace(mode === 'edit' ? '/profile' : '/setup/location'), [mode, router]);
  if (!session) return <Redirect href="/login" />;
  const skip = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('onboarding_progress').upsert({ user_id: session.user.id,
        wearable_provider: 'galaxy_watch', wearable_status: 'skipped', wearable_completed_at: now, updated_at: now }, { onConflict: 'user_id' });
      if (error) throw error;
      await refreshOnboarding(); done();
    } catch (error) { Alert.alert('Unable to continue', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setSaving(false); }
  };
  return <SetupScaffold step={3} title="Connect Galaxy Watch6" subtitle="Pair the watch directly with this patient profile to receive measurements and location.">
    <GalaxyWatchConnection onConnected={done} />
    <Pressable disabled={saving} onPress={() => mode === 'edit' ? router.back() : void skip()} style={{ padding: 16, alignItems: 'center' }}>
      <Text style={{ color: theme.subtitle }}>{mode === 'edit' ? 'Back to profile' : 'Set up later'}</Text>
    </Pressable>
  </SetupScaffold>;
}
