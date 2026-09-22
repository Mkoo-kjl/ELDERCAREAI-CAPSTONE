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
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isSupabaseConfigured } from '@/src/lib/supabase';
import { getPostAuthRoute } from '@/src/lib/onboarding-route';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme, palette } from '@/src/theme/colors';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);
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
      colors={isDark ? ['#0F172A', '#162544', '#0F172A'] : ['#FFFFFF', '#EBF4FF', '#E0EFFF']}
      locations={[0, 0.6, 1]}
      style={[styles.container, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]}
    >
      <Animated.View style={[styles.content, { opacity, transform: [{ translateY: rise }] }]}>
        <View style={styles.brandBlock}>
          <View style={[styles.logoCard, { backgroundColor: isDark ? theme.card : '#FFFFFF' }]}>
            <Image
              source={require('@/assets/images/eldercare-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>ElderCare<Text style={{ color: palette.primary }}>AI</Text></Text>
          <Text style={[styles.subtitle, { color: theme.subtitle }]}>Smart care for your loved ones</Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardElevated,
              borderColor: theme.border,
              shadowColor: isDark ? '#000000' : '#94A3B8',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.shieldIcon}>
              <Ionicons name="shield-checkmark" size={20} color={palette.accent} />
            </View>
            <View style={styles.cardHeaderCopy}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Secure caregiver access</Text>
              <Text style={[styles.cardSubtitle, { color: theme.subtitle }]}>Sign in with the Google account connected to your Google Health app to sync vitals.</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
            disabled={isSigningIn}
            onPress={handleGoogleSignIn}
            style={({ pressed }) => [styles.buttonWrap, pressed && styles.buttonPressed]}
          >
            <LinearGradient
              colors={[palette.google, palette.googleDark]}
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

          <View style={styles.securityLine}>
            <Ionicons name="lock-closed" size={13} color={theme.subtitle} />
            <Text style={[styles.securityText, { color: theme.subtitle }]}>Protected by Google and Supabase authentication</Text>
          </View>
        </View>
      </Animated.View>

      <Text style={[styles.legal, { color: theme.subtitle }]}>By continuing, you agree to our Terms of Service and Privacy Policy.</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 22 },
  content: { flex: 1, justifyContent: 'center' },
  brandBlock: { alignItems: 'center', marginBottom: 30 },
  logoCard: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 6,
  },
  logo: { width: 112, height: 112 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  subtitle: { maxWidth: 340, marginTop: 10, fontSize: 15, lineHeight: 22, fontWeight: '400', textAlign: 'center' },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  shieldIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#E9FBEA', alignItems: 'center', justifyContent: 'center' },
  cardHeaderCopy: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { marginTop: 3, fontSize: 13, fontWeight: '400' },
  buttonWrap: { borderRadius: 14 },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  googleButton: {
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  googleIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  googleButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: 11, borderRadius: 12 },
  messageText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  securityLine: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 },
  securityText: { fontSize: 11, fontWeight: '500' },
  legal: { alignSelf: 'center', maxWidth: 330, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 10 },
});
