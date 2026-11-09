import { waitFor } from '@testing-library/react-native';
import { from, medicationPdf, patient, prepareReportCase, pressReport } from '../test-support/profile-report-case-harness';

test('CASE-077 saved medication schedule is scoped and passed to the PDF exporter', async () => {
  const medications = [{ medication_name: 'Aspirin', dosage: '81 mg', frequency: 'daily', is_active: true }];
  const query = prepareReportCase({ data: medications });
  await pressReport('Medication schedule PDF');
  await waitFor(() => expect(medicationPdf).toHaveBeenCalledWith({ patient, caregiverName: 'Caregiver', medications }));
  expect(from).toHaveBeenCalledWith('medication_schedules');
  expect(query.eq).toHaveBeenCalledWith('caregiver_id', 'caregiver-1');
  expect(query.eq).toHaveBeenCalledWith('elderly_id', 'patient-1');
  expect(query.order).toHaveBeenNthCalledWith(1, 'is_active', { ascending: false });
  expect(query.order).toHaveBeenNthCalledWith(2, 'medication_name');
});
