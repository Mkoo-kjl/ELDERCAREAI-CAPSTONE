import {useState} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react-native';
import {AppointmentLocationField} from '@/src/components/AppointmentLocationField';
import {decodeAppointmentLocation,encodeAppointmentLocation} from '@/src/lib/appointment-location';

let mockMapProps:any;
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
jest.mock('react-native-webview',()=>({WebView:(props:any)=>{mockMapProps=props;return null;}}));
const point={latitude:10.3157,longitude:123.8854};
function Field({initial='Clinic'}) {
  const [value,setValue]=useState(initial);
  return <AppointmentLocationField value={value} onChange={setValue}/>;
}
async function message(type:string,value?:unknown) {
  await act(async()=>mockMapProps.onMessage({nativeEvent:{data:JSON.stringify({channel:'appointment-map',type,value})}}));
}

test('manual addresses remain editable and selected map pins survive reopening',async()=>{
  await render(<Field/>);
  await fireEvent.changeText(screen.getByLabelText('Location'),'Family clinic');
  await fireEvent.press(screen.getByLabelText('Open appointment location map'));
  expect(screen.getByText('Use this location')).toBeDisabled();
  await message('ready');
  await message('coordinate',point);
  await fireEvent.press(screen.getByText('Use this location'));
  expect(screen.getByText(/Map pin saved/)).toBeTruthy();
  expect(screen.getByLabelText('Location').props.value).toBe('Family clinic');
  await fireEvent.press(screen.getByLabelText('Open appointment location map'));
  expect(mockMapProps.source.html).toContain('"selected":{"latitude":10.3157,"longitude":123.8854}');
  await message('coordinate',{latitude:11,longitude:124});
  await fireEvent.press(screen.getByText('Cancel'));
  expect(screen.getByText(/10.31570, 123.88540/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Remove map pin'));
  expect(screen.getByLabelText('Location').props.value).toBe('Family clinic');
  expect(screen.queryByText(/Map pin saved/)).toBeNull();
});

test('invalid map messages are ignored, errors offer retry and manual entry stays available',async()=>{
  await render(<Field/>);
  await fireEvent.press(screen.getByText('Open map'));
  await message('coordinate',{latitude:95,longitude:123});
  expect(screen.getByText('Use this location')).toBeDisabled();
  await message('error');
  expect(screen.getByText(/Map unavailable/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Retry map'));
  expect(screen.getByText('Loading map…')).toBeTruthy();
  await fireEvent.press(screen.getByText('Cancel'));
  await fireEvent.changeText(screen.getByLabelText('Location'),'Manual hospital address');
  expect(screen.getByLabelText('Location').props.value).toBe('Manual hospital address');
});

test('stored locations round-trip without changing existing text-only records',()=>{
  const encoded=encodeAppointmentLocation('Family clinic',point);
  expect(decodeAppointmentLocation(encoded)).toEqual({label:'Family clinic',point});
  expect(decodeAppointmentLocation('Old clinic address')).toEqual({label:'Old clinic address',point:null});
  expect(decodeAppointmentLocation(null)).toEqual({label:'',point:null});
  expect(encodeAppointmentLocation(' Clinic ',null)).toBe('Clinic');
});
