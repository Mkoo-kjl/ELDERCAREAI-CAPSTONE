import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/src/components/AppText';
import { PickerModal } from '@/src/components/PickerModal';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { useHealthData } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

type Checkup = { id: string; title: string; appointment_at: string; doctor_name: string | null; location: string | null; notes: string | null };
type Medication = { id: string; medication_name: string; dosage: string | null; frequency: string };

function sameOrBeforeToday(date: Date) {
  const today = new Date();
  return Number.isFinite(date.getTime()) && new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() <= new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
}

export default function HealthRecordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = getTheme(useColorScheme() === 'dark');
  const { session } = useAuth();
  const { elderly, refresh } = useHealthData();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [medicalHistory, setMedicalHistory] = useState('');
  const [historyDraft, setHistoryDraft] = useState('');
  const [editingHistory, setEditingHistory] = useState(false);
  const editingHistoryRef = useRef(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [checkups, setCheckups] = useState<Checkup[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [editingCheckup, setEditingCheckup] = useState<Checkup | null>(null);
  const [visitTitle, setVisitTitle] = useState('');
  const [visitDate, setVisitDate] = useState(new Date());
  const [doctorName, setDoctorName] = useState('');
  const [location, setLocation] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [savingCheckup, setSavingCheckup] = useState(false);

  const load = useCallback(async () => {
    if (!session || !elderly) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [profile, visits, medicines] = await Promise.all([
        supabase.from('elderly_profiles').select('medical_conditions').eq('elderly_id', elderly.elderly_id).eq('caregiver_id', session.user.id).maybeSingle(),
        supabase.from('appointments').select('id, title, appointment_at, doctor_name, location, notes').eq('caregiver_id', session.user.id).eq('elderly_id', elderly.elderly_id).eq('status', 'completed').order('appointment_at', { ascending: false }),
        supabase.from('medication_schedules').select('id, medication_name, dosage, frequency').eq('caregiver_id', session.user.id).eq('elderly_id', elderly.elderly_id).eq('is_active', true).order('medication_name'),
      ]);
      const loadError = profile.error ?? visits.error ?? medicines.error;
      if (loadError) setError('Unable to load health records. Check your connection and try again.');
      if (!profile.error) {
        const value = profile.data?.medical_conditions ?? '';
        setMedicalHistory(value);
        if (!editingHistoryRef.current) setHistoryDraft(value);
      }
      if (!visits.error) setCheckups((visits.data as Checkup[]) ?? []);
      if (!medicines.error) setMedications((medicines.data as Medication[]) ?? []);
    } catch {
      setError('Unable to load health records. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [elderly, session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const saveHistory = async () => {
    if (!session || !elderly || savingHistory) return;
    const value = historyDraft.trim();
    if (value.length > 2000) { setHistoryError('Keep medical history under 2,000 characters.'); return; }
    setHistoryError(null);
    setSavingHistory(true);
    try {
      const { data, error: saveError } = await supabase.from('elderly_profiles')
        .update({ medical_conditions: value || null })
        .eq('elderly_id', elderly.elderly_id).eq('caregiver_id', session.user.id)
        .select('medical_conditions').single();
      if (saveError) throw saveError;
      setMedicalHistory(data.medical_conditions ?? '');
      editingHistoryRef.current = false;
      setEditingHistory(false);
      await refresh(false).catch(() => undefined);
    } catch {
      setHistoryError('Could not save medical history. Please try again.');
    } finally {
      setSavingHistory(false);
    }
  };

  const openCheckup = (item: Checkup | null = null) => {
    setEditingCheckup(item);
    setVisitTitle(item?.title ?? '');
    setVisitDate(item ? new Date(item.appointment_at) : new Date());
    setDoctorName(item?.doctor_name ?? '');
    setLocation(item?.location ?? '');
    setVisitNotes(item?.notes ?? '');
    setFormError(null);
    setFormOpen(true);
  };

  const saveCheckup = async () => {
    if (!session || !elderly || savingCheckup) return;
    if (visitTitle.trim().length < 2) { setFormError('Enter a checkup title.'); return; }
    if (!sameOrBeforeToday(visitDate)) { setFormError('Choose today or an earlier visit date.'); return; }
    if (!visitNotes.trim()) { setFormError('Add the findings or treatment recorded at this visit.'); return; }
    setFormError(null);
    setSavingCheckup(true);
    const payload = {
      caregiver_id: session.user.id,
      elderly_id: elderly.elderly_id,
      title: visitTitle.trim(),
      appointment_at: visitDate.toISOString(),
      doctor_name: doctorName.trim() || null,
      location: location.trim() || null,
      notes: visitNotes.trim(),
      status: 'completed',
      updated_at: new Date().toISOString(),
    };
    try {
      const query = editingCheckup
        ? supabase.from('appointments').update(payload).eq('id', editingCheckup.id).eq('caregiver_id', session.user.id).eq('elderly_id', elderly.elderly_id)
        : supabase.from('appointments').insert(payload);
      const { error: saveError } = await query.select('id').single();
      if (saveError) throw saveError;
      setFormOpen(false);
      await load();
    } catch {
      setFormError('Could not save the checkup. Please try again.');
    } finally {
      setSavingCheckup(false);
    }
  };

  return <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to settings" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={theme.text} /></Pressable><View style={styles.headerText}><Text style={[styles.title, { color: theme.text }]}>Health records</Text><Text style={[styles.subtitle, { color: theme.subtitle }]}>{elderly?.full_name ?? 'Older adult'}</Text></View></View>
    {!elderly ? <View style={styles.center}><Text style={[styles.emptyTitle, { color: theme.text }]}>Add an older adult profile first</Text><Text style={[styles.body, { color: theme.subtitle }]}>Health records are saved to the active older adult.</Text></View> : loading && !checkups.length && !medications.length && !medicalHistory ? <View style={styles.center}><ActivityIndicator color={palette.primaryDark} /><Text style={[styles.body, { color: theme.subtitle }]}>Loading health records...</Text></View> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}>
      {error ? <Pressable accessibilityRole="button" onPress={() => void load()} style={[styles.errorBanner, { backgroundColor: `${palette.error}12` }]}><Text style={[styles.errorText, { color: palette.error }]}>{error} Tap to retry.</Text></Pressable> : null}
      <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.text }]}>Medical history</Text>{!editingHistory ? <Pressable accessibilityRole="button" accessibilityLabel="Edit medical history" onPress={() => { setHistoryDraft(medicalHistory); setHistoryError(null); editingHistoryRef.current = true; setEditingHistory(true); }}><Ionicons name="create-outline" size={20} color={palette.primaryDark} /></Pressable> : null}</View>
      {editingHistory ? <View style={[styles.panel, { backgroundColor: theme.cardElevated }]}><TextInput accessibilityLabel="Medical history and conditions" multiline value={historyDraft} onChangeText={setHistoryDraft} placeholder="Conditions, past procedures, and relevant history" placeholderTextColor={theme.subtitle} style={[styles.historyInput, { color: theme.text, backgroundColor: theme.card }]} /><Text style={[styles.hint, { color: theme.subtitle }]}>Caregiver-entered information, not a clinical record.</Text>{historyError ? <Text style={styles.validation}>{historyError}</Text> : null}<View style={styles.formActions}><Pressable accessibilityRole="button" disabled={savingHistory} onPress={() => { setHistoryDraft(medicalHistory); setHistoryError(null); editingHistoryRef.current = false; setEditingHistory(false); }} style={styles.cancelButton}><Text style={[styles.actionText, { color: theme.subtitle }]}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={savingHistory} onPress={() => void saveHistory()} style={styles.saveButton}><Text style={styles.saveText}>{savingHistory ? 'Saving...' : 'Save Entry'}</Text></Pressable></View></View> : <View style={[styles.panel, { backgroundColor: theme.cardElevated }]}><Text style={[styles.body, { color: medicalHistory ? theme.text : theme.subtitle }]}>{medicalHistory || 'No medical history entered yet.'}</Text></View>}

      <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.text }]}>Checkup history</Text><Pressable accessibilityRole="button" accessibilityLabel="Add checkup" onPress={() => openCheckup()} style={styles.addButton}><Ionicons name="add" size={17} color="#FFFFFF" /><Text style={styles.addText}>Add</Text></Pressable></View>
      {checkups.length ? checkups.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} onPress={() => openCheckup(item)} style={[styles.visit, { backgroundColor: theme.cardElevated }]}><View style={styles.visitIcon}><Ionicons name="medkit-outline" size={21} color={palette.primaryDark} /></View><View style={styles.visitCopy}><Text style={[styles.visitTitle, { color: theme.text }]}>{item.title}</Text><Text style={[styles.meta, { color: theme.subtitle }]}>{new Date(item.appointment_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}{item.doctor_name ? ` · ${item.doctor_name}` : ''}</Text><Text numberOfLines={2} style={[styles.body, { color: theme.subtitle }]}>{item.notes}</Text></View><Ionicons name="chevron-forward" size={17} color={theme.subtitle} /></Pressable>) : <View style={[styles.panel, { backgroundColor: theme.cardElevated }]}><Text style={[styles.body, { color: theme.subtitle }]}>No completed checkups recorded yet.</Text></View>}

      <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.text }]}>Medications</Text><Pressable accessibilityRole="button" accessibilityLabel="Manage medications" onPress={() => router.push('/care?tab=Medications')}><Text style={styles.manageText}>Manage</Text></Pressable></View>
      <View style={[styles.panel, { backgroundColor: theme.cardElevated }]}>{medications.length ? medications.map((item) => <View key={item.id} style={styles.medicineRow}><Ionicons name="medical-outline" size={18} color={palette.primaryDark} /><View style={styles.medicineCopy}><Text style={[styles.medicineName, { color: theme.text }]}>{item.medication_name}</Text><Text style={[styles.meta, { color: theme.subtitle }]}>{[item.dosage, item.frequency].filter(Boolean).join(' · ')}</Text></View></View>) : <Text style={[styles.body, { color: theme.subtitle }]}>No active medication schedules yet.</Text>}</View>
    </ScrollView>}

    <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}><KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.sheet, { backgroundColor: theme.cardElevated, paddingBottom: Math.max(insets.bottom, 18) }]}><View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: theme.text }]}>{editingCheckup ? 'Edit checkup' : 'Add checkup'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Cancel checkup" onPress={() => setFormOpen(false)}><Ionicons name="close" size={22} color={theme.text} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled">
      <RecordField label="Checkup title" value={visitTitle} onChangeText={setVisitTitle} placeholder="e.g. Routine follow-up" />
      <Text style={[styles.label, { color: theme.subtitle }]}>VISIT DATE</Text><Pressable accessibilityRole="button" accessibilityLabel="Choose visit date" onPress={() => setDatePickerOpen(true)} style={[styles.dateButton, { backgroundColor: theme.card }]}><Ionicons name="calendar-outline" size={18} color={palette.primaryDark} /><Text style={[styles.dateText, { color: theme.text }]}>{visitDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</Text><Ionicons name="chevron-down" size={16} color={theme.subtitle} /></Pressable>
      <RecordField label="Doctor (optional)" value={doctorName} onChangeText={setDoctorName} placeholder="Doctor's name" />
      <RecordField label="Location (optional)" value={location} onChangeText={setLocation} placeholder="Clinic or hospital" />
      <RecordField label="Findings or treatment" value={visitNotes} onChangeText={setVisitNotes} placeholder="What was discussed or done" multiline />
      {formError ? <Text style={styles.validation}>{formError}</Text> : null}
      <View style={styles.formActions}><Pressable accessibilityRole="button" disabled={savingCheckup} onPress={() => setFormOpen(false)} style={styles.cancelButton}><Text style={[styles.actionText, { color: theme.subtitle }]}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={savingCheckup} onPress={() => void saveCheckup()} style={styles.saveButton}><Text style={styles.saveText}>{savingCheckup ? 'Saving...' : 'Save Entry'}</Text></Pressable></View>
    </ScrollView></View></KeyboardAvoidingView></Modal>
    <PickerModal visible={datePickerOpen} value={visitDate} mode="date" title="Visit date" maxDate={new Date()} onChange={setVisitDate} onClose={() => setDatePickerOpen(false)} />
  </View>;
}

function RecordField({ label, multiline, ...props }: { label: string; multiline?: boolean; value: string; onChangeText: (value: string) => void; placeholder: string }) {
  const theme = getTheme(useColorScheme() === 'dark');
  return <View style={styles.field}><Text style={[styles.label, { color: theme.subtitle }]}>{label.toUpperCase()}</Text><TextInput {...props} accessibilityLabel={label} multiline={multiline} placeholderTextColor={theme.subtitle} style={[styles.input, multiline && styles.multiline, { color: theme.text, backgroundColor: theme.card }]} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { minHeight: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }, back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, headerText: { flex: 1 }, title: { ...typeScale.screenTitle }, subtitle: { ...typeScale.subhead }, content: { paddingHorizontal: 18, gap: 10 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25, gap: 10 }, emptyTitle: { ...typeScale.cardTitle }, body: { ...typeScale.subhead }, errorBanner: { padding: 13, borderRadius: 13 }, errorText: { ...typeScale.caption },
  sectionHeader: { marginTop: 19, minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { ...typeScale.sectionTitle }, panel: { padding: 15, borderRadius: 15 }, historyInput: { minHeight: 110, borderRadius: 11, padding: 12, textAlignVertical: 'top', ...typeScale.body }, hint: { marginTop: 8, ...typeScale.caption }, validation: { color: palette.error, marginTop: 9, ...typeScale.caption }, formActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 17 }, cancelButton: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, actionText: { fontFamily: fontFamily.semiBold, fontSize: 13 }, saveButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryDark }, saveText: { color: '#FFFFFF', ...typeScale.button },
  addButton: { minHeight: 32, paddingHorizontal: 11, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: palette.primaryDark }, addText: { color: '#FFFFFF', fontFamily: fontFamily.semiBold, fontSize: 12 }, visit: { minHeight: 86, padding: 14, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 11 }, visitIcon: { width: 41, height: 41, borderRadius: 12, backgroundColor: palette.aquaSurface, alignItems: 'center', justifyContent: 'center' }, visitCopy: { flex: 1 }, visitTitle: { ...typeScale.cardTitle }, meta: { marginTop: 2, ...typeScale.caption }, medicineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }, medicineCopy: { flex: 1 }, medicineName: { fontFamily: fontFamily.semiBold, fontSize: 13 }, manageText: { color: palette.primaryDark, fontFamily: fontFamily.semiBold, fontSize: 12 },
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }, sheet: { maxHeight: '88%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 18 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }, sheetTitle: { ...typeScale.sectionTitle }, field: { marginTop: 10 }, label: { ...typeScale.eyebrow, marginBottom: 7 }, input: { minHeight: 47, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, ...typeScale.body }, multiline: { minHeight: 95, textAlignVertical: 'top' }, dateButton: { minHeight: 49, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }, dateText: { flex: 1, ...typeScale.body },
});
