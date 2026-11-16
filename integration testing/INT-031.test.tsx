import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';

import {Linking} from 'react-native';

import {EmergencyContacts,orderedEmergencyContacts} from '@/src/components/EmergencyContacts';

const mockRefresh=jest.fn(),mockUpdate=jest.fn();

const patient={elderly_id:'patient',full_name:'Test patient',emergency_contacts:[{role:'doctor',name:'Dr C',relationship:'Physician',phone:'09170000003'},{role:'family',name:'Family B',relationship:'Brother',phone:'09170000002'},{role:'caregiver',name:'Caregiver A',relationship:'Caregiver',phone:'09170000001'}]};

jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'owner'}}})}));

jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:patient,refresh:mockRefresh})}));

jest.mock('@/src/lib/supabase',()=>({supabase:{from:()=>{const query:any={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:null,error:null}),update:(payload:any)=>{mockUpdate(payload);return query;}};return query;}}}));

test('emergency action displays contact details and dials the selected caregiver without automatic calls',async()=>{
  const dial=jest.spyOn(Linking,'openURL').mockResolvedValue(true);await render(<EmergencyContacts/>);
  await fireEvent.press(screen.getByText('Emergency contacts · call for help'));
  await waitFor(()=>expect(screen.getByText('Caregiver A')).toBeTruthy());expect(dial).not.toHaveBeenCalled();
  expect(screen.getByText('Caregiver · Main SOS')).toBeTruthy();expect(screen.getByText('Family member')).toBeTruthy();expect(screen.getByText('Doctor')).toBeTruthy();
  await fireEvent.press(screen.getByText('Call caregiver'));expect(dial).toHaveBeenCalledWith('tel:09170000001');dial.mockRestore();
});

test('settings save the selected main SOS role with that patient’s dedicated contact numbers',async()=>{
  await render(<EmergencyContacts editable/>);await fireEvent.press(screen.getByText('Emergency contacts · main SOS number'));
  await waitFor(()=>expect(screen.getByDisplayValue('Dr C')).toBeTruthy());await fireEvent.press(screen.getByLabelText('Main SOS contact: Doctor'));
  await fireEvent.press(screen.getByText('Save emergency contacts'));
  await waitFor(()=>expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({primary_emergency_role:'doctor',emergency_contacts:expect.arrayContaining([expect.objectContaining({role:'doctor',phone:'09170000003'})])})));
});
