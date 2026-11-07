import { Notifications, change, prepareCareWorkflow, pressLabel, pressText, showCare, waitFor } from '../test-support/integration/care-workflow-harness';

test('INT-016 saving an appointment schedules a named patient reminder', async () => {
  const { writes } = prepareCareWorkflow();
  await showCare();
  await pressText('Appointments');
  await pressLabel('Add Appointment');
  await change('Title', 'Cardiology visit');
  await change('Doctor name', 'Dr. Kevin');
  await pressText('Save');
  await waitFor(() => expect(writes).toContainEqual(expect.objectContaining({ table: 'appointments', operation: 'insert' })));
  await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    content: expect.objectContaining({ title: 'Appointment now: Cardiology visit', body: expect.stringContaining('Maria') }),
  })));
});
