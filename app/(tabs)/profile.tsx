import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfilePhotoPicker, type LocalPhoto } from '@/src/components/ProfilePhotoPicker';
import { uploadProfilePhoto } from '@/src/lib/profile-photo';
import { ensureNotificationPermission, hasNotificationPermission } from '@/src/lib/notifications';
import { exportHealthReportPdf, exportMedicationReportPdf } from '@/src/lib/pdf-reports';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { useHealthData, type VitalLog } from '@/src/providers/HealthDataProvider';
import { useThemePreference } from '@/src/providers/ThemePreferenceProvider';
import { getTheme, palette } from '@/src/theme/colors';

type Caregiver = { full_name: string; email: string | null; photo_url: string | null };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = getTheme(useColorScheme() === 'dark');
  const { session, onboarding, refreshOnboarding, signOut } = useAuth();
  const { elderly, refresh } = useHealthData();
  const { isDark, toggleDarkMode } = useThemePreference();
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [exporting, setExporting] = useState<'health' | 'medications' | null>(null);

  const loadCaregiver = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase.from('caregivers').select('full_name, email, photo_url').eq('id', session.user.id).maybeSingle();
    if (error) Alert.alert('Unable to load account', error.message); else setCaregiver(data as Caregiver | null);
  }, [session]);
  useFocusEffect(useCallback(() => {
    void loadCaregiver();
    void hasNotificationPermission().then(setNotificationsEnabled);
  }, [loadCaregiver]));

  const configureNotifications = async () => {
    if (notificationsEnabled) {
      Alert.alert('Notification settings', 'Use the phone settings to change or disable ElderCareAI notifications.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() }]);
      return;
    }
    const granted = await ensureNotificationPermission();
    setNotificationsEnabled(granted);
    if (!granted) Alert.alert('Notifications are off', 'Enable notifications in the phone settings to receive appointment, medication, and health reminders.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() }]);
  };

  const savePhoto = async (kind: 'caregiver' | 'elderly', photo: LocalPhoto) => {
    if (!session || (kind === 'elderly' && !elderly)) return;
    setUploading(kind);
    try {
      const url = await uploadProfilePhoto(session.user.id, kind, photo);
      const result = kind === 'caregiver'
        ? await supabase.from('caregivers').update({ photo_url: url, updated_at: new Date().toISOString() }).eq('id', session.user.id)
        : await supabase.from('elderly_profiles').update({ photo_url: url }).eq('elderly_id', elderly!.elderly_id);
      if (result.error) throw result.error;
      await Promise.all([loadCaregiver(), refresh(false)]);
    } catch (caught) { Alert.alert('Unable to upload photo', caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setUploading(null); }
  };

  const disconnect = () => Alert.alert('Disconnect Google Health?', 'Future synchronizations will stop. Existing health logs remain in your account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', style: 'destructive', onPress: async () => {
    const { error } = await supabase.functions.invoke('google-health-disconnect');
    if (error) Alert.alert('Unable to disconnect', error.message); else { await refreshOnboarding(); Alert.alert('Disconnected', 'Google Health access was revoked and local tokens were removed.'); }
  } }]);

  const exportHealth = async () => {
    if (!elderly) { Alert.alert('Nothing to export', 'Complete the older adult profile first.'); return; }
    setExporting('health');
    try {
      const { data, error } = await supabase
        .from('vital_sign_logs')
        .select('*')
        .eq('elderly_id', elderly.elderly_id)
        .order('recorded_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      if (!data?.length) { Alert.alert('Nothing to export', 'Synchronize Google Health first.'); return; }
      await exportHealthReportPdf({ patient: elderly, caregiverName: caregiver?.full_name ?? 'Caregiver', history: data as VitalLog[] });
    }
    catch (caught) { Alert.alert('Unable to export report', caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setExporting(null); }
  };
  const exportMedications = async () => {
    if (!session || !elderly) return;
    setExporting('medications');
    try {
      const { data, error } = await supabase.from('medication_schedules').select('medication_name, dosage, form, frequency, times_of_day, start_date, end_date, instructions, prescribed_by, is_active').eq('caregiver_id', session.user.id).eq('elderly_id', elderly.elderly_id).order('is_active', { ascending: false }).order('medication_name');
      if (error) throw error;
      if (!data?.length) { Alert.alert('Nothing to export', 'Add a medication schedule first.'); return; }
      await exportMedicationReportPdf({ patient: elderly, caregiverName: caregiver?.full_name ?? 'Caregiver', medications: data });
    } catch (caught) { Alert.alert('Unable to export report', caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setExporting(null); }
  };

  const connected = onboarding?.wearable_status === 'connected' || onboarding?.wearable_status === 'authorized_no_device';
  return <ScrollView style={[styles.screen, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 95 }}>
    <View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>Settings</Text><Text style={[styles.subtitle, { color: theme.subtitle }]}>Account, profiles & integrations</Text></View>
    <Section title="ACCOUNT"><View style={[styles.card, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}><View style={styles.account}><LinearGradient colors={[palette.primary, palette.accent]} style={styles.accountIcon}><Text style={styles.initial}>{(caregiver?.full_name ?? session?.user.email ?? 'C')[0].toUpperCase()}</Text></LinearGradient><View><Text style={[styles.cardTitle, { color: theme.text }]}>{caregiver?.full_name ?? 'Caregiver'}</Text><Text style={[styles.body, { color: theme.subtitle }]}>{caregiver?.email ?? session?.user.email}</Text></View></View></View></Section>
    <Section title="PROFILE PHOTOS"><View style={[styles.photoCard, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}><View style={styles.photoColumn}><ProfilePhotoPicker value={null} remoteUrl={caregiver?.photo_url} label={uploading === 'caregiver' ? 'Uploading…' : 'Caregiver photo'} onChange={(photo) => void savePhoto('caregiver', photo)} /></View><View style={styles.photoColumn}><ProfilePhotoPicker value={null} remoteUrl={elderly?.photo_url} label={uploading === 'elderly' ? 'Uploading…' : 'Older adult photo'} onChange={(photo) => void savePhoto('elderly', photo)} /></View></View></Section>
    <Section title="MANAGE PROFILES"><SettingsCard><Row icon="person-outline" title="Caregiver information" subtitle="Contact and personal details" onPress={() => router.push('/setup/caregiver?mode=edit')} /><Divider color={theme.border} /><Row icon="heart-outline" title="Older adult information" subtitle="Health profile and emergency contact" onPress={() => router.push('/setup/elderly?mode=edit')} /></SettingsCard></Section>
    <Section title="INTEGRATIONS"><SettingsCard><Row icon={connected ? 'checkmark-circle-outline' : 'cloud-offline-outline'} title="Google Health API v4" subtitle={connected ? onboarding?.wearable_status === 'connected' ? `${onboarding.paired_device_count} paired device(s)` : 'Authorized • no paired device' : 'Disconnected'} color={connected ? palette.accentDark : theme.subtitle} onPress={() => connected ? disconnect() : router.push('/setup/fitness?mode=edit')} trailing={connected ? 'Disconnect' : 'Connect'} /></SettingsCard></Section>
    <Section title="DATA MANAGEMENT"><SettingsCard><Row icon="document-outline" title="Health vitals PDF" subtitle={exporting === 'health' ? 'Generating organized report…' : 'Export a receipt-style table of synchronized readings'} onPress={exporting ? undefined : () => void exportHealth()} /><Divider color={theme.border} /><Row icon="receipt-outline" title="Medication schedule PDF" subtitle={exporting === 'medications' ? 'Generating organized report…' : 'Export medications as a caregiver-ready table'} onPress={exporting ? undefined : () => void exportMedications()} /></SettingsCard></Section>
    <Section title="PREFERENCES"><SettingsCard><Row icon="notifications-outline" title="Care notifications" subtitle={notificationsEnabled ? 'Appointments, medications, and health warnings enabled' : 'Tap to enable reminders'} color={notificationsEnabled ? palette.accentDark : palette.warning} onPress={() => void configureNotifications()} trailing={notificationsEnabled ? 'Enabled' : 'Enable'} /><Divider color={theme.border} /><View style={styles.row}><View style={[styles.rowIcon, { backgroundColor: `${palette.purple}14` }]}><Ionicons name="moon-outline" size={20} color={palette.purple} /></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: theme.text }]}>Dark Mode</Text><Text style={[styles.rowSubtitle, { color: theme.subtitle }]}>Use the dark color palette</Text></View><Switch value={isDark} onValueChange={toggleDarkMode} trackColor={{ true: palette.primary }} /></View></SettingsCard></Section>
    <Section title="ABOUT"><SettingsCard><Row icon="information-circle-outline" title="ElderCareAI" subtitle="Version 1.0.0" /><Divider color={theme.border} /><Row icon="shield-checkmark-outline" title="Privacy Policy" subtitle="How health and account data are handled" onPress={() => Alert.alert('Privacy Policy', 'ElderCareAI stores account and care data in your configured Supabase project. Google Health tokens remain server-side. This app does not perform hidden background location tracking. Replace this placeholder with your reviewed production policy before release.')} /><Divider color={theme.border} /><Row icon="document-outline" title="Terms of Service" subtitle="Demo application terms" onPress={() => Alert.alert('Terms of Service', 'This demo is not a medical device and does not provide medical diagnosis. Replace this placeholder with reviewed production terms before release.')} /></SettingsCard></Section>
    <Pressable onPress={() => void signOut()} style={styles.logout}><Ionicons name="log-out-outline" size={20} color={palette.error} /><Text style={styles.logoutText}>Log out</Text></Pressable>
  </ScrollView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { const theme = getTheme(useColorScheme() === 'dark'); return <View style={styles.section}><Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{title}</Text>{children}</View>; }
function SettingsCard({ children }: { children: React.ReactNode }) { const theme = getTheme(useColorScheme() === 'dark'); return <View style={[styles.card, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>{children}</View>; }
function Divider({ color }: { color: string }) { return <View style={[styles.divider, { backgroundColor: color }]} />; }
function Row({ icon, title, subtitle, color = palette.primaryDark, onPress, trailing }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; color?: string; onPress?: () => void; trailing?: string }) { const theme = getTheme(useColorScheme() === 'dark'); return <Pressable disabled={!onPress} onPress={onPress} style={styles.row}><View style={[styles.rowIcon, { backgroundColor: `${color}14` }]}><Ionicons name={icon} size={20} color={color} /></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.rowSubtitle, { color: theme.subtitle }]}>{subtitle}</Text></View>{trailing ? <Text style={[styles.trailing, { color }]}>{trailing}</Text> : onPress ? <Ionicons name="chevron-forward" size={18} color={theme.subtitle} /> : null}</Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { paddingHorizontal: 20, marginBottom: 18 }, title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4 }, subtitle: { marginTop: 4, fontSize: 13 }, section: { paddingHorizontal: 18, marginBottom: 19 }, sectionTitle: { marginLeft: 3, marginBottom: 8, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }, card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' }, account: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 }, accountIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, initial: { color: '#FFFFFF', fontWeight: '800', fontSize: 20 }, cardTitle: { fontSize: 15, fontWeight: '800' }, body: { marginTop: 3, fontSize: 11.5 }, photoCard: { borderWidth: 1, borderRadius: 18, paddingTop: 16, flexDirection: 'row' }, photoColumn: { flex: 1, transform: [{ scale: 0.82 }], marginVertical: -12 }, row: { minHeight: 72, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }, rowIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, rowCopy: { flex: 1, marginLeft: 11 }, rowTitle: { fontSize: 13.5, fontWeight: '700' }, rowSubtitle: { marginTop: 3, fontSize: 10.5 }, trailing: { fontSize: 11, fontWeight: '800' }, divider: { height: StyleSheet.hairlineWidth, marginLeft: 67 }, logout: { marginHorizontal: 18, marginTop: 2, height: 53, borderRadius: 14, borderWidth: 1, borderColor: `${palette.error}55`, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, logoutText: { color: palette.error, fontWeight: '800', fontSize: 14 },
});
