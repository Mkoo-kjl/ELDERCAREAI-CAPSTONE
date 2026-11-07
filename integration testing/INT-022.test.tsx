import { act,Alert, AsyncStorage, prepareCareWorkflow, pressText, showCare, waitFor } from '../test-support/integration/care-workflow-harness';

test('INT-022 deleting an appointment removes its care entry and reminder', async () => {
  const { writes } = prepareCareWorkflow({ appointments: [{ id: 'appt-1', caregiver_id: 'caregiver-1', elderly_id: 'patient-1', title: 'Checkup', doctor_name: null, location: null, appointment_at: new Date(Date.now() + 86_400_000).toISOString(), notes: null, status: 'scheduled' }] });
  const screen = await showCare();
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
  await pressText('Appointments');
  expect(screen.getByText('Checkup')).toBeTruthy();
  await pressText('Delete');
  const actions = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
  await act(async()=>{await actions[1].onPress();});
  await waitFor(() => expect(writes).toContainEqual(expect.objectContaining({ table: 'appointments', operation: 'delete' })));
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('eldercare-notification:appointment:appt-1');
  await waitFor(() => expect(screen.queryByText('Checkup')).toBeNull());
});
