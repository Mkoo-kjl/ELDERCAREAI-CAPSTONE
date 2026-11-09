import { expectAlert, medicationPdf, prepareReportCase, pressReport } from '../test-support/profile-report-case-harness';

test('CASE-076 empty medication schedule cannot produce a report', async () => {
  const query = prepareReportCase({ data: [] });
  await pressReport('Medication schedule PDF');
  await expectAlert('Nothing to export', 'Add a medication schedule first.');
  expect(query.eq).toHaveBeenCalledWith('caregiver_id', 'caregiver-1');
  expect(query.eq).toHaveBeenCalledWith('elderly_id', 'patient-1');
  expect(medicationPdf).not.toHaveBeenCalled();
});
