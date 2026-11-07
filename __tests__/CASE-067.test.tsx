import { expectAlert, healthPdf, prepareReportCase, pressReport } from '../test-support/profile-report-case-harness';

test('CASE-067 health query failure is shown and no PDF is exported', async () => {
  prepareReportCase({ error: new Error('History unavailable') });
  await pressReport('Health vitals PDF');
  await expectAlert('Unable to export report', 'History unavailable');
  expect(healthPdf).not.toHaveBeenCalled();
});
