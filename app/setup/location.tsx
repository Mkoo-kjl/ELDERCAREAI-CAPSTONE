import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, useColorScheme, View } from 'react-native';
import { AppText as Text } from '@/src/components/AppText';
import { GradientButton } from '@/src/components/GradientButton';
import { SetupScaffold } from '@/src/components/SetupScaffold';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

export default function LocationConsentScreen() {
  const router = useRouter();
  const { session, refreshOnboarding } = useAuth();
  const theme = getTheme(useColorScheme() === 'dark');
  const [saving, setSaving] = useState(false);
  if (!session) return <Redirect href="/login" />;
  const complete = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('onboarding_progress').upsert({ user_id: session.user.id,
        location_permission: 'denied', location_consent_at: now, completed_at: now, updated_at: now }, { onConflict: 'user_id' });
      if (error) throw error;
      await refreshOnboarding(); router.replace('/home');
    } catch (error) { Alert.alert('Unable to finish setup', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setSaving(false); }
  };
  return <SetupScaffold step={4} title="Watch location sharing" subtitle="Location permission is requested on Galaxy Watch when you start monitoring.">
    <View style={[styles.card, { backgroundColor: theme.cardElevated }]}>
      <ConsentRow icon="watch-outline" title="Start on the watch" body="Open ElderCareAI Watch, allow precise location and sensor access, then tap Start monitoring. Measurements are sent to this patient profile." />
      <ConsentRow icon="navigate-circle-outline" title="GPS and location fallback" body="The watch requests satellite GPS and fused location. Fused location may use the paired phone; the map shows its source, accuracy and measurement time." />
      <ConsentRow icon="stop-circle-outline" title="Your control" body="Tap Stop monitoring on the watch to end sharing. The app identifies old readings and offline sessions." last />
    </View>
    <GradientButton label="Finish setup" icon="checkmark-circle-outline" loading={saving} onPress={() => void complete()} />
  </SetupScaffold>;
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
