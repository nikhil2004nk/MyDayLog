import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

const THEME_PROFILE_KEY = 'mydaylog_profile';

type ThemeContextType = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage early
  useEffect(() => {
    try {
      const raw = localStorage.getItem(THEME_PROFILE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && (p.theme === 'dark' || p.theme === 'light')) {
          setThemeState(p.theme);
        }
      }
    } catch {}
  }, []);

  // Apply to <html>, persist, and hint UA
  useEffect(() => {
    const root = document.documentElement;
    // Ensure any stray extension-applied 'dark' class is removed
    root.classList.remove('dark');
    // Toggle our custom selector
    if (theme === 'dark') root.classList.add('theme-dark'); else root.classList.remove('theme-dark');
    try { (root.style as any).colorScheme = theme; } catch {}
    try {
      const raw = localStorage.getItem(THEME_PROFILE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(THEME_PROFILE_KEY, JSON.stringify({ ...prev, theme }));
    } catch {}
    setMounted(true);
  }, [theme]);

  const value = useMemo<ThemeContextType>(() => ({
    theme,
    setTheme: (t: Theme) => setThemeState(t),
    toggleTheme: () => setThemeState(prev => (prev === 'dark' ? 'light' : 'dark')),
    mounted,
  }), [theme, mounted]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

