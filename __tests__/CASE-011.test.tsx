import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ChoiceChips } from '@/src/components/ChoiceChips';
import { FormField } from '@/src/components/FormField';
import { MetricCard } from '@/src/components/MetricCard';

describe('Care UI components', () => {
  test('CASE-011 form field displays validation feedback beside its input', async () => {
    await render(<FormField label="Phone" value="123" onChangeText={jest.fn()} error="Enter a valid phone number." required />);
    expect(screen.getByLabelText('Phone')).toBeTruthy();
    expect(screen.getByText('Enter a valid phone number.')).toBeTruthy();
  });
});
