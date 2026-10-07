import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ChoiceChips } from '@/src/components/ChoiceChips';
import { FormField } from '@/src/components/FormField';
import { MetricCard } from '@/src/components/MetricCard';

describe('Care UI components', () => {
  test('CASE-027 full-width vital card keeps a readable row width', async () => {
    await render(<MetricCard icon="moon" title="Sleep" value="7.0" unit="hours" timestamp="Read today" color="#748" fullWidth />);
    const style = StyleSheet.flatten(screen.getByRole('button').props.style);
    expect(style.width).toBe('100%');
  });
});
