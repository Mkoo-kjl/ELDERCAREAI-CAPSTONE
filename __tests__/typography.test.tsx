import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { fontFamily, typeScale } from '@/src/theme/typography';

describe('app typography', () => {
  it('uses Manrope by default and allows a named weight to override it', async () => {
    const { getByText } = await render(
      <>
        <AppText>Care details</AppText>
        <AppText style={typeScale.sectionTitle}>Health vitals</AppText>
      </>,
    );

    expect(StyleSheet.flatten(getByText('Care details').props.style)).toMatchObject({ fontFamily: fontFamily.regular });
    expect(StyleSheet.flatten(getByText('Health vitals').props.style)).toMatchObject(typeScale.sectionTitle);
  });
});
