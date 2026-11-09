import { Sharing, exportFromSettings, prepareReportWorkflow } from '../test-support/integration/report-workflow-harness';

test('INT-019 patient medication schedule becomes a shareable medication PDF', async () => {
  const medications = [{ medication_name: 'Losartan', dosage: '50 mg', form: 'tablet', frequency: 'Daily', times_of_day: ['08:00'], start_date: '2026-10-01', end_date: null, instructions: 'After breakfast', prescribed_by: 'Dr. Kevin', is_active: true }];
  const { query } = prepareReportWorkflow('medication_schedules', medications);
  const html = await exportFromSettings('Medication schedule PDF');
  expect(query.eq).toHaveBeenCalledWith('caregiver_id', 'caregiver-1');
  expect(query.eq).toHaveBeenCalledWith('elderly_id', 'patient-1');
  expect(html).toContain('Losartan');
  expect(html).toContain('After breakfast');
  expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
});
