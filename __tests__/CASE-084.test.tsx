import {act,render,screen} from '@testing-library/react-native';
import {LiveLocationMap} from '@/src/components/LiveLocationMap';
const mockInject=jest.fn();let mockProps:any;
jest.mock('react-native-webview',()=>{
  const React=require('react');const {View}=require('react-native');
  return{WebView:React.forwardRef((props:any,ref:any)=>{mockProps=props;React.useImperativeHandle(ref,()=>({injectJavaScript:mockInject}));return <View testID="map-webview"/>;})};
});
const point={latitude:10,longitude:123,accuracy_m:5,measured_at:'2026-11-02T10:00:00Z',location_source:'watch_gps' as const};
beforeEach(()=>mockInject.mockClear());
test('retains its document and sends the newest fix when map initialization finishes',async()=>{
  const result=await render(<LiveLocationMap position={point} live/>);const source=mockProps.source;
  const next={...point,latitude:10.001,measured_at:'2026-11-02T10:00:02Z'};
  await result.rerender(<LiveLocationMap position={next} live/>);
  expect(mockProps.source).toBe(source);expect(mockInject).not.toHaveBeenCalled();
  await act(async()=>mockProps.onMessage({nativeEvent:{data:JSON.stringify({type:'ready'})}}));
  expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('10.001'));
  await result.rerender(<LiveLocationMap position={{...next,latitude:10.002}} live/>);
  expect(mockProps.source).toBe(source);expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('10.002'));
});
test('offers a follow control after the user drags the map',async()=>{
  await render(<LiveLocationMap position={point}/>);
  await act(async()=>mockProps.onMessage({nativeEvent:{data:JSON.stringify({type:'follow',value:false})}}));
  expect(screen.getByLabelText('Follow latest location')).toBeTruthy();
});
test('validates coordinate messages and permits selection only in edit mode',async()=>{
  const pick=jest.fn();const result=await render(<LiveLocationMap position={point} onCoordinateSelect={pick}/>);
  const message=(latitude:number)=>({nativeEvent:{data:JSON.stringify({type:'coordinate',value:{latitude,longitude:123}})}});
  await act(async()=>mockProps.onMessage(message(10)));expect(pick).not.toHaveBeenCalled();
  await result.rerender(<LiveLocationMap position={point} selecting onCoordinateSelect={pick}/>);
  await act(async()=>mockProps.onMessage(message(100)));expect(pick).not.toHaveBeenCalled();
  await act(async()=>mockProps.onMessage(message(10)));expect(pick).toHaveBeenCalledWith({latitude:10,longitude:123});
});
