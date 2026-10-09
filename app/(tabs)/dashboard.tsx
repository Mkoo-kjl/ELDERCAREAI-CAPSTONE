import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';

import { AppText as Text } from '@/src/components/AppText';
import { CareArtwork } from '@/src/components/CareArtwork';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { LocationMapPreview } from '@/src/components/LocationMapPreview';
import { MetricCard } from '@/src/components/MetricCard';
import { VitalDetailModal, type VitalMetricKey } from '@/src/components/VitalDetailModal';
import { useMinuteClock } from '@/src/hooks/useMinuteClock';
import { medicationDoseStatus, medicationStatusPriority, startOfLocalDay, type MedicationDoseTone, type MedicationLogLike } from '@/src/lib/care-status';
import { timeAgo } from '@/src/lib/format';
import { sleepDurationScore } from '@/src/lib/sleep-score';
import { vitalTimeLabel } from '@/src/lib/vital-time';
import { watchSyncDelayed } from '@/src/lib/watch-sync';
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
type SyncLocationPreview = { latitude: number; longitude: number; recorded_at: string };

function appointmentLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function DashboardScreen() {
  useMinuteClock();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stackVitals = width < 350 || fontScale >= 1.25;
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);
  const { session, onboarding } = useAuth();
  const { elderly, vital, history, refreshing, error, syncState, lastGoogleHealthCheckAt, watchSync, watchSyncIssue, refresh } = useHealthData();
  const caregiverId = session?.user.id;
  const elderlyId = elderly?.elderly_id;
  const connected = onboarding?.wearable_status === 'connected' || onboarding?.wearable_status === 'authorized_no_device';
  const [showPermission, setShowPermission] = useState(!connected);
  const [selectedMetric, setSelectedMetric] = useState<VitalMetricKey | null>(null);
  const [showSyncHelp, setShowSyncHelp] = useState(false);
  const [doctor, setDoctor] = useState<DoctorContact | null>(null);
  const [caregiverName, setCaregiverName] = useState<string | null>(null);
  const [medications, setMedications] = useState<MedicationPreview[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLogPreview[]>([]);
  const [appointments, setAppointments] = useState<AppointmentPreview[]>([]);
  const [notes, setNotes] = useState<NotePreview[]>([]);
  const [syncLocation, setSyncLocation] = useState<SyncLocationPreview | null>(null);

  const checkedAgo = timeAgo(lastGoogleHealthCheckAt);
  const watchSyncedAgo = timeAgo(watchSync?.lastSyncTime);
  const watchDelayed = watchSyncDelayed(watchSync?.lastSyncTime, Date.now(), vital?.measurement_times?.heart_rate_bpm);
  const healthSyncMessage = error ? (vital
    ? 'Google Health could not be checked. Showing the last saved readings.'
    : 'Health readings could not be loaded. Tap the sync icon to try again.') : null;
  const watchIssueMessage = watchSyncIssue === 'permission_required'
    ? 'Watch sync status needs Google Health permission. Reconnect the account to grant access.'
    : watchSyncIssue === 'no_tracker'
      ? 'No paired tracker was found for this Google Health account.'
      : watchSyncIssue === 'unavailable'
        ? 'Watch sync status is temporarily unavailable.'
        : null;
  const hasCarePreview = Boolean(doctor || medications.length || appointments.length || notes.length);
  const pills = [
    elderly?.age != null ? `${elderly.age} yrs` : null,
    elderly?.gender,
    elderly?.weight_kg ? `${elderly.weight_kg} kg` : null,
    elderly?.height_cm ? `${elderly.height_cm} cm` : null,
    elderly?.blood_type,
  ].filter(Boolean);

  const loadCarePreview = useCallback(async () => {
    if (!caregiverId || !elderlyId) {
      setDoctor(null);
      setCaregiverName(null);
      setMedications([]);
      setMedicationLogs([]);
      setAppointments([]);
      setNotes([]);
      setSyncLocation(null);
      return;
    }
    const todayStart = startOfLocalDay().toISOString();
    const [doctorResult, medicationResult, medicationLogResult, appointmentResult, notesResult, caregiverResult, locationResult] = await Promise.all([
      supabase.from('doctor_contacts')
        .select('id, full_name, phone, photo_url')
        .eq('caregiver_id', caregiverId)
        .eq('elderly_id', elderlyId)
        .maybeSingle(),
      supabase.from('medication_schedules')
        .select('id, medication_name, dosage, frequency, times_of_day')
        .eq('caregiver_id', caregiverId)
        .eq('elderly_id', elderlyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase.from('medication_logs')
        .select('schedule_id, status, scheduled_time, taken_at')
        .eq('elderly_id', elderlyId)
        .gte('scheduled_time', todayStart),
      supabase.from('appointments')
        .select('id, title, doctor_name, appointment_at, status')
        .eq('caregiver_id', caregiverId)
        .eq('elderly_id', elderlyId)
        .gte('appointment_at', new Date().toISOString())
        .order('appointment_at')
        .limit(3),
      supabase.from('caregiver_notes')
        .select('id, title, content, is_pinned, updated_at')
        .eq('caregiver_id', caregiverId)
        .eq('elderly_id', elderlyId)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(3),
      supabase.from('caregivers').select('full_name').eq('id', caregiverId).maybeSingle(),
      supabase.from('wearable_sync_locations')
        .select('latitude, longitude, recorded_at')
        .eq('user_id', caregiverId)
        .eq('elderly_id', elderlyId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (!caregiverResult.error) setCaregiverName(caregiverResult.data?.full_name ?? null);
    if (!locationResult.error) setSyncLocation((locationResult.data as SyncLocationPreview | null) ?? null);
    else console.warn('Unable to load last sync location:', locationResult.error.message);
    if (doctorResult.error) console.warn('Unable to load doctor contact:', doctorResult.error.message);
    else setDoctor((doctorResult.data as DoctorContact | null) ?? null);
    if (medicationResult.error) console.warn('Unable to load medications:', medicationResult.error.message);
    else setMedications((medicationResult.data as MedicationPreview[]) ?? []);
    if (medicationLogResult.error) console.warn('Unable to load medication logs:', medicationLogResult.error.message);
    else setMedicationLogs((medicationLogResult.data as MedicationLogPreview[]) ?? []);
    if (notesResult.error) console.warn('Unable to load notes:', notesResult.error.message);
    else setNotes((notesResult.data as NotePreview[]) ?? []);
    if (appointmentResult.error) console.warn('Unable to load appointments:', appointmentResult.error.message);
    else if (appointmentResult.data?.length) setAppointments(appointmentResult.data as AppointmentPreview[]);
    else {
      const recent = await supabase.from('appointments')
        .select('id, title, doctor_name, appointment_at, status')
        .eq('caregiver_id', caregiverId)
        .eq('elderly_id', elderlyId)
        .lt('appointment_at', new Date().toISOString())
        .order('appointment_at', { ascending: false })
        .limit(1);
      if (recent.error) console.warn('Unable to load recent appointment:', recent.error.message);
      else setAppointments((recent.data as AppointmentPreview[]) ?? []);
    }
  }, [caregiverId, elderlyId]);

  useFocusEffect(useCallback(() => {
    void refresh(false, true);
    void loadCarePreview();
  }, [loadCarePreview, refresh]));

  useFocusEffect(useCallback(() => {
    if (syncState === 'success') void loadCarePreview();
  }, [loadCarePreview, syncState]));

  const callDoctor = useCallback(() => {
    if (!doctor?.phone) return;
    void Linking.openURL(`tel:${doctor.phone.replace(/[^+\d]/g, '')}`);
  }, [doctor?.phone]);
  const patientName = elderly?.full_name ?? 'The patient';
  const sleepScore = sleepDurationScore(vital?.sleep_hours);
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
              <Text style={[styles.headerStatusText, { color: connected ? palette.accentDark : palette.error }]}>{connected ? 'Google connected' : 'Needs sync'}</Text>
            </View>
          </View>
          <WeekStrip appointmentDates={appointments.map((item) => item.appointment_at)} />
          <View style={[styles.patientCard, { backgroundColor: isDark ? theme.cardElevated : palette.aquaSurface }]}>
            {elderly?.photo_url ? <Image source={{ uri: elderly.photo_url }} resizeMode="cover" style={styles.profilePhoto} /> : (
              <View style={[styles.profilePhoto, styles.profilePhotoFallback, { backgroundColor: isDark ? theme.card : palette.mintSurface }]}><Ionicons name="person-outline" size={42} color={palette.primaryDark} /></View>
            )}
            <LinearGradient
              colors={isDark ? ['rgba(41,57,54,0)', palette.cardElevatedDark] : ['rgba(235,247,248,0)', palette.aquaSurface]}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={styles.profilePhotoFade}
            />
            <View style={styles.patientCopy}>
              <Text style={[styles.eyebrow, { color: palette.primaryDark }]}>{"TODAY'S CARE"}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.name, { color: theme.text }]}>{elderly?.full_name ?? 'Older adult'}</Text>
              <View style={styles.pills}>{pills.map((pill) => <View key={String(pill)} style={[styles.pill, { backgroundColor: isDark ? theme.card : theme.cardElevated }]}><Text style={[styles.pillText, { color: theme.text }]}>{pill}</Text></View>)}</View>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Health vitals</Text>
            <View style={styles.vitalsActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sync now"
                accessibilityHint={connected ? 'Check Google Health for new patient readings' : 'Connect Google Health to sync patient readings'}
                disabled={refreshing}
                onPress={() => connected ? void refresh(true) : router.push('/setup/fitness?mode=edit')}
                style={[styles.syncButton, { backgroundColor: theme.cardElevated, borderColor: theme.border, opacity: refreshing ? 0.55 : 1 }]}
              >
                {refreshing ? <ActivityIndicator size="small" color={palette.primaryDark} /> : <Ionicons name="refresh" size={17} color={palette.primaryDark} />}
              </Pressable>
              <View style={[styles.connectionPill, { backgroundColor: connected ? palette.mintSurface : palette.peachSurface }]}><View style={[styles.dot, { backgroundColor: connected ? palette.accentDark : palette.error }]} /><Text style={[styles.connectionText, { color: connected ? palette.accentDark : palette.error }]}>{connected ? 'Connected' : 'Disconnected'}</Text></View>
            </View>
          </View>
          {healthSyncMessage ? <Text style={styles.error}>{healthSyncMessage}</Text> : null}
          {watchDelayed ? (
            <Pressable accessibilityRole="button" accessibilityLabel="See how to restore automatic watch syncing" onPress={() => setShowSyncHelp(true)} style={[styles.watchNotice, { backgroundColor: isDark ? theme.cardElevated : palette.peachSurface }]}>
              <Ionicons name="watch-outline" size={19} color={palette.warning} />
              <View style={styles.watchNoticeCopy}>
                <Text style={[styles.watchNoticeTitle, { color: theme.text }]}>Watch sync delayed</Text>
                <Text style={[styles.watchNoticeText, { color: theme.subtitle }]}>{watchSync?.deviceVersion ?? 'Paired watch'} last synced {watchSyncedAgo}. Check its phone connection.</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={theme.subtitle} />
            </Pressable>
          ) : watchSyncedAgo ? <Text style={[styles.watchFreshText, { color: theme.subtitle }]}>{watchSync?.deviceVersion ?? 'Watch'} last confirmed synced {watchSyncedAgo}</Text> : null}
          {watchIssueMessage ? (
            <Pressable accessibilityRole="button" accessibilityLabel="See watch sync details" onPress={() => setShowSyncHelp(true)} style={[styles.watchIssue, { backgroundColor: theme.cardElevated }]}>
              <Ionicons name="information-circle-outline" size={17} color={palette.primaryDark} />
              <Text style={[styles.watchIssueText, { color: theme.subtitle }]}>{watchIssueMessage}</Text>
            </Pressable>
          ) : null}
          <View style={styles.grid}>
            <MetricCard fullWidth={stackVitals} icon="heart-outline" title="Heart rate" value={display(vital?.heart_rate_bpm)} unit="bpm" timestamp={vitalTimeLabel(vital, 'heart_rate_bpm')} color={palette.error} surface={palette.lemonSurface} onPress={() => setSelectedMetric('heart_rate_bpm')} />
            <MetricCard fullWidth={stackVitals} icon="water-outline" title="Blood oxygen" value={display(vital?.spo2_percent, 1)} unit="%" timestamp={vitalTimeLabel(vital, 'spo2_percent')} color={palette.primaryDark} surface={palette.aquaSurface} onPress={() => setSelectedMetric('spo2_percent')} />
            <MetricCard fullWidth={stackVitals} icon="moon-outline" title="Sleep" value={display(vital?.sleep_hours, 1)} unit="hours" annotation={sleepScore ? `Sleep score ${sleepScore.score} - ${sleepScore.label}` : undefined} timestamp={vitalTimeLabel(vital, 'sleep_hours')} color={palette.purple} surface={palette.lavenderSurface} onPress={() => setSelectedMetric('sleep_hours')} />
            <MetricCard fullWidth={stackVitals} icon="footsteps-outline" title="Steps (24h)" value={vital?.steps_count?.toLocaleString() ?? '--'} unit="steps" timestamp={vitalTimeLabel(vital, 'steps_count')} color={palette.accentDark} surface={palette.mintSurface} onPress={() => setSelectedMetric('steps_count')} />
            <MetricCard fullWidth={stackVitals} icon="thermometer-outline" title="Overnight skin temp" value={display(vital?.skin_temp_celsius, 1)} unit="°C" timestamp={vitalTimeLabel(vital, 'skin_temp_celsius')} color={palette.warning} surface={palette.peachSurface} onPress={() => setSelectedMetric('skin_temp_celsius')} />
            <MetricCard fullWidth={stackVitals} icon="leaf-outline" title="HRV" value={display(vital?.hrv_rmssd_ms)} unit="ms" timestamp={vitalTimeLabel(vital, 'hrv_rmssd_ms')} color={palette.pink} surface={palette.aquaSurface} onPress={() => setSelectedMetric('hrv_rmssd_ms')} />
          </View>
          {!vital ? <View style={[styles.empty, { backgroundColor: theme.cardElevated }]}><Ionicons name="analytics-outline" size={26} color={theme.subtitle} /><Text style={[styles.emptyTitle, { color: theme.text }]}>No health readings yet</Text><Text style={[styles.emptyText, { color: theme.subtitle }]}>Connect Google Health. Readings appear after the paired watch syncs.</Text></View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="View last sync location" onPress={() => router.push('/location')} style={[styles.locationStrip, { backgroundColor: isDark ? theme.cardElevated : palette.aquaSurface }]}>
            {syncLocation ? <View pointerEvents="none" style={styles.locationMap}><LocationMapPreview key={`${syncLocation.latitude}:${syncLocation.longitude}`} latitude={syncLocation.latitude} longitude={syncLocation.longitude} /></View> : null}
            <LinearGradient
              pointerEvents="none"
              colors={isDark ? ['rgba(41,57,54,0.98)', 'rgba(41,57,54,0.83)', 'rgba(41,57,54,0.34)'] : ['rgba(235,247,248,0.98)', 'rgba(235,247,248,0.84)', 'rgba(235,247,248,0.24)']}
              locations={[0, 0.58, 1]}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.locationContent}>
              <View style={styles.locationIcon}><CareArtwork kind="location" size={43} /></View>
              <View style={styles.locationCopy}>
                <Text style={[styles.locationTitle, { color: theme.text }]}>Last sync location</Text>
                <Text style={[styles.locationSubtitle, { color: theme.subtitle }]}>{syncLocation ? `Caregiver phone · ${timeAgo(syncLocation.recorded_at)}` : 'No phone sync location yet'}</Text>
              </View>
              <Ionicons name="arrow-forward" size={19} color={theme.text} />
            </View>
          </Pressable>
          <View style={styles.careSection}>
            <View style={styles.sectionRow}><Text style={[styles.sectionTitle, { color: theme.text }]}>Care plan</Text><Pressable onPress={() => router.push('/care')}><Text style={styles.manageText}>Manage</Text></Pressable></View>
            {appointments.map((item) => <CarePreviewRow key={item.id} kind="appointment" title={item.title} subtitle={`${new Date(item.appointment_at).getTime() >= Date.now() ? 'Appointment on' : 'Previous appointment'} ${appointmentLabel(item.appointment_at)}`} onPress={() => router.push('/care?tab=Appointments')} />)}
            {medicationStatuses.map(({ item, status }) => <CarePreviewRow key={item.id} kind="medication" title={item.medication_name} subtitle={`${status.label}: ${status.detail}${item.dosage ? ` • ${item.dosage}` : ''}`} onPress={() => router.push('/care?tab=Medications')} />)}
            {notes.map((item) => <CarePreviewRow key={item.id} kind="note" title={item.title || 'Caregiver note'} subtitle={item.content} onPress={() => router.push('/care?tab=Notes')} />)}
            {doctor ? <Pressable accessibilityRole="button" accessibilityLabel={`Call ${doctor.full_name}`} onPress={callDoctor} style={[styles.doctorCard, { backgroundColor: isDark ? theme.cardElevated : palette.aquaSurface }]}>
              {doctor.photo_url ? <Image source={{ uri: doctor.photo_url }} resizeMode="cover" style={styles.doctorPhoto} /> : <View style={styles.doctorFallback}><Ionicons name="medical-outline" size={90} color={palette.primaryDark} /></View>}
              <LinearGradient
                pointerEvents="none"
                colors={isDark ? ['rgba(41,57,54,0.05)', 'rgba(41,57,54,0.72)', palette.cardElevatedDark] : ['rgba(235,247,248,0.05)', 'rgba(235,247,248,0.76)', palette.aquaSurface]}
                locations={[0, 0.52, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.doctorCardContent}>
                <Text style={[styles.doctorEyebrow, { color: isDark ? theme.text : palette.primaryDark, backgroundColor: isDark ? 'rgba(41,57,54,0.86)' : 'rgba(235,247,248,0.86)' }]}>YOUR DOCTOR</Text>
                <View>
                  <Text numberOfLines={2} style={[styles.doctorTitle, { color: theme.text }]}>{doctor.full_name}</Text>
                  <Text numberOfLines={1} style={[styles.doctorBody, { color: theme.subtitle }]}>{doctor.phone}</Text>
                  <View style={styles.doctorCallRow}><View style={styles.doctorCallIcon}><Ionicons name="call" size={17} color="#FFFFFF" /></View><Text style={[styles.doctorCallText, { color: theme.text }]}>Call Doctor</Text><Ionicons name="arrow-forward" size={18} color={theme.text} /></View>
                </View>
              </View>
            </Pressable> : null}
            {!hasCarePreview ? <View style={[styles.emptyCare, { backgroundColor: theme.card }]}><Ionicons name="clipboard-outline" size={25} color={theme.subtitle} /><Text style={[styles.emptyText, { color: theme.subtitle }]}>Add a doctor, medications, appointments, or notes to see them here.</Text></View> : null}
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.cardElevated }]}>
            <View style={styles.summaryHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryEyebrow, { color: palette.primaryDark }]}>TODAY SUMMARY</Text>
                <Text style={[styles.summaryTitle, { color: theme.text }]}>What needs attention</Text>
              </View>
              <Text style={[styles.summaryTime, { color: theme.subtitle }]}>{checkedAgo ? `Checked ${checkedAgo}` : 'No sync yet'}</Text>
            </View>
            {todaySummary.map((item) => <SummaryRow key={item.label} icon={item.icon} color={item.color} label={item.label} text={item.text} />)}
          </View>
        </View>
      </ScrollView>

      <VitalDetailModal visible={selectedMetric !== null} metric={selectedMetric} history={history} onClose={() => setSelectedMetric(null)} />

      <Modal transparent visible={showSyncHelp} animationType="fade" onRequestClose={() => setShowSyncHelp(false)}>
        <View style={styles.overlay}><View style={[styles.modal, { backgroundColor: theme.cardElevated, alignItems: 'stretch' }]}>
          <Text style={[styles.modalTitle, { color: theme.text, marginTop: 0 }]}>Restore automatic watch sync</Text>
          <Text style={[styles.syncHelpText, { color: theme.subtitle }]}>On the phone paired with the Inspire 3:</Text>
          <Text style={[styles.syncHelpStep, { color: theme.text }]}>1. Keep Bluetooth on and the watch nearby.</Text>
          <Text style={[styles.syncHelpStep, { color: theme.text }]}>2. In Android Settings, open Apps → Health → App battery usage. Allow background usage and choose Unrestricted.</Text>
          <Text style={[styles.syncHelpStep, { color: theme.text }]}>3. In Apps → Health, allow Nearby devices and Background data. Turn off Battery Saver while testing.</Text>
          <Text style={[styles.syncHelpStep, { color: theme.text }]}>4. If watch status is unavailable, reconnect the same Google account in ElderCareAI and allow the requested Google Health permissions.</Text>
          <Text style={[styles.syncHelpText, { color: theme.subtitle }]}>New readings reach ElderCareAI automatically after Google Health syncs the watch. You do not need to refresh this app.</Text>
          <Pressable accessibilityRole="button" onPress={() => setShowSyncHelp(false)} style={styles.syncHelpClose}><Text style={styles.syncHelpCloseText}>Done</Text></Pressable>
        </View></View>
      </Modal>

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

function CarePreviewRow({ kind, title, subtitle, onPress }: { kind: 'appointment' | 'medication' | 'note'; title: string; subtitle: string; onPress: () => void }) {
  const theme = getTheme(useColorScheme() === 'dark');
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.careRow, { backgroundColor: theme.cardElevated }]}><View style={styles.careIcon}><CareArtwork kind={kind} size={42} /></View><View style={styles.careCopy}><Text numberOfLines={1} style={[styles.careTitle, { color: theme.text }]}>{title}</Text><Text numberOfLines={2} style={[styles.careText, { color: theme.subtitle }]}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={17} color={theme.subtitle} /></Pressable>;
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
  brand: { fontSize: 18, lineHeight: 24, fontFamily: fontFamily.extraBold }, brandAccent: { color: palette.primaryDark }, greeting: { marginTop: 2, fontSize: 12, fontFamily: fontFamily.regular }, headerStatus: { minHeight: 27, paddingHorizontal: 9, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }, headerStatusText: { fontSize: 10, fontFamily: fontFamily.semiBold },
  weekStrip: { flexDirection: 'row', marginTop: 13, paddingVertical: 7, borderRadius: 14 }, weekDay: { flex: 1, alignItems: 'center', gap: 3 }, weekLabel: { fontSize: 9.5, fontFamily: fontFamily.medium }, weekDate: { width: 29, height: 29, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, weekNumber: { fontSize: 11, fontFamily: fontFamily.medium, fontVariant: ['tabular-nums'] }, weekDot: { width: 4, height: 4, borderRadius: 2 },
  eyebrow: { ...typeScale.eyebrow },
  patientCard: { minHeight: 150, marginTop: 16, borderRadius: 16, overflow: 'hidden', justifyContent: 'center' },
  profilePhoto: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '54%', height: '100%' },
  profilePhotoFallback: { alignItems: 'center', justifyContent: 'center' },
  profilePhotoFade: { position: 'absolute', left: '20%', top: 0, bottom: 0, width: '34%' },
  patientCopy: { marginLeft: '43%', paddingRight: 12, paddingVertical: 15 },
  name: { marginTop: 4, fontSize: 22, lineHeight: 29, fontFamily: fontFamily.bold }, pills: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  pill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 11 }, pillText: { fontSize: 9.5, fontFamily: fontFamily.medium },
  content: { paddingHorizontal: 18, paddingTop: 5 },
  locationStrip: { minHeight: 82, marginTop: 16, borderRadius: 16, overflow: 'hidden', justifyContent: 'center' },
  locationMap: { ...StyleSheet.absoluteFillObject },
  locationContent: { minHeight: 82, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  locationIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  locationCopy: { flex: 1 },
  locationTitle: { fontSize: 13, fontFamily: fontFamily.semiBold },
  locationSubtitle: { marginTop: 3, fontSize: 11, fontFamily: fontFamily.regular },
  summaryCard: { marginTop: 20, marginBottom: 18, padding: 15, borderRadius: 14 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  summaryEyebrow: { ...typeScale.eyebrow },
  summaryTitle: { marginTop: 3, ...typeScale.sectionTitle },
  summaryTime: { marginTop: 2, fontSize: 10, fontFamily: fontFamily.medium },
  summaryRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1 },
  summaryLabel: { fontSize: 13, fontFamily: fontFamily.semiBold },
  summaryText: { marginTop: 2, fontSize: 12, lineHeight: 17 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 11 }, sectionTitle: { ...typeScale.sectionTitle, flexShrink: 1 },
  vitalsActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  syncButton: { width: 31, height: 31, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  connectionPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }, dot: { width: 7, height: 7, borderRadius: 4 }, connectionText: { fontSize: 11, fontFamily: fontFamily.bold },
  error: { marginBottom: 10, color: palette.error, fontSize: 12, lineHeight: 18 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  watchNotice: { padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  watchNoticeCopy: { flex: 1 }, watchNoticeTitle: { fontSize: 12, fontFamily: fontFamily.semiBold },
  watchNoticeText: { marginTop: 2, fontSize: 11, lineHeight: 15 }, watchFreshText: { marginBottom: 10, fontSize: 11, fontFamily: fontFamily.medium },
  watchIssue: { padding: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  watchIssueText: { flex: 1, fontSize: 11, lineHeight: 15 },
  empty: { marginTop: 16, padding: 22, borderRadius: 18, alignItems: 'center' }, emptyTitle: { marginTop: 9, ...typeScale.cardTitle }, emptyText: { marginTop: 5, ...typeScale.subhead, textAlign: 'center' },
  careSection: { marginTop: 18, gap: 8 },
  manageText: { color: palette.primaryDark, fontSize: 11, fontFamily: fontFamily.semiBold },
  doctorCard: { width: '100%', maxWidth: 320, aspectRatio: 1, alignSelf: 'center', borderRadius: 16, overflow: 'hidden' },
  doctorPhoto: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  doctorFallback: { ...StyleSheet.absoluteFillObject, padding: 30, alignItems: 'flex-end', opacity: 0.28 },
  doctorCardContent: { flex: 1, justifyContent: 'space-between', padding: 18 },
  doctorEyebrow: { ...typeScale.eyebrow, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, overflow: 'hidden' },
  doctorTitle: { fontSize: 22, lineHeight: 29, fontFamily: fontFamily.bold },
  doctorBody: { marginTop: 3, fontSize: 13, fontFamily: fontFamily.medium },
  doctorCallRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 9 },
  doctorCallIcon: { width: 35, height: 35, borderRadius: 18, backgroundColor: palette.primaryDark, alignItems: 'center', justifyContent: 'center' },
  doctorCallText: { flex: 1, fontSize: 13, fontFamily: fontFamily.bold },
  careRow: { minHeight: 65, borderRadius: 14, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  careIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  careCopy: { flex: 1, marginLeft: 10 }, careTitle: { fontSize: 13, fontFamily: fontFamily.semiBold }, careText: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  emptyCare: { padding: 16, borderRadius: 14, alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.62)', alignItems: 'center', justifyContent: 'center', padding: 24 }, modal: { width: '100%', maxWidth: 390, padding: 22, borderRadius: 14, alignItems: 'center' },
  modalIcon: { width: 55, height: 55, borderRadius: 14, backgroundColor: palette.aquaSurface, alignItems: 'center', justifyContent: 'center' }, modalTitle: { marginTop: 14, ...typeScale.sectionTitle },
  modalText: { marginTop: 8, ...typeScale.body, textAlign: 'center' }, notNow: { minHeight: 43, justifyContent: 'center' }, notNowText: { fontSize: 13, fontFamily: fontFamily.semiBold },
  syncHelpText: { marginTop: 12, fontSize: 12, lineHeight: 18 }, syncHelpStep: { marginTop: 11, fontSize: 13, lineHeight: 19 },
  syncHelpClose: { marginTop: 18, minHeight: 43, borderRadius: 12, backgroundColor: palette.primaryDark, alignItems: 'center', justifyContent: 'center' },
  syncHelpCloseText: { color: '#FFFFFF', fontSize: 13, fontFamily: fontFamily.semiBold },
});
