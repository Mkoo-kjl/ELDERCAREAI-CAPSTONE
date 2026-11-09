import {fireEvent,render,screen} from '@testing-library/react-native';

import {AutomaticVitalAlerts} from '@/src/components/AutomaticVitalAlerts';

import {PrescriptionEntryCard} from '@/src/components/PrescriptionEntryCard';

jest.mock('@/src/lib/notifications',()=>({openHealthSoundSettings:jest.fn().mockResolvedValue(undefined)}));

test('automatic vital details start collapsed and expand without hiding the control',async()=>{
  await render(<AutomaticVitalAlerts/>);
  expect(screen.getByLabelText('Automatic vital alerts').props.accessibilityState.expanded).toBe(false);
  expect(screen.queryByText(/Heart rate: below/)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Automatic vital alerts'));
  expect(screen.getByLabelText('Automatic vital alerts').props.accessibilityState.expanded).toBe(true);
  expect(screen.getByText(/Heart rate: below 50 or above 110 BPM/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Automatic vital alerts'));
  expect(screen.queryByText(/Heart rate: below/)).toBeNull();
});
