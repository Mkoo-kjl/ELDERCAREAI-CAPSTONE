import { medication, Notifications, prepareCareWorkflow, showCare, waitFor } from '../test-support/integration/care-workflow-harness';

test('INT-012 loading a saved medication schedules its native reminder', async () => {
  const { store } = prepareCareWorkflow({ medication_schedules: [medication] });
  await showCare();
  await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    content: expect.objectContaining({ body: 'Maria: Time for Losartan (50 mg).' }),
  })));
  expect(store.has('eldercare-notification:medication:med-1')).toBe(true);
});
