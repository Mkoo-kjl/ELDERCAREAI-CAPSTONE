import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';

import { AppText as Text } from '@/src/components/AppText';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily } from '@/src/theme/typography';

export default function AuthCallbackScreen() {
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);
  const { session, authError } = useAuth();

  if (session) return <Redirect href="/" />;
  if (authError) return <Redirect href="/login" />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={palette.primary} size="large" />
      <Text style={[styles.text, { color: theme.subtitle }]}>Completing secure sign in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  text: { fontSize: 14, fontFamily: fontFamily.semiBold },
});
