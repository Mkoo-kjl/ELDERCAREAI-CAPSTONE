import {Alert,Notifications,change,medication,prepareCareWorkflow,pressLabel,pressText,screen,showCare,waitFor} from '../test-support/integration/care-workflow-harness';
import {isCarePushRegistered} from '@/src/lib/watch-push';

afterEach(()=>jest.restoreAllMocks());
test('a notification setup exception cannot turn a committed medication into a failed save',async()=>{
  const {writes}=prepareCareWorkflow();await showCare();
  await pressLabel('Add Medication');await change('Medication name','Regression medication');
  (isCarePushRegistered as jest.Mock).mockRejectedValueOnce(Error('undefined is not a function'));
  await pressText('Save');
  await waitFor(()=>expect(screen.queryByText('Add Medication')).toBeNull());
  expect(writes.filter(row=>row.table==='medication_schedules'&&row.operation==='insert')).toHaveLength(1);
  expect(Alert.alert).toHaveBeenCalledWith('Saved — reminder setup needs attention',expect.any(String));
  expect(Alert.alert).not.toHaveBeenCalledWith('Unable to save',expect.anything());
});
test('appointment data survives a local notification scheduling error',async()=>{
  const {writes}=prepareCareWorkflow();await showCare();await pressText('Appointments');
  await pressLabel('Add Appointment');await change('Title','Regression appointment');
  (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(Error('Notification unavailable'));
  await pressText('Save');
  await waitFor(()=>expect(screen.queryByText('Add Appointment')).toBeNull());
  expect(writes.filter(row=>row.table==='appointments'&&row.operation==='insert')).toHaveLength(1);
  expect(Alert.alert).not.toHaveBeenCalledWith('Unable to save',expect.anything());
});
test('a rejected database write keeps the medication draft available for retry',async()=>{
  const {writes,failNextWrite}=prepareCareWorkflow();await showCare();
  await pressLabel('Add Medication');await change('Medication name','Keep this draft');
  failNextWrite(Error('Database unavailable'));await pressText('Save');
  await waitFor(()=>expect(Alert.alert).toHaveBeenCalledWith('Unable to save','Database unavailable'));
  expect(screen.getByDisplayValue('Keep this draft')).toBeTruthy();expect(writes).toHaveLength(0);
});
test('editing a medication updates the existing schedule and refreshes the list',async()=>{
  const {writes}=prepareCareWorkflow({medication_schedules:[medication]});await showCare();
  await pressText('Edit');await change('Medication name','Updated medication');await pressText('Save');
  await waitFor(()=>expect(screen.getByText('Updated medication')).toBeTruthy());
  expect(writes.filter(row=>row.table==='medication_schedules')).toEqual([expect.objectContaining({operation:'update'})]);
});
