import { useThemeStore } from '../stores/themeStore';
import { Theme } from '../theme';

export function useTheme(): Theme {
  return useThemeStore(state => state.theme);
}
