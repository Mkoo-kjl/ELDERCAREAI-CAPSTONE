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

test('local reminder scope rejects other accounts, other patients and legacy unscoped notifications',async()=>{
  await render(<WatchCareObserver/>);
  const event=local('medication','foreign');
  await act(async()=>{
    mockLocalEvent({...event,request:{...event.request,content:{...event.request.content,data:{...event.request.content.data,caregiver_id:'other'}}}});
    mockLocalEvent({...event,request:{...event.request,content:{...event.request.content,data:{...event.request.content.data,elderly_id:'other'}}}});
    mockLocalEvent({...event,request:{...event.request,content:{...event.request.content,data:{care_kind:'medication',entityId:'legacy'}}}});
  });
  expect(Alert.alert).not.toHaveBeenCalled();
});
