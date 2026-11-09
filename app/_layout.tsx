import {CareScheduleObserver} from '@/src/components/CareScheduleObserver';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/src/providers/AuthProvider';
import { HealthDataProvider } from '@/src/providers/HealthDataProvider';
import { ThemePreferenceProvider } from '@/src/providers/ThemePreferenceProvider';
import {CareNotificationObserver} from '@/src/components/CareNotificationObserver';
import { appFontAssets } from '@/src/theme/typography';
import { WatchCareObserver } from '@/src/components/WatchCareObserver';
import { SamsungHealthProvider } from '@/src/providers/SamsungHealthProvider';

function AppNavigator({ isDark }: { isDark: boolean }) {
  const { session } = useAuth();
  return (
    <HealthDataProvider key={session?.user.id ?? 'signed-out'}>
      <SamsungHealthProvider>
      <CareNotificationObserver /><CareScheduleObserver />
      <WatchCareObserver />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="setup/intro" />
        <Stack.Screen name="setup/caregiver" />
        <Stack.Screen name="setup/elderly" />
        <Stack.Screen name="setup/fitness" />
        <Stack.Screen name="setup/location" />
        <Stack.Screen name="home" />
        <Stack.Screen name="location" />
        <Stack.Screen name="alert-response" />
        <Stack.Screen name="vital-evidence" />
        <Stack.Screen name="health-records" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      </SamsungHealthProvider>
    </HealthDataProvider>
  );
}

export default function RootLayout() {
  const isDark = useColorScheme() === 'dark';
  const [fontsLoaded, fontError] = useFonts(appFontAssets);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        <AuthProvider>
          <AppNavigator isDark={isDark} />
        </AuthProvider>
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}

export const unstable_settings = {
  initialRouteName: 'index',
};
