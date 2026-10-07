import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, useColorScheme, View } from 'react-native';

import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily } from '@/src/theme/typography';

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
          accessibilityLabel={props.accessibilityLabel ?? label}
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
  label: { marginBottom: 7, fontSize: 12, fontFamily: fontFamily.medium },
  inputWrap: { minHeight: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minHeight: 48, paddingVertical: 11, fontSize: 14, fontFamily: fontFamily.regular },
  error: { marginTop: 5, color: palette.error, fontSize: 12, fontWeight: '500' },
});
