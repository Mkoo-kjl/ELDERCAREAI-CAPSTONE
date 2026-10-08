import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import type { TextStyle } from 'react-native';

export const appFontAssets = {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
};

export const fontFamily = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
} as const;

export const appTextStyle: TextStyle = {
  fontFamily: fontFamily.regular,
};

export const typeScale = {
  display: { fontFamily: fontFamily.extraBold, fontSize: 34, lineHeight: 40 },
  screenTitle: { fontFamily: fontFamily.extraBold, fontSize: 28, lineHeight: 35 },
  sectionTitle: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 27 },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21 },
  subhead: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 16 },
  eyebrow: { fontFamily: fontFamily.bold, fontSize: 10, lineHeight: 15 },
  metric: { fontFamily: fontFamily.extraBold, fontSize: 28, lineHeight: 35 },
  button: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20 },
} as const;

export function appFontForWeight(fontWeight?: TextStyle['fontWeight']) {
  switch (fontWeight) {
    case '500':
      return fontFamily.medium;
    case '600':
      return fontFamily.semiBold;
    case '700':
    case 'bold':
      return fontFamily.bold;
    case '800':
    case '900':
      return fontFamily.extraBold;
    default:
      return fontFamily.regular;
  }
}
