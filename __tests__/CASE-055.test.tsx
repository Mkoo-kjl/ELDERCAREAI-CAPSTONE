import { medicationDoseStatus, medicationStatusPriority, wasMedicationTakenToday } from '@/src/lib/care-status';

const now = new Date(2026, 9, 7, 12, 0, 0);
const medicine = { id: 'med-1', medication_name: 'Losartan', dosage: '50 mg', frequency: 'Daily', times_of_day: ['17:00'] };

describe('Medication dose status', () => {
  test('CASE-055 taken log for today marks the dose taken', () => {
    const due=new Date(now);due.setHours(17,0,0,0);
    const taken=new Date(now);taken.setHours(17,1,0,0);
    const logs = [{ schedule_id: medicine.id, status: 'taken', scheduled_time: due.toISOString(), taken_at: taken.toISOString() }];
    expect(wasMedicationTakenToday(medicine.id, logs, taken)).toBe(true);
    expect(medicationDoseStatus(medicine, logs, taken).tone).toBe('taken');
  });
});
