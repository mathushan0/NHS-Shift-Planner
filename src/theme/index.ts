export * from './colors';
export * from './typography';
export * from './spacing';

import { ColorTokens, lightColors, darkColors } from './colors';
import { TypographyTokens, typography } from './typography';
import { spacing, radius, elevation, tapTargets, screenMargin } from './spacing';

export interface Theme {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  elevation: typeof elevation;
  tapTargets: typeof tapTargets;
  screenMargin: typeof screenMargin;
  isDark: boolean;
}

export function buildTheme(isDark: boolean): Theme {
  return {
    colors: isDark ? darkColors : lightColors,
    typography,
    spacing,
    radius,
    elevation,
    tapTargets,
    screenMargin,
    isDark,
  };
}

export const DEFAULT_THEME = buildTheme(false);
