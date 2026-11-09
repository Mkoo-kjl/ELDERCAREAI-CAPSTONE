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

test('uploads reject a changed account before reading or transmitting a photo',async()=>{
  await expect(uploadCareFile('another-owner','patient','medication',{uri:'file:///photo.jpg'})).rejects.toThrow('session changed');
});
