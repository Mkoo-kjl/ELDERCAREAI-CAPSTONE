import {act,renderHook,waitFor} from '@testing-library/react-native';
import {useWatchTrack} from '@/src/hooks/useWatchTrack';
import {AppState} from 'react-native';
import {supabase} from '@/src/lib/supabase';
let mockReceive:((event:any)=>void)|undefined;
const stamp=new Date().toISOString();
const gps={id:'gps',elderly_id:'patient',device_id:'watch',latitude:10,longitude:123,accuracy_m:8,location_source:'watch_gps',measured_at:stamp};
const mockEq=jest.fn();
let mockRows:any[]=[];
jest.mock('@/src/lib/supabase',()=>({supabase:{from:jest.fn(),channel:()=>{const channel={on:(_event:any,_filter:any,receive:any)=>{mockReceive=receive;return channel;},subscribe:()=>channel};return channel;},removeChannel:jest.fn()}}));
beforeEach(()=>{
  mockEq.mockClear();
  mockRows=[gps,{...gps,id:'phone',location_source:'fused'}];
  (supabase.from as jest.Mock).mockImplementation(()=>{
    const query={select:()=>query,eq:(...args:any[])=>{mockEq(...args);return query;},gte:()=>query,order:()=>query,
      limit:async()=>({data:mockRows,error:null})};return query;
  });
});
test('polling recovers movement when the realtime channel sends no events',async()=>{
  jest.useFakeTimers();const previousState=AppState.currentState;Object.defineProperty(AppState,'currentState',{value:'active',configurable:true});
  try{
    mockRows=[gps];
    const view=await renderHook(()=>useWatchTrack('patient','watch'));
    await act(async()=>{});expect(view.result.current.points.map(p=>p.id)).toEqual(['gps']);
    mockRows=[{...gps,id:'polled-movement',latitude:10.001,measured_at:new Date(Date.now()+2_000).toISOString()}];
    await act(async()=>{jest.advanceTimersByTime(3_000);});
    expect(view.result.current.points.at(-1)?.id).toBe('polled-movement');
    await view.unmount();
  }finally{Object.defineProperty(AppState,'currentState',{value:previousState,configurable:true});jest.useRealTimers();}
});
test('route query and realtime merge retain hybrid sources for only this patient and device',async()=>{
  const view=await renderHook(()=>useWatchTrack('patient','watch'));
  await waitFor(()=>expect(view.result.current.points).toHaveLength(2));
  expect(mockEq).not.toHaveBeenCalledWith('location_source','watch_gps');
  await act(async()=>{
    mockReceive?.({new:{...gps,id:'new-phone',location_source:'fused'}});
    mockReceive?.({new:{...gps,id:'foreign',elderly_id:'other'}});
    mockReceive?.({new:{...gps,id:'next-watch',latitude:10.001}});
  });
  expect(view.result.current.points.map(p=>p.id)).toEqual(['gps','phone','new-phone','next-watch']);
});
