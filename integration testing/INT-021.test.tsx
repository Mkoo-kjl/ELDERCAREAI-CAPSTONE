import { Notifications, prepareCareWorkflow, showCare, waitFor } from '../test-support/integration/care-workflow-harness';

test('INT-021 a saved upcoming appointment reaches the notification scheduler', async () => {
  prepareCareWorkflow({ appointments: [{ id: 'appt-1', caregiver_id: 'caregiver-1', elderly_id: 'patient-1', title: 'Checkup', doctor_name: 'Dr. Kevin', location: 'Clinic', appointment_at: new Date(Date.now() + 86_400_000).toISOString(), notes: null, status: 'scheduled' }] });
  await showCare();
  await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    content: expect.objectContaining({ title: 'Appointment now: Checkup', body: 'Maria • Dr. Kevin • Clinic' }),
  })));
});
