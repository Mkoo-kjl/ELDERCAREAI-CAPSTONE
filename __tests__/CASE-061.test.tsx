import {fireEvent,render,screen} from '@testing-library/react-native';

import {AutomaticVitalAlerts} from '@/src/components/AutomaticVitalAlerts';

import {PrescriptionEntryCard} from '@/src/components/PrescriptionEntryCard';

jest.mock('@/src/lib/notifications',()=>({openHealthSoundSettings:jest.fn().mockResolvedValue(undefined)}));

test('prescription entry includes Elle and opens the optional review flow',async()=>{
  const open=jest.fn();await render(<PrescriptionEntryCard onPress={open}/>);
  expect(screen.getByLabelText('Elle, your care assistant')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Scan or upload a prescription with Elle'));
  expect(open).toHaveBeenCalledTimes(1);expect(screen.getByText(/Review Elle’s draft before saving/)).toBeTruthy();
});
