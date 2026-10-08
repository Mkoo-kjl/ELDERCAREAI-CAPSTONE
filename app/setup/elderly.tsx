import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText as Text } from '@/src/components/AppText';
import { ChoiceChips } from '@/src/components/ChoiceChips';
import { FormField } from '@/src/components/FormField';
import { GradientButton } from '@/src/components/GradientButton';
import { PickerModal } from '@/src/components/PickerModal';
import { type LocalPhoto, ProfilePhotoPicker } from '@/src/components/ProfilePhotoPicker';
import { SetupScaffold } from '@/src/components/SetupScaffold';
import { uploadProfilePhoto } from '@/src/lib/profile-photo';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
type Field = 'fullName' | 'birth' | 'gender' | 'weight' | 'height' | 'bloodType' | 'emergencyName' | 'emergencyPhone';
type Errors = Partial<Record<Field, string>>;

function ageFromDate(date: string) {
  const birthday = new Date(`${date}T00:00:00`);
  if (Number.isNaN(birthday.getTime()) || birthday > new Date()) return null;
  const now = new Date();
  let result = now.getFullYear() - birthday.getFullYear();
  const beforeBirthday = now.getMonth() < birthday.getMonth()
    || (now.getMonth() === birthday.getMonth() && now.getDate() < birthday.getDate());
  if (beforeBirthday) result -= 1;
  return result;
}

