import { expectAlert, healthPdf, prepareReportCase, pressReport } from '../test-support/profile-report-case-harness';

test('CASE-071 PDF generation failure is explained to the caregiver', async () => {
  prepareReportCase({ data: [{ id: 'log-1', recorded_at: '2026-10-20T08:00:00Z' }] });
  healthPdf.mockRejectedValueOnce(new Error('Printer unavailable'));
  await pressReport('Health vitals PDF');
  await expectAlert('Unable to export report', 'Printer unavailable');
  expect(healthPdf).toHaveBeenCalledTimes(1);
});
