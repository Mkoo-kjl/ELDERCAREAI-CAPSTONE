import {act,render} from '@testing-library/react-native';

import {Alert,AppState,Vibration} from 'react-native';

import {WatchCareObserver} from '@/src/components/WatchCareObserver';

jest.mock('@/src/lib/watch-push',()=>({refreshCarePushRegistration:jest.fn().mockResolvedValue(false),isCarePushRegistered:jest.fn().mockResolvedValue(false)}));

let mockEvent:(value:any)=>void;

let mockLocalEvent:(value:any)=>void;

const mockAudio={seekTo:jest.fn().mockResolvedValue(undefined),play:jest.fn()};

jest.mock('expo-audio',()=>({useAudioPlayer:()=>mockAudio,setAudioModeAsync:jest.fn().mockResolvedValue(undefined)}));

jest.mock('expo-notifications',()=>({addNotificationReceivedListener:(callback:any)=>{mockLocalEvent=callback;return {remove:jest.fn()};}}));

jest.mock('expo-router',()=>({router:{push:jest.fn()}}));

jest.mock('@react-native-async-storage/async-storage',()=>({__esModule:true,default:{getItem:jest.fn().mockResolvedValue(null),setItem:jest.fn().mockResolvedValue(undefined)}}));

jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'caregiver'}}})}));

jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:{elderly_id:'patient'}})}));

jest.mock('@/src/lib/supabase',()=>({supabase:{
  from:()=>{let related=false;const query:any={select:()=>query,eq:()=>query,gte:()=>query,order:()=>query,contains:()=>{related=true;return query;},limit:()=>Promise.resolve({data:related&&mockLinked?[{id:'linked-med'}]:[],error:null})};return query;},
  channel:()=>{const channel={on:(_event:any,_filter:any,callback:any)=>{mockEvent=callback;return channel;},subscribe:()=>channel};return channel;},removeChannel:jest.fn().mockResolvedValue(undefined),
}}));

let mockLinked=false;

const notice={id:'notification-1',title:'Watch SOS',body:'Assistance requested',data:{watch_sos_id:'event-1'},sent_at:new Date().toISOString()};

beforeEach(()=>{Object.defineProperty(AppState,'currentState',{value:'active',writable:true,configurable:true});jest.spyOn(Alert,'alert').mockImplementation(()=>{});jest.spyOn(Vibration,'vibrate').mockImplementation(()=>{});});

afterEach(()=>jest.restoreAllMocks());

const local=(kind:'medication'|'appointment',id:string,date=Date.now())=>({date,request:{identifier:`${kind}:${id}`,content:{title:`${kind} reminder`,body:`Patient: ${id}`,data:{care_local_version:3,caregiver_id:'caregiver',elderly_id:'patient',care_kind:kind,entityId:id}}}});

test('new watch SOS alerts once and duplicate delivery is ignored',async()=>{
  await render(<WatchCareObserver/>);
  await act(async()=>{mockEvent({new:notice});await Promise.resolve();});
  expect(Alert.alert).toHaveBeenCalledTimes(1);expect(Vibration.vibrate).toHaveBeenCalled();expect(mockAudio.play).toHaveBeenCalled();
  await act(async()=>{mockEvent({new:notice});await Promise.resolve();});
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});

test('unrelated notices and events delivered after cleanup cannot display an SOS',async()=>{
  const result=await render(<WatchCareObserver/>);const oldEvent=mockEvent;
  await act(async()=>{oldEvent({new:{...notice,data:{}}});});expect(Alert.alert).not.toHaveBeenCalled();
  await result.unmount();await act(async()=>{oldEvent({new:notice});});expect(Alert.alert).not.toHaveBeenCalled();
});

test('a newly saved vital warning sounds once without Firebase registration',async()=>{
  await render(<WatchCareObserver/>);
  const vital={...notice,id:'vital-notice',title:'Heart rate above review threshold',data:{care_kind:'vital'}};
  await act(async()=>{mockEvent({new:vital});await Promise.resolve();});
  expect(Alert.alert).toHaveBeenCalledTimes(1);expect(mockAudio.play).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith(vital.title,vital.body,expect.any(Array),expect.objectContaining({cancelable:true}));
  await act(async()=>{mockEvent({new:vital});await Promise.resolve();});
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});

test('stale vital notices and background Realtime events do not play foreground audio',async()=>{
  await render(<WatchCareObserver/>);
  await act(async()=>{mockEvent({new:{...notice,id:'old-vital',data:{care_kind:'vital'},sent_at:new Date(Date.now()-180000).toISOString()}});});
  Object.defineProperty(AppState,'currentState',{value:'background',writable:true,configurable:true});
  await act(async()=>{mockEvent({new:{...notice,id:'background-vital',data:{care_kind:'vital'}}});});
  expect(Alert.alert).not.toHaveBeenCalled();expect(mockAudio.play).not.toHaveBeenCalled();
});

test('threshold popup offers linked prescriptions only when that patient has an explicit medication link',async()=>{
  mockLinked=true;await render(<WatchCareObserver/>);
  await act(async()=>{mockEvent({new:{...notice,id:'linked-warning',data:{care_kind:'vital',rule:'heart_high'}}});});
  const buttons=(Alert.alert as jest.Mock).mock.calls[0][2];
  expect(buttons.some((button:{text:string})=>button.text==='View linked medications')).toBe(true);
  mockLinked=false;
});
