import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PickerModal } from '@/src/components/PickerModal';
import { medicationDoseStatus, startOfLocalDay, type MedicationDoseStatus, type MedicationDoseTone, type MedicationLogLike } from '@/src/lib/care-status';
import {
  cancelCareNotifications,
  hasNotificationPermission,
  isValidReminderTime,
  scheduleAppointmentNotification,
  scheduleMedicationNotifications,
  secondDailyTime,
} from '@/src/lib/notifications';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { useHealthData } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

type Tab = 'Medications' | 'Appointments' | 'Notes';
type Medication = { id: string; medication_name: string; dosage: string | null; frequency: string; instructions: string | null; color_tag: string | null; is_active: boolean; times_of_day: string[] | null; reminder_enabled: boolean | null; start_date: string | null };
type MedicationLog = MedicationLogLike;
type Appointment = { id: string; title: string; doctor_name: string | null; location: string | null; appointment_at: string; notes: string | null; status: string | null };
type Note = { id: string; title: string | null; content: string; is_pinned: boolean; updated_at: string };
type Editing = Medication | Appointment | Note | null;

const tabs: Tab[] = ['Medications', 'Appointments', 'Notes'];
const frequencies = ['Daily', 'Twice daily', 'Weekly', 'As needed'];
const colorTags = [palette.primary, palette.accent, palette.warning, palette.error, palette.purple, palette.pink];

