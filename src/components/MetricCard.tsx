import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getTheme } from '@/src/theme/colors';

type Props = { icon: ComponentProps<typeof Ionicons>['name']; title: string; value: string; unit: string; timestamp: string; color: string; fullWidth?: boolean; onPress?: () => void };

export function MetricCard({ icon, title, value, unit, timestamp, color, fullWidth, onPress }: Props) {
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);
  return (
    <Pressable accessibilityRole="button" accessibilityHint="Opens details and recent readings" disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.card, fullWidth ? styles.full : styles.half, { backgroundColor: theme.cardElevated, borderColor: theme.border, shadowColor: isDark ? '#000' : '#94A3B8' }, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={[styles.icon, { backgroundColor: `${color}16` }]}><Ionicons name={icon} size={21} color={color} /></View>
        {onPress ? <Ionicons name="information-circle-outline" size={17} color={theme.subtitle} /> : null}
      </View>
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82} style={[styles.title, { color: theme.subtitle }]}>{title}</Text>
      <View style={styles.valueRow}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={[styles.value, { color: theme.text }]}>{value}</Text><Text numberOfLines={1} style={[styles.unit, { color: theme.subtitle }]}>{unit}</Text></View>
      <Text style={[styles.timestamp, { color: theme.subtitle }]}>{timestamp}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 164, padding: 13, borderWidth: 1, borderRadius: 19, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  half: { flexGrow: 1, flexBasis: 0, minWidth: 0, aspectRatio: 0.94 }, full: { width: '100%', minHeight: 150 }, topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, title: { minHeight: 30, marginTop: 7, fontSize: 12.5, lineHeight: 15, fontWeight: '700' },
  valueRow: { marginTop: 5, flexDirection: 'row', alignItems: 'baseline', gap: 5, minWidth: 0 }, value: { flexShrink: 1, fontSize: 29, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 12, fontWeight: '600' }, timestamp: { marginTop: 5, fontSize: 10.5, fontWeight: '500' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
