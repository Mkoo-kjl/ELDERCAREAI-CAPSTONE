import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {MedicationEditor} from '@/src/components/MedicationEditor';
import {supabase} from '@/src/lib/supabase';
import {localDateKey} from '@/src/lib/care-time';
import type {MedicationRecord} from '@/src/lib/medication';

jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'caregiver-1'}}})}));
jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:{elderly_id:'patient-1',full_name:'Maria'}})}));
jest.mock('@/src/lib/supabase',()=>({supabase:{from:jest.fn()}}));
jest.mock('@/src/components/CareImage',()=>({CareImage:()=>null,CareImagePicker:()=>null}));
jest.mock('@/src/lib/care-files',()=>({uploadCareFile:jest.fn(),careFileUrl:jest.fn()}));
jest.mock('@/src/lib/watch-push',()=>({isCarePushRegistered:jest.fn(async()=>true)}));
jest.mock('@/src/lib/notifications',()=>({cancelCareNotifications:jest.fn(),scheduleMedicationNotifications:jest.fn()}));

test('an unreadable medication start date can be replaced and saved as a valid date key',async()=>{
  const write=jest.fn(),saved=jest.fn();
  const query:{update:jest.Mock;eq:jest.Mock;select:jest.Mock;single:jest.Mock}={update:jest.fn((payload)=>{write(payload);return query;}),eq:jest.fn(()=>query),select:jest.fn(()=>query),single:jest.fn(async()=>({data:{id:'med-1'},error:null}))};
  (supabase.from as jest.Mock).mockReturnValue(query);
  const item={id:'med-1',medication_name:'Prescribed medication',frequency:'Daily',times_of_day:['08:25'],start_date:'Nov. 14',end_date:null,timezone:'Asia/Manila'} as MedicationRecord;
  await render(<MedicationEditor visible item={item} onClose={jest.fn()} onSaved={saved}/>);
  expect(screen.getByText(/date could not be read/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Save'));
  expect(write).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Choose medication start date'));
  const today=new Date();
  await fireEvent.press(screen.getByLabelText(`${today.toLocaleString('en-US',{month:'long'})} ${today.getDate()}, ${today.getFullYear()}`));
  await fireEvent.press(screen.getByText('Done'));
  await fireEvent.press(screen.getByText('Save'));
  await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));
  expect(write).toHaveBeenCalledWith(expect.objectContaining({start_date:localDateKey(today),times_of_day:['08:25'],elderly_id:'patient-1',caregiver_id:'caregiver-1'}));
});

test('end date rejects days before start, and a new start after end cannot be saved',async()=>{
  const item={id:'med-1',medication_name:'Medicine',frequency:'Daily',times_of_day:['08:00'],start_date:'2026-11-14',end_date:'2026-11-18'} as MedicationRecord;
  await render(<MedicationEditor visible item={item} onClose={jest.fn()} onSaved={jest.fn()}/>);
  await fireEvent.press(screen.getByLabelText('Choose medication end date'));
  expect(screen.getByLabelText('November 13, 2026')).toBeDisabled();
  await fireEvent.press(screen.getByText('Done'));
  await fireEvent.press(screen.getByLabelText('Choose medication start date'));
  await fireEvent.press(screen.getByLabelText('November 19, 2026'));
  await fireEvent.press(screen.getByText('Done'));
  await fireEvent.press(screen.getByText('Save'));
  expect(screen.getByText(/end must be on or after start/)).toBeTruthy();
});
