jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
import {useState} from 'react';
import {Text} from 'react-native';
import {fireEvent,render,screen} from '@testing-library/react-native';
import {AppointmentLocationField} from '@/src/components/AppointmentLocationField';
import {searchAppointmentPlaces} from '@/src/lib/appointment-places';
jest.mock('@/src/lib/appointment-places',()=>({searchAppointmentPlaces:jest.fn()}));
function Field(){const [value,setValue]=useState('');return <><AppointmentLocationField value={value} onChange={setValue}/><Text testID="saved-location">{value}</Text></>;}
test('manual multiword entry works and a hospital search saves its selected name and map pin only on confirmation',async()=>{
  jest.mocked(searchAppointmentPlaces).mockResolvedValueOnce([{label:'Fixture Hospital, Cebu',latitude:10.3,longitude:123.9}]);
  await render(<Field/>);
  await fireEvent.changeText(screen.getByLabelText('Location'),'City ');expect(screen.getByDisplayValue('City ')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Location'),'City Hospital');
  await fireEvent.press(screen.getByLabelText('Open appointment location map'));
  await fireEvent.changeText(screen.getByLabelText('Search hospital or place'),'Cebu hospital');await fireEvent.press(screen.getByText('Search places'));
  await fireEvent.press(await screen.findByText('Fixture Hospital, Cebu'));
  expect(screen.getByTestId('saved-location').props.children).toBe('City Hospital');
  await fireEvent.press(screen.getByText('Use this location'));
  expect(screen.getByTestId('saved-location').props.children).toContain('Fixture Hospital, Cebu');
  expect(screen.getByTestId('saved-location').props.children).toContain('mlat=10.300000&mlon=123.900000');
});
test('place search failure keeps manual entry and map selection available',async()=>{
  jest.mocked(searchAppointmentPlaces).mockRejectedValueOnce(new Error('Search unavailable. Use the map or manual entry.'));
  await render(<Field/>);await fireEvent.press(screen.getByLabelText('Open appointment location map'));
  await fireEvent.changeText(screen.getByLabelText('Search hospital or place'),'Some hospital');await fireEvent.press(screen.getByText('Search places'));
  await screen.findByText('Search unavailable. Use the map or manual entry.');
  await fireEvent(screen.getByTestId('appointment-map'),'message',{nativeEvent:{data:JSON.stringify({channel:'appointment-map',type:'coordinate',value:{latitude:10,longitude:123}})}});
  await fireEvent.changeText(screen.getByLabelText('Selected destination name or address'),'Manual clinic');await fireEvent.press(screen.getByText('Use this location'));
  expect(screen.getByTestId('saved-location').props.children).toContain('Manual clinic');
});
