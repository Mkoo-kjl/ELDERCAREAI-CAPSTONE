import { act,Alert, AsyncStorage, medication, prepareCareWorkflow, pressText, showCare, waitFor } from '../test-support/integration/care-workflow-harness';

test('INT-015 deleting a medication deactivates it and cancels its reminder', async () => {
  const { writes } = prepareCareWorkflow({ medication_schedules: [medication] });
  await showCare();
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
  await pressText('Delete');
  const actions = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
  await act(async()=>{await actions[1].onPress();});
  await waitFor(() => expect(writes).toContainEqual(expect.objectContaining({ table: 'medication_schedules', operation: 'update', payload: { is_active: false } })));
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('eldercare-notification:medication:med-1');
});
