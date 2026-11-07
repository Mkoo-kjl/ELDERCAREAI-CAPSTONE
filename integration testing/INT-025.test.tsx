import { Notifications, change, prepareCareWorkflow, pressLabel, pressText, showCare, waitFor } from '../test-support/integration/care-workflow-harness';

test('INT-025 twice-daily medicine saves both times and schedules both reminders', async () => {
  const { writes } = prepareCareWorkflow();
  await showCare();
  await pressLabel('Add Medication');
  await change('Medication name', 'Metformin');
  await pressText('Twice daily');
  await pressText('Save');
  await waitFor(() => expect(writes).toContainEqual(expect.objectContaining({ table: 'medication_schedules', operation: 'insert', payload: expect.objectContaining({ times_of_day: ['08:00', '20:00'] }) })));
  await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ trigger: expect.objectContaining({ hour: 8, minute: 0 }) })));
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ trigger: expect.objectContaining({ hour: 20, minute: 0 }) }));
});
