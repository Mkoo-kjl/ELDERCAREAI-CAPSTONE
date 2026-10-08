import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { router, Stack, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/src/providers/AuthProvider';
import { ThemePreferenceProvider } from '@/src/providers/ThemePreferenceProvider';
import { initializeNotifications } from '@/src/lib/notifications';
import { appFontAssets } from '@/src/theme/typography';

function NotificationObserver() {
  useEffect(() => {
    void initializeNotifications();
    const openNotification = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string' && (url.startsWith('/care') || url.startsWith('/alerts'))) router.push(url as Href);
    };
    const previous = Notifications.getLastNotificationResponse();
    if (previous?.notification) {
      openNotification(previous.notification);
      Notifications.clearLastNotificationResponse();
    }
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => openNotification(response.notification));
    return () => subscription.remove();
  }, []);
  return null;
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
        <NotificationObserver />
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
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthProvider>
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}

export const unstable_settings = {
  initialRouteName: 'index',
};
