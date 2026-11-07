import {render,screen} from '@testing-library/react-native';
import VitalEvidenceScreen from '@/app/vital-evidence';
import {supabase} from '@/src/lib/supabase';
const mockId='11111111-1111-4111-8111-111111111111',mockPatient={elderly_id:'patient-1',full_name:'Maria'},mockSession={user:{id:'caregiver-1'}},mockFilters=jest.fn();
let mockReading:any;
jest.mock('expo-router',()=>({useLocalSearchParams:()=>({id:mockId,metric:'heart_rate_bpm'}),Stack:{Screen:()=>null},Redirect:()=>null}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({bottom:0})}));
jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:mockSession})}));
jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:mockPatient})}));
jest.mock('@/src/lib/supabase',()=>({supabase:{from:jest.fn()}}));
beforeEach(()=>{mockReading={id:mockId,heart_rate_bpm:118,source:'galaxy_watch',recorded_at:'2026-11-07T01:00:00Z'};(supabase.from as jest.Mock).mockImplementation(()=>{const q:any={select:()=>q,eq:(...args:any[])=>{mockFilters(...args);return q;},maybeSingle:async()=>({data:mockReading,error:null})};return q;});});
test('reads the source by record and active patient rather than accepting arbitrary patient IDs',async()=>{
  await render(<VitalEvidenceScreen/>);await screen.findByText('Saved Galaxy Watch record');
  expect(mockFilters).toHaveBeenCalledWith('elderly_id','patient-1');expect(mockFilters).toHaveBeenCalledWith('id',mockId);expect(screen.getByText(/Record ID:/)).toBeTruthy();
});
test('an unavailable source does not invent a vital reading',async()=>{
  mockReading=null;await render(<VitalEvidenceScreen/>);await screen.findByText('This reading is unavailable for the signed-in patient.');expect(screen.queryByText('Saved Galaxy Watch record')).toBeNull();
});
