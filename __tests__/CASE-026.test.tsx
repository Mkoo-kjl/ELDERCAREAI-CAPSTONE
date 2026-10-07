import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ChoiceChips } from '@/src/components/ChoiceChips';
import { FormField } from '@/src/components/FormField';
import { MetricCard } from '@/src/components/MetricCard';

describe('Care UI components', () => {
  test('CASE-026 vital card opens the reading detail when tapped', async () => {
    const open = jest.fn();
    await render(<MetricCard icon="heart" title="Heart rate" value="78" unit="bpm" timestamp="Read 2m ago" color="#D44" onPress={open} />);
    fireEvent.press(screen.getByRole('button'));
    expect(open).toHaveBeenCalledTimes(1);
  });
});
