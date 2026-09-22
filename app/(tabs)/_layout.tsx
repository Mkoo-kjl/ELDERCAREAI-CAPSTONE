import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

import { getPostAuthRoute } from '@/src/lib/onboarding-route';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthDataProvider } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';

const tabIcons = {
  dashboard: ['home-outline', 'home'], health: ['pulse-outline', 'pulse'], alerts: ['alert-circle-outline', 'alert-circle'],
  chatbot: ['sparkles-outline', 'sparkles'], care: ['medkit-outline', 'medkit'], profile: ['person-outline', 'person'],
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
        tabBarStyle: { backgroundColor: theme.cardElevated, borderTopColor: theme.border, height: 66, paddingTop: 5, paddingBottom: 7 },
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 9.5, fontWeight: '700' },
        tabBarIcon: ({ color, focused, size }) => {
          const icons = tabIcons[route.name as keyof typeof tabIcons];
          return <Ionicons name={icons?.[focused ? 1 : 0] ?? 'ellipse-outline'} color={color} size={size} />;
        },
      })}>
        <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
        <Tabs.Screen name="health" options={{ title: 'Health' }} />
        <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
        <Tabs.Screen name="chatbot" options={{ title: 'AI Chat' }} />
        <Tabs.Screen name="care" options={{ title: 'Care' }} />
        <Tabs.Screen name="profile" options={{ title: 'Settings' }} />
      </Tabs>
    </HealthDataProvider>
  );
}
