import {decodeAppointmentLocation} from '@/src/lib/appointment-location';
import {Notifications,act,change,prepareCareWorkflow,pressLabel,pressText,screen,showCare,waitFor} from '../test-support/integration/care-workflow-harness';

let mockMapProps:any;
jest.mock('react-native-webview',()=>({WebView:(props:any)=>{mockMapProps=props;return null;}}));

test('INT-041 appointment map pin and address save, reload, edit and reach the reminder together',async()=>{
  const {writes}=prepareCareWorkflow();
  await showCare();
  await pressText('Schedule');
  await pressLabel('Add Appointment');
  await change('Title','Eye checkup');
  await change('Doctor name','Dr. Santos');
  await change('Location','Eye clinic');
  await pressLabel('Open appointment location map');
  const point={latitude:10.3157,longitude:123.8854};
  await act(async()=>{
    mockMapProps.onMessage({nativeEvent:{data:JSON.stringify({channel:'appointment-map',type:'ready'})}});
    mockMapProps.onMessage({nativeEvent:{data:JSON.stringify({channel:'appointment-map',type:'coordinate',value:point})}});
  });
  await pressText('Use this location');
  await pressText('Save');
  await waitFor(()=>expect(writes.some(row=>row.table==='appointments')).toBe(true));
  const payload=writes.find(row=>row.table==='appointments')!.payload;
  expect(decodeAppointmentLocation(payload.location)).toEqual({label:'Eye clinic',point});
  expect(payload).toEqual(expect.objectContaining({caregiver_id:'caregiver-1',elderly_id:'patient-1'}));
  await waitFor(()=>expect(screen.getByText('Eye checkup')).toBeTruthy());
  expect(screen.getByText('Dr. Santos • Eye clinic')).toBeTruthy();
  expect(screen.getByText('Open map')).toBeTruthy();
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({content:expect.objectContaining({title:'Appointment now: Eye checkup',body:expect.stringContaining('Eye clinic')})}));
  await pressText('Edit');
  expect(screen.getByLabelText('Location').props.value).toBe('Eye clinic');
  expect(screen.getByText(/Map pin saved/)).toBeTruthy();
  await change('Location','Eye clinic, second floor');
  await pressText('Save');
  await waitFor(()=>expect(writes.some(row=>row.operation==='update')).toBe(true));
  expect(decodeAppointmentLocation(writes.find(row=>row.operation==='update')!.payload.location)).toEqual({label:'Eye clinic, second floor',point});
});
