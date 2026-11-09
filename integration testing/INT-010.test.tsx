import { medication, prepareCareWorkflow, showCare } from '../test-support/integration/care-workflow-harness';

test('INT-011 taken log changes the saved medication status in Care plan', async () => {
  const scheduled=new Date();scheduled.setHours(8,0,0,0);
  prepareCareWorkflow({
    medication_schedules: [medication],
    medication_logs: [{ elderly_id: 'patient-1', schedule_id: 'med-1', status: 'taken', scheduled_time: scheduled.toISOString(), taken_at: new Date().toISOString() }],
  });
  const screen = await showCare();
  expect(await screen.findByText('Taken today')).toBeTruthy();
});
