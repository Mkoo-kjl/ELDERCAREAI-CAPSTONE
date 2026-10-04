import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getTheme } from '@/src/theme/colors';
import { fontFamily } from '@/src/theme/typography';

type Props = { icon: ComponentProps<typeof Ionicons>['name']; title: string; value: string; unit: string; timestamp: string; color: string; surface?: string; fullWidth?: boolean; onPress?: () => void };

export function MetricCard({ icon, title, value, unit, timestamp, color, surface, fullWidth, onPress }: Props) {
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);
  return (
    <Pressable accessibilityRole="button" accessibilityHint="Opens details and recent readings" disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.card, fullWidth ? styles.full : styles.half, { backgroundColor: isDark ? theme.cardElevated : surface ?? theme.cardElevated, borderColor: isDark ? theme.border : 'transparent' }, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <Ionicons name={icon} size={17} color={color} />
        {onPress ? <Ionicons name="chevron-forward" size={15} color={theme.subtitle} /> : null}
      </View>
      <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>{title}</Text>
      <View style={styles.valueRow}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={[styles.value, { color: theme.text }]}>{value}</Text><Text numberOfLines={1} style={[styles.unit, { color: theme.subtitle }]}>{unit}</Text></View>
      <Text numberOfLines={1} style={[styles.timestamp, { color: theme.subtitle }]}>{timestamp}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minWidth: 0, padding: 14, borderWidth: 1, borderRadius: 8, justifyContent: 'space-between' },
  half: { width: '48%', minHeight: 148 }, full: { width: '100%', minHeight: 128 }, topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { minHeight: 32, fontSize: 12, lineHeight: 16, fontFamily: fontFamily.medium },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, minWidth: 0 }, value: { flexShrink: 1, fontSize: 25, lineHeight: 31, fontFamily: fontFamily.semiBold, fontVariant: ['tabular-nums'] },
  unit: { flexShrink: 0, fontSize: 11, fontFamily: fontFamily.medium }, timestamp: { fontSize: 10, fontFamily: fontFamily.regular },
  pressed: { opacity: 0.8 },
});
