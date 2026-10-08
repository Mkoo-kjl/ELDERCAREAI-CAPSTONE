import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/src/components/AppText';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

type Mode = 'date' | 'time' | 'datetime';
type Page = 'calendar' | 'months' | 'years' | 'time';
type Props = {
  visible: boolean;
  value: Date;
  onChange: (value: Date) => void;
  onClose: () => void;
  mode?: Mode;
  title?: string;
  minDate?: Date;
  maxDate?: Date;
};

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export function PickerModal({ visible, value, onChange, onClose, mode = 'datetime', title, minDate, maxDate }: Props) {
  const theme = getTheme(useColorScheme() === 'dark');
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>(mode === 'time' ? 'time' : 'calendar');
  const [viewMonth, setViewMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const [yearStart, setYearStart] = useState(Math.floor(value.getFullYear() / 12) * 12);
  const previousOpenMode = useRef<Mode | null>(null);

  useEffect(() => {
    if (!visible) {
      previousOpenMode.current = null;
      return;
    }
    if (previousOpenMode.current !== mode) {
      setPage(mode === 'time' ? 'time' : 'calendar');
      setViewMonth(new Date(value.getFullYear(), value.getMonth(), 1));
      setYearStart(Math.floor(value.getFullYear() / 12) * 12);
      previousOpenMode.current = mode;
    }
  }, [visible, mode, value]);

  const minDay = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime() : -Infinity;
  const maxDay = maxDate ? new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()).getTime() : Infinity;
  const selectedHour = value.getHours() % 12 || 12;
  const selectedMinute = value.getMinutes();
  const minuteChoices = [...new Set([...Array.from({ length: 12 }, (_, index) => index * 5), selectedMinute])].sort((a, b) => a - b);
  const firstWeekday = (new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const calendarDays: (number | null)[] = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  while (calendarDays.length % 7) calendarDays.push(null);

  const chooseTime = (hour: number, minute: number, pm: boolean) => {
    const next = new Date(value);
    next.setHours((hour % 12) + (pm ? 12 : 0), minute, 0, 0);
    onChange(next);
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={[styles.sheet, { backgroundColor: theme.cardElevated, paddingBottom: Math.max(insets.bottom, 18) }]}>
        <View style={styles.top}>
          <Text style={[styles.title, { color: theme.text }]}>{title ?? (mode === 'time' ? 'Choose time' : mode === 'date' ? 'Choose date' : 'Choose date & time')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Done choosing date and time" onPress={onClose} style={styles.doneButton}><Text style={styles.done}>Done</Text></Pressable>
        </View>
        {mode === 'datetime' ? <View style={[styles.segment, { backgroundColor: theme.card }]}>
          {(['calendar', 'time'] as const).map((item) => <Pressable key={item} accessibilityRole="button" onPress={() => setPage(item)} style={[styles.segmentButton, page === item && { backgroundColor: palette.aquaSurface }]}><Text style={[styles.segmentText, { color: page === item ? palette.primaryDark : theme.subtitle }]}>{item === 'calendar' ? 'Date' : 'Time'}</Text></Pressable>)}
        </View> : null}
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {page === 'calendar' && mode !== 'time' ? <>
            <View style={styles.monthHeader}>
              <Pressable accessibilityLabel="Previous month" onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} style={styles.arrow}><Ionicons name="chevron-back" size={20} color={theme.text} /></Pressable>
              <View style={styles.monthHeading}>
                <Pressable accessibilityRole="button" onPress={() => setPage('months')}><Text style={[styles.monthTitle, { color: theme.text }]}>{months[viewMonth.getMonth()]}</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => { setYearStart(Math.floor(viewMonth.getFullYear() / 12) * 12); setPage('years'); }}><Text style={[styles.monthTitle, { color: palette.primaryDark }]}>{viewMonth.getFullYear()}</Text></Pressable>
              </View>
              <Pressable accessibilityLabel="Next month" onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} style={styles.arrow}><Ionicons name="chevron-forward" size={20} color={theme.text} /></Pressable>
            </View>
            <View style={styles.calendarGrid}>
              {weekdays.map((day) => <Text key={day} style={[styles.weekday, { color: theme.subtitle }]}>{day}</Text>)}
              {calendarDays.map((day, index) => {
                if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />;
                const candidate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
                const disabled = candidate.getTime() < minDay || candidate.getTime() > maxDay;
                const selected = sameDay(candidate, value);
                return <Pressable key={day} accessibilityRole="button" accessibilityLabel={`${months[viewMonth.getMonth()]} ${day}, ${viewMonth.getFullYear()}`} disabled={disabled} onPress={() => onChange(new Date(candidate.getFullYear(), candidate.getMonth(), day, value.getHours(), value.getMinutes()))} style={[styles.dayCell, selected && styles.selectedDay]}><Text style={[styles.dayText, { color: disabled ? theme.border : selected ? '#FFFFFF' : theme.text }]}>{day}</Text></Pressable>;
              })}
            </View>
          </> : null}
          {page === 'months' ? <><Text style={[styles.sectionLabel, { color: theme.subtitle }]}>MONTH</Text><View style={styles.optionGrid}>{months.map((month, index) => <Option key={month} label={month.slice(0, 3)} selected={viewMonth.getMonth() === index} onPress={() => { setViewMonth(new Date(viewMonth.getFullYear(), index, 1)); setPage('calendar'); }} />)}</View></> : null}
          {page === 'years' ? <>
            <View style={styles.yearHeader}><Pressable accessibilityLabel="Previous 12 years" onPress={() => setYearStart(yearStart - 12)} style={styles.arrow}><Ionicons name="chevron-back" size={20} color={theme.text} /></Pressable><Text style={[styles.monthTitle, { color: theme.text }]}>{yearStart} - {yearStart + 11}</Text><Pressable accessibilityLabel="Next 12 years" onPress={() => setYearStart(yearStart + 12)} style={styles.arrow}><Ionicons name="chevron-forward" size={20} color={theme.text} /></Pressable></View>
            <View style={styles.optionGrid}>{Array.from({ length: 12 }, (_, index) => yearStart + index).map((year) => <Option key={year} label={`${year}`} selected={viewMonth.getFullYear() === year} disabled={year < (minDate?.getFullYear() ?? 1) || year > (maxDate?.getFullYear() ?? 9999)} onPress={() => { setViewMonth(new Date(year, viewMonth.getMonth(), 1)); setPage('calendar'); }} />)}</View>
          </> : null}
          {page === 'time' ? <>
            <Text style={[styles.timePreview, { color: theme.text }]}>{value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
            <Text style={[styles.sectionLabel, { color: theme.subtitle }]}>HOUR</Text>
            <View style={styles.optionGrid}>{Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <Option key={hour} label={`${hour}`} selected={selectedHour === hour} onPress={() => chooseTime(hour, selectedMinute, value.getHours() >= 12)} />)}</View>
            <Text style={[styles.sectionLabel, { color: theme.subtitle }]}>MINUTE</Text>
            <View style={styles.optionGrid}>{minuteChoices.map((minute) => <Option key={minute} label={`${minute}`.padStart(2, '0')} selected={selectedMinute === minute} onPress={() => chooseTime(selectedHour, minute, value.getHours() >= 12)} />)}</View>
            <View style={styles.ampm}>{[false, true].map((pm) => <Pressable key={String(pm)} accessibilityRole="button" accessibilityLabel={pm ? 'PM' : 'AM'} onPress={() => chooseTime(selectedHour, selectedMinute, pm)} style={[styles.ampmButton, { backgroundColor: (value.getHours() >= 12) === pm ? palette.aquaSurface : theme.card }]}><Text style={[styles.segmentText, { color: (value.getHours() >= 12) === pm ? palette.primaryDark : theme.subtitle }]}>{pm ? 'PM' : 'AM'}</Text></Pressable>)}</View>
          </> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function Option({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const theme = getTheme(useColorScheme() === 'dark');
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.option, { backgroundColor: selected ? palette.aquaSurface : theme.card, opacity: disabled ? 0.35 : 1 }]}><Text style={[styles.optionText, { color: selected ? palette.primaryDark : theme.text }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  sheet: { maxHeight: '86%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 18 },
  top: { paddingHorizontal: 20, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typeScale.sectionTitle, flexShrink: 1 }, doneButton: { minHeight: 36, justifyContent: 'center', paddingLeft: 15 }, done: { color: palette.primaryDark, fontFamily: fontFamily.semiBold },
  segment: { marginHorizontal: 20, marginBottom: 8, padding: 4, borderRadius: 12, flexDirection: 'row' }, segmentButton: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, segmentText: { fontFamily: fontFamily.semiBold, fontSize: 13 },
  body: { paddingHorizontal: 20, paddingBottom: 14 }, monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 }, monthHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, monthTitle: { fontFamily: fontFamily.bold, fontSize: 17 }, arrow: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.2857%', textAlign: 'center', fontFamily: fontFamily.medium, fontSize: 11, marginBottom: 10 }, dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, selectedDay: { backgroundColor: palette.primaryDark }, dayText: { fontFamily: fontFamily.semiBold, fontSize: 13 },
  sectionLabel: { ...typeScale.eyebrow, marginTop: 8, marginBottom: 10 }, optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { width: '22%', minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, optionText: { fontFamily: fontFamily.semiBold, fontSize: 13 }, yearHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  timePreview: { fontFamily: fontFamily.bold, fontSize: 27, textAlign: 'center', marginVertical: 13 }, ampm: { flexDirection: 'row', gap: 8, marginTop: 17 }, ampmButton: { flex: 1, minHeight: 43, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
