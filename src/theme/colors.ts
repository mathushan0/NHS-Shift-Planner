// NHS Brand Colours — Light Mode
export const NHSColors = {
  // Primary brand
  nhsBlue: '#005EB8',
  nhsDarkBlue: '#003087',
  nhsLightBlue: '#41B6E6',
  nhsAquaGreen: '#00A499',
  nhsRed: '#DA291C',
  nhsYellow: '#FFB81C',
  nhsMidGrey: '#768692',
  nhsPaleGrey: '#E8EDEE',
  nhsBlack: '#231F20',
  nhsWhite: '#FFFFFF',

  // Shift type colours
  shiftLongDay: '#005EB8',
  shiftNight: '#003087',
  shiftShortDay: '#41B6E6',
  shiftLate: '#768692',
  shiftAnnualLeave: '#00A499',
  shiftSick: '#DA291C',
  shiftBankHoliday: '#FFB81C',
  shiftRest: '#E8EDEE',
} as const;

export interface ColorTokens {
  // Brand
  primary: string;
  primaryDark: string;
  primaryLight: string;

  // Semantic
  success: string;
  warning: string;
  error: string;
  info: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  textInverse: string;

  // Surfaces
  surface1: string;
  surface2: string;
  surface3: string;
  border: string;

  // Tab bar
  tabActive: string;
  tabInactive: string;

  // Backgrounds
  screenBackground: string;
}

export const lightColors: ColorTokens = {
  primary: '#005EB8',
  primaryDark: '#003087',
  primaryLight: '#41B6E6',

  success: '#00A499',
  warning: '#FFB81C',
  error: '#DA291C',
  info: '#41B6E6',

  textPrimary: '#231F20',
  textSecondary: '#425563',
  textDisabled: '#768692',
  textInverse: '#FFFFFF',

  surface1: '#FFFFFF',
  surface2: '#F0F4F5',
  surface3: '#E8EDEE',
  border: '#D8DDE0',

  tabActive: '#005EB8',
  tabInactive: '#768692',

  screenBackground: '#F0F4F5',
};

export const darkColors: ColorTokens = {
  primary: '#4DA3FF',
  primaryDark: '#2D7DD2',
  primaryLight: '#41B6E6',

  success: '#00C4B4',
  warning: '#FFB81C',
  error: '#FF4444',
  info: '#41B6E6',

  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(235,235,245,0.6)',
  textDisabled: 'rgba(235,235,245,0.3)',
  textInverse: '#231F20',

  surface1: '#1C1C1E',
  surface2: '#000000',
  surface3: '#2C2C2E',
  border: '#3A3A3C',

  tabActive: '#4DA3FF',
  tabInactive: '#636366',

  screenBackground: '#000000',
};
