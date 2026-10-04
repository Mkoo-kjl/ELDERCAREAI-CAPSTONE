import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { MetricCard } from '@/src/components/MetricCard';
import { VitalDetailModal, type VitalMetricKey } from '@/src/components/VitalDetailModal';
import { medicationDoseStatus, medicationStatusPriority, startOfLocalDay, type MedicationDoseTone, type MedicationLogLike } from '@/src/lib/care-status';
import { relativeTime } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { useHealthData } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

function display(value: number | null | undefined, digits = 0) { return value === null || value === undefined ? '--' : value.toFixed(digits); }
type DoctorContact = { id: string; full_name: string; phone: string; photo_url: string | null };
type MedicationPreview = { id: string; medication_name: string; dosage: string | null; frequency: string; times_of_day: string[] | null };
type AppointmentPreview = { id: string; title: string; doctor_name: string | null; appointment_at: string; status: string | null };
type NotePreview = { id: string; title: string | null; content: string; is_pinned: boolean; updated_at: string };
type MedicationLogPreview = MedicationLogLike;

function appointmentLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stackVitals = width < 350 || fontScale >= 1.25;
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);
  const { session, onboarding } = useAuth();
  const { elderly, vital, history, refreshing, error, syncState, lastSuccessfulSyncAt, refresh } = useHealthData();
  const connected = onboarding?.wearable_status === 'connected' || onboarding?.wearable_status === 'authorized_no_device';
  const [showPermission, setShowPermission] = useState(!connected);
  const [selectedMetric, setSelectedMetric] = useState<VitalMetricKey | null>(null);
  const [doctor, setDoctor] = useState<DoctorContact | null>(null);
  const [caregiverName, setCaregiverName] = useState<string | null>(null);
  const [medications, setMedications] = useState<MedicationPreview[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLogPreview[]>([]);
  const [appointments, setAppointments] = useState<AppointmentPreview[]>([]);
  const [notes, setNotes] = useState<NotePreview[]>([]);

  const readTime = relativeTime(vital?.synced_at ?? vital?.recorded_at);
  const healthSyncMessage = error && !vital ? 'Health sync could not load readings yet. Pull down or tap refresh to try again.' : null;
  const hasCarePreview = Boolean(doctor || medications.length || appointments.length || notes.length);
  const pills = [
    elderly?.age !== null ? `${elderly?.age ?? '--'} yrs` : null,
    elderly?.gender,
    elderly?.weight_kg ? `${elderly.weight_kg} kg` : null,
    elderly?.height_cm ? `${elderly.height_cm} cm` : null,
    elderly?.blood_type,
  ].filter(Boolean);

  const loadCarePreview = useCallback(async () => {
    if (!session || !elderly) {
      setDoctor(null);
      setCaregiverName(null);
      setMedications([]);
      setMedicationLogs([]);
      setAppointments([]);
      setNotes([]);
      return;
    }
    const todayStart = startOfLocalDay().toISOString();
    const [doctorResult, medicationResult, medicationLogResult, appointmentResult, notesResult, caregiverResult] = await Promise.all([
      supabase.from('doctor_contacts')
        .select('id, full_name, phone, photo_url')
        .eq('caregiver_id', session.user.id)
        .eq('elderly_id', elderly.elderly_id)
        .maybeSingle(),
      supabase.from('medication_schedules')
        .select('id, medication_name, dosage, frequency, times_of_day')
        .eq('caregiver_id', session.user.id)
        .eq('elderly_id', elderly.elderly_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase.from('medication_logs')
        .select('schedule_id, status, scheduled_time, taken_at')
        .eq('elderly_id', elderly.elderly_id)
        .gte('scheduled_time', todayStart),
      supabase.from('appointments')
        .select('id, title, doctor_name, appointment_at, status')
        .eq('caregiver_id', session.user.id)
        .eq('elderly_id', elderly.elderly_id)
        .gte('appointment_at', new Date().toISOString())
        .order('appointment_at')
        .limit(3),
      supabase.from('caregiver_notes')
        .select('id, title, content, is_pinned, updated_at')
        .eq('caregiver_id', session.user.id)
        .eq('elderly_id', elderly.elderly_id)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(3),
      supabase.from('caregivers').select('full_name').eq('id', session.user.id).maybeSingle(),
    ]);
    if (!caregiverResult.error) setCaregiverName(caregiverResult.data?.full_name ?? null);
    const loadError = doctorResult.error ?? medicationResult.error ?? medicationLogResult.error ?? appointmentResult.error ?? notesResult.error;
    if (loadError) {
      console.warn('Unable to load care preview:', loadError.message);
      return;
    }
    setDoctor((doctorResult.data as DoctorContact | null) ?? null);
    setMedications((medicationResult.data as MedicationPreview[]) ?? []);
    setMedicationLogs((medicationLogResult.data as MedicationLogPreview[]) ?? []);
    setAppointments((appointmentResult.data as AppointmentPreview[]) ?? []);
    setNotes((notesResult.data as NotePreview[]) ?? []);
  }, [elderly, session]);

  useFocusEffect(useCallback(() => {
    void refresh(false);
    void loadCarePreview();
  }, [loadCarePreview, refresh]));

  const callDoctor = useCallback(() => {
    if (!doctor?.phone) return;
    void Linking.openURL(`tel:${doctor.phone.replace(/[^+\d]/g, '')}`);
  }, [doctor?.phone]);
  const patientName = elderly?.full_name ?? 'The patient';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const medicationStatuses = medications
    .map((item) => ({ item, status: medicationDoseStatus(item, medicationLogs) }))
    .sort((a, b) => medicationStatusPriority(a.status) - medicationStatusPriority(b.status) || (a.status.nextMinutes ?? 9999) - (b.status.nextMinutes ?? 9999));
  const featuredMedication = medicationStatuses[0] ?? null;
  const featuredAppointment = appointments[0] ?? null;
  const featuredNote = notes[0] ?? null;
  const todaySummary = [
    {
      icon: 'pulse' as const,
      color: palette.error,
      label: 'Vitals',
      text: vital ? `Latest readings: ${display(vital.heart_rate_bpm)} bpm heart rate, SpO₂ ${display(vital.spo2_percent, 1)}%.` : 'No synced vital readings yet.',
    },
    {
      icon: 'moon' as const,
      color: palette.purple,
      label: 'Sleep',
      text: vital?.sleep_hours != null ? `${patientName} slept ${display(vital.sleep_hours, 1)} hours in the latest synced record.` : 'No sleep reading is available yet.',
    },
    {
      icon: 'medkit-outline' as const,
      color: featuredMedication ? medicationToneColor(featuredMedication.status.tone) : palette.primaryDark,
      label: 'Medication',
      text: featuredMedication ? featuredMedication.status.summary : 'No active medication schedule saved.',
    },
    {
      icon: featuredAppointment ? 'calendar-outline' as const : 'document-text-outline' as const,
      color: featuredAppointment ? palette.purple : palette.accentDark,
      label: featuredAppointment ? 'Appointment' : 'Care note',
      text: featuredAppointment ? `${featuredAppointment.title} on ${appointmentLabel(featuredAppointment.appointment_at)}.` : featuredNote ? `${featuredNote.title || 'Caregiver note'}: ${featuredNote.content}` : 'No upcoming appointment or care note saved.',
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={palette.primary} colors={[palette.primary]} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}
      >
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={styles.headerTop}>
            <View><Text style={[styles.brand, { color: theme.text }]}>ElderCare<Text style={styles.brandAccent}>AI</Text></Text><Text style={[styles.greeting, { color: theme.subtitle }]}>{greeting}{caregiverName ? `, ${caregiverName.split(' ')[0]}` : ''}</Text></View>
            <View style={[styles.headerStatus, { backgroundColor: connected ? `${palette.accent}14` : `${palette.error}10` }]}>
              <View style={[styles.dot, { backgroundColor: connected ? palette.accent : palette.error }]} />
              <Text style={[styles.headerStatusText, { color: connected ? palette.accentDark : palette.error }]}>{connected ? 'Live sync' : 'Needs sync'}</Text>
            </View>
          </View>
          <WeekStrip appointmentDates={appointments.map((item) => item.appointment_at)} />
          <View style={[styles.patientCard, { backgroundColor: isDark ? theme.cardElevated : palette.aquaSurface, borderColor: theme.border }]}>
            {elderly?.photo_url ? <Image source={{ uri: elderly.photo_url }} style={styles.profilePhoto} /> : (
              <View style={[styles.profilePhoto, { backgroundColor: palette.cardElevated }]}><Ionicons name="person-outline" size={30} color={palette.primaryDark} /></View>
            )}
            <View style={styles.patientCopy}>
              <Text style={[styles.eyebrow, { color: palette.primaryDark }]}>{"TODAY'S CARE"}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.name, { color: theme.text }]}>{elderly?.full_name ?? 'Older adult'}</Text>
              <View style={styles.pills}>{pills.map((pill) => <View key={String(pill)} style={[styles.pill, { backgroundColor: isDark ? theme.card : theme.cardElevated }]}><Text style={[styles.pillText, { color: theme.text }]}>{pill}</Text></View>)}</View>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.sectionRow}><Text style={[styles.sectionTitle, { color: theme.text }]}>Health vitals</Text><View style={[styles.connectionPill, { backgroundColor: connected ? palette.mintSurface : palette.peachSurface }]}><View style={[styles.dot, { backgroundColor: connected ? palette.accentDark : palette.error }]} /><Text style={[styles.connectionText, { color: connected ? palette.accentDark : palette.error }]}>{connected ? 'Connected' : 'Disconnected'}</Text></View></View>
          {healthSyncMessage ? <Text style={styles.error}>{healthSyncMessage}</Text> : null}
          <View style={styles.grid}>
            <MetricCard fullWidth={stackVitals} icon="heart-outline" title="Heart rate" value={display(vital?.heart_rate_bpm)} unit="bpm" timestamp={readTime} color={palette.error} surface={palette.lemonSurface} onPress={() => setSelectedMetric('heart_rate_bpm')} />
            <MetricCard fullWidth={stackVitals} icon="water-outline" title="Blood oxygen" value={display(vital?.spo2_percent, 1)} unit="%" timestamp={readTime} color={palette.primaryDark} surface={palette.aquaSurface} onPress={() => setSelectedMetric('spo2_percent')} />
            <MetricCard fullWidth={stackVitals} icon="moon-outline" title="Sleep" value={display(vital?.sleep_hours, 1)} unit="hours" timestamp={readTime} color={palette.purple} surface={palette.lavenderSurface} onPress={() => setSelectedMetric('sleep_hours')} />
            <MetricCard fullWidth={stackVitals} icon="footsteps-outline" title="Steps (24h)" value={vital?.steps_count?.toLocaleString() ?? '--'} unit="steps" timestamp={readTime} color={palette.accentDark} surface={palette.mintSurface} onPress={() => setSelectedMetric('steps_count')} />
            <MetricCard fullWidth={stackVitals} icon="thermometer-outline" title="Overnight skin temp" value={display(vital?.skin_temp_celsius, 1)} unit="°C" timestamp={readTime} color={palette.warning} surface={palette.peachSurface} onPress={() => setSelectedMetric('skin_temp_celsius')} />
            <MetricCard fullWidth={stackVitals} icon="leaf-outline" title="HRV" value={display(vital?.hrv_rmssd_ms)} unit="ms" timestamp={readTime} color={palette.pink} surface={palette.aquaSurface} onPress={() => setSelectedMetric('hrv_rmssd_ms')} />
          </View>
          {!vital ? <View style={[styles.empty, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}><Ionicons name="analytics-outline" size={26} color={theme.subtitle} /><Text style={[styles.emptyTitle, { color: theme.text }]}>No health readings yet</Text><Text style={[styles.emptyText, { color: theme.subtitle }]}>Connect Google Health and pull down to synchronize real readings.</Text></View> : null}
          <View style={styles.quickActions}>
            <Pressable onPress={() => router.push('/location')} style={[styles.quickAction, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
              <View style={styles.quickIcon}><Ionicons name="location" size={18} color={palette.primaryDark} /></View>
              <View style={styles.quickCopy}><Text style={[styles.quickTitle, { color: theme.text }]}>Last location</Text><Text style={[styles.quickText, { color: theme.subtitle }]}>View sync map</Text></View>
              <Ionicons name="chevron-forward" size={17} color={theme.subtitle} />
            </Pressable>
            <Pressable accessibilityLabel="Refresh health readings now" disabled={refreshing} onPress={() => void refresh(true)} style={[styles.quickAction, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
              <View style={[styles.quickIcon, { backgroundColor: `${syncState === 'error' ? palette.warning : palette.accent}14` }]}>{refreshing ? <ActivityIndicator size="small" color={palette.primaryDark} /> : <Ionicons name="refresh" size={18} color={palette.primaryDark} />}</View>
              <View style={styles.quickCopy}><Text style={[styles.quickTitle, { color: theme.text }]}>{syncState === 'syncing' ? 'Syncing…' : 'Sync now'}</Text><Text style={[styles.quickText, { color: theme.subtitle }]}>{lastSuccessfulSyncAt ? `Checked ${relativeTime(lastSuccessfulSyncAt)}` : 'Refresh vitals'}</Text></View>
            </Pressable>
          </View>
          <View style={styles.careSection}>
            <View style={styles.sectionRow}><Text style={[styles.sectionTitle, { color: theme.text }]}>Care plan</Text><Pressable onPress={() => router.push('/care')}><Text style={styles.manageText}>Manage</Text></Pressable></View>
            {doctor ? <View style={[styles.doctorCard, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>{doctor.photo_url ? <Image source={{ uri: doctor.photo_url }} style={styles.doctorPhoto} /> : <View style={styles.doctorFallback}><Ionicons name="medical" size={22} color={palette.primaryDark} /></View>}<View style={styles.doctorCopy}><Text numberOfLines={1} style={[styles.doctorTitle, { color: theme.text }]}>{doctor.full_name}</Text><Text numberOfLines={1} style={[styles.doctorBody, { color: theme.subtitle }]}>{doctor.phone}</Text></View><Pressable onPress={callDoctor} style={styles.callButton}><Ionicons name="call" size={15} color="#FFFFFF" /><Text style={styles.callText}>Call Doctor</Text></Pressable></View> : null}
            {appointments.map((item) => <CarePreviewRow key={item.id} icon="calendar-outline" color={palette.purple} title={item.title} subtitle={`Appointment on ${appointmentLabel(item.appointment_at)}`} />)}
            {medicationStatuses.map(({ item, status }) => <CarePreviewRow key={item.id} icon="medkit-outline" color={medicationToneColor(status.tone)} title={item.medication_name} subtitle={`${status.label}: ${status.detail}${item.dosage ? ` • ${item.dosage}` : ''}`} />)}
            {notes.map((item) => <CarePreviewRow key={item.id} icon={item.is_pinned ? 'pin-outline' : 'document-text-outline'} color={item.is_pinned ? palette.warning : palette.accentDark} title={item.title || 'Caregiver note'} subtitle={item.content} />)}
            {!hasCarePreview ? <View style={[styles.emptyCare, { backgroundColor: theme.card, borderColor: theme.border }]}><Ionicons name="clipboard-outline" size={25} color={theme.subtitle} /><Text style={[styles.emptyText, { color: theme.subtitle }]}>Add a doctor, medications, appointments, or notes to see them here.</Text></View> : null}
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
            <View style={styles.summaryHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryEyebrow, { color: palette.primaryDark }]}>TODAY SUMMARY</Text>
                <Text style={[styles.summaryTitle, { color: theme.text }]}>What needs attention</Text>
              </View>
              <Text style={[styles.summaryTime, { color: theme.subtitle }]}>{lastSuccessfulSyncAt ? relativeTime(lastSuccessfulSyncAt) : 'No sync yet'}</Text>
            </View>
            {todaySummary.map((item) => <SummaryRow key={item.label} icon={item.icon} color={item.color} label={item.label} text={item.text} />)}
          </View>
        </View>
      </ScrollView>

      <VitalDetailModal visible={selectedMetric !== null} metric={selectedMetric} history={history} onClose={() => setSelectedMetric(null)} />

      <Modal transparent visible={showPermission && !connected} animationType="fade" onRequestClose={() => setShowPermission(false)}>
        <View style={styles.overlay}><View style={[styles.modal, { backgroundColor: theme.cardElevated }]}>
          <View style={styles.modalIcon}><Ionicons name="fitness" size={32} color={palette.primaryDark} /></View>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Connect Google Health</Text>
          <Text style={[styles.modalText, { color: theme.subtitle }]}>Your dashboard stays empty until you authorize read-only health data access. ElderCareAI never fabricates readings.</Text>
          <GradientButton label="Review permissions" onPress={() => { setShowPermission(false); router.push('/setup/fitness?mode=edit'); }} colors={[palette.google, palette.googleDark]} />
          <Pressable onPress={() => setShowPermission(false)} style={styles.notNow}><Text style={[styles.notNowText, { color: theme.subtitle }]}>Not now</Text></Pressable>
        </View></View>
      </Modal>
    </View>
  );
}

function CarePreviewRow({ icon, color, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; subtitle: string }) {
  const theme = getTheme(useColorScheme() === 'dark');
  return <View style={[styles.careRow, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}><View style={[styles.careIcon, { backgroundColor: `${color}14` }]}><Ionicons name={icon} size={19} color={color} /></View><View style={styles.careCopy}><Text numberOfLines={1} style={[styles.careTitle, { color: theme.text }]}>{title}</Text><Text numberOfLines={2} style={[styles.careText, { color: theme.subtitle }]}>{subtitle}</Text></View></View>;
}

function WeekStrip({ appointmentDates }: { appointmentDates: string[] }) {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const theme = getTheme(useColorScheme() === 'dark');
  return <View style={styles.weekStrip}>{Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    const isToday = day.toDateString() === today.toDateString();
    const hasAppointment = appointmentDates.some((value) => new Date(value).toDateString() === day.toDateString());
    return <View key={day.toDateString()} style={styles.weekDay}><Text style={[styles.weekLabel, { color: theme.subtitle }]}>{day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}</Text><View style={[styles.weekDate, isToday && { backgroundColor: palette.aquaSurface }]}><Text style={[styles.weekNumber, { color: isToday ? palette.text : theme.text }]}>{day.getDate()}</Text></View><View style={[styles.weekDot, { backgroundColor: hasAppointment ? palette.primaryDark : 'transparent' }]} /></View>;
  })}</View>;
}

function SummaryRow({ icon, color, label, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; text: string }) {
  const theme = getTheme(useColorScheme() === 'dark');
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}14` }]}><Ionicons name={icon} size={16} color={color} /></View>
      <View style={styles.summaryCopy}>
        <Text style={[styles.summaryLabel, { color: theme.text }]}>{label}</Text>
        <Text numberOfLines={2} style={[styles.summaryText, { color: theme.subtitle }]}>{text}</Text>
      </View>
    </View>
  );
}

function medicationToneColor(tone: MedicationDoseTone) {
  if (tone === 'taken') return palette.accentDark;
  if (tone === 'missed') return palette.error;
  if (tone === 'due' || tone === 'soon') return palette.warning;
  if (tone === 'as_needed') return palette.purple;
  return palette.primaryDark;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { paddingHorizontal: 18, paddingBottom: 14 }, headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 17, fontFamily: fontFamily.semiBold }, brandAccent: { color: palette.primaryDark }, greeting: { marginTop: 2, fontSize: 11, fontFamily: fontFamily.regular }, headerStatus: { minHeight: 27, paddingHorizontal: 9, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, headerStatusText: { fontSize: 10, fontFamily: fontFamily.medium },
  weekStrip: { flexDirection: 'row', marginTop: 13, paddingVertical: 7, borderRadius: 8 }, weekDay: { flex: 1, alignItems: 'center', gap: 3 }, weekLabel: { fontSize: 9.5, fontFamily: fontFamily.medium }, weekDate: { width: 29, height: 29, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, weekNumber: { fontSize: 11, fontFamily: fontFamily.medium, fontVariant: ['tabular-nums'] }, weekDot: { width: 4, height: 4, borderRadius: 2 },
  eyebrow: { fontSize: 10, fontFamily: fontFamily.medium },
  patientCard: { minHeight: 112, marginTop: 16, padding: 13, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  profilePhoto: { width: 76, height: 76, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  patientCopy: { flex: 1, marginLeft: 14 },
  name: { marginTop: 4, fontSize: 20, lineHeight: 25, fontFamily: fontFamily.semiBold }, pills: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  pill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7 }, pillText: { fontSize: 9.5, fontFamily: fontFamily.medium },
  content: { paddingHorizontal: 18, paddingTop: 5 },
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 16 }, quickAction: { flex: 1, minHeight: 55, padding: 8, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, quickIcon: { width: 30, height: 30, borderRadius: 7, backgroundColor: palette.aquaSurface, alignItems: 'center', justifyContent: 'center' }, quickCopy: { flex: 1, marginLeft: 7 }, quickTitle: { fontSize: 11, fontFamily: fontFamily.semiBold }, quickText: { marginTop: 2, fontSize: 9, lineHeight: 12 },
  summaryCard: { marginTop: 20, marginBottom: 18, padding: 15, borderRadius: 8, borderWidth: 1 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  summaryEyebrow: { fontSize: 10, fontFamily: fontFamily.medium },
  summaryTitle: { marginTop: 3, ...typeScale.sectionTitle },
  summaryTime: { marginTop: 2, fontSize: 10, fontFamily: fontFamily.medium },
  summaryRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1 },
  summaryLabel: { fontSize: 12.5, fontFamily: fontFamily.semiBold },
  summaryText: { marginTop: 2, fontSize: 11.2, lineHeight: 15.5 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }, sectionTitle: { ...typeScale.sectionTitle },
  connectionPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }, dot: { width: 7, height: 7, borderRadius: 4 }, connectionText: { fontSize: 11, fontWeight: '700' },
  error: { marginBottom: 10, color: palette.error, fontSize: 12, lineHeight: 18 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  empty: { marginTop: 16, padding: 22, borderRadius: 18, borderWidth: 1, alignItems: 'center' }, emptyTitle: { marginTop: 9, fontSize: 15, fontWeight: '700' }, emptyText: { marginTop: 5, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  careSection: { marginTop: 18, gap: 8 }, manageText: { color: palette.primaryDark, fontSize: 11, fontFamily: fontFamily.medium }, doctorCard: { minHeight: 72, borderRadius: 8, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'center' }, doctorPhoto: { width: 45, height: 45, borderRadius: 7, backgroundColor: palette.card }, doctorFallback: { width: 45, height: 45, borderRadius: 7, backgroundColor: palette.aquaSurface, alignItems: 'center', justifyContent: 'center' }, doctorCopy: { flex: 1, minWidth: 0, marginLeft: 11 }, doctorTitle: { ...typeScale.cardTitle }, doctorBody: { marginTop: 3, fontSize: 11 }, callButton: { minHeight: 35, paddingHorizontal: 9, borderRadius: 7, backgroundColor: palette.primaryDark, flexDirection: 'row', alignItems: 'center', gap: 5 }, callText: { color: '#FFFFFF', fontSize: 10, fontFamily: fontFamily.medium }, careRow: { minHeight: 65, borderRadius: 8, borderWidth: 1, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' }, careIcon: { width: 38, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, careCopy: { flex: 1, marginLeft: 10 }, careTitle: { fontSize: 12.5, fontFamily: fontFamily.semiBold }, careText: { marginTop: 3, fontSize: 11, lineHeight: 15 }, emptyCare: { padding: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.62)', alignItems: 'center', justifyContent: 'center', padding: 24 }, modal: { width: '100%', maxWidth: 390, padding: 22, borderRadius: 8, alignItems: 'center' },
  modalIcon: { width: 55, height: 55, borderRadius: 8, backgroundColor: palette.aquaSurface, alignItems: 'center', justifyContent: 'center' }, modalTitle: { marginTop: 14, ...typeScale.sectionTitle },
  modalText: { marginTop: 8, fontSize: 13, lineHeight: 20, textAlign: 'center' }, notNow: { minHeight: 43, justifyContent: 'center' }, notNowText: { fontSize: 13, fontWeight: '600' },
});
