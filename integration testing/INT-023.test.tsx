import { change, prepareCareWorkflow, pressLabel, pressText, showCare, waitFor } from '../test-support/integration/care-workflow-harness';

test('INT-023 caregiver note save appears in the Care plan list', async () => {
  const { writes } = prepareCareWorkflow();
  const screen = await showCare();
  await pressText('Notes');
  await pressLabel('Add Note');
  await change('Title', 'Evening handoff');
  await change('Note content', 'Check blood pressure before bedtime');
  await pressText('Save');
  await waitFor(() => expect(writes).toContainEqual(expect.objectContaining({ table: 'caregiver_notes', operation: 'insert', payload: expect.objectContaining({ elderly_id: 'patient-1', content: 'Check blood pressure before bedtime' }) })));
  expect(await screen.findByText('Evening handoff')).toBeTruthy();
});
