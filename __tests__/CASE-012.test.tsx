import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ChoiceChips } from '@/src/components/ChoiceChips';
import { FormField } from '@/src/components/FormField';
import { MetricCard } from '@/src/components/MetricCard';

describe('Care UI components', () => {
  test('CASE-012 authenticated email field cannot be edited', async () => {
    const change = jest.fn();
    await render(<FormField label="Authenticated email" value="caregiver@example.com" editable={false} onChangeText={change} />);
    expect(screen.getByLabelText('Authenticated email').props.editable).toBe(false);
  });
});
