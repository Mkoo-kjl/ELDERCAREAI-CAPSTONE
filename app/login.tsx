import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/src/components/AppText';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { getPostAuthRoute } from '@/src/lib/onboarding-route';
import { useAuth } from '@/src/providers/AuthProvider';
import { palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { session, onboarding, isLoading, isOnboardingLoading, isSigningIn, authError, signInWithGoogle, clearAuthError } = useAuth();

  if (!isLoading && !isOnboardingLoading && session) return <Redirect href={getPostAuthRoute(onboarding)} />;

  const handleGoogleSignIn = async () => {
    clearAuthError();
    const completed = await signInWithGoogle();
    if (completed) router.replace('/');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Image
        accessible={false}
        source={width >= 700
          ? require('@/assets/images/login-caregiver-desktop.png')
          : require('@/assets/images/login-caregiver-mobile.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(9, 30, 27, 0)', 'rgba(9, 30, 27, 0)', 'rgba(9, 30, 27, 0.83)', 'rgba(7, 23, 22, 0.98)']}
        locations={[0, 0.38, 0.7, 1]}
        style={styles.gradient}
      />

      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.content,
          {
            minHeight: height,
            paddingTop: insets.top + 18,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.brand}>
          <Image
            source={require('@/assets/images/eldercare-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>ElderCare<Text style={styles.brandAccent}>AI</Text></Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.bottomContent}>
          <Text style={styles.eyebrow}>FOR THOSE WHO CARE</Text>
          <Text style={styles.headline}>Care, closer together.</Text>
          <Text style={styles.description}>
            Stay connected to the person you care for, with health updates and a care plan in one place.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
            disabled={isSigningIn}
            onPress={handleGoogleSignIn}
            style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed, isSigningIn && styles.buttonDisabled]}
          >
            {isSigningIn ? (
              <ActivityIndicator color={palette.primaryDark} />
            ) : (
              <>
                <Image source={require('@/assets/images/google-logo.png')} style={styles.googleLogo} resizeMode="contain" />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
                <Ionicons name="arrow-forward" size={20} color={palette.primaryDark} />
              </>
            )}
          </Pressable>

          <Text style={styles.accountHint}>Use the Google account connected to Google Health.</Text>

          {!isSupabaseConfigured && !authError ? (
            <View style={styles.message}>
              <Ionicons name="information-circle" size={18} color={palette.warning} />
              <Text style={styles.messageText}>Supabase setup is still needed. See README.md before signing in.</Text>
            </View>
          ) : null}

          {authError ? (
            <View style={styles.message}>
              <Ionicons name="alert-circle" size={18} color={palette.error} />
              <Text style={styles.messageText}>{authError}</Text>
            </View>
          ) : null}

          <Text style={styles.legal}>By continuing, you agree to our Terms of Service and Privacy Policy.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#DCE8E1' },
  backgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  gradient: { ...StyleSheet.absoluteFillObject },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  logo: { width: 45, height: 45 },
  brandName: { color: '#122D27', fontFamily: fontFamily.extraBold, fontSize: 21, lineHeight: 29 },
  brandAccent: { color: palette.primaryDark },
  spacer: { flexGrow: 1, minHeight: 180 },
  bottomContent: { width: '100%', maxWidth: 520, alignSelf: 'flex-start' },
  eyebrow: { color: '#C7E7D4', ...typeScale.eyebrow, letterSpacing: 1.5, marginBottom: 9 },
  headline: { color: '#FFFFFF', ...typeScale.display, marginBottom: 10 },
  description: { color: '#EDF5F1', ...typeScale.body, maxWidth: 440, marginBottom: 26 },
  googleButton: {
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 19,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.7 },
  googleLogo: { width: 24, height: 24 },
  googleButtonText: { color: '#122D27', ...typeScale.button, flex: 1, textAlign: 'center' },
  accountHint: { color: '#DDEBE3', ...typeScale.caption, marginTop: 14, textAlign: 'center' },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.93)',
  },
  messageText: { flex: 1, color: '#293C35', fontSize: 12, lineHeight: 18, fontFamily: fontFamily.medium },
  legal: {
    color: '#BDD0C5',
    ...typeScale.caption,
    textAlign: 'center',
    marginTop: 28,
  },
});
