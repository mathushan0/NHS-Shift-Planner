import { create } from 'zustand';
import { Appearance } from 'react-native';
import { Theme, buildTheme } from '../theme';
import { DarkModePreference } from '../types';

interface ThemeStoreState {
  theme: Theme;
  darkModePreference: DarkModePreference;
  setDarkModePreference: (pref: DarkModePreference) => void;
  syncWithSystem: () => void;
}

function resolveTheme(pref: DarkModePreference): Theme {
  if (pref === 1) return buildTheme(true);
  if (pref === 2) return buildTheme(false);
  // System
  const colorScheme = Appearance.getColorScheme();
  return buildTheme(colorScheme === 'dark');
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  theme: resolveTheme(0),
  darkModePreference: 0,

  setDarkModePreference: (pref: DarkModePreference) => {
    set({ darkModePreference: pref, theme: resolveTheme(pref) });
  },

  syncWithSystem: () => {
    const { darkModePreference } = get();
    if (darkModePreference === 0) {
      set({ theme: resolveTheme(0) });
    }
  },
}));

// Listen for system appearance changes
Appearance.addChangeListener(() => {
  useThemeStore.getState().syncWithSystem();
});