export default function CareScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);
  const { session } = useAuth();
  const { elderly } = useHealthData();
  const [tab, setTab] = useState<Tab>('Medications');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [secondary, setSecondary] = useState('');
  const [details, setDetails] = useState('');
  const [location, setLocation] = useState('');
  const [frequency, setFrequency] = useState(frequencies[0]);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [tag, setTag] = useState<string>(colorTags[0]);
  const [date, setDate] = useState(() => new Date(Date.now() + 86_400_000));
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (tabs.includes(params.tab as Tab)) setTab(params.tab as Tab);
  }, [params.tab]);

  const load = useCallback(async () => {
    if (!session || !elderly) return;
    setRefreshing(true);
    const [meds, medLogs, visits, noteRows] = await Promise.all([
      supabase.from('medication_schedules').select('id, medication_name, dosage, frequency, instructions, color_tag, is_active, times_of_day, reminder_enabled, start_date').eq('caregiver_id', session.user.id).eq('elderly_id', elderly.elderly_id).eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('medication_logs').select('schedule_id, status, scheduled_time, taken_at').eq('elderly_id', elderly.elderly_id).gte('scheduled_time', startOfLocalDay().toISOString()),
      supabase.from('appointments').select('id, title, doctor_name, location, appointment_at, notes, status').eq('caregiver_id', session.user.id).eq('elderly_id', elderly.elderly_id).order('appointment_at'),
      supabase.from('caregiver_notes').select('id, title, content, is_pinned, updated_at').eq('caregiver_id', session.user.id).eq('elderly_id', elderly.elderly_id).order('is_pinned', { ascending: false }).order('updated_at', { ascending: false }),
    ]);
    const error = meds.error ?? medLogs.error ?? visits.error ?? noteRows.error;
    if (error) Alert.alert('Unable to load care data', error.message);
    const medicationRows = (meds.data as Medication[]) ?? [];
    const appointmentRows = (visits.data as Appointment[]) ?? [];
    setMedications(medicationRows);
    setMedicationLogs((medLogs.data as MedicationLog[]) ?? []);
    setAppointments(appointmentRows);
    setNotes((noteRows.data as Note[]) ?? []);
    if (await hasNotificationPermission()) {
      void Promise.all([
        ...medicationRows.map((item) => scheduleMedicationNotifications({ id: item.id, medicationName: item.medication_name, dosage: item.dosage, frequency: item.frequency, timesOfDay: item.times_of_day ?? [], elderlyName: elderly.full_name, startDate: item.start_date }, false)),
        ...appointmentRows.filter((item) => new Date(item.appointment_at).getTime() > Date.now()).map((item) => scheduleAppointmentNotification({ id: item.id, title: item.title, appointmentAt: item.appointment_at, elderlyName: elderly.full_name, doctorName: item.doctor_name, location: item.location }, false)),
      ]).catch(() => undefined);
    }
    setRefreshing(false);
  }, [elderly, session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openForm = (item: Editing = null) => {
    setEditing(item);
    if (tab === 'Medications') {
      const med = item as Medication | null;
      setName(med?.medication_name ?? ''); setSecondary(med?.dosage ?? ''); setDetails(med?.instructions ?? ''); setFrequency(med?.frequency ?? frequencies[0]); setTag(med?.color_tag ?? colorTags[0]); setReminderTime(med?.times_of_day?.[0] ?? '08:00');
    } else if (tab === 'Appointments') {
      const appointment = item as Appointment | null;
      setName(appointment?.title ?? ''); setSecondary(appointment?.doctor_name ?? ''); setLocation(appointment?.location ?? ''); setDetails(appointment?.notes ?? ''); setDate(appointment ? new Date(appointment.appointment_at) : new Date(Date.now() + 86_400_000));
    } else {
      const note = item as Note | null;
      setName(note?.title ?? ''); setDetails(note?.content ?? ''); setSecondary(''); setLocation('');
    }
    setModalOpen(true);
  };

  const save = async () => {
    if (!session || !elderly || (tab !== 'Notes' && !name.trim()) || (tab === 'Notes' && !details.trim())) { Alert.alert('Missing information', tab === 'Notes' ? 'Add note content.' : 'Add a name or title.'); return; }
    if (tab === 'Appointments' && date.getTime() < Date.now()) { Alert.alert('Choose a future time', 'Appointments cannot be scheduled in the past.'); return; }
    if (tab === 'Medications' && frequency !== 'As needed' && !isValidReminderTime(reminderTime)) { Alert.alert('Invalid reminder time', 'Use 24-hour HH:MM format, for example 08:00 or 20:30.'); return; }
    setSaving(true);
    try {
      let reminderWarning: string | null = null;
      if (tab === 'Medications') {
        const timesOfDay = frequency === 'As needed' ? [] : frequency === 'Twice daily' ? [reminderTime, secondDailyTime(reminderTime)] : [reminderTime];
        const payload = { elderly_id: elderly.elderly_id, caregiver_id: session.user.id, medication_name: name.trim(), dosage: secondary.trim() || null, frequency, times_of_day: timesOfDay, reminder_enabled: frequency !== 'As needed', instructions: details.trim() || null, color_tag: tag, updated_at: new Date().toISOString() };
        const result = editing ? await supabase.from('medication_schedules').update(payload).eq('id', editing.id).select('id, start_date').single() : await supabase.from('medication_schedules').insert(payload).select('id, start_date').single();
        if (result.error) throw result.error;
        try {
          const scheduled = await scheduleMedicationNotifications({ id: result.data.id, medicationName: name.trim(), dosage: secondary.trim() || null, frequency, timesOfDay, elderlyName: elderly.full_name, startDate: result.data.start_date });
          if (!scheduled) reminderWarning = 'Medication saved, but notification permission was not granted.';
        } catch (notificationError) { reminderWarning = notificationError instanceof Error ? notificationError.message : 'Medication saved, but its notification could not be scheduled.'; }
      } else if (tab === 'Appointments') {
        const payload = { elderly_id: elderly.elderly_id, caregiver_id: session.user.id, title: name.trim(), doctor_name: secondary.trim() || null, location: location.trim() || null, notes: details.trim() || null, appointment_at: date.toISOString(), updated_at: new Date().toISOString() };
        const result = editing ? await supabase.from('appointments').update(payload).eq('id', editing.id).select('id').single() : await supabase.from('appointments').insert(payload).select('id').single();
        if (result.error) throw result.error;
        try {
          const scheduled = await scheduleAppointmentNotification({ id: result.data.id, title: name.trim(), appointmentAt: date.toISOString(), elderlyName: elderly.full_name, doctorName: secondary.trim() || null, location: location.trim() || null });
          if (!scheduled) reminderWarning = 'Appointment saved, but notification permission was not granted.';
        } catch (notificationError) { reminderWarning = notificationError instanceof Error ? notificationError.message : 'Appointment saved, but its notification could not be scheduled.'; }
      } else {
        const payload = { elderly_id: elderly.elderly_id, caregiver_id: session.user.id, title: name.trim() || null, content: details.trim(), updated_at: new Date().toISOString() };
        const result = editing ? await supabase.from('caregiver_notes').update(payload).eq('id', editing.id) : await supabase.from('caregiver_notes').insert(payload);
        if (result.error) throw result.error;
      }
      setModalOpen(false); await load();
      if (reminderWarning) Alert.alert('Reminder not scheduled', reminderWarning);
    } catch (caught) { Alert.alert('Unable to save', caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setSaving(false); }
  };

  const markTaken = async (item: Medication) => {
    if (!session || !elderly) return;
    const { error } = await supabase.from('medication_logs').insert({ schedule_id: item.id, elderly_id: elderly.elderly_id, scheduled_time: new Date().toISOString(), taken_at: new Date().toISOString(), status: 'taken', recorded_by: session.user.id });
    if (!error) await load();
    Alert.alert(error ? 'Unable to record dose' : 'Dose recorded', error?.message ?? `${item.medication_name} was marked as taken.`);
  };

  const remove = (kind: Tab, item: Editing) => Alert.alert(`Delete ${kind === 'Medications' ? 'medication' : kind === 'Appointments' ? 'appointment' : 'note'}?`, 'This action cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
    if (!item) return;
    const result = kind === 'Medications' ? await supabase.from('medication_schedules').update({ is_active: false }).eq('id', item.id) : kind === 'Appointments' ? await supabase.from('appointments').delete().eq('id', item.id) : await supabase.from('caregiver_notes').delete().eq('id', item.id);
    if (result.error) Alert.alert('Unable to delete', result.error.message); else {
      if (kind === 'Medications') await cancelCareNotifications('medication', item.id);
      if (kind === 'Appointments') await cancelCareNotifications('appointment', item.id);
      await load();
    }
  } }]);

  const togglePin = async (item: Note) => { const { error } = await supabase.from('caregiver_notes').update({ is_pinned: !item.is_pinned, updated_at: new Date().toISOString() }).eq('id', item.id); if (error) Alert.alert('Unable to update note', error.message); else await load(); };

  return <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
    <View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>Care plan</Text><Text style={[styles.subtitle, { color: theme.subtitle }]}>Medication, appointments and notes</Text></View>
    <View style={[styles.tabs, { backgroundColor: theme.cardElevated }]}>{tabs.map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.activeTab]}><Text style={[styles.tabText, { color: tab === item ? palette.text : theme.subtitle }]}>{item}</Text></Pressable>)}</View>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} colors={[palette.primary]} />} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
      {tab === 'Medications' ? medications.map((item) => {
        const status = medicationDoseStatus(item, medicationLogs);
        return <View key={item.id} style={[styles.card, { backgroundColor: isDark ? theme.cardElevated : status.tone === 'taken' ? palette.mintSurface : status.tone === 'due' || status.tone === 'soon' ? palette.lemonSurface : theme.cardElevated, borderColor: theme.border }]}><View style={[styles.colorBar, { backgroundColor: item.color_tag ?? medicationToneColor(status.tone) }]} /><View style={styles.cardBody}><View style={styles.medTop}><View style={styles.medTitleWrap}><Text style={[styles.cardTitle, { color: theme.text }]}>{item.medication_name}</Text><Text style={[styles.meta, { color: theme.subtitle }]}>{[item.dosage, item.frequency].filter(Boolean).join(' • ')}</Text></View><MedicationStatusPill status={status} /></View>{item.reminder_enabled && item.times_of_day?.length ? <View style={styles.reminderRow}><Ionicons name="notifications-outline" size={14} color={palette.primaryDark} /><Text style={styles.reminderText}>{item.times_of_day.join(' and ')}</Text></View> : null}{item.instructions ? <Text style={[styles.body, { color: theme.subtitle }]}>{item.instructions}</Text> : null}<View style={styles.actions}><Action icon="checkmark" label="Taken" color={palette.accentDark} onPress={() => void markTaken(item)} /><Action icon="create-outline" label="Edit" color={palette.primaryDark} onPress={() => openForm(item)} /><Action icon="trash-outline" label="Delete" color={palette.error} onPress={() => remove(tab, item)} /></View></View></View>;
      }) : null}
      {tab === 'Appointments' ? appointments.map((item) => <View key={item.id} style={[styles.card, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}><View style={[styles.leadingIcon, { backgroundColor: `${palette.purple}15` }]}><Ionicons name="calendar" size={21} color={palette.purple} /></View><View style={styles.cardBody}><Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text><Text style={[styles.meta, { color: theme.subtitle }]}>{new Date(item.appointment_at).toLocaleString()}</Text>{item.doctor_name || item.location ? <Text style={[styles.body, { color: theme.subtitle }]}>{[item.doctor_name, item.location].filter(Boolean).join(' • ')}</Text> : null}<View style={styles.actions}><Action icon="create-outline" label="Edit" color={palette.primaryDark} onPress={() => openForm(item)} /><Action icon="trash-outline" label="Delete" color={palette.error} onPress={() => remove(tab, item)} /></View></View></View>) : null}
      {tab === 'Notes' ? notes.map((item) => <Pressable key={item.id} onPress={() => openForm(item)} style={[styles.noteCard, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}><View style={styles.noteTop}><Text style={[styles.cardTitle, { color: theme.text }]}>{item.title || 'Untitled note'}</Text><Pressable hitSlop={10} onPress={() => void togglePin(item)}><Ionicons name={item.is_pinned ? 'pin' : 'pin-outline'} size={19} color={item.is_pinned ? palette.warning : theme.subtitle} /></Pressable></View><Text numberOfLines={4} style={[styles.body, { color: theme.subtitle }]}>{item.content}</Text><View style={styles.actions}><Action icon="create-outline" label="Edit" color={palette.primaryDark} onPress={() => openForm(item)} /><Action icon="trash-outline" label="Delete" color={palette.error} onPress={() => remove(tab, item)} /></View></Pressable>) : null}
      {(tab === 'Medications' ? medications : tab === 'Appointments' ? appointments : notes).length === 0 && !refreshing ? <View style={styles.empty}><Ionicons name={tab === 'Medications' ? 'medkit-outline' : tab === 'Appointments' ? 'calendar-outline' : 'document-text-outline'} size={42} color={theme.subtitle} /><Text style={[styles.emptyTitle, { color: theme.text }]}>No {tab.toLowerCase()} yet</Text><Text style={[styles.emptyBody, { color: theme.subtitle }]}>Tap + to create the first one.</Text></View> : null}
    </ScrollView>
    <Pressable accessibilityLabel={`Add ${tab.slice(0, -1)}`} onPress={() => openForm()} style={[styles.fabWrap, { bottom: insets.bottom + 77 }]}><View style={styles.fab}><Ionicons name="add" size={26} color="#FFFFFF" /></View></Pressable>
    <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}><KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.sheet, { backgroundColor: theme.cardElevated, paddingBottom: Math.max(insets.bottom, 18) }]}><View style={styles.formHeader}><Text style={[styles.formTitle, { color: theme.text }]}>{editing ? 'Edit' : 'Add'} {tab.slice(0, -1)}</Text><Pressable onPress={() => setModalOpen(false)}><Ionicons name="close" size={24} color={theme.text} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled">
      <Field label={tab === 'Medications' ? 'Medication name' : 'Title'} value={name} onChangeText={setName} />
      {tab !== 'Notes' ? <Field label={tab === 'Medications' ? 'Dosage' : 'Doctor name'} value={secondary} onChangeText={setSecondary} /> : null}
      {tab === 'Medications' ? <><Text style={[styles.fieldLabel, { color: theme.subtitle }]}>FREQUENCY</Text><View style={styles.choices}>{frequencies.map((item) => <Pressable key={item} onPress={() => setFrequency(item)} style={[styles.choice, { backgroundColor: theme.card, borderColor: theme.border }, frequency === item && styles.choiceActive]}><Text style={[styles.choiceText, { color: frequency === item ? palette.text : theme.text }]}>{item}</Text></Pressable>)}</View>{frequency !== 'As needed' ? <><Field label="Reminder time (24-hour HH:MM)" value={reminderTime} onChangeText={setReminderTime} />{frequency === 'Twice daily' && isValidReminderTime(reminderTime) ? <Text style={[styles.timeHint, { color: theme.subtitle }]}>Reminders at {reminderTime} and {secondDailyTime(reminderTime)}</Text> : null}</> : <Text style={[styles.timeHint, { color: theme.subtitle }]}>As-needed medications do not receive scheduled reminders.</Text>}<Text style={[styles.fieldLabel, { color: theme.subtitle }]}>COLOR TAG</Text><View style={styles.colorChoices}>{colorTags.map((color) => <Pressable key={color} onPress={() => setTag(color)} style={[styles.colorChoice, { backgroundColor: color }, tag === color && styles.colorActive]} />)}</View></> : null}
      {tab === 'Appointments' ? <><Text style={[styles.fieldLabel, { color: theme.subtitle }]}>DATE & TIME</Text><Pressable onPress={() => setDatePickerOpen(true)} style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.border }]}><Ionicons name="calendar-outline" size={18} color={palette.purple} /><Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{date.toLocaleString()}</Text></Pressable></> : null}
      {tab === 'Appointments' ? <Field label="Location" value={location} onChangeText={setLocation} /> : null}
      <Field label={tab === 'Appointments' ? 'Notes' : tab === 'Medications' ? 'Instructions' : 'Note content'} value={details} onChangeText={setDetails} multiline />
      <Pressable onPress={() => void save()} disabled={saving} style={styles.save}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
    </ScrollView></View></KeyboardAvoidingView></Modal>
    <PickerModal visible={datePickerOpen} value={date} onChange={setDate} onClose={() => setDatePickerOpen(false)} />
  </View>;
}

