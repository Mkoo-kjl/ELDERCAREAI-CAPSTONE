import {act,render,screen,waitFor} from '@testing-library/react-native';
import {Text} from 'react-native';
import {SamsungHealthProvider,useSamsungHealth} from '@/src/providers/SamsungHealthProvider';
import {restoreSamsungHealthLink,syncSamsungHealth} from '@/src/lib/samsung-health-sync';

let mockUser='a';const mockRefresh=jest.fn(async()=>{});
jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:mockUser}}})}));
jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:{elderly_id:`patient-${mockUser}`},refresh:mockRefresh})}));
jest.mock('@/src/components/AppText',()=>({AppText:require('react-native').Text}));
jest.mock('@/modules/samsung-health',()=>({__esModule:true,default:{requestAccess:jest.fn(),sources:jest.fn()}}));
jest.mock('@/src/lib/samsung-health-sync',()=>({restoreSamsungHealthLink:jest.fn(),syncSamsungHealth:jest.fn(),connectSamsungHealth:jest.fn(),disconnectSamsungHealth:jest.fn()}));
function Probe(){const health=useSamsungHealth();return <><Text>{health.connected?'Connected':'Disconnected'}</Text><Text>{health.status}</Text></>;}
const link=(user:string)=>({userId:user,elderlyId:`patient-${user}`,sourceId:`watch-${user}`,sourceName:`Watch ${user}`,sleep:true,oxygen:false});
beforeEach(()=>{jest.clearAllMocks();mockUser='a';(restoreSamsungHealthLink as jest.Mock).mockImplementation(async(user:string)=>link(user));(syncSamsungHealth as jest.Mock).mockResolvedValue(0);});

test('restores the signed-in patient’s connection and distinguishes no new records from missing history',async()=>{
  await render(<SamsungHealthProvider><Probe/></SamsungHealthProvider>);
  await waitFor(()=>expect(screen.getByText('Connected')).toBeTruthy());
  await waitFor(()=>expect(screen.getByText(/Watch a: no new records; previously saved readings are still available/)).toBeTruthy());
  expect(restoreSamsungHealthLink).toHaveBeenCalledWith('a','patient-a');
  expect(syncSamsungHealth).toHaveBeenCalledWith('a','patient-a');
  expect(mockRefresh).toHaveBeenCalledWith(false,true);
});

test('a late restore from the logged-out provider cannot sync or replace the new account’s status',async()=>{
  let finishA!:(value:unknown)=>void;
  const pending=new Promise(resolve=>{finishA=resolve;});
  (restoreSamsungHealthLink as jest.Mock).mockImplementation(async(user:string)=>user==='a'?pending:link(user));
  const view=await render(<SamsungHealthProvider key={mockUser}><Probe/></SamsungHealthProvider>);
  await waitFor(()=>expect(restoreSamsungHealthLink).toHaveBeenCalledWith('a','patient-a'));
  mockUser='b';await view.rerender(<SamsungHealthProvider key={mockUser}><Probe/></SamsungHealthProvider>);
  await waitFor(()=>expect(screen.getByText(/Watch b: no new records/)).toBeTruthy());
  await act(async()=>{finishA(link('a'));});
  expect(syncSamsungHealth).not.toHaveBeenCalledWith('a','patient-a');
  expect(screen.queryByText(/Watch a:/)).toBeNull();
  expect(screen.getByText(/Watch b: no new records/)).toBeTruthy();
});
