import {render,screen} from '@testing-library/react-native';
import LocationScreen from '@/app/location';
const mockRefresh=jest.fn().mockResolvedValue(undefined);
let mockState:any,mockPoints:any[]=[],mockMap:any;
jest.mock('expo-router',()=>({useRouter:()=>({back:jest.fn()}),Redirect:()=>null}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'caregiver'}}})}));
jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:{elderly_id:'patient'},galaxyWatch:mockState,error:null,refresh:mockRefresh})}));
jest.mock('@/src/hooks/useWatchTrack',()=>({useWatchTrack:()=>({points:mockPoints,error:null})}));
jest.mock('@/src/hooks/useSafeZone',()=>({useSafeZone:()=>({zone:null,state:null,events:[],loading:false,error:null,refresh:mockRefresh})}));
jest.mock('@/src/components/SafeZonePanel',()=>({SafeZonePanel:()=>null}));
jest.mock('@/src/components/LiveLocationMap',()=>({LiveLocationMap:(props:any)=>{mockMap=props;return null;}}));
beforeEach(()=>{
  mockPoints=[];mockMap=undefined;
  mockState={device_id:'watch',elderly_id:'patient',latitude:10,longitude:123,accuracy_m:8,location_source:'watch_gps',
    gps_measured_at:new Date(Date.now()-120_000).toISOString(),received_at:new Date().toISOString(),monitoring:true};
});
test('a fresh route point moves the marker even when the live snapshot is older',async()=>{
  mockPoints=[{id:'new',device_id:'watch',elderly_id:'patient',latitude:10.001,longitude:123,accuracy_m:8,location_source:'watch_gps',measured_at:new Date().toISOString()}];
  await render(<LocationScreen/>);
  expect(mockMap.position.latitude).toBe(10.001);expect(mockMap.live).toBe(true);
  expect(screen.getByText('Receiving location updates')).toBeTruthy();
});
test('a successful upload does not label an old GPS fix as streaming',async()=>{
  await render(<LocationScreen/>);
  expect(mockMap.live).toBe(false);
  expect(screen.getByText('Watch connected · waiting for location')).toBeTruthy();
  expect(screen.getByText(/The watch is reaching the server, but it has no fresh location estimate/)).toBeTruthy();
});
test('a fused estimate is displayed with a paired-phone source explanation',async()=>{
  mockState.location_source='fused';mockState.gps_measured_at=new Date().toISOString();
  await render(<LocationScreen/>);
  expect(mockMap.position.location_source).toBe('fused');expect(mockMap.live).toBe(true);
  expect(screen.getByText(/Fused location \(may use paired phone\)/)).toBeTruthy();
});
