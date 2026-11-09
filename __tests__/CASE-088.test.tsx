import {render,screen,waitFor} from '@testing-library/react-native';
import {Text} from 'react-native';
import {HealthDataProvider,useHealthData,type VitalLog} from '@/src/providers/HealthDataProvider';
import {latestWatchVital,watchMetricStatus,type WatchLiveState} from '@/src/lib/galaxy-watch';

let mockUser='caregiver-a';
let mockState:WatchLiveState|null=null;
const mockRows:VitalLog[]=[];
jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:mockUser}},onboarding:{wearable_status:'connected',wearable_provider:'galaxy_watch'}})}));
jest.mock('@/src/hooks/useGalaxyWatch',()=>({useGalaxyWatch:()=>({state:mockState,error:null,reload:async()=>{},status:'Waiting for watch',heartRateFresh:false,gpsFresh:false})}));
jest.mock('@/src/lib/supabase',()=>({supabase:{
  from:jest.fn((table:string)=>{
    let patient='',caregiver='',metric='';
    const query:any={select:()=>query,order:()=>query,
      eq:(key:string,value:string)=>{if(key==='elderly_id')patient=value;if(key==='caregiver_id')caregiver=value;return query;},
      not:(key:string)=>{metric=key;return query;},
      limit:()=>table==='vital_sign_logs'?Promise.resolve({data:mockRows.filter(row=>row.elderly_id===patient&&row[metric as keyof VitalLog]!=null),error:null}):query,
      maybeSingle:async()=>({data:{elderly_id:caregiver==='caregiver-a'?'patient-a':'patient-b',full_name:caregiver},error:null})};return query;
  }),
  channel:()=>{const channel:any={on:()=>channel,subscribe:()=>channel};return channel;},removeChannel:async()=>{},
}}));
function Probe(){const {vital,history}=useHealthData();return <><Text>{vital?.sleep_hours??'--'} hours</Text><Text>{vital?.measurement_times?.sleep_hours??'No time'}</Text><Text>{history.length} saved</Text></>;}
const saved=(patient:string,hours:number):VitalLog=>({id:`sleep:${patient}`,elderly_id:patient,source:'galaxy_watch',recorded_at:'2026-11-06T23:00:00Z',synced_at:'2026-11-07T00:00:00Z',
  measurement_times:{sleep_hours:'2026-11-06T23:00:00Z'},heart_rate_bpm:null,spo2_percent:null,skin_temp_celsius:null,hrv_rmssd_ms:null,steps_count:null,sleep_hours:hours,overall_status:null,ai_risk_score:null});
beforeEach(()=>{mockUser='caregiver-a';mockState=null;mockRows.splice(0,mockRows.length,saved('patient-a',7.2),saved('patient-b',5.8));});

test('login A → B → A restores the card from each patient’s saved history without live state',async()=>{
  const view=await render(<HealthDataProvider key={mockUser}><Probe/></HealthDataProvider>);
  await waitFor(()=>expect(screen.getByText('7.2 hours')).toBeTruthy());
  expect(screen.getByText('1 saved')).toBeTruthy();
  mockUser='caregiver-b';await view.rerender(<HealthDataProvider key={mockUser}><Probe/></HealthDataProvider>);
  await waitFor(()=>expect(screen.getByText('5.8 hours')).toBeTruthy());
  expect(screen.queryByText('7.2 hours')).toBeNull();
  mockUser='caregiver-a';await view.rerender(<HealthDataProvider key={mockUser}><Probe/></HealthDataProvider>);
  await waitFor(()=>expect(screen.getByText('7.2 hours')).toBeTruthy());
  expect(screen.getByText('2026-11-06T23:00:00Z')).toBeTruthy();
  expect(screen.queryByText('5.8 hours')).toBeNull();
});

test('a replacement watch with no sleep does not hide recorded sleep or borrow another patient’s reading',()=>{
  const state:WatchLiveState={elderly_id:'patient-a',device_id:'replacement',heart_rate_bpm:81,heart_rate_measured_at:'2026-11-07T08:00:00Z',
    sleep_hours:null,latitude:null,longitude:null,accuracy_m:null,gps_measured_at:null,battery_percent:70,monitoring:true,status_at:'2026-11-07T08:00:00Z',received_at:'2026-11-07T08:00:01Z'};
  const vital=latestWatchVital('patient-a',state,mockRows);
  expect(vital).toMatchObject({sleep_hours:7.2,heart_rate_bpm:81,measurement_times:{sleep_hours:'2026-11-06T23:00:00Z',heart_rate_bpm:'2026-11-07T08:00:00Z'}});
  expect(watchMetricStatus(state,'sleep_hours',vital)).toContain('Recorded sleep');
  expect(latestWatchVital('patient-c',state,mockRows)).toBeNull();
});

test('new readings win by their own timestamp and superseded history is excluded',()=>{
  const first=saved('patient-a',7.2),newer={...first,id:'new-sleep',sleep_hours:8,recorded_at:'2026-11-07T06:00:00Z',measurement_times:{sleep_hours:'2026-11-07T06:00:00Z'}};
  const superseded={...newer,id:'obsolete',sleep_hours:9,is_superseded:true};
  expect(latestWatchVital('patient-a',null,[superseded,first,newer])?.sleep_hours).toBe(8);
});

test('an untimestamped snapshot value cannot freshen old sleep using the heart-rate timestamp',()=>{
  const state:WatchLiveState={elderly_id:'patient-a',device_id:'replacement',heart_rate_bpm:81,heart_rate_measured_at:'2026-11-07T08:00:00Z',
    sleep_hours:10,sleep_measured_at:null,latitude:null,longitude:null,accuracy_m:null,gps_measured_at:null,battery_percent:70,monitoring:true,status_at:'2026-11-07T08:00:00Z',received_at:'2026-11-07T08:00:01Z'};
  expect(latestWatchVital('patient-a',state,mockRows)).toMatchObject({sleep_hours:7.2,measurement_times:{sleep_hours:'2026-11-06T23:00:00Z'}});
});
