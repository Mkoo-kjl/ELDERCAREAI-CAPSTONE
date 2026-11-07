import { medication, prepareCareWorkflow, showCare } from '../test-support/integration/care-workflow-harness';

test('INT-010 saved medication schedule reaches the Care plan status view', async () => {
  prepareCareWorkflow({ medication_schedules: [{ ...medication, frequency: 'As needed', times_of_day: [] }] });
  const screen = await showCare();
  expect(await screen.findByText('Losartan')).toBeTruthy();
  expect(screen.getByText('As needed')).toBeTruthy();
});
