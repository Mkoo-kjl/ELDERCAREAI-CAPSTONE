import { medicationDoseStatus, medicationStatusPriority, wasMedicationTakenToday } from '@/src/lib/care-status';

const now = new Date(2026, 9, 7, 12, 0, 0);
const medicine = { id: 'med-1', medication_name: 'Losartan', dosage: '50 mg', frequency: 'Daily', times_of_day: ['17:00'] };

describe('Medication dose status', () => {
  test('CASE-051 later dose is upcoming', () => {
    expect(medicationDoseStatus(medicine, [], now).tone).toBe('upcoming');
  });
});
