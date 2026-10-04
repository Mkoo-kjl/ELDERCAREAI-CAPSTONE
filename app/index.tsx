import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/src/providers/AuthProvider';
import { getPostAuthRoute } from '@/src/lib/onboarding-route';
import { palette } from '@/src/theme/colors';
import { fontFamily } from '@/src/theme/typography';

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      colors={[palette.background, '#FFFFFF', palette.background]}
      locations={[0, 0.58, 1]}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.content}>
        <Animated.View
          style={[styles.logoStage, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        >
          <Image
            source={require('@/assets/images/eldercare-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={[styles.copy, { opacity: textOpacity }]}>
          <Text style={styles.title}>ElderCare<Text style={styles.titleAccent}>AI</Text></Text>
          <PulsingDots />
        </Animated.View>
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
  logoStage: { alignItems: 'center', justifyContent: 'center' },
  logo: { width: 180, height: 180 },
  copy: { alignItems: 'center', marginTop: 24 },
  title: { color: palette.text, fontSize: 32, lineHeight: 39, fontFamily: fontFamily.semiBold },
  titleAccent: { color: palette.primaryDark },
  dots: { height: 18, marginTop: 36, flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
