import AsyncStorage from '@react-native-async-storage/async-storage';
import SamsungHealth from '@/modules/samsung-health';
import {supabase} from '@/src/lib/supabase';
import {syncSamsungHealth,connectSamsungHealth,clearSamsungHealthLocalLink,getSamsungLink,restoreSamsungHealthLink,disconnectSamsungHealth} from '@/src/lib/samsung-health-sync';

const mockStorage=new Map<string,string>();
jest.mock('@react-native-async-storage/async-storage',()=>({
  getItem:jest.fn(async(key:string)=>mockStorage.get(key)??null),
  setItem:jest.fn(async(key:string,value:string)=>{mockStorage.set(key,value);}),
  removeItem:jest.fn(async(key:string)=>{mockStorage.delete(key);}),
}));
jest.mock('expo-task-manager',()=>({isTaskDefined:()=>true,isTaskRegisteredAsync:jest.fn(async()=>false)}));
jest.mock('expo-background-task',()=>({getStatusAsync:jest.fn(async()=>1),BackgroundTaskStatus:{Available:1},registerTaskAsync:jest.fn(async()=>{}),unregisterTaskAsync:jest.fn(async()=>{})}));
jest.mock('@/modules/samsung-health',()=>({__esModule:true,default:{readPage:jest.fn(),getAccess:jest.fn(),requestAccess:jest.fn()}}));
jest.mock('@/src/lib/supabase',()=>({supabase:{
  auth:{getSession:jest.fn()},functions:{invoke:jest.fn()},from:jest.fn(),
}}));

const source={userId:'caregiver-a',elderlyId:'patient-a',sourceId:'watch-a',sourceName:'Watch6',sleep:true,oxygen:true};
const revision='2026-11-02T08:00:00Z';
const sample=(index:number)=>({metric:'spo2_percent',value:96,measured_at:new Date(Date.parse('2026-11-02T00:00:00Z')+index*1000).toISOString(),
  source_record_key:`oxygen:night:${index}`,source_group_key:'oxygen:night',source_revision_at:revision});
const readPage=SamsungHealth!.readPage as jest.Mock;
const invoke=supabase.functions.invoke as jest.Mock;
const getSession=supabase.auth.getSession as jest.Mock;

beforeEach(()=>{
  jest.clearAllMocks();mockStorage.clear();
  mockStorage.set('eldercare:samsung-health-link',JSON.stringify(source));
  getSession.mockResolvedValue({data:{session:{user:{id:source.userId},access_token:'token-a'}}});
  readPage.mockImplementation(async(kind:string)=>({records:kind==='oxygen'?[sample(0)]:[],cursor:null}));
  invoke.mockImplementation(async(_name:string,{body}:{body:{samples?:unknown[]}})=>({data:{inserted:body.samples?.length??0},error:null}));
  (SamsungHealth!.getAccess as jest.Mock).mockResolvedValue({sleep:true,oxygen:false});
  const query={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),maybeSingle:jest.fn(async()=>({data:null,error:null}))};
  (supabase.from as jest.Mock).mockReturnValue(query);
});

test('resumes an interrupted large oxygen series after acknowledged batches',async()=>{
  const records=Array.from({length:245},(_,index)=>sample(index));
  readPage.mockImplementation(async(kind:string)=>({records:kind==='oxygen'?records:[],cursor:null}));
  const stored=new Set<string>();let shouldFail=true;
  invoke.mockImplementation(async(_name:string,{body}:{body:{samples:ReturnType<typeof sample>[]}})=>{
    if(shouldFail&&body.samples[0].source_record_key==='oxygen:night:120')return {data:null,error:new Error('Offline')};
    body.samples.forEach(item=>stored.add(item.source_record_key));
    return {data:{inserted:body.samples.length},error:null};
  });
  await expect(syncSamsungHealth()).rejects.toThrow('retried');
  expect(stored.size).toBe(120);
  shouldFail=false;invoke.mockClear();
  await expect(syncSamsungHealth()).resolves.toBe(125);
  expect(invoke.mock.calls.map(([,request])=>request.body.samples.length)).toEqual([120,5]);
  expect(stored.size).toBe(245);
  invoke.mockClear();await expect(syncSamsungHealth()).resolves.toBe(0);
  expect(invoke).not.toHaveBeenCalled();
});

