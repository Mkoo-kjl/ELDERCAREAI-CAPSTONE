import {WalkthroughTarget} from '@/src/providers/WalkthroughProvider';
import { Redirect, Tabs } from 'expo-router';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import { getPostAuthRoute } from '@/src/lib/onboarding-route';
import { useAuth } from '@/src/providers/AuthProvider';
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
  const insets=useSafeAreaInsets();
  const theme = getTheme(useColorScheme() === 'dark');
  const { session, onboarding, isLoading, isOnboardingLoading } = useAuth();
  if (!isLoading && !session) return <Redirect href="/login" />;
  if (!isLoading && !isOnboardingLoading && !onboarding?.completed_at) return <Redirect href={getPostAuthRoute(onboarding)} />;

  return (
    <Tabs screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'none',
        tabBarActiveTintColor: palette.primaryDark,
        tabBarInactiveTintColor: theme.subtitle,
        tabBarStyle: { backgroundColor: theme.cardElevated, borderTopColor: theme.border, height: 72+insets.bottom, paddingTop: 4, paddingBottom: Math.max(insets.bottom,7) },
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 10 },
        tabBarIcon: ({ color, size, focused }) => {
          const icon = tabIcons[route.name as keyof typeof tabIcons];
          if(!icon)return null;
          const image=<Image source={icon} style={{ width: size, height: size, tintColor: color }} resizeMode="contain"/>;
          return focused?<WalkthroughTarget id={`tab-${route.name}`}>{image}</WalkthroughTarget>:<View>{image}</View>;
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
          tabBarIconStyle: {width:40,height:40},
          tabBarIcon: ({ focused }) => focused?
            <WalkthroughTarget id="tab-chatbot" style={[styles.elleIcon,styles.elleIconFocused]}><Image source={require('@/assets/images/elle-happy.png')} style={styles.elleImage} resizeMode="cover"/></WalkthroughTarget>:
            <View style={styles.elleIcon}><Image source={require('@/assets/images/elle-happy.png')} style={styles.elleImage} resizeMode="cover"/></View>,
        }} />
        <Tabs.Screen name="care" options={{ title: 'Care' }} />
        <Tabs.Screen name="profile" options={{ title: 'Settings' }} />
    </Tabs>
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
