import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'eldercare-theme-preference';
type ThemeContextValue = { isDark: boolean; toggleDarkMode: () => void; ready: boolean };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const [isDark, setIsDark] = useState(Appearance.getColorScheme() === 'dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value !== null) {
        const next = value === 'dark';
        setIsDark(next);
        Appearance.setColorScheme(next ? 'dark' : 'light');
      }
      setReady(true);
    });
  }, []);

  const value = useMemo(() => ({
    isDark,
    ready,
    toggleDarkMode: () => {
      setIsDark((current) => {
        const next = !current;
        Appearance.setColorScheme(next ? 'dark' : 'light');
        void AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
        return next;
      });
    },
  }), [isDark, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useThemePreference must be used inside ThemePreferenceProvider.');
  return value;
}
