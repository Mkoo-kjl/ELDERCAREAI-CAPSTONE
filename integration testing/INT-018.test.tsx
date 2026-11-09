import { act,Alert,medication, prepareCareWorkflow, pressText, screen, showCare, waitFor } from '../test-support/integration/care-workflow-harness';

test('INT-018 recording a dose writes a log and refreshes the Care status', async () => {
  const due=new Date(Date.now()-60000);const clock=`${String(due.getHours()).padStart(2,'0')}:${String(due.getMinutes()).padStart(2,'0')}`;
  const { writes } = prepareCareWorkflow({ medication_schedules: [{...medication,times_of_day:[clock]}] });
  await showCare();
  await pressText('Taken');
  const actions=(Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
  await act(async()=>{await actions[1].onPress();});
  await waitFor(() => expect(writes).toContainEqual(expect.objectContaining({ table: 'medication_logs', operation: 'insert', payload: expect.objectContaining({ schedule_id: 'med-1', status: 'taken' }) })));
  expect(await screen.findByText('Taken today')).toBeTruthy();
});
