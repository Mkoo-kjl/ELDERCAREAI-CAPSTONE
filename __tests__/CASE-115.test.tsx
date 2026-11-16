import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {Alert,Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {PrescriptionImport} from '@/src/components/PrescriptionImport';
jest.mock('react-native-safe-area-context',()=>({...jest.requireActual('react-native-safe-area-context'),useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
jest.mock('expo-image-picker',()=>({requestMediaLibraryPermissionsAsync:jest.fn().mockResolvedValue({granted:true}),launchImageLibraryAsync:jest.fn().mockResolvedValue({canceled:false,assets:[{uri:'file:///fixture.jpg',mimeType:'image/jpeg'}]})}));
jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'owner'}}})}));
jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:{elderly_id:'patient'}})}));
const mockUpload=jest.fn().mockResolvedValue('owner/patient/prescription-fixture.jpg');
jest.mock('@/src/lib/care-files',()=>({uploadCareFile:(...args:unknown[])=>mockUpload(...args)}));
const mockInvoke=jest.fn().mockResolvedValue({data:{medications:[{medication_name:'',dosage:'',original_text:'Partly readable',warnings:['Name and dose unit need checking.']}]},error:null});
jest.mock('@/src/lib/supabase',()=>({supabase:{functions:{invoke:(...args:unknown[])=>mockInvoke(...args)}}}));

test('optional crop preserves image quality and extraction waits for consent, retaining warnings and blank fields',async()=>{
  const draft=jest.fn(),alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{}),platform=jest.replaceProperty(Platform,'OS','android');
  try{
    await render(<PrescriptionImport visible onClose={jest.fn()} onDrafts={draft}/>);
    await fireEvent.press(screen.getByLabelText('Crop and rotate prescription before upload'));
    await fireEvent.press(screen.getByText('Select image'));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({allowsEditing:true,quality:1}));
    expect((ImagePicker.launchImageLibraryAsync as jest.Mock).mock.calls[0][0].aspect).toBeUndefined();
    expect(mockUpload).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Extract editable drafts'));
    expect(mockInvoke).not.toHaveBeenCalled();
    const buttons=alert.mock.calls.at(-1)?.[2];
    const confirm=buttons?.find(button=>button.text==='Extract draft');
    await act(async()=>confirm?.onPress?.());
    await waitFor(()=>expect(draft).toHaveBeenCalled());
    expect(draft.mock.calls[0][0][0]).toMatchObject({medication_name:'',dosage:'',start_date:'',times_of_day:[],uncertainties:['Name and dose unit need checking.']});
  }finally{alert.mockRestore();platform.restore();}
});