test('replays a revised provider record and recovers from a corrupt local checkpoint',async()=>{
  await syncSamsungHealth();expect(invoke).toHaveBeenCalledTimes(1);
  readPage.mockImplementation(async(kind:string)=>({records:kind==='oxygen'?[{...sample(0),value:97,source_revision_at:'2026-11-02T09:00:00Z'}]:[],cursor:null}));
  await expect(syncSamsungHealth()).resolves.toBe(1);
  expect(invoke.mock.calls[1][1].body.samples[0].value).toBe(97);
  mockStorage.set('samsung-health-progress:caregiver-a:patient-a:watch-a','invalid JSON');
  await expect(syncSamsungHealth()).resolves.toBe(1);
});

test('reports partial sleep success and preserves the actual oxygen HTTP failure',async()=>{
  const sleep={...sample(0),metric:'sleep_hours',value:6.92,source_record_key:'sleep:night',source_group_key:'sleep:night'};
  readPage.mockImplementation(async(kind:string)=>({records:kind==='sleep'?[sleep]:[sample(0)],cursor:null}));
  invoke.mockImplementation(async(_name:string,{body}:{body:{samples:{metric:string}[]}})=>body.samples[0].metric==='sleep_hours'
    ?{data:{inserted:1},error:null}
    :{data:null,error:{context:{status:400,json:async()=>({error:'A Samsung Health sample has an invalid value, identifier or timestamp.',code:'P0001'})}}});
  await expect(syncSamsungHealth()).rejects.toThrow('Sleep check completed. Blood oxygen sync paused: A Health history sample has an invalid value, identifier or timestamp. (HTTP 400, P0001)');
  const checkpoint=JSON.parse(mockStorage.get('samsung-health-progress:caregiver-a:patient-a:watch-a')!);
  expect(checkpoint['sleep:night'].offset).toBe(1);
  invoke.mockImplementation(async(_name:string,{body}:{body:{samples:unknown[]}})=>({data:{inserted:body.samples.length},error:null}));
  invoke.mockClear();await expect(syncSamsungHealth()).resolves.toBe(1);
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(invoke.mock.calls[0][1].body.samples[0].metric).toBe('spo2_percent');
});

test('keeps a useful retry message for a non-JSON gateway failure',async()=>{
  invoke.mockResolvedValue({data:null,error:{context:{status:503,json:async()=>{throw Error('Not JSON');}}}});
  await expect(syncSamsungHealth()).rejects.toThrow('HTTP 503');
});

test('checks the caregiver and selected source again between upload batches',async()=>{
  readPage.mockImplementation(async(kind:string)=>({records:kind==='oxygen'?Array.from({length:121},(_,index)=>sample(index)):[],cursor:null}));
  invoke.mockImplementation(async()=>{
    mockStorage.set('eldercare:samsung-health-link',JSON.stringify({...source,sourceId:'different-watch'}));
    return {data:{inserted:120},error:null};
  });
  await expect(syncSamsungHealth()).rejects.toThrow('connection changed');
  expect(invoke).toHaveBeenCalledTimes(1);
});

test('rejects another caregiver before reading health records and covers a long offline interval',async()=>{
  getSession.mockResolvedValueOnce({data:{session:{user:{id:'another-caregiver'}}}});
  await expect(syncSamsungHealth()).rejects.toThrow('linked caregiver');
  expect(readPage).not.toHaveBeenCalled();
  mockStorage.set('samsung-health-last-sync:caregiver-a:patient-a','2026-01-01T00:00:00Z');
  await syncSamsungHealth();
  expect(readPage.mock.calls[0][2]).toBe('2025-12-31T00:00:00.000Z');
  expect(AsyncStorage.setItem).toHaveBeenCalled();
});

