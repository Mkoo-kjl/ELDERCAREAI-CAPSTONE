import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ChoiceChips } from '@/src/components/ChoiceChips';
import { FormField } from '@/src/components/FormField';
import { MetricCard } from '@/src/components/MetricCard';

describe('Care UI components', () => {
  test('CASE-025 vital card presents the patient reading and timestamp', async () => {
    await render(<MetricCard icon="heart" title="Heart rate" value="78" unit="bpm" timestamp="Read 2m ago" color="#D44" />);
    expect(screen.getByText('Heart rate')).toBeTruthy();
    expect(screen.getByText('78')).toBeTruthy();
    expect(screen.getByText('bpm')).toBeTruthy();
    expect(screen.getByText('Read 2m ago')).toBeTruthy();
  });
});
