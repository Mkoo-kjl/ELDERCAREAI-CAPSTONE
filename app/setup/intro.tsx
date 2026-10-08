import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';

import { AppText as Text } from '@/src/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

type IntroSlide = {
  eyebrow: string;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const slides: IntroSlide[] = [
  {
    eyebrow: 'FITBIT INSPIRE 3',
    title: 'Start with the wearable your care plan depends on.',
    body: 'ElderCareAI is built around synced Fitbit and Google Health readings, so caregivers can review patient patterns without typing them in manually.',
    icon: 'watch-outline',
    color: palette.primaryDark,
  },
  {
    eyebrow: 'SYNCED READINGS',
    title: 'See patient context before you act.',
    body: 'Heart rate, blood oxygen, sleep, steps, skin temperature, and HRV appear only when real readings are synchronized from Google Health.',
    icon: 'pulse-outline',
    color: palette.accentDark,
  },
  {
    eyebrow: 'CAREGIVER WORKFLOW',
    title: 'Keep doctor, medicine, notes, and appointments together.',
    body: 'After setup, Home and Elle can use saved care details to help you find the right next step faster.',
    icon: 'clipboard-outline',
    color: palette.purple,
  },
];

export default function IntroSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);
  const { session, refreshOnboarding } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <Redirect href="/login" />;

  const completeIntro = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const { error: saveError } = await supabase.from('onboarding_progress').upsert({
        user_id: session.user.id,
        intro_completed_at: now,
        updated_at: now,
      }, { onConflict: 'user_id' });
      if (saveError) throw saveError;
      await refreshOnboarding();
      router.replace('/setup/caregiver');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save intro progress. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (page < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (page + 1), animated: true });
      setPage((current) => Math.min(current + 1, slides.length - 1));
      return;
    }
    void completeIntro();
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextPage = Math.round(event.nativeEvent.contentOffset.x / width);
    setPage(Math.max(0, Math.min(nextPage, slides.length - 1)));
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.brand, { color: theme.text }]}>ElderCare<Text style={styles.brandAccent}>AI</Text></Text>
          <Text style={[styles.brandSub, { color: theme.subtitle }]}>Care setup</Text>
        </View>
        <Pressable disabled={saving} onPress={() => void completeIntro()} style={[styles.skip, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
          {saving ? <ActivityIndicator size="small" color={palette.primaryDark} /> : <Text style={[styles.skipText, { color: theme.text }]}>Skip</Text>}
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        bounces={false}
        style={styles.pager}
      >
        {slides.map((slide, index) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            {index === 0 ? <FitbitHero /> : <CareHero slide={slide} index={index} />}
            <View style={styles.copy}>
              <View style={[styles.eyebrowPill, { backgroundColor: `${slide.color}14` }]}>
                <Ionicons name={slide.icon} size={14} color={slide.color} />
                <Text style={[styles.eyebrow, { color: slide.color }]}>{slide.eyebrow}</Text>
              </View>
              <Text style={[styles.title, { color: theme.text }]}>{slide.title}</Text>
              <Text style={[styles.body, { color: theme.subtitle }]}>{slide.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((slide, index) => (
            <View key={slide.title} style={[styles.dot, { backgroundColor: index === page ? palette.primaryDark : theme.border, width: index === page ? 24 : 8 }]} />
          ))}
        </View>
        {error ? <Text selectable style={styles.error}>{error}</Text> : null}
        <Pressable disabled={saving} onPress={goNext} style={({ pressed }) => [styles.primaryButton, { opacity: pressed || saving ? 0.78 : 1 }]}>
          <View style={styles.primaryGradient}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <Text style={styles.primaryText}>{page === slides.length - 1 ? 'Set up caregiver info' : 'Continue'}</Text>
                <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
              </>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function FitbitHero() {
  return (
    <View style={styles.heroWrap}>
      <View style={styles.deviceStage}>
        <Image source={require('@/assets/images/fitbit-inspire-3.jpg')} style={styles.deviceImage} resizeMode="contain" />
      </View>
      <View style={styles.deviceBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.deviceBadgeText}>Ready for Google Health sync</Text>
      </View>
    </View>
  );
}

function CareHero({ slide, index }: { slide: IntroSlide; index: number }) {
  const theme = getTheme(useColorScheme() === 'dark');
  const items = index === 1
    ? [
      ['heart-outline', 'Heart rate'],
      ['water-outline', 'SpO₂'],
      ['moon-outline', 'Sleep'],
      ['leaf-outline', 'HRV'],
    ] as const
    : [
      ['medical-outline', 'Doctor'],
      ['medkit-outline', 'Medication'],
      ['calendar-outline', 'Appointments'],
      ['document-text-outline', 'Notes'],
    ] as const;

  return (
    <View style={styles.heroWrap}>
      <View style={[styles.summaryPanel, { backgroundColor: theme.cardElevated }]}>
        <View style={[styles.panelIcon, { backgroundColor: `${slide.color}16` }]}>
          <Ionicons name={slide.icon} size={29} color={slide.color} />
        </View>
        <View style={styles.panelGrid}>
          {items.map(([icon, label]) => (
            <View key={label} style={[styles.panelItem, { backgroundColor: theme.card }]}>
              <Ionicons name={icon} size={18} color={slide.color} />
              <Text style={[styles.panelText, { color: theme.text }]}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { minHeight: 52, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { ...typeScale.sectionTitle },
  brandAccent: { color: palette.primaryDark },
  brandSub: { marginTop: 2, fontSize: 11, fontFamily: fontFamily.medium },
  skip: { minWidth: 70, minHeight: 38, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 12, fontFamily: fontFamily.medium },
  pager: { flex: 1 },
  slide: { flex: 1, paddingHorizontal: 22, justifyContent: 'center' },
  heroWrap: { minHeight: 320, alignItems: 'center', justifyContent: 'center' },
  deviceStage: { width: 250, height: 250, alignItems: 'center', justifyContent: 'center' },
  deviceImage: { width: 218, height: 218 },
  deviceBadge: { marginTop: -15, minHeight: 37, paddingHorizontal: 13, borderRadius: 14, backgroundColor: palette.mintSurface, flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.accentDark },
  deviceBadgeText: { color: palette.text, fontSize: 11, fontFamily: fontFamily.medium },
  summaryPanel: { width: '100%', maxWidth: 340, borderRadius: 14, padding: 18 },
  panelIcon: { alignSelf: 'center', width: 58, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  panelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  panelItem: { width: '48%', minHeight: 72, borderRadius: 14, padding: 12, justifyContent: 'space-between' },
  panelText: { fontSize: 12, fontFamily: fontFamily.medium },
  copy: { alignItems: 'center', paddingHorizontal: 4 },
  eyebrowPill: { minHeight: 32, paddingHorizontal: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { ...typeScale.eyebrow },
  title: { marginTop: 18, maxWidth: 380, textAlign: 'center', ...typeScale.screenTitle },
  body: { marginTop: 11, maxWidth: 370, textAlign: 'center', ...typeScale.body },
  footer: { paddingHorizontal: 22, gap: 13 },
  dots: { height: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  dot: { height: 8, borderRadius: 4 },
  error: { color: palette.error, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  primaryButton: { borderRadius: 14 },
  primaryGradient: { minHeight: 52, borderRadius: 14, backgroundColor: palette.primaryDark, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryText: { color: '#FFFFFF', ...typeScale.button },
});