export default function ElderlySetupScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { session, refreshOnboarding } = useAuth();
  const theme = getTheme(useColorScheme() === 'dark');
  const [elderlyId, setElderlyId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [birthPickerOpen, setBirthPickerOpen] = useState(false);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [remotePhoto, setRemotePhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const parsedBirthDate = dateOfBirth ? new Date(`${dateOfBirth}T12:00:00`) : null;
  const birthPickerDate = parsedBirthDate && !Number.isNaN(parsedBirthDate.getTime())
    ? parsedBirthDate
    : new Date(new Date().getFullYear() - 75, new Date().getMonth(), new Date().getDate(), 12);

  useEffect(() => {
    if (!session) return;
    supabase.from('elderly_profiles').select('*').eq('caregiver_id', session.user.id).order('created_at').limit(1).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setElderlyId(data.elderly_id);
        setFullName(data.full_name ?? '');
        setDateOfBirth(data.date_of_birth ?? '');
        setAge(data.age !== null ? String(data.age) : '');
        setGender(data.gender ?? '');
        setWeight(data.weight_kg !== null ? String(data.weight_kg) : '');
        setHeight(data.height_cm !== null ? String(data.height_cm) : '');
        setBloodType(data.blood_type ?? '');
        setConditions(data.medical_conditions ?? '');
        setMedications(data.medications ?? '');
        setEmergencyName(data.emergency_contact ?? '');
        setEmergencyPhone(data.emergency_contact_phone ?? '');
        setRemotePhoto(data.photo_url ?? null);
      });
  }, [session]);

  if (!session) return <Redirect href="/login" />;

  const validate = () => {
    const next: Errors = {};
    const parsedAge = dateOfBirth ? ageFromDate(dateOfBirth) : age ? Number(age) : null;
    if (fullName.trim().length < 2) next.fullName = 'Enter the older adult’s full name.';
    if ((!dateOfBirth && !age) || parsedAge === null || !Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 125) {
      next.birth = 'Enter a valid date of birth or age.';
    }
    if (!gender) next.gender = 'Select a gender.';
    if (!Number.isFinite(Number(weight)) || Number(weight) < 1 || Number(weight) > 500) next.weight = 'Enter a weight between 1 and 500 kg.';
    if (!Number.isFinite(Number(height)) || Number(height) < 30 || Number(height) > 250) next.height = 'Enter a height between 30 and 250 cm.';
    if (!bloodType) next.bloodType = 'Select a blood type.';
    if (emergencyName.trim().length < 2) next.emergencyName = 'Enter an emergency contact name.';
    if (emergencyPhone.replace(/\D/g, '').length < 7) next.emergencyPhone = 'Enter a valid emergency phone number.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let photoUrl = remotePhoto;
      if (photo) photoUrl = await uploadProfilePhoto(session.user.id, 'elderly', photo);
      const computedAge = dateOfBirth ? ageFromDate(dateOfBirth) : Number(age);
      const now = new Date().toISOString();
      const profile = {
        caregiver_id: session.user.id,
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth || null,
        age: computedAge,
        gender,
        weight_kg: Number(weight),
        height_cm: Number(height),
        blood_type: bloodType,
        medical_conditions: conditions.trim() || null,
        medications: medications.trim() || null,
        emergency_contact: emergencyName.trim(),
        emergency_contact_phone: emergencyPhone.trim(),
        photo_url: photoUrl,
        updated_at: now,
      };

      const result = elderlyId
        ? await supabase.from('elderly_profiles').update(profile).eq('elderly_id', elderlyId).eq('caregiver_id', session.user.id)
        : await supabase.from('elderly_profiles').insert(profile);
      if (result.error) throw new Error(`Older adult profile save failed: ${result.error.message}`);

      const { error: progressError } = await supabase.from('onboarding_progress').upsert({
        user_id: session.user.id,
        elderly_completed_at: now,
        updated_at: now,
      }, { onConflict: 'user_id' });
      if (progressError) throw new Error(`Onboarding progress save failed: ${progressError.message}`);
      await refreshOnboarding();

      if (mode === 'edit') router.back();
      else router.replace('/setup/fitness');
    } catch (error) {
      Alert.alert('Unable to save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SetupScaffold step={2} title="Who are you caring for?" subtitle="These details help interpret health readings and prepare emergency information.">
      <ProfilePhotoPicker value={photo} remoteUrl={remotePhoto} onChange={setPhoto} label="Older adult photo" />

      <View style={[styles.section, { backgroundColor: theme.cardElevated }]}>
        <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>BASIC INFORMATION</Text>
        <FormField label="Full name" required value={fullName} onChangeText={setFullName} error={errors.fullName} icon="person-outline" autoCapitalize="words" />
        <Text style={[styles.fieldLabel, { color: theme.text }]}>Date of birth</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose date of birth" onPress={() => setBirthPickerOpen(true)} style={[styles.birthButton, { backgroundColor: theme.card, borderColor: errors.birth ? palette.error : theme.border }]}><Ionicons name="calendar-outline" size={20} color={palette.primaryDark} /><Text style={[styles.birthValue, { color: dateOfBirth ? theme.text : theme.subtitle }]}>{dateOfBirth ? birthPickerDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Select date'}</Text><Ionicons name="chevron-down" size={17} color={theme.subtitle} /></Pressable>
        {errors.birth ? <Text style={styles.error}>{errors.birth}</Text> : null}
        {dateOfBirth ? <View style={styles.birthAgeRow}><Text style={[styles.birthAgeText, { color: theme.subtitle }]}>{ageFromDate(dateOfBirth)} years old</Text><Pressable accessibilityRole="button" onPress={() => setDateOfBirth('')}><Text style={styles.useAgeText}>Use age instead</Text></Pressable></View> : <><Text style={[styles.or, { color: theme.subtitle }]}>OR</Text><FormField label="Age" value={age} onChangeText={setAge} error={errors.birth} icon="hourglass-outline" keyboardType="number-pad" placeholder="Age in years" maxLength={3} /></>}
        <ChoiceChips label="Gender" options={['Male', 'Female', 'Other']} value={gender} onChange={setGender} error={errors.gender} />
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardElevated }]}>
        <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>PHYSICAL DETAILS</Text>
        <View style={styles.twoColumns}>
          <View style={styles.column}><FormField label="Weight (kg)" required value={weight} onChangeText={setWeight} error={errors.weight} keyboardType="decimal-pad" placeholder="65" /></View>
          <View style={styles.column}><FormField label="Height (cm)" required value={height} onChangeText={setHeight} error={errors.height} keyboardType="decimal-pad" placeholder="165" /></View>
        </View>
        <Text style={[styles.fieldLabel, { color: theme.text }]}>Blood type <Text style={{ color: palette.error }}>*</Text></Text>
        <View style={styles.bloodGrid}>
          {BLOOD_TYPES.map((type) => {
            const selected = bloodType === type;
            return (
              <Pressable key={type} onPress={() => setBloodType(type)} style={[styles.bloodButton, { backgroundColor: theme.card, borderColor: selected ? palette.error : theme.border }, selected && styles.bloodSelected]}>
                <Text style={[styles.bloodText, { color: selected ? '#FFFFFF' : theme.text }]}>{type}</Text>
              </Pressable>
            );
          })}
        </View>
        {errors.bloodType ? <Text style={styles.error}>{errors.bloodType}</Text> : null}
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardElevated }]}>
        <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>MEDICAL & EMERGENCY</Text>
        <FormField label="Medical conditions" value={conditions} onChangeText={setConditions} placeholder="e.g. Hypertension, Type 2 diabetes" multiline style={styles.multiline} />
        <FormField label="Current medications" value={medications} onChangeText={setMedications} placeholder="e.g. Losartan 50 mg daily" multiline style={styles.multiline} />
        <FormField label="Emergency contact name" required value={emergencyName} onChangeText={setEmergencyName} error={errors.emergencyName} icon="person-add-outline" autoCapitalize="words" />
        <FormField label="Emergency contact phone" required value={emergencyPhone} onChangeText={setEmergencyPhone} error={errors.emergencyPhone} icon="call-outline" keyboardType="phone-pad" />
      </View>
      <GradientButton label={mode === 'edit' ? 'Save changes' : 'Save profile'} onPress={() => void save()} loading={saving} colors={[palette.accentDark, palette.accentDark]} />
      <PickerModal visible={birthPickerOpen} mode="date" title="Date of birth" minDate={new Date(new Date().getFullYear() - 125, new Date().getMonth(), new Date().getDate())} maxDate={new Date()} value={birthPickerDate} onChange={(next) => { setDateOfBirth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`); setAge(''); }} onClose={() => setBirthPickerOpen(false)} />
    </SetupScaffold>
  );
}

const styles = StyleSheet.create({
  section: { padding: 18, borderRadius: 14, marginBottom: 16 },
  sectionTitle: { marginBottom: 16, ...typeScale.eyebrow },
  or: { marginTop: -8, marginBottom: 8, textAlign: 'center', ...typeScale.eyebrow },
  twoColumns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  fieldLabel: { marginBottom: 9, fontSize: 13, fontFamily: fontFamily.bold },
  birthButton: { minHeight: 50, marginBottom: 13, paddingHorizontal: 13, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  birthValue: { flex: 1, fontFamily: fontFamily.medium, fontSize: 14 },
  birthAgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  birthAgeText: { fontSize: 12, fontFamily: fontFamily.medium },
  useAgeText: { color: palette.primaryDark, fontSize: 12, fontFamily: fontFamily.semiBold },
  bloodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bloodButton: { width: '23%', minHeight: 44, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bloodSelected: { backgroundColor: palette.error },
  bloodText: { fontSize: 14, fontFamily: fontFamily.bold },
  multiline: { minHeight: 76, textAlignVertical: 'top' },
  error: { marginTop: 6, color: palette.error, fontSize: 12, fontFamily: fontFamily.medium },
});
