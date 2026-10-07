import { medicationDoseStatus, medicationStatusPriority, wasMedicationTakenToday } from '@/src/lib/care-status';

const now = new Date(2026, 9, 7, 12, 0, 0);
const medicine = { id: 'med-1', medication_name: 'Losartan', dosage: '50 mg', frequency: 'Daily', times_of_day: ['17:00'] };

describe('Medication dose status', () => {
  test('CASE-049 dose within thirty minutes is due now', () => {
    const status = medicationDoseStatus({ ...medicine, times_of_day: ['12:20'] }, [], now);
    expect(status.tone).toBe('due');
    expect(status.nextMinutes).toBe(20);
  });
});
