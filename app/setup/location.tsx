import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { AppText as Text } from '@/src/components/AppText';
import { GradientButton } from '@/src/components/GradientButton';
import { SetupScaffold } from '@/src/components/SetupScaffold';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

export default function LocationConsentScreen() {
  const router = useRouter();
  const { session, onboarding, refreshOnboarding } = useAuth();
  const theme = getTheme(useColorScheme() === 'dark');
  const [saving, setSaving] = useState(false);

  if (!session) return <Redirect href="/login" />;

  const complete = async (permission: 'granted' | 'denied') => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error: progressError } = await supabase.from('onboarding_progress').upsert({
        user_id: session.user.id,
        location_permission: permission,
        location_consent_at: now,
        completed_at: now,
        updated_at: now,
      }, { onConflict: 'user_id' });
      if (progressError) throw progressError;

      if (permission === 'granted' && onboarding?.wearable_status === 'connected') {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { data: elderly } = await supabase.from('elderly_profiles').select('elderly_id').eq('caregiver_id', session.user.id).limit(1).maybeSingle();
        const { error: locationError } = await supabase.from('wearable_sync_locations').insert({
          user_id: session.user.id,
          elderly_id: elderly?.elderly_id ?? null,
          event_type: 'wearable_connection',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          recorded_at: new Date(position.timestamp).toISOString(),
        });
        if (locationError) throw locationError;
      }

      await refreshOnboarding();
      router.replace('/home');
    } catch (error) {
      Alert.alert('Unable to finish setup', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const requestPermission = async () => {
    setSaving(true);
    const response = await Location.requestForegroundPermissionsAsync();
    setSaving(false);
    await complete(response.granted ? 'granted' : 'denied');
  };

  return (
    <SetupScaffold step={4} title="Phone location consent" subtitle="Choose whether ElderCareAI may record this phone’s location at specific health-sync events.">
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="phone-portrait-outline" size={40} color={palette.primaryDark} />
        </View>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Your phone, not the watch</Text>
        <Text style={[styles.heroText, { color: theme.subtitle }]}>This permission does not expose the Fitbit Inspire 3’s live GPS location.</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardElevated }]}>
        <ConsentRow icon="navigate-circle-outline" title="When it is recorded" body="Once after a successful wearable connection, and later when you explicitly synchronize health data." />
        <ConsentRow icon="eye-off-outline" title="What we do not do" body="No continuous tracking, no hidden background location, and no claim that the phone is where the older adult or watch is." />
        <ConsentRow icon="shield-checkmark-outline" title="Your control" body="Only foreground permission is requested. You can deny it and still finish setup or use the app." last />
      </View>

      <View style={[styles.disclosure, { backgroundColor: `${palette.warning}12` }]}>
        <Ionicons name="information-circle" size={21} color={palette.warning} />
        <Text style={[styles.disclosureText, { color: theme.text }]}>If permission is granted but the wearable is disconnected, no location is recorded now. A future successful sync may record the phone’s location while the app is open.</Text>
      </View>

      <GradientButton label="Allow phone location" icon="location" onPress={() => void requestPermission()} loading={saving} />
      <Pressable disabled={saving} onPress={() => void complete('denied')} style={styles.skipButton}>
        <Text style={[styles.skipText, { color: theme.subtitle }]}>Continue without location</Text>
      </Pressable>
    </SetupScaffold>
  );
}

function ConsentRow({ icon, title, body, last }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; last?: boolean }) {
  const theme = getTheme(useColorScheme() === 'dark');
  return (
    <View style={[styles.row, !last && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
      <View style={[styles.rowIcon, { backgroundColor: `${palette.primary}16` }]}>
        <Ionicons name={icon} size={21} color={palette.primaryDark} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.rowBody, { color: theme.subtitle }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 22 },
  heroIcon: { width: 82, height: 82, borderRadius: 14, backgroundColor: palette.aquaSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  heroTitle: { ...typeScale.sectionTitle },
  heroText: { marginTop: 7, maxWidth: 350, ...typeScale.body, textAlign: 'center' },
  card: { borderRadius: 14, paddingHorizontal: 17 },
  row: { flexDirection: 'row', paddingVertical: 17 },
  rowIcon: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, marginLeft: 12 },
  rowTitle: { ...typeScale.cardTitle },
  rowBody: { marginTop: 3, ...typeScale.subhead },
  disclosure: { marginTop: 16, padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  disclosureText: { flex: 1, ...typeScale.subhead },
  skipButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 13, fontFamily: fontFamily.semiBold },
});
