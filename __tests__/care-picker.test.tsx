import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { PickerModal } from '@/src/components/PickerModal';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

describe('Care date and time picker', () => {
  test('jumps directly to an older birth year and selects a calendar day', async () => {
    const onChange = jest.fn();
    await render(<PickerModal visible mode="date" value={new Date(1950, 5, 15, 12)} onChange={onChange} onClose={jest.fn()} minDate={new Date(1900, 0, 1)} maxDate={new Date()} />);
    await fireEvent.press(screen.getByText('1950'));
    await fireEvent.press(screen.getByLabelText('1948'));
    await fireEvent.press(screen.getByLabelText('June 1, 1948'));
    expect(onChange).toHaveBeenCalledWith(new Date(1948, 5, 1, 12));
  });

  test('sets hour, minute and AM/PM without typing', async () => {
    function PickerHarness() {
      const [value, setValue] = useState(new Date(2026, 9, 9, 8, 0));
      return <PickerModal visible mode="time" value={value} onChange={setValue} onClose={jest.fn()} />;
    }
    await render(<PickerHarness />);
    await fireEvent.press(screen.getByLabelText('5'));
    await fireEvent.press(screen.getByLabelText('30'));
    await fireEvent.press(screen.getByLabelText('PM'));
    expect(screen.getByText(/5:30\s*PM/i)).toBeTruthy();
  });
});
