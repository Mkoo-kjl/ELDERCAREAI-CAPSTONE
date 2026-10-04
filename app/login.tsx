import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isSupabaseConfigured } from '@/src/lib/supabase';
import { getPostAuthRoute } from '@/src/lib/onboarding-route';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = getTheme(false);
  const { session, onboarding, isLoading, isOnboardingLoading, isSigningIn, authError, signInWithGoogle, clearAuthError } = useAuth();
  const rise = useRef(new Animated.Value(18)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rise, { toValue: 0, duration: 520, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]).start();
  }, [opacity, rise]);

  if (!isLoading && !isOnboardingLoading && session) return <Redirect href={getPostAuthRoute(onboarding)} />;

  const handleGoogleSignIn = async () => {
    clearAuthError();
    const completed = await signInWithGoogle();
    if (completed) router.replace('/');
  };

  return (
    <LinearGradient
      colors={[palette.background, '#FFFFFF', palette.aquaSurface]}
      locations={[0, 0.52, 1]}
      style={[styles.container, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]}
    >
      <Animated.View style={[styles.content, { opacity, transform: [{ translateY: rise }] }]}>
        <View style={styles.brandBlock}>
          <Image
            source={require('@/assets/images/eldercare-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: theme.text }]}>ElderCare<Text style={{ color: palette.primaryDark }}>AI</Text></Text>
          <Text style={[styles.subtitle, { color: theme.subtitle }]}>Care updates for the people who look after them</Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardElevated,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Caregiver sign in</Text>
            <Text style={[styles.cardSubtitle, { color: theme.subtitle }]}>Use the Google account connected to Google Health to sync vitals and care reminders.</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
            disabled={isSigningIn}
            onPress={handleGoogleSignIn}
            style={({ pressed }) => [styles.buttonWrap, pressed && styles.buttonPressed]}
          >
            <LinearGradient
              colors={[palette.primaryDark, palette.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.googleButton}
            >
              {isSigningIn ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <View style={styles.googleIcon}>
                    <Ionicons name="logo-google" size={19} color={palette.google} />
                  </View>
                  <Text style={styles.googleButtonText}>Sign in with Google</Text>
                  <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
                </>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.cueRow}>
            <CareCue icon="pulse" label="Vitals sync" />
            <CareCue icon="calendar" label="Care schedule" />
          </View>

          {!isSupabaseConfigured && !authError ? (
            <View style={[styles.message, { backgroundColor: `${palette.warning}16` }]}>
              <Ionicons name="information-circle" size={18} color={palette.warning} />
              <Text style={[styles.messageText, { color: theme.text }]}>Supabase setup is still needed. See README.md before signing in.</Text>
            </View>
          ) : null}

          {authError ? (
            <View style={[styles.message, { backgroundColor: `${palette.error}12` }]}>
              <Ionicons name="alert-circle" size={18} color={palette.error} />
              <Text style={[styles.messageText, { color: palette.error }]}>{authError}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>

      <Text style={[styles.legal, { color: theme.subtitle }]}>By continuing, you agree to our Terms of Service and Privacy Policy.</Text>
    </LinearGradient>
  );
}

function CareCue({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.cue}>
      <Ionicons name={icon} size={15} color={palette.primaryDark} />
      <Text style={styles.cueText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 22 },
  content: { flex: 1, justifyContent: 'center' },
  brandBlock: { alignItems: 'center', marginBottom: 26 },
  logo: { width: 112, height: 112, marginBottom: 14 },
  title: { ...typeScale.screenTitle, textAlign: 'center' },
  subtitle: { maxWidth: 330, marginTop: 8, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 18,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardHeader: { marginBottom: 16 },
  cardTitle: { ...typeScale.sectionTitle, textAlign: 'center' },
  cardSubtitle: { alignSelf: 'center', maxWidth: 300, marginTop: 7, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  buttonWrap: { borderRadius: 8 },
  buttonPressed: { opacity: 0.86 },
  googleButton: {
    height: 52,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  googleIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  googleButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: fontFamily.semiBold },
  cueRow: { marginTop: 15, flexDirection: 'row', gap: 9 },
  cue: { flex: 1, minHeight: 40, borderRadius: 8, backgroundColor: palette.aquaSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cueText: { color: palette.primaryDark, fontSize: 11, fontFamily: fontFamily.medium },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: 11, borderRadius: 12 },
  messageText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  legal: { alignSelf: 'center', maxWidth: 330, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 10 },
});
