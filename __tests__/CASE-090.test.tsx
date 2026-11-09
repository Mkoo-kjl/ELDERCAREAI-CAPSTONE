import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import AlertResponseScreen from '@/app/alert-response';
import {supabase} from '@/src/lib/supabase';
const mockPatient={elderly_id:'patient-1',full_name:'Maria'},mockSession={user:{id:'caregiver-1'}};
const mockAlertId='11111111-1111-4111-8111-111111111111';
let mockAlert:any,mockAudit:any[],mockLoadError=false;
jest.mock('expo-router',()=>({Stack:{Screen:()=>null},Redirect:()=>null,useLocalSearchParams:()=>({id:mockAlertId})}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({bottom:0})}));
jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:mockSession})}));
jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:mockPatient})}));
jest.mock('@/src/hooks/useCareRefresh',()=>({useCareRefresh:jest.fn()}));
jest.mock('@/src/lib/supabase',()=>({supabase:{from:jest.fn(),rpc:jest.fn()}}));
beforeEach(()=>{
  mockLoadError=false;mockAudit=[];mockAlert={id:mockAlertId,elderly_id:'patient-1',title:'High heart rate',message:'118 BPM',severity:'warning',triggered_at:'2026-11-07T01:00:00Z',is_resolved:false,acknowledged_at:null};
  (supabase.from as jest.Mock).mockImplementation(table=>{
    const result=()=>Promise.resolve({data:table==='health_alerts'?mockAlert:table==='alert_response_events'?mockAudit:null,error:mockLoadError?{message:'offline'}:null});
    const q:any={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,maybeSingle:result,then:(resolve:any,reject:any)=>result().then(resolve,reject)};return q;
  });
  (supabase.rpc as jest.Mock).mockImplementation(async(_name,{p_action,p_note})=>{
    mockAlert={...mockAlert,acknowledged_at:'2026-11-07T01:00:10Z',acknowledged_by:'caregiver-1',is_resolved:p_action==='resolve',resolution_note:p_note};
    mockAudit=[{id:'event-1',actor_id:'caregiver-1',action:'acknowledged',occurred_at:'2026-11-07T01:00:10Z'}];return{data:mockAlert,error:null};
  });
});
test('acknowledges first, validates an action note, then records resolution',async()=>{
  await render(<AlertResponseScreen/>);await screen.findByText('High heart rate');
  await fireEvent.press(screen.getByLabelText('Acknowledge alert'));
  await waitFor(()=>expect(screen.queryByLabelText('Acknowledge alert')).toBeNull());
  await fireEvent.press(screen.getByLabelText('Save note and resolve'));expect(supabase.rpc).toHaveBeenCalledTimes(1);
  await fireEvent.changeText(screen.getByLabelText('Response note'),'Called Maria and checked in.');
  await fireEvent.press(screen.getByLabelText('Save note and resolve'));
  await screen.findByText('Action recorded');expect(supabase.rpc).toHaveBeenLastCalledWith('respond_to_care_alert',{p_alert:mockAlertId,p_action:'resolve',p_note:'Called Maria and checked in.'});
});
test('a failed save preserves the response note and allows retry',async()=>{
  mockAlert.acknowledged_at='2026-11-07T01:00:10Z';
  await render(<AlertResponseScreen/>);await screen.findByText('High heart rate');
  (supabase.rpc as jest.Mock).mockResolvedValueOnce({data:null,error:{message:'offline'}});
  await fireEvent.changeText(screen.getByLabelText('Response note'),'Called Maria.');await fireEvent.press(screen.getByLabelText('Save note and resolve'));
  await screen.findByText(/Your response was not saved/);expect(screen.getByLabelText('Response note').props.value).toBe('Called Maria.');
  await fireEvent.press(screen.getByLabelText('Save note and resolve'));await screen.findByText('Action recorded');
});
test('prevents a second response request while the first is pending',async()=>{
  await render(<AlertResponseScreen/>);await screen.findByText('High heart rate');let complete:any;
  (supabase.rpc as jest.Mock).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
  await fireEvent.press(screen.getByLabelText('Acknowledge alert'));await fireEvent.press(screen.getByLabelText('Acknowledge alert'));
  expect(supabase.rpc).toHaveBeenCalledTimes(1);await act(async()=>complete({data:{...mockAlert,acknowledged_at:'2026-11-07T01:00:10Z'},error:null}));
});
