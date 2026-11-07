import { expectAlert, medicationPdf, prepareReportCase, pressReport } from '../test-support/profile-report-case-harness';

test('CASE-070 medication query failure is shown and no PDF is exported', async () => {
  prepareReportCase({ error: new Error('Schedule unavailable') });
  await pressReport('Medication schedule PDF');
  await expectAlert('Unable to export report', 'Schedule unavailable');
  expect(medicationPdf).not.toHaveBeenCalled();
});