function MedicationStatusPill({ status }: { status: MedicationDoseStatus }) {
  const color = medicationToneColor(status.tone);
  return <View style={[styles.statusPill, { backgroundColor: `${color}14` }]}><Ionicons name={medicationToneIcon(status.tone)} size={13} color={color} /><Text style={[styles.statusText, { color }]}>{status.label}</Text></View>;
}
function medicationToneColor(tone: MedicationDoseTone) {
  if (tone === 'taken') return palette.accentDark;
  if (tone === 'missed') return palette.error;
  if (tone === 'due' || tone === 'soon') return palette.warning;
  if (tone === 'as_needed') return palette.purple;
  return palette.primaryDark;
}
function medicationToneIcon(tone: MedicationDoseTone): keyof typeof Ionicons.glyphMap {
  if (tone === 'taken') return 'checkmark-circle';
  if (tone === 'missed') return 'alert-circle';
  if (tone === 'due' || tone === 'soon') return 'time';
  if (tone === 'as_needed') return 'hand-left-outline';
  return 'notifications-outline';
}
function Field({ label, multiline, ...props }: { label: string; multiline?: boolean; value: string; onChangeText: (value: string) => void }) { const theme = getTheme(useColorScheme() === 'dark'); return <View style={styles.field}><Text style={[styles.fieldLabel, { color: theme.subtitle }]}>{label.toUpperCase()}</Text><TextInput {...props} multiline={multiline} placeholderTextColor={theme.subtitle} style={[styles.input, multiline && styles.multiline, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]} /></View>; }
function Action({ icon, label, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.action}><Ionicons name={icon} size={15} color={color} /><Text style={[styles.actionText, { color }]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 }, title: { ...typeScale.screenTitle }, subtitle: { marginTop: 3, fontSize: 12, lineHeight: 18 }, tabs: { marginHorizontal: 18, borderRadius: 8, padding: 4, flexDirection: 'row' }, tab: { flex: 1, height: 35, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, activeTab: { backgroundColor: palette.aquaSurface }, tabText: { fontSize: 11, fontFamily: fontFamily.medium }, content: { padding: 18, gap: 8 },
  card: { borderWidth: 1, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', minHeight: 112 }, colorBar: { width: 4 }, leadingIcon: { width: 40, height: 40, borderRadius: 7, margin: 13, alignItems: 'center', justifyContent: 'center' }, cardBody: { flex: 1, padding: 13 }, medTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, medTitleWrap: { flex: 1 }, cardTitle: { ...typeScale.cardTitle }, meta: { marginTop: 3, fontSize: 11 }, statusPill: { minHeight: 25, borderRadius: 7, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 4 }, statusText: { fontSize: 10, fontFamily: fontFamily.medium }, reminderRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }, reminderText: { color: palette.primaryDark, fontSize: 11, fontFamily: fontFamily.medium }, body: { marginTop: 7, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: 'row', gap: 17, marginTop: 12 }, action: { flexDirection: 'row', alignItems: 'center', gap: 4 }, actionText: { fontSize: 10.5, fontFamily: fontFamily.medium }, noteCard: { borderWidth: 1, borderRadius: 8, padding: 14 }, noteTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, empty: { alignItems: 'center', paddingTop: 70 }, emptyTitle: { marginTop: 12, ...typeScale.sectionTitle }, emptyBody: { marginTop: 4, fontSize: 12 }, fabWrap: { position: 'absolute', right: 20 }, fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: palette.text, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }, sheet: { maxHeight: '88%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 18 }, formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, formTitle: { ...typeScale.sectionTitle }, field: { marginTop: 12 }, fieldLabel: { fontSize: 10, fontFamily: fontFamily.medium, marginBottom: 7, marginTop: 12 }, input: { minHeight: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13 }, multiline: { minHeight: 92, textAlignVertical: 'top' }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choice: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 }, choiceActive: { backgroundColor: palette.aquaSurface, borderColor: palette.primaryDark }, choiceText: { fontSize: 11, fontFamily: fontFamily.medium }, timeHint: { marginTop: 7, fontSize: 11, lineHeight: 16 }, colorChoices: { flexDirection: 'row', gap: 13 }, colorChoice: { width: 31, height: 31, borderRadius: 16 }, colorActive: { borderWidth: 4, borderColor: '#FFFFFF' }, dateButton: { minHeight: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 }, save: { marginTop: 22, height: 51, borderRadius: 8, backgroundColor: palette.primaryDark, alignItems: 'center', justifyContent: 'center' }, saveText: { color: '#FFFFFF', fontFamily: fontFamily.semiBold, fontSize: 14 },
});
