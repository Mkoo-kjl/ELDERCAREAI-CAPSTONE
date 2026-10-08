import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, useColorScheme, View } from 'react-native';

import { AppText as Text } from '@/src/components/AppText';
import { ChoiceChips } from '@/src/components/ChoiceChips';
import { FormField } from '@/src/components/FormField';
import { GradientButton } from '@/src/components/GradientButton';
import { type LocalPhoto, ProfilePhotoPicker } from '@/src/components/ProfilePhotoPicker';
import { SetupScaffold } from '@/src/components/SetupScaffold';
import { uploadProfilePhoto } from '@/src/lib/profile-photo';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme } from '@/src/theme/colors';
import { typeScale } from '@/src/theme/typography';

type Errors = Partial<Record<'fullName' | 'phone' | 'age' | 'sex', string>>;

export default function CaregiverSetupScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { session, refreshOnboarding } = useAuth();
  const theme = getTheme(useColorScheme() === 'dark');
  const [fullName, setFullName] = useState(session?.user.user_metadata?.full_name ?? session?.user.user_metadata?.name ?? '');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [remotePhoto, setRemotePhoto] = useState<string | null>(session?.user.user_metadata?.avatar_url ?? null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase.from('caregivers').select('full_name, phone, age, sex, photo_url').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setFullName(data.full_name ?? '');
        setPhone(data.phone ?? '');
        setAge(data.age ? String(data.age) : '');
        setSex(data.sex ?? '');
        setRemotePhoto(data.photo_url ?? null);
      });
  }, [session]);

  if (!session) return <Redirect href="/login" />;

  const validate = () => {
    const next: Errors = {};
    const numericAge = Number(age);
    if (fullName.trim().length < 2) next.fullName = 'Enter the caregiver’s full name.';
    if (phone.replace(/\D/g, '').length < 7) next.phone = 'Enter a valid phone number.';
    if (!Number.isInteger(numericAge) || numericAge < 18 || numericAge > 120) next.age = 'Age must be between 18 and 120.';
    if (!sex) next.sex = 'Select a sex or gender.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let photoUrl = remotePhoto;
      if (photo) photoUrl = await uploadProfilePhoto(session.user.id, 'caregiver', photo);

      const now = new Date().toISOString();
      const { error } = await supabase.from('caregivers').upsert({
        id: session.user.id,
        email: session.user.email,
        full_name: fullName.trim(),
        phone: phone.trim(),
        age: Number(age),
        sex,
        photo_url: photoUrl,
        updated_at: now,
      }, { onConflict: 'id' });
      if (error) throw new Error(`Caregiver profile save failed: ${error.message}`);

      const { error: progressError } = await supabase.from('onboarding_progress').upsert({
        user_id: session.user.id,
        caregiver_completed_at: now,
        updated_at: now,
      }, { onConflict: 'user_id' });
      if (progressError) throw new Error(`Onboarding progress save failed: ${progressError.message}`);
      await refreshOnboarding();

      if (mode === 'edit') router.back();
      else router.replace('/setup/elderly');
    } catch (error) {
      Alert.alert('Unable to save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SetupScaffold step={1} title="Tell us about you" subtitle="This helps personalize your caregiver dashboard and emergency actions." canGoBack={mode === 'edit'}>
      <ProfilePhotoPicker value={photo} remoteUrl={remotePhoto} onChange={setPhoto} label="Caregiver photo" />
      <View style={[styles.section, { backgroundColor: theme.cardElevated }]}>
        <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>CAREGIVER INFORMATION</Text>
        <FormField label="Full name" required value={fullName} onChangeText={setFullName} error={errors.fullName} icon="person-outline" autoCapitalize="words" />
        <FormField label="Authenticated email" value={session.user.email ?? ''} editable={false} icon="mail-outline" />
        <FormField label="Phone" required value={phone} onChangeText={setPhone} error={errors.phone} icon="call-outline" keyboardType="phone-pad" placeholder="e.g. +63 917 123 4567" />
        <FormField label="Age" required value={age} onChangeText={setAge} error={errors.age} icon="calendar-outline" keyboardType="number-pad" placeholder="18 or older" maxLength={3} />
        <ChoiceChips label="Sex / gender" options={['Male', 'Female', 'Other']} value={sex} onChange={setSex} error={errors.sex} />
      </View>
      <GradientButton label={mode === 'edit' ? 'Save changes' : 'Next'} onPress={() => void save()} loading={saving} />
    </SetupScaffold>
  );
}

const styles = StyleSheet.create({
  section: { padding: 18, borderRadius: 14, marginBottom: 12 },
  sectionTitle: { marginBottom: 16, ...typeScale.eyebrow },
});
