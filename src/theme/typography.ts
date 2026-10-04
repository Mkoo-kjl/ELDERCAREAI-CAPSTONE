import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import type { TextStyle } from 'react-native';

export const interFontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
};

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;

export const appTextStyle: TextStyle = {
  fontFamily: fontFamily.regular,
};

export const typeScale = {
  screenTitle: { fontFamily: fontFamily.semiBold, fontSize: 24, lineHeight: 30 },
  sectionTitle: { fontFamily: fontFamily.semiBold, fontSize: 18, lineHeight: 24 },
  cardTitle: { fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 16 },
} as const;

export function interFontForWeight(fontWeight?: TextStyle['fontWeight']) {
  switch (fontWeight) {
    case '500':
      return fontFamily.medium;
    case '600':
      return fontFamily.semiBold;
    case '700':
    case 'bold':
      return fontFamily.bold;
    case '800':
      return fontFamily.extraBold;
    case '900':
      return fontFamily.black;
    default:
      return fontFamily.regular;
  }
}
