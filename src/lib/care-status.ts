type MedicationLike = {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string;
  times_of_day: string[] | null;
};

export type MedicationLogLike = {
  schedule_id: string | null;
  status: string | null;
  scheduled_time: string | null;
  taken_at?: string | null;
};

export type MedicationDoseTone = 'taken' | 'due' | 'soon' | 'upcoming' | 'missed' | 'as_needed' | 'unscheduled';

export type MedicationDoseStatus = {
  tone: MedicationDoseTone;
  label: string;
  detail: string;
  summary: string;
  nextMinutes: number | null;
};

export function startOfLocalDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function endOfLocalDay(date = new Date()) {
  const end = startOfLocalDay(date);
  end.setDate(end.getDate() + 1);
  return end;
}

export function formatMedicationClock(value: string | null | undefined) {
  if (!value) return null;
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? 0);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function parseTime(value: string) {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? 0);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { time: value, minutes: hour * 60 + minute };
}

export function wasMedicationTakenToday(scheduleId: string, logs: MedicationLogLike[], now = new Date()) {
  const start = startOfLocalDay(now).getTime();
  const end = endOfLocalDay(now).getTime();
  return logs.some((log) => {
    if (log.schedule_id !== scheduleId || log.status !== 'taken') return false;
    const stamp = log.taken_at ?? log.scheduled_time;
    if (!stamp) return false;
    const time = new Date(stamp).getTime();
    return time >= start && time < end;
  });
}

export function medicationDoseStatus(item: MedicationLike, logs: MedicationLogLike[] = [], now = new Date()): MedicationDoseStatus {
  const medName = item.dosage ? `${item.medication_name} ${item.dosage}` : item.medication_name;
  if (/as needed/i.test(item.frequency)) {
    return {
      tone: 'as_needed',
      label: 'As needed',
      detail: 'No scheduled dose',
      summary: `${medName} is marked as needed.`,
      nextMinutes: null,
    };
  }

  if (wasMedicationTakenToday(item.id, logs, now)) {
    return {
      tone: 'taken',
      label: 'Taken today',
      detail: 'Recorded in care log',
      summary: `${medName} was marked taken today.`,
      nextMinutes: null,
    };
  }

  const parsed = (item.times_of_day ?? [])
    .map(parseTime)
    .filter((time): time is { time: string; minutes: number } => Boolean(time))
    .sort((a, b) => a.minutes - b.minutes);

  if (!parsed.length) {
    return {
      tone: 'unscheduled',
      label: item.frequency,
      detail: 'Reminder time not set',
      summary: `${medName} has no reminder time set.`,
      nextMinutes: null,
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const next = parsed.find((time) => time.minutes >= nowMinutes);
  if (!next) {
    const last = parsed[parsed.length - 1];
    const at = formatMedicationClock(last.time) ?? last.time;
    return {
      tone: 'missed',
      label: 'Due earlier',
      detail: `Scheduled ${at}`,
      summary: `${medName} was scheduled earlier today at ${at}.`,
      nextMinutes: null,
    };
  }

  const minutesUntil = next.minutes - nowMinutes;
  const at = formatMedicationClock(next.time) ?? next.time;
  if (minutesUntil <= 30) {
    return {
      tone: 'due',
      label: 'Due now',
      detail: `Medication at ${at}`,
      summary: `${medName} is due now at ${at}.`,
      nextMinutes: minutesUntil,
    };
  }
  if (minutesUntil <= 180) {
    return {
      tone: 'soon',
      label: 'Due soon',
      detail: `Medication at ${at}`,
      summary: `${medName} is due at ${at}.`,
      nextMinutes: minutesUntil,
    };
  }
  return {
    tone: 'upcoming',
    label: 'Next dose',
    detail: `Medication at ${at}`,
    summary: `${medName} is scheduled at ${at}.`,
    nextMinutes: minutesUntil,
  };
}

export function medicationStatusPriority(status: MedicationDoseStatus) {
  if (status.tone === 'missed') return 0;
  if (status.tone === 'due') return 1;
  if (status.tone === 'soon') return 2;
  if (status.tone === 'upcoming') return 3;
  if (status.tone === 'taken') return 4;
  return 5;
}
