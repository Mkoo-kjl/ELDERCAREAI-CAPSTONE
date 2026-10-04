import { Modal, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

type Props = {
  visible: boolean;
  value: Date;
  onChange: (value: Date) => void;
  onClose: () => void;
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function PickerModal({ visible, value, onChange, onClose }: Props) {
  const theme = getTheme(useColorScheme() === 'dark');
  const insets = useSafeAreaInsets();
  const update = (part: 'year' | 'month' | 'day' | 'hour' | 'minute', next: number) => {
    const date = new Date(value);
    if (part === 'year') {
      const day = date.getDate();
      date.setDate(1);
      date.setFullYear(next);
      date.setDate(Math.min(day, new Date(next, date.getMonth() + 1, 0).getDate()));
    }
    if (part === 'month') {
      const day = date.getDate();
      date.setDate(1);
      date.setMonth(next);
      date.setDate(Math.min(day, new Date(date.getFullYear(), next + 1, 0).getDate()));
    }
    if (part === 'day') date.setDate(next);
    if (part === 'hour') date.setHours(next);
    if (part === 'minute') date.setMinutes(next);
    onChange(date);
  };
  const days = Array.from({ length: new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate() }, (_, index) => index + 1);
  const years = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() + index);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}><View style={[styles.sheet, { backgroundColor: theme.cardElevated, paddingBottom: Math.max(insets.bottom, 18) }]}>
      <View style={styles.top}><Text style={[styles.title, { color: theme.text }]}>Choose date & time</Text><Pressable onPress={onClose}><Text style={styles.done}>Done</Text></Pressable></View>
      <PickerRow label="Month" values={months.map((label, index) => ({ label, value: index }))} selected={value.getMonth()} onSelect={(next) => update('month', next)} />
      <PickerRow label="Day" values={days.map((item) => ({ label: `${item}`, value: item }))} selected={value.getDate()} onSelect={(next) => update('day', next)} />
      <PickerRow label="Year" values={years.map((item) => ({ label: `${item}`, value: item }))} selected={value.getFullYear()} onSelect={(next) => update('year', next)} />
      <PickerRow label="Hour" values={Array.from({ length: 24 }, (_, item) => ({ label: `${item}`.padStart(2, '0'), value: item }))} selected={value.getHours()} onSelect={(next) => update('hour', next)} />
      <PickerRow label="Minute" values={[0, 15, 30, 45].map((item) => ({ label: `${item}`.padStart(2, '0'), value: item }))} selected={Math.round(value.getMinutes() / 15) * 15 % 60} onSelect={(next) => update('minute', next)} />
    </View></View>
  </Modal>;
}

function PickerRow({ label, values, selected, onSelect }: { label: string; values: { label: string; value: number }[]; selected: number; onSelect: (value: number) => void }) {
  const theme = getTheme(useColorScheme() === 'dark');
  return <View style={styles.row}><Text style={[styles.label, { color: theme.subtitle }]}>{label.toUpperCase()}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>{values.map((item) => <Pressable key={item.value} onPress={() => onSelect(item.value)} style={[styles.option, { backgroundColor: theme.card, borderColor: theme.border }, selected === item.value && styles.selected]}><Text style={[styles.optionText, { color: selected === item.value ? palette.text : theme.text }]}>{item.label}</Text></Pressable>)}</ScrollView></View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }, sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 18 }, top: { paddingHorizontal: 20, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { ...typeScale.sectionTitle }, done: { color: palette.primaryDark, fontFamily: fontFamily.semiBold }, row: { marginTop: 13 }, label: { paddingHorizontal: 20, marginBottom: 7, fontSize: 10, fontFamily: fontFamily.medium }, options: { paddingHorizontal: 18, gap: 7 }, option: { minWidth: 52, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11 }, selected: { backgroundColor: palette.aquaSurface, borderColor: palette.primaryDark }, optionText: { fontSize: 12, fontFamily: fontFamily.medium },
});
