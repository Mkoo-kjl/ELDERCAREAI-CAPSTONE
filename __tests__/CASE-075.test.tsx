import { waitFor } from '@testing-library/react-native';
import { from, healthPdf, patient, prepareReportCase, pressReport } from '../test-support/profile-report-case-harness';

test('CASE-075 synchronized readings are scoped and passed to the health PDF exporter', async () => {
  const history = [{ id: 'log-1', recorded_at: '2026-10-20T08:00:00Z', heart_rate_bpm: 72 }];
  const query = prepareReportCase({ data: history });
  await pressReport('Health vitals PDF');
  await waitFor(() => expect(healthPdf).toHaveBeenCalledWith({ patient, caregiverName: 'Caregiver', history }));
  expect(from).toHaveBeenCalledWith('vital_sign_logs');
  expect(query.eq).toHaveBeenCalledWith('elderly_id', 'patient-1');
  expect(query.order).toHaveBeenCalledWith('recorded_at', { ascending: false });
  expect(query.limit).toHaveBeenCalledWith(1000);
});
