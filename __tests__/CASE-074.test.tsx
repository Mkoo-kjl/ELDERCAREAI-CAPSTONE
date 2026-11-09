import { expectAlert, healthPdf, prepareReportCase, pressReport } from '../test-support/profile-report-case-harness';

test('CASE-074 empty synchronized history cannot produce a health report', async () => {
  const query = prepareReportCase({ data: [] });
  await pressReport('Health vitals PDF');
  await expectAlert('Nothing to export', 'Start monitoring on Galaxy Watch to record measurements first.');
  expect(query.eq).toHaveBeenCalledWith('elderly_id', 'patient-1');
  expect(healthPdf).not.toHaveBeenCalled();
});
