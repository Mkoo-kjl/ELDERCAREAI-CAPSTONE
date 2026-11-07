import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {SafeZonePanel} from '@/src/components/SafeZonePanel';
jest.mock('expo-router',()=>({router:{push:jest.fn()}}));
const fix={latitude:10,longitude:123,accuracy_m:8,measured_at:new Date().toISOString(),location_source:'watch_gps' as const};
function care(save=jest.fn().mockResolvedValue(undefined)){return{identity:'caregiver:patient',zone:null,state:null,events:[],loading:false,error:null,saving:false,save,refresh:jest.fn()};}
test('sets a safe zone from watch GPS and saves only on explicit confirmation',async()=>{
  const state=care();await render(<SafeZonePanel care={state} fix={fix} picked={null} onPreview={jest.fn()} onPickRequest={jest.fn()}/>);
  await fireEvent.press(screen.getByLabelText('Set up safe zone'));expect(state.save).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Safe-zone name'),'Family home');await fireEvent.press(screen.getByLabelText('Save and enable safe zone'));
  expect(state.save).toHaveBeenCalledWith({name:'Family home',latitude:10,longitude:123,radius_m:20,enabled:true});
});
test('does not lose a drafted zone when saving fails',async()=>{
  const state=care(jest.fn().mockRejectedValue(new Error('Connection lost.')));
  await render(<SafeZonePanel care={state} fix={fix} picked={null} onPreview={jest.fn()} onPickRequest={jest.fn()}/>);await fireEvent.press(screen.getByLabelText('Set up safe zone'));
  await fireEvent.changeText(screen.getByLabelText('Safe-zone name'),'Family home');await fireEvent.press(screen.getByLabelText('Save and enable safe zone'));
  await waitFor(()=>expect(screen.getByText('Connection lost.')).toBeTruthy());expect(screen.getByLabelText('Safe-zone name').props.value).toBe('Family home');
});
test('cannot use a stale or fused position as the patient’s GPS center',async()=>{
  const state=care();await render(<SafeZonePanel care={state} fix={{...fix,location_source:'fused'}} picked={null} onPreview={jest.fn()} onPickRequest={jest.fn()}/>);
  await fireEvent.press(screen.getByLabelText('Set up safe zone'));await fireEvent.press(screen.getByLabelText('Save and enable safe zone'));
  expect(state.save).not.toHaveBeenCalled();expect(screen.getByLabelText('Safe-zone latitude').props.value).toBe('');
});

test('accepts the 50 m preset, rejects smaller radii, and preserves saved zone sizes',async()=>{
  const state={...care(),zone:{elderly_id:'patient',caregiver_id:'caregiver',name:'Home',latitude:10,longitude:123,radius_m:300,enabled:true,revision:'revision',updated_at:fix.measured_at}};
  await render(<SafeZonePanel care={state} fix={fix} picked={null} onPreview={jest.fn()} onPickRequest={jest.fn()}/>);
  await fireEvent.press(screen.getByLabelText('Edit safe zone'));
  expect(screen.getByLabelText('Safe-zone radius').props.value).toBe('300');
  await fireEvent.changeText(screen.getByLabelText('Safe-zone radius'),'9');
  await fireEvent.press(screen.getByLabelText('Save and enable safe zone'));
  expect(state.save).not.toHaveBeenCalled();expect(screen.getByText('Choose a whole-number radius from 10 to 5,000 meters.')).toBeTruthy();
  await fireEvent.press(screen.getByText('50 m'));await fireEvent.press(screen.getByLabelText('Save and enable safe zone'));
  expect(state.save).toHaveBeenCalledWith(expect.objectContaining({radius_m:50}));
});

test('small zones need a more accurate GPS center and stale fixes are unavailable',async()=>{
  const state=care();const props={care:state,fix:{...fix,accuracy_m:26},picked:null,onPreview:jest.fn(),onPickRequest:jest.fn()};
  const result=await render(<SafeZonePanel {...props}/>);
  await fireEvent.press(screen.getByLabelText('Set up safe zone'));
  expect(screen.getByLabelText('Safe-zone latitude').props.value).toBe('');
  await fireEvent.press(screen.getByLabelText('Use watch GPS'));
  expect(screen.getByLabelText('Safe-zone latitude').props.value).toBe('');
  await fireEvent.press(screen.getByText('100 m'));await fireEvent.press(screen.getByLabelText('Use watch GPS'));
  expect(screen.getByLabelText('Safe-zone latitude').props.value).toBe('10');
  await result.rerender(<SafeZonePanel {...props} fix={{...fix,measured_at:new Date(Date.now()-120_000).toISOString()}}/>);
  await fireEvent.changeText(screen.getByLabelText('Safe-zone latitude'),'');await fireEvent.press(screen.getByLabelText('Use watch GPS'));
  expect(screen.getByLabelText('Safe-zone latitude').props.value).toBe('');
});

test('explains why a small safe zone cannot confirm imprecise watch GPS',async()=>{
  const state={...care(),zone:{elderly_id:'patient',caregiver_id:'caregiver',name:'Home',latitude:10,longitude:123,radius_m:50,enabled:true,revision:'revision',updated_at:fix.measured_at}};
  await render(<SafeZonePanel care={state} fix={{...fix,accuracy_m:40}} picked={null} onPreview={jest.fn()} onPickRequest={jest.fn()}/>);
  expect(screen.getByText(/This 50 m zone needs watch GPS accuracy of 25 m or better/)).toBeTruthy();
  expect(screen.getByText(/The circle stays centered on your saved place/)).toBeTruthy();
});

test('offers a 10 m zone with its stricter GPS limit while retaining a valid center',async()=>{
  const state=care();await render(<SafeZonePanel care={state} fix={{...fix,accuracy_m:3}} picked={null} onPreview={jest.fn()} onPickRequest={jest.fn()}/>);
  await fireEvent.press(screen.getByLabelText('Set up safe zone'));
  expect(screen.getByLabelText('Safe-zone radius').props.value).toBe('20');
  await fireEvent.press(screen.getByText('10 m'));
  expect(screen.getByText('Watch GPS needs accuracy of 5 m or better for this radius.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Save and enable safe zone'));
  expect(state.save).toHaveBeenCalledWith(expect.objectContaining({radius_m:10,latitude:10,longitude:123}));
});
