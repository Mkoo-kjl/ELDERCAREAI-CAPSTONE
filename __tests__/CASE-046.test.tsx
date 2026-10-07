import { medicationDoseStatus, medicationStatusPriority, wasMedicationTakenToday } from '@/src/lib/care-status';

const now = new Date(2026, 9, 7, 12, 0, 0);
const medicine = { id: 'med-1', medication_name: 'Losartan', dosage: '50 mg', frequency: 'Daily', times_of_day: ['17:00'] };

describe('Medication dose status', () => {
  test('CASE-046 taken log for today marks the dose taken', () => {
    const logs = [{ schedule_id: medicine.id, status: 'taken', scheduled_time: now.toISOString(), taken_at: now.toISOString() }];
    expect(wasMedicationTakenToday(medicine.id, logs, now)).toBe(true);
    expect(medicationDoseStatus(medicine, logs, now).tone).toBe('taken');
  });
});
