import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';

import {MedicationEditor} from '@/src/components/MedicationEditor';

import {supabase} from '@/src/lib/supabase';

import {uploadCareFile} from '@/src/lib/care-files';

const mockInsert=jest.fn(),mockSingle=jest.fn().mockResolvedValue({data:{id:'new-med'},error:null});

jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'owner'}}})}));

jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:{elderly_id:'patient',full_name:'Test patient'}})}));

jest.mock('@/src/lib/supabase',()=>({supabase:{from:jest.fn(()=>({insert:mockInsert}))}}));

jest.mock('@/src/lib/watch-push',()=>({isCarePushRegistered:jest.fn().mockResolvedValue(false)}));

jest.mock('@/src/lib/notifications',()=>({cancelCareNotifications:jest.fn(),scheduleMedicationNotifications:jest.fn().mockResolvedValue(true)}));

jest.mock('@/src/lib/care-files',()=>({uploadCareFile:jest.fn().mockResolvedValue('owner/patient/medication-photo.jpg'),careFileUrl:jest.fn()}));

jest.mock('@/src/components/CareImage',()=>({CareImage:()=>null,CareImagePicker:({onChange}:any)=>{const {Pressable,Text}=require('react-native');return <Pressable onPress={()=>onChange({uri:'file:///photo.jpg',mimeType:'image/jpeg'})}><Text>Select medication photo</Text></Pressable>;}}));

jest.mock('@/src/components/PickerModal',()=>({PickerModal:()=>null}));

const draft={medication_name:'OCR uncertain text',dosage:'5 mg',frequency:'Daily',times_of_day:['08:00'],instructions:'Follow written prescription',start_date:'2026-11-08',end_date:'2026-11-15',prescribed_by:'Written prescriber',original_text:'Original prescription excerpt',uncertainties:['Check the name']};

beforeEach(()=>{mockInsert.mockReturnValue({select:()=>({single:mockSingle})});mockSingle.mockResolvedValue({data:{id:'new-med'},error:null});});

test('failed saves preserve the caregiver draft for correction and retry',async()=>{
  mockSingle.mockResolvedValue({data:null,error:new Error('Connection lost')});
  await render(<MedicationEditor visible item={null} onClose={()=>{}} onSaved={()=>{}}/>);
  await fireEvent.changeText(screen.getByLabelText('Medication name'),'Keep my work');await fireEvent.press(screen.getByText('Save'));
  await waitFor(()=>expect(screen.getByText('Connection lost')).toBeTruthy());expect(screen.getByDisplayValue('Keep my work')).toBeTruthy();
});
