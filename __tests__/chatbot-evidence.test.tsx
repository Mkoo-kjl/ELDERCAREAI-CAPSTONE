import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import ChatbotScreen from '@/app/(tabs)/chatbot';
import {supabase} from '@/src/lib/supabase';
const mockPush=jest.fn(),mockPersist=jest.fn(),mockSession={user:{id:'caregiver-1'}},mockPatient={elderly_id:'patient-1',full_name:'Maria'};
jest.mock('expo-router',()=>({useRouter:()=>({push:mockPush}),router:{push:(...args:any[])=>mockPush(...args)}}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:mockSession})}));
jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:mockPatient,vital:null})}));
jest.mock('@/src/lib/supabase',()=>({supabase:{from:jest.fn(),functions:{invoke:jest.fn()}}}));
const evidence={reference:'V1',record_id:'11111111-1111-4111-8111-111111111111',metric:'heart_rate_bpm',label:'Heart rate',value:118,unit:'BPM',measured_at:'2026-11-07T01:00:00Z',source:'galaxy_watch',origin:null};
beforeEach(()=>{
  mockPersist.mockResolvedValue({error:null});
  (supabase.from as jest.Mock).mockImplementation(table=>table==='ai_chatbot_sessions'?{insert:()=>({select:()=>({single:async()=>({data:{id:'chat'},error:null})})}),update:()=>({eq:async()=>({error:null})})}:{insert:mockPersist});
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({data:{reply:'The saved reading was 118 BPM [V1].',emotion:'neutral',hasHealthData:true,evidence:[evidence]},error:null});
});
test('displays original source links and persists the evidence alongside the answer',async()=>{
  await render(<ChatbotScreen/>);await fireEvent.changeText(screen.getByPlaceholderText('Ask about health or care…'),'Did my patient exceed 110 BPM?');await fireEvent.press(screen.getByLabelText('Send message'));
  await screen.findByText('SOURCE READINGS');
  await fireEvent.press(screen.getByLabelText('Open source V1: Heart rate 118 BPM'));
  expect(mockPush).toHaveBeenCalledWith({pathname:'/vital-evidence',params:{id:evidence.record_id,metric:'heart_rate_bpm'}});
  await waitFor(()=>expect(mockPersist).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({role:'assistant',evidence:[evidence]})])));
});
