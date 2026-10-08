import { Text as NativeText, type TextProps } from 'react-native';

import { appTextStyle } from '@/src/theme/typography';

export function AppText({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[appTextStyle, style]} />;
}
