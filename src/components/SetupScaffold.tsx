import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getTheme, palette } from '@/src/theme/colors';

type Props = PropsWithChildren<{
  step: number;
  title: string;
  subtitle: string;
  canGoBack?: boolean;
}>;

export function SetupScaffold({ step, title, subtitle, canGoBack = true, children }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={isDark ? ['#162544', '#0F172A'] : ['#EBF4FF', '#FFFFFF']}
          style={[styles.header, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.navRow}>
            {canGoBack ? (
              <Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
                <Ionicons name="chevron-back" size={22} color={theme.text} />
              </Pressable>
            ) : <View style={styles.backPlaceholder} />}
            <Text style={[styles.stepText, { color: theme.subtitle }]}>STEP {step} OF 4</Text>
            <View style={styles.backPlaceholder} />
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient colors={[palette.primary, palette.accent]} style={[styles.progressFill, { width: `${step * 25}%` }]} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.subtitle }]}>{subtitle}</Text>
        </LinearGradient>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 22, paddingBottom: 20 },
  navRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backPlaceholder: { width: 40 },
  stepText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  progressTrack: { height: 5, marginTop: 10, marginBottom: 22, overflow: 'hidden', borderRadius: 3, backgroundColor: 'rgba(100,116,139,0.16)' },
  progressFill: { height: '100%', borderRadius: 3 },
  title: { fontSize: 27, lineHeight: 34, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { marginTop: 7, maxWidth: 390, fontSize: 14, lineHeight: 21, fontWeight: '400' },
  content: { paddingHorizontal: 22, paddingTop: 22 },
});
