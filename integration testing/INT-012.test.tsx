import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';

import {HealthAnalytics} from '@/src/components/HealthAnalytics';

import {CareImage} from '@/src/components/CareImage';

import {uploadCareFile} from '@/src/lib/care-files';

import {supabase} from '@/src/lib/supabase';

const mockPatient={elderly_id:'patient',full_name:'Test patient'};

const mockRows=[{id:'one',elderly_id:'patient',heart_rate_bpm:70,recorded_at:new Date(Date.now()-60000).toISOString(),source:'galaxy_watch'},{id:'two',elderly_id:'patient',heart_rate_bpm:90,recorded_at:new Date().toISOString(),source:'galaxy_watch'}];

const mockRange=jest.fn(async()=>({data:mockRows,error:null})),mockGte=jest.fn(),mockUpload=jest.fn(async()=>({error:null})),mockSigned=jest.fn(async()=>({data:{signedUrl:'https://test.invalid/private-signed-image'},error:null}));

const mockDailyHistory=jest.fn(async()=>({data:[{id:'daily',elderly_id:'patient',steps_count:200,steps_day:new Date().toISOString().slice(0,10),recorded_at:new Date().toISOString(),source:'galaxy_watch'}],error:null}));

let mockEvent:(value:any)=>void;

jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:mockPatient})}));

jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'owner'}}})}));

jest.mock('@/src/lib/supabase',()=>({supabase:{rpc:jest.fn(()=>({range:mockDailyHistory})),auth:{getUser:jest.fn(async()=>({data:{user:{id:'owner'}},error:null}))},storage:{from:jest.fn(()=>({upload:mockUpload,createSignedUrl:mockSigned}))},from:jest.fn(()=>{const q:any={select:()=>q,eq:()=>q,not:()=>q,gte:(...args:any[])=>{mockGte(...args);return q;},lt:()=>q,order:()=>q,range:mockRange};return q;}),channel:()=>{const c:any={on:(_kind:any,_filter:any,fn:any)=>{mockEvent=fn;return c;},subscribe:()=>c};return c;},removeChannel:jest.fn()}}));

jest.mock('@/src/components/PickerModal',()=>({PickerModal:()=>null}));

test('step analytics uses daily history and replaces a changed total instead of summing snapshots',async()=>{
  await render(<HealthAnalytics/>);
  await waitFor(()=>expect(screen.getByText(/2 records · Min/)).toBeTruthy());
  await fireEvent.press(screen.getByText('Steps'));
  await waitFor(()=>expect(screen.getByText(/1 day · Min 200 · Max 200/)).toBeTruthy());
  expect(supabase.rpc).toHaveBeenCalledWith('daily_step_history',expect.objectContaining({p_elderly:'patient',p_from:expect.any(String),p_until:expect.any(String)}));
  const row=(await mockDailyHistory.mock.results[0].value).data[0];
  await act(async()=>mockEvent({eventType:'UPDATE',new:{...row,steps_count:350}}));
  expect(screen.getByText(/1 day · Min 350 · Max 350/)).toBeTruthy();expect(screen.getByText(/Total 350 steps across recorded days/)).toBeTruthy();
});
