import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';
import { THEMES, DEFAULT_THEME_ID, type Theme } from '@/lib/themes';

interface ThemeContextValue {
  theme: Theme;
  themeId: string;
  setThemeId: (themeId: string) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeId = useProfileSettingsStore((s) => s.personalization.themeId);
  const setThemeId = useProfileSettingsStore((s) => s.setThemeId);

  // Find the current theme
  const theme = useMemo(() => {
    return THEMES.find((t) => t.id === themeId) || THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
  }, [themeId]);

  // Apply CSS variables to :root when theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-gradient', theme.gradient);
    root.style.setProperty('--theme-accent', theme.accent);
    root.style.setProperty('--theme-accent-dark', theme.accentDark);
    root.style.setProperty('--theme-accent-rgb', theme.accentRgb);
    root.style.setProperty('--theme-card-bg', theme.cardBg);
    root.style.setProperty('--theme-card-border', theme.cardBorder);

    // Toggle theme-light class based on isDark
    if (theme.isDark) {
      root.classList.remove('theme-light');
    } else {
      root.classList.add('theme-light');
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      themeId,
      setThemeId,
      themes: THEMES,
    }),
    [theme, themeId, setThemeId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
