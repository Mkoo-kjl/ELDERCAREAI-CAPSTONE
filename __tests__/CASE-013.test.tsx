import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ChoiceChips } from '@/src/components/ChoiceChips';
import { FormField } from '@/src/components/FormField';
import { MetricCard } from '@/src/components/MetricCard';

describe('Care UI components', () => {
  test('CASE-013 selecting a choice calls back with that option', async () => {
    const change = jest.fn();
    await render(<ChoiceChips label="Gender" options={['Male', 'Female', 'Other']} value="Male" onChange={change} />);
    fireEvent.press(screen.getByText('Female'));
    expect(change).toHaveBeenCalledWith('Female');
  });
});
