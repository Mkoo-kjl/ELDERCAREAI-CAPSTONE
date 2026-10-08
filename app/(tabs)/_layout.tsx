import { Redirect, Tabs } from 'expo-router';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';

import { getPostAuthRoute } from '@/src/lib/onboarding-route';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthDataProvider } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily } from '@/src/theme/typography';

const tabIcons = {
  dashboard: require('@/assets/nav-icons/home.png'),
  health: require('@/assets/nav-icons/health.png'),
  alerts: require('@/assets/nav-icons/alerts.png'),
  care: require('@/assets/nav-icons/care.png'),
  profile: require('@/assets/nav-icons/profile.png'),
} as const;

export default function TabLayout() {
  const theme = getTheme(useColorScheme() === 'dark');
  const { session, onboarding, isLoading, isOnboardingLoading } = useAuth();
  if (!isLoading && !session) return <Redirect href="/login" />;
  if (!isLoading && !isOnboardingLoading && !onboarding?.completed_at) return <Redirect href={getPostAuthRoute(onboarding)} />;

  return (
    <HealthDataProvider>
      <Tabs screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.primaryDark,
        tabBarInactiveTintColor: theme.subtitle,
        tabBarStyle: { backgroundColor: theme.cardElevated, borderTopColor: theme.border, height: 72, paddingTop: 4, paddingBottom: 7 },
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 10 },
        tabBarIcon: ({ color, size }) => {
          const icon = tabIcons[route.name as keyof typeof tabIcons];
          return icon ? <Image source={icon} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" /> : null;
        },
      })}>
        <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
        <Tabs.Screen name="health" options={{ title: 'Health' }} />
        <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
        <Tabs.Screen name="chatbot" options={{
          title: 'Elle',
          tabBarAccessibilityLabel: 'Elle AI Chat',
          tabBarActiveTintColor: palette.primaryDark,
          tabBarLabelStyle: { fontFamily: fontFamily.bold, fontSize: 11 },
          tabBarIcon: ({ focused }) => (
            <View style={[styles.elleIcon, focused && styles.elleIconFocused]}>
              <Image
                source={require('@/assets/images/elle-happy.png')}
                style={styles.elleImage}
                resizeMode="cover"
              />
            </View>
          ),
        }} />
        <Tabs.Screen name="care" options={{ title: 'Care' }} />
        <Tabs.Screen name="profile" options={{ title: 'Settings' }} />
      </Tabs>
    </HealthDataProvider>
  );
}

const styles = StyleSheet.create({
  elleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: palette.accent,
    backgroundColor: palette.aquaSurface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  elleIconFocused: { borderColor: palette.primaryDark, backgroundColor: palette.mintSurface },
  elleImage: { width: 36, height: 36, borderRadius: 18 },
});
