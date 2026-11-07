import { Print, Sharing, exportFromSettings, prepareReportWorkflow } from '../test-support/integration/report-workflow-harness';

test('INT-017 patient-scoped vital history becomes a shareable health PDF', async () => {
  const history = [{ id: 'log-1', elderly_id: 'patient-1', heart_rate_bpm: 82, spo2_percent: 97.5, sleep_hours: 7, steps_count: 3200, skin_temp_celsius: 36.1, hrv_rmssd_ms: 41, overall_status: 'normal', recorded_at: '2026-10-20T08:00:00Z', synced_at: '2026-10-20T08:01:00Z' }];
  const { query } = prepareReportWorkflow('vital_sign_logs', history);
  const html = await exportFromSettings('Health vitals PDF');
  expect(query.eq).toHaveBeenCalledWith('elderly_id', 'patient-1');
  expect(html).toContain('Maria Santos');
  expect(html).toContain('97.5');
  expect(Print.printToFileAsync).toHaveBeenCalledTimes(1);
  expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///mock-report.pdf', expect.objectContaining({ mimeType: 'application/pdf' }));
});
