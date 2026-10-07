import { medicationDoseStatus, medicationStatusPriority, wasMedicationTakenToday } from '@/src/lib/care-status';

const now = new Date(2026, 9, 7, 12, 0, 0);
const medicine = { id: 'med-1', medication_name: 'Losartan', dosage: '50 mg', frequency: 'Daily', times_of_day: ['17:00'] };

describe('Medication dose status', () => {
  test('CASE-047 yesterday or another medication does not count as taken today', () => {
    const logs = [{ schedule_id: 'med-2', status: 'taken', scheduled_time: now.toISOString() }, { schedule_id: medicine.id, status: 'taken', scheduled_time: new Date(2026, 9, 6, 12).toISOString() }];
    expect(wasMedicationTakenToday(medicine.id, logs, now)).toBe(false);
  });
});
