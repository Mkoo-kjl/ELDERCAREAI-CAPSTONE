import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/src/providers/AuthProvider';
import { getPostAuthRoute } from '@/src/lib/onboarding-route';
import { getTheme, palette } from '@/src/theme/colors';

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);
  const { session, onboarding, isLoading, isOnboardingLoading } = useAuth();
  const logoScale = useRef(new Animated.Value(0.78)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          damping: 13,
          stiffness: 110,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoOpacity, logoScale, textOpacity]);

  useEffect(() => {
    if (isLoading || (session && isOnboardingLoading)) return;
    const timer = setTimeout(() => {
      router.replace(session ? getPostAuthRoute(onboarding) : '/login');
    }, 2500);
    return () => clearTimeout(timer);
  }, [isLoading, isOnboardingLoading, onboarding, router, session]);

  return (
    <LinearGradient
      colors={isDark ? ['#0F172A', '#162544', '#0F172A'] : ['#FFFFFF', '#FFFFFF', '#FFFFFF']}
      locations={[0, 0.55, 1]}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.content}>
        <Animated.View
          style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}
        >
          <View style={[styles.logoHalo, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <Image
              source={require('@/assets/images/eldercare-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <Animated.View style={[styles.copy, { opacity: textOpacity }]}>
          <Text style={[styles.title, { color: theme.text }]}>ElderCareAI</Text>
          <Text style={[styles.subtitle, { color: theme.subtitle }]}>Care that stays connected</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <PulsingDots />
        <Text style={[styles.footerText, { color: theme.subtitle }]}>HEALTH • SAFETY • PEACE OF MIND</Text>
      </View>
    </LinearGradient>
  );
}

function PulsingDots() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.dots}>
      {[palette.primary, palette.accent, palette.primary].map((color, index) => (
        <Animated.View
          key={`${color}-${index}`}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              opacity: pulse.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: index === 1 ? [0.35, 1, 0.35] : [1, 0.35, 1],
              }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: index === 1 ? [0.78, 1.12] : [1.12, 0.78] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logoHalo: {
    width: 220,
    height: 220,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 8,
  },
  logo: { width: 184, height: 184 },
  copy: { alignItems: 'center', marginTop: 32 },
  title: { fontSize: 38, lineHeight: 44, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 8, fontSize: 15, fontWeight: '500', letterSpacing: 0.2 },
  footer: { alignItems: 'center', paddingHorizontal: 40, paddingBottom: 28 },
  dots: { height: 18, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  footerText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.45 },
});