test('account A → B → A keeps independent source choices and resumes the correct watch',async()=>{
  await clearSamsungHealthLocalLink();
  expect(await getSamsungLink()).toBeNull();
  getSession.mockResolvedValue({data:{session:{user:{id:'caregiver-b'},access_token:'token-b'}}});
  await connectSamsungHealth('caregiver-b','patient-b',{id:'watch-b',name:'B watch',model:'Watch6',manufacturer:'Samsung'},{sleep:true,oxygen:false});
  expect((await getSamsungLink('caregiver-b','patient-b'))?.sourceId).toBe('watch-b');
  await clearSamsungHealthLocalLink();
  getSession.mockResolvedValue({data:{session:{user:{id:source.userId},access_token:'token-a'}}});
  expect(await restoreSamsungHealthLink(source.userId,source.elderlyId)).toEqual(source);
  expect((await getSamsungLink('caregiver-b','patient-b'))?.sourceId).toBe('watch-b');
  invoke.mockClear();readPage.mockClear();
  await syncSamsungHealth(source.userId,source.elderlyId);
  expect(readPage.mock.calls.every(([,id])=>id==='watch-a')).toBe(true);
  expect(invoke.mock.calls[0][1]).toMatchObject({body:{source_device_id:'watch-a'},headers:{Authorization:'Bearer token-a'}});
});

test('recovers a link erased by an older APK from this patient’s authorized server binding',async()=>{
  mockStorage.clear();
  const query=(supabase.from as jest.Mock)();
  query.maybeSingle.mockResolvedValue({data:{source_device_id:'watch-a',source_name:'A history'},error:null});
  expect(await restoreSamsungHealthLink(source.userId,source.elderlyId)).toMatchObject({sourceId:'watch-a',sleep:true,oxygen:false});
  expect(query.eq).toHaveBeenCalledWith('caregiver_id','caregiver-a');
  expect(query.eq).toHaveBeenCalledWith('elderly_id','patient-a');
  expect(SamsungHealth!.requestAccess).not.toHaveBeenCalled();
  await syncSamsungHealth(source.userId,source.elderlyId);
  expect(readPage.mock.calls.map(([kind,id])=>[kind,id])).toEqual([['sleep','watch-a']]);
});

test('does not inherit another account’s source when there is no saved binding',async()=>{
  getSession.mockResolvedValue({data:{session:{user:{id:'caregiver-b'},access_token:'token-b'}}});
  expect(await restoreSamsungHealthLink('caregiver-b','patient-b')).toBeNull();
  expect(await syncSamsungHealth('caregiver-b','patient-b')).toBe(0);
  expect(readPage).not.toHaveBeenCalled();
  expect(SamsungHealth!.getAccess).not.toHaveBeenCalled();
});

test('a new account’s sync does not join the preceding account’s unfinished SDK request',async()=>{
  let release!:(value:unknown)=>void;
  const pending=new Promise(resolve=>{release=resolve;});
  readPage.mockImplementation(async(_kind:string,id:string)=>id==='watch-a'?pending:{records:[sample(0)],cursor:null});
  const oldResult=syncSamsungHealth().catch(error=>error as Error);
  while(readPage.mock.calls.length===0)await new Promise(resolve=>setTimeout(resolve,0));
  await clearSamsungHealthLocalLink();
  getSession.mockResolvedValue({data:{session:{user:{id:'caregiver-b'},access_token:'token-b'}}});
  await connectSamsungHealth('caregiver-b','patient-b',{id:'watch-b',name:'B watch',model:'Watch6',manufacturer:'Samsung'},{sleep:true,oxygen:false});
  invoke.mockClear();
  await expect(syncSamsungHealth('caregiver-b','patient-b')).resolves.toBe(1);
  expect(invoke.mock.calls).toHaveLength(1);
  expect(invoke.mock.calls[0][1]).toMatchObject({body:{source_device_id:'watch-b'},headers:{Authorization:'Bearer token-b'}});
  release({records:[sample(0)],cursor:null});
  expect(await oldResult).toBeInstanceOf(Error);
  expect(invoke).toHaveBeenCalledTimes(1);
});

test('explicit disconnect removes only that account’s binding while sign-out retains it',async()=>{
  const other={...source,userId:'caregiver-b',elderlyId:'patient-b',sourceId:'watch-b'};
  mockStorage.set('eldercare:samsung-health-link:caregiver-b:patient-b',JSON.stringify(other));
  await clearSamsungHealthLocalLink();
  await restoreSamsungHealthLink(source.userId,source.elderlyId);
  await disconnectSamsungHealth(source.userId,source.elderlyId);
  expect(await getSamsungLink(source.userId,source.elderlyId)).toBeNull();
  expect(await getSamsungLink(other.userId,other.elderlyId)).toEqual(other);
});
