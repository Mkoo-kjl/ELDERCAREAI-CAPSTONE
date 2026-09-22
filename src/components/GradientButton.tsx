import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  colors?: readonly [string, string, ...string[]];
  icon?: ComponentProps<typeof Ionicons>['name'];
};

export function GradientButton({ label, onPress, loading, disabled, colors = ['#38BDF8', '#2DA3DC'], icon }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, (pressed || disabled) && styles.pressed]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : (
          <>
            {icon ? <Ionicons name={icon} size={20} color="#FFFFFF" /> : null}
            <Text style={styles.label}>{label}</Text>
            {!icon ? <Ionicons name="arrow-forward" size={20} color="#FFFFFF" /> : null}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, borderRadius: 14 },
  pressed: { opacity: 0.78 },
  button: { minHeight: 56, borderRadius: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
