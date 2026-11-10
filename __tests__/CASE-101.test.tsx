import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {VitalDetailModal} from '@/src/components/VitalDetailModal';
import {supabase} from '@/src/lib/supabase';
import type {VitalLog} from '@/src/providers/HealthDataProvider';

jest.mock('@/src/lib/supabase',()=>({supabase:{functions:{invoke:jest.fn()}}}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));

const row=(bpm:number,patient='patient-a')=>({id:`reading-${bpm}`,elderly_id:patient,heart_rate_bpm:bpm,recorded_at:`2026-11-10T10:00:${bpm===80?'00':'10'}Z`,measurement_times:{heart_rate_bpm:`2026-11-10T10:00:${bpm===80?'00':'10'}Z`}} as VitalLog);
const props=(reading:VitalLog)=>({visible:true,metric:'heart_rate_bpm' as const,history:[reading],currentVital:reading,onClose:jest.fn()});

test('Elle stays readable through live readings; caregiver refreshes explicitly and patient changes reset it',async()=>{
  const invoke=jest.mocked(supabase.functions.invoke);
  invoke.mockResolvedValue({data:{reply:'Observation for 80 bpm.'},error:null} as never);
  const view=await render(<VitalDetailModal {...props(row(80))}/>);
  await screen.findByText('Observation for 80 bpm.');
  expect(invoke).toHaveBeenCalledTimes(1);
  await view.rerender(<VitalDetailModal {...props(row(90))}/>);
  expect(screen.getByText('Observation for 80 bpm.')).toBeTruthy();
  expect(screen.getByText(/New readings available/)).toBeTruthy();
  expect(invoke).toHaveBeenCalledTimes(1);
  invoke.mockResolvedValue({data:{reply:'Observation for 90 bpm.'},error:null} as never);
  await fireEvent.press(screen.getByLabelText('Refresh Elle insight'));
  await screen.findByText('Observation for 90 bpm.');
  expect(invoke).toHaveBeenCalledTimes(2);
  expect((invoke.mock.calls[1]?.[1]?.body as {message:string}).message).toContain('90 bpm');
  invoke.mockResolvedValue({data:{reply:'Patient B observation.'},error:null} as never);
  await view.rerender(<VitalDetailModal {...props(row(90,'patient-b'))}/>);
  await screen.findByText('Patient B observation.');
  await waitFor(()=>expect(invoke).toHaveBeenCalledTimes(3));
  expect(screen.queryByText('Observation for 90 bpm.')).toBeNull();
});
