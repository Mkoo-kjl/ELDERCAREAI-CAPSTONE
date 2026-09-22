import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { GradientButton } from '@/src/components/GradientButton';
import { SetupScaffold } from '@/src/components/SetupScaffold';
import { getFunctionErrorMessage } from '@/src/lib/function-error';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme, palette } from '@/src/theme/colors';

const requestedData = [
  ['heart-outline', 'Heart health', 'Heart rate and resting heart-rate measurements'],
  ['water-outline', 'Blood oxygen', 'SpO₂ samples and daily oxygen summaries'],
  ['moon-outline', 'Sleep', 'Sleep sessions, duration, and stages when available'],
  ['footsteps-outline', 'Activity', 'Steps and activity measurements'],
  ['thermometer-outline', 'Temperature', 'Daily sleep skin-temperature derivations'],
] as const;

export default function FitnessSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ connected?: string; error?: string; devices?: string; mode?: string }>();
  const { session, onboarding, refreshOnboarding } = useAuth();
  const theme = getTheme(useColorScheme() === 'dark');
  const [connecting, setConnecting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isEditMode = params.mode === 'edit';
  const appRedirectUri = Linking.createURL('setup/fitness', {
    scheme: 'eldercareai',
    queryParams: isEditMode ? { mode: 'edit' } : undefined,
  });

  useEffect(() => {
    if (params.connected !== '1') return;
    void refreshOnboarding();
    const timer = setTimeout(() => router.replace(isEditMode ? '/profile' : '/setup/location'), 700);
    return () => clearTimeout(timer);
  }, [isEditMode, params.connected, refreshOnboarding, router]);

  useEffect(() => {
    if (params.error) setLocalError(String(params.error));
  }, [params.error]);

  if (!session) return <Redirect href="/login" />;

  const connect = async () => {
    setConnecting(true);
    setLocalError(null);
    try {
      const { data, error } = await supabase.functions.invoke('google-health-oauth-start', {
        body: { appRedirectUri },
      });
      if (error) throw error;
      if (!data?.authorizationUrl) throw new Error('The Google Health authorization URL was not returned.');

      const result = await WebBrowser.openAuthSessionAsync(data.authorizationUrl, appRedirectUri, { showInRecents: true });
      if (result.type === 'success') {
        const callback = new URL(result.url);
        const callbackError = callback.searchParams.get('error');
        if (callbackError) throw new Error(callbackError);
        if (callback.searchParams.get('connected') === '1') {
          await refreshOnboarding();
          router.replace(isEditMode ? '/profile' : '/setup/location');
        }
      }
    } catch (error) {
      const message = await getFunctionErrorMessage(error, 'Could not connect Google Health.');
      setLocalError(message);
      Alert.alert('Connection unsuccessful', message);
    } finally {
      setConnecting(false);
    }
  };

  const skip = async () => {
    setConnecting(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from('onboarding_progress').upsert({
      user_id: session.user.id,
      wearable_status: 'skipped',
      wearable_completed_at: now,
      updated_at: now,
    }, { onConflict: 'user_id' });
    setConnecting(false);
    if (error) Alert.alert('Unable to continue', error.message);
    else {
      await refreshOnboarding();
      router.replace(isEditMode ? '/profile' : '/setup/location');
    }
  };

  const authorized = onboarding?.wearable_status === 'connected'
    || onboarding?.wearable_status === 'authorized_no_device'
    || params.connected === '1';
  const deviceCount = params.devices !== undefined ? Number(params.devices) : (onboarding?.paired_device_count ?? 0);

  return (
    <SetupScaffold step={3} title="Connect your watch" subtitle="Link the Google account that receives data from the Fitbit Inspire 3.">
      <View style={styles.hero}>
        <LinearGradient colors={[palette.accent, palette.accentDark]} style={styles.heroIcon}>
          <Ionicons name="fitness" size={48} color="#FFFFFF" />
        </LinearGradient>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Google Health API v4</Text>
        <Text style={[styles.heroText, { color: theme.subtitle }]}>Google Health is the current cloud API for supported Fitbit and Pixel devices. You stay in control of every scope.</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
        <Text style={[styles.cardLabel, { color: theme.subtitle }]}>READ-ONLY DATA REQUESTED</Text>
        {requestedData.map(([icon, title, description]) => (
          <View key={title} style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: `${palette.primary}18` }]}>
              <Ionicons name={icon} size={20} color={palette.primaryDark} />
            </View>
            <View style={styles.featureCopy}>
              <Text style={[styles.featureTitle, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.featureText, { color: theme.subtitle }]}>{description}</Text>
            </View>
          </View>
        ))}
        <View style={[styles.note, { backgroundColor: theme.card }]}>
          <Ionicons name="information-circle-outline" size={19} color={theme.subtitle} />
          <Text style={[styles.noteText, { color: theme.subtitle }]}>Stress is not requested as a nonexistent raw scope. Later insights may derive stress indicators from supported measurements such as heart-rate variability.</Text>
        </View>
      </View>

      {authorized ? (
        <View style={[styles.status, { backgroundColor: `${palette.accent}12`, borderColor: palette.accent }]}>
          <Ionicons name={deviceCount > 0 ? 'checkmark-circle' : 'information-circle'} size={22} color={deviceCount > 0 ? palette.accent : palette.warning} />
          <Text style={[styles.statusText, { color: theme.text }]}>
            {deviceCount > 0 ? `Google Health connected • ${deviceCount} paired device(s)` : 'Google Health authorized • no paired wearable found'}
          </Text>
        </View>
      ) : (
        <View style={[styles.status, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="cloud-offline-outline" size={22} color={theme.subtitle} />
          <Text style={[styles.statusText, { color: theme.subtitle }]}>Disconnected — no health readings will be fabricated.</Text>
        </View>
      )}

      {localError ? <Text style={styles.error}>{localError}</Text> : null}
      <GradientButton label="Connect with Google Health" icon="logo-google" onPress={() => void connect()} loading={connecting} colors={[palette.google, palette.googleDark]} />
      <Pressable disabled={connecting} onPress={() => void skip()} style={styles.skipButton}>
        <Text style={[styles.skipText, { color: theme.subtitle }]}>Skip for now</Text>
      </Pressable>
    </SetupScaffold>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 22 },
  heroIcon: { width: 94, height: 94, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroText: { marginTop: 7, maxWidth: 360, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  card: { padding: 18, borderRadius: 20, borderWidth: 1 },
  cardLabel: { marginBottom: 14, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  featureIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1, marginLeft: 12 },
  featureTitle: { fontSize: 14, fontWeight: '700' },
  featureText: { marginTop: 2, fontSize: 12, lineHeight: 17 },
  note: { marginTop: 2, padding: 12, borderRadius: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noteText: { flex: 1, fontSize: 11, lineHeight: 16 },
  status: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusText: { flex: 1, fontSize: 13, fontWeight: '600' },
  error: { marginTop: 10, color: palette.error, fontSize: 12, lineHeight: 17 },
  skipButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 14, fontWeight: '600' },
});
