import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getTheme, palette } from '@/src/theme/colors';

type ChoiceChipsProps = {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  accent?: string;
};

export function ChoiceChips({ label, options, value, onChange, error, accent = palette.primary }: ChoiceChipsProps) {
  const theme = getTheme(useColorScheme() === 'dark');
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: theme.text }]}>{label} <Text style={{ color: palette.error }}>*</Text></Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option)}
              style={[
                styles.chip,
                { backgroundColor: theme.cardElevated, borderColor: theme.border },
                selected && { backgroundColor: `${accent}18`, borderColor: accent },
              ]}
            >
              <View style={[styles.radio, { borderColor: selected ? accent : theme.subtitle }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: accent }]} /> : null}
              </View>
              <Text style={[styles.text, { color: selected ? accent : theme.text }]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: { marginBottom: 8, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: { minWidth: 92, minHeight: 44, flex: 1, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: '600' },
  error: { marginTop: 5, color: palette.error, fontSize: 12, fontWeight: '500' },
});
