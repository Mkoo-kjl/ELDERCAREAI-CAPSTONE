import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField } from '@/src/components/FormField';
import { GradientButton } from '@/src/components/GradientButton';
import { ProfilePhotoPicker, type LocalPhoto } from '@/src/components/ProfilePhotoPicker';
import { uploadProfilePhoto } from '@/src/lib/profile-photo';
import { ensureNotificationPermission, hasNotificationPermission } from '@/src/lib/notifications';
import { exportHealthReportPdf, exportMedicationReportPdf } from '@/src/lib/pdf-reports';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { useHealthData, type VitalLog } from '@/src/providers/HealthDataProvider';
import { useThemePreference } from '@/src/providers/ThemePreferenceProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

type Caregiver = { full_name: string; email: string | null; photo_url: string | null };
type DoctorContact = { id: string; full_name: string; phone: string; photo_url: string | null };

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
  const [doctor, setDoctor] = useState<DoctorContact | null>(null);
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [doctorPhoto, setDoctorPhoto] = useState<LocalPhoto | null>(null);
  const [doctorRemotePhoto, setDoctorRemotePhoto] = useState<string | null>(null);
  const [doctorSaving, setDoctorSaving] = useState(false);

  const loadCaregiver = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase.from('caregivers').select('full_name, email, photo_url').eq('id', session.user.id).maybeSingle();
    if (error) Alert.alert('Unable to load account', error.message); else setCaregiver(data as Caregiver | null);
  }, [session]);

  const loadDoctor = useCallback(async () => {
    if (!session || !elderly) {
      setDoctor(null);
      return;
    }
    const { data, error } = await supabase.from('doctor_contacts')
      .select('id, full_name, phone, photo_url')
      .eq('caregiver_id', session.user.id)
      .eq('elderly_id', elderly.elderly_id)
      .maybeSingle();
    if (error) Alert.alert('Unable to load doctor', error.message);
    else setDoctor(data as DoctorContact | null);
  }, [elderly, session]);

  useFocusEffect(useCallback(() => {
    void loadCaregiver();
    void refresh(false);
    void loadDoctor();
    void hasNotificationPermission().then(setNotificationsEnabled);
  }, [loadCaregiver, loadDoctor, refresh]));

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

  const openDoctorForm = () => {
    setDoctorName(doctor?.full_name ?? '');
    setDoctorPhone(doctor?.phone ?? '');
    setDoctorRemotePhoto(doctor?.photo_url ?? null);
    setDoctorPhoto(null);
    setDoctorModalOpen(true);
  };

  const saveDoctor = async () => {
    if (!session || !elderly) {
      Alert.alert('Older adult profile needed', 'Save the older adult profile before adding a doctor.');
      return;
    }
    if (doctorName.trim().length < 2) {
      Alert.alert('Doctor name needed', 'Enter the doctor’s full name.');
      return;
    }
    if (doctorPhone.replace(/\D/g, '').length < 7) {
      Alert.alert('Doctor phone needed', 'Enter a valid doctor phone number.');
      return;
    }

    setDoctorSaving(true);
    try {
      let photoUrl = doctorRemotePhoto;
      if (doctorPhoto) photoUrl = await uploadProfilePhoto(session.user.id, 'doctor', doctorPhoto);
      const payload = {
        caregiver_id: session.user.id,
        elderly_id: elderly.elderly_id,
        full_name: doctorName.trim(),
        phone: doctorPhone.trim(),
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      };
      const result = doctor
        ? await supabase.from('doctor_contacts').update(payload).eq('id', doctor.id).eq('caregiver_id', session.user.id).select('id, full_name, phone, photo_url').single()
        : await supabase.from('doctor_contacts').upsert(payload, { onConflict: 'caregiver_id,elderly_id' }).select('id, full_name, phone, photo_url').single();
      if (result.error) throw result.error;
      setDoctor(result.data as DoctorContact);
      setDoctorModalOpen(false);
      setDoctorPhoto(null);
    } catch (caught) {
      Alert.alert('Unable to save doctor', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setDoctorSaving(false);
    }
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
    <View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>Settings</Text><Text style={[styles.subtitle, { color: theme.subtitle }]}>Profiles and connected services</Text></View>
    <Section title="ACCOUNT"><View style={[styles.card, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}><View style={styles.account}><View style={styles.accountIcon}><Text style={styles.initial}>{(caregiver?.full_name ?? session?.user.email ?? 'C')[0].toUpperCase()}</Text></View><View style={styles.accountCopy}><Text numberOfLines={1} style={[styles.cardTitle, { color: theme.text }]}>{caregiver?.full_name ?? 'Caregiver'}</Text><Text numberOfLines={1} style={[styles.body, { color: theme.subtitle }]}>{caregiver?.email ?? session?.user.email}</Text></View></View></View></Section>
    <Section title="PROFILE PHOTOS"><View style={[styles.photoCard, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}><View style={styles.photoColumn}><ProfilePhotoPicker value={null} remoteUrl={caregiver?.photo_url} label={uploading === 'caregiver' ? 'Uploading…' : 'Caregiver photo'} onChange={(photo) => void savePhoto('caregiver', photo)} /></View><View style={styles.photoColumn}><ProfilePhotoPicker value={null} remoteUrl={elderly?.photo_url} label={uploading === 'elderly' ? 'Uploading…' : 'Older adult photo'} onChange={(photo) => void savePhoto('elderly', photo)} /></View></View></Section>
    <Section title="MANAGE PROFILES"><SettingsCard><Row icon="person-outline" title="Caregiver information" subtitle="Contact and personal details" onPress={() => router.push('/setup/caregiver?mode=edit')} /><Divider color={theme.border} /><Row icon="heart-outline" title="Older adult information" subtitle="Health profile and emergency contact" onPress={() => router.push('/setup/elderly?mode=edit')} /></SettingsCard></Section>
    <Section title="DOCTOR CONTACT"><View style={[styles.doctorCard, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>{doctor?.photo_url ? <Image source={{ uri: doctor.photo_url }} style={styles.doctorPhoto} /> : <View style={[styles.doctorPhotoFallback, { backgroundColor: `${palette.primary}16` }]}><Ionicons name="medical" size={23} color={palette.primaryDark} /></View>}<View style={styles.doctorCopy}><Text style={[styles.cardTitle, { color: theme.text }]}>{doctor?.full_name ?? 'No doctor saved'}</Text><Text style={[styles.body, { color: theme.subtitle }]}>{doctor?.phone ?? 'Add a doctor phone number for quick calls from Home.'}</Text></View><Pressable onPress={openDoctorForm} style={[styles.doctorEdit, { backgroundColor: `${palette.primary}14` }]}><Text style={styles.doctorEditText}>{doctor ? 'Edit' : 'Add'}</Text></Pressable></View></Section>
    <Section title="INTEGRATIONS"><SettingsCard><Row icon={connected ? 'checkmark-circle-outline' : 'cloud-offline-outline'} title="Google Health API v4" subtitle={connected ? onboarding?.wearable_status === 'connected' ? `${onboarding.paired_device_count} paired device(s)` : 'Authorized • no paired device' : 'Disconnected'} color={connected ? palette.accentDark : theme.subtitle} onPress={() => connected ? disconnect() : router.push('/setup/fitness?mode=edit')} trailing={connected ? 'Disconnect' : 'Connect'} /></SettingsCard></Section>
    <Section title="DATA MANAGEMENT"><SettingsCard><Row icon="document-outline" title="Health vitals PDF" subtitle={exporting === 'health' ? 'Generating organized report…' : 'Export a receipt-style table of synchronized readings'} onPress={exporting ? undefined : () => void exportHealth()} /><Divider color={theme.border} /><Row icon="receipt-outline" title="Medication schedule PDF" subtitle={exporting === 'medications' ? 'Generating organized report…' : 'Export medications as a caregiver-ready table'} onPress={exporting ? undefined : () => void exportMedications()} /></SettingsCard></Section>
    <Section title="PREFERENCES"><SettingsCard><Row icon="notifications-outline" title="Care notifications" subtitle={notificationsEnabled ? 'Appointments, medications, and health warnings enabled' : 'Tap to enable reminders'} color={notificationsEnabled ? palette.accentDark : palette.warning} onPress={() => void configureNotifications()} trailing={notificationsEnabled ? 'Enabled' : 'Enable'} /><Divider color={theme.border} /><View style={styles.row}><View style={[styles.rowIcon, { backgroundColor: `${palette.purple}14` }]}><Ionicons name="moon-outline" size={20} color={palette.purple} /></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: theme.text }]}>Dark Mode</Text><Text style={[styles.rowSubtitle, { color: theme.subtitle }]}>Use the dark color palette</Text></View><Switch value={isDark} onValueChange={toggleDarkMode} trackColor={{ true: palette.primary }} /></View></SettingsCard></Section>
    <Section title="ABOUT"><SettingsCard><Row icon="information-circle-outline" title="ElderCareAI" subtitle="Version 1.0.0" /><Divider color={theme.border} /><Row icon="shield-checkmark-outline" title="Privacy Policy" subtitle="How health and account data are handled" onPress={() => Alert.alert('Privacy Policy', 'ElderCareAI stores account and care data in your configured Supabase project. Google Health tokens remain server-side. This app does not perform hidden background location tracking. Replace this placeholder with your reviewed production policy before release.')} /><Divider color={theme.border} /><Row icon="document-outline" title="Terms of Service" subtitle="Demo application terms" onPress={() => Alert.alert('Terms of Service', 'This demo is not a medical device and does not provide medical diagnosis. Replace this placeholder with reviewed production terms before release.')} /></SettingsCard></Section>
    <Pressable onPress={() => void signOut()} style={styles.logout}><Ionicons name="log-out-outline" size={20} color={palette.error} /><Text style={styles.logoutText}>Log out</Text></Pressable>
    <Modal visible={doctorModalOpen} transparent animationType="slide" onRequestClose={() => setDoctorModalOpen(false)}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { backgroundColor: theme.cardElevated, paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{doctor ? 'Edit doctor' : 'Add doctor'}</Text>
            <Pressable onPress={() => setDoctorModalOpen(false)}><Ionicons name="close" size={24} color={theme.text} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <ProfilePhotoPicker value={doctorPhoto} remoteUrl={doctorRemotePhoto} label="Doctor photo" onChange={setDoctorPhoto} />
            <FormField label="Doctor name" required value={doctorName} onChangeText={setDoctorName} icon="medical-outline" autoCapitalize="words" />
            <FormField label="Phone number" required value={doctorPhone} onChangeText={setDoctorPhone} icon="call-outline" keyboardType="phone-pad" placeholder="e.g. +63 917 123 4567" />
            <GradientButton label={doctorSaving ? 'Saving…' : 'Save doctor'} onPress={() => void saveDoctor()} loading={doctorSaving} colors={[palette.primaryDark, palette.primaryDark]} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </ScrollView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { const theme = getTheme(useColorScheme() === 'dark'); return <View style={styles.section}><Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{title}</Text>{children}</View>; }
function SettingsCard({ children }: { children: React.ReactNode }) { const theme = getTheme(useColorScheme() === 'dark'); return <View style={[styles.card, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>{children}</View>; }
function Divider({ color }: { color: string }) { return <View style={[styles.divider, { backgroundColor: color }]} />; }
function Row({ icon, title, subtitle, color = palette.primaryDark, onPress, trailing }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; color?: string; onPress?: () => void; trailing?: string }) { const theme = getTheme(useColorScheme() === 'dark'); return <Pressable disabled={!onPress} onPress={onPress} style={styles.row}><View style={[styles.rowIcon, { backgroundColor: `${color}14` }]}><Ionicons name={icon} size={20} color={color} /></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.rowSubtitle, { color: theme.subtitle }]}>{subtitle}</Text></View>{trailing ? <Text style={[styles.trailing, { color }]}>{trailing}</Text> : onPress ? <Ionicons name="chevron-forward" size={18} color={theme.subtitle} /> : null}</Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { paddingHorizontal: 18, marginBottom: 16 }, title: { ...typeScale.screenTitle }, subtitle: { marginTop: 3, fontSize: 12 },
  section: { paddingHorizontal: 18, marginBottom: 18 }, sectionTitle: { marginLeft: 2, marginBottom: 8, fontSize: 11, fontFamily: fontFamily.medium },
  card: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' }, account: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }, accountIcon: { width: 45, height: 45, borderRadius: 23, backgroundColor: palette.primaryDark, alignItems: 'center', justifyContent: 'center' }, accountCopy: { flex: 1, minWidth: 0 }, initial: { color: '#FFFFFF', fontFamily: fontFamily.semiBold, fontSize: 18 }, cardTitle: { ...typeScale.cardTitle }, body: { marginTop: 3, fontSize: 11.5 },
  photoCard: { borderWidth: 1, borderRadius: 8, paddingTop: 16, flexDirection: 'row' }, photoColumn: { flex: 1, transform: [{ scale: 0.82 }], marginVertical: -12 },
  doctorCard: { minHeight: 72, borderWidth: 1, borderRadius: 8, padding: 13, flexDirection: 'row', alignItems: 'center' }, doctorPhoto: { width: 45, height: 45, borderRadius: 7, backgroundColor: palette.card }, doctorPhotoFallback: { width: 45, height: 45, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, doctorCopy: { flex: 1, marginLeft: 11 }, doctorEdit: { minWidth: 55, minHeight: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, doctorEditText: { color: palette.primaryDark, fontSize: 11, fontFamily: fontFamily.semiBold },
  row: { minHeight: 68, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' }, rowIcon: { width: 38, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, rowCopy: { flex: 1, marginLeft: 11 }, rowTitle: { fontSize: 12.5, fontFamily: fontFamily.semiBold }, rowSubtitle: { marginTop: 3, fontSize: 10.5 }, trailing: { fontSize: 11, fontFamily: fontFamily.medium }, divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  logout: { marginHorizontal: 18, marginTop: 2, height: 50, borderRadius: 8, borderWidth: 1, borderColor: `${palette.error}55`, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, logoutText: { color: palette.error, fontFamily: fontFamily.semiBold, fontSize: 13 },
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }, sheet: { maxHeight: '88%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 18 }, sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, sheetTitle: { ...typeScale.sectionTitle },
});
