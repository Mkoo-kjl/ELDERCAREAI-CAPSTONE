import { Alert } from 'react-native';
import { from, healthPdf, prepareReportCase, pressReport } from '../test-support/profile-report-case-harness';

test('CASE-064 health export requires an older adult profile', async () => {
  prepareReportCase({ elderly: null });
  await pressReport('Health vitals PDF');
  expect(Alert.alert).toHaveBeenCalledWith('Nothing to export', 'Complete the older adult profile first.');
  expect(from).not.toHaveBeenCalled();
  expect(healthPdf).not.toHaveBeenCalled();
});
