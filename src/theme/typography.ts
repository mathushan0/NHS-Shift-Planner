import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: undefined, // uses SF Pro (system default)
  android: 'Roboto',
  default: undefined,
});

export interface TypographyTokens {
  display: TextStyle;
  heading1: TextStyle;
  heading2: TextStyle;
  heading3: TextStyle;
  body1: TextStyle;
  body2: TextStyle;
  caption: TextStyle;
  button: TextStyle;
  tab: TextStyle;
}

export const typography: TypographyTokens = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    fontFamily,
  },
  heading1: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    fontFamily,
  },
  heading2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily,
  },
  heading3: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily,
  },
  body1: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    fontFamily,
  },
  body2: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontFamily,
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily,
  },
  tab: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily,
  },
};
