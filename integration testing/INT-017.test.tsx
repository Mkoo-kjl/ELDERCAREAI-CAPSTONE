import { Notifications, change, prepareCareWorkflow, pressLabel, pressText, showCare, waitFor } from '../test-support/integration/care-workflow-harness';

test('INT-017 saving an as-needed medication stores it without a timed reminder', async () => {
  const { writes } = prepareCareWorkflow();
  await showCare();
  await pressLabel('Add Medication');
  await change('Medication name', 'Paracetamol');
  await pressText('As needed');
  await pressText('Save');
  await waitFor(() => expect(writes).toContainEqual(expect.objectContaining({ table: 'medication_schedules', operation: 'insert' })));
  expect(writes.find((row) => row.table === 'medication_schedules')?.payload.times_of_day).toEqual([]);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
