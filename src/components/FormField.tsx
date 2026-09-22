import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, useColorScheme, View } from 'react-native';

import { getTheme, palette } from '@/src/theme/colors';

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  required?: boolean;
};

export function FormField({ label, error, icon, required, editable = true, style, ...props }: FormFieldProps) {
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);

  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: theme.text }]}>
        {label}{required ? <Text style={{ color: palette.error }}> *</Text> : null}
      </Text>
      <View style={[
        styles.inputWrap,
        { backgroundColor: editable ? theme.cardElevated : theme.card, borderColor: error ? palette.error : theme.border },
      ]}>
        {icon ? <Ionicons name={icon} size={18} color={theme.subtitle} /> : null}
        <TextInput
          {...props}
          editable={editable}
          placeholderTextColor={theme.subtitle}
          style={[styles.input, { color: theme.text }, style]}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: { marginBottom: 7, fontSize: 13, fontWeight: '700' },
  inputWrap: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minHeight: 50, paddingVertical: 12, fontSize: 15, fontWeight: '500' },
  error: { marginTop: 5, color: palette.error, fontSize: 12, fontWeight: '500' },
});
