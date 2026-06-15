import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('glifo-theme') || 'light';
  });

  // Aplica el tema al documento
  const applyTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
  };

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('glifo-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  // Fuerza light mode temporalmente (para el landing)
  const forceLightMode = () => applyTheme('light');
  const restoreTheme   = () => applyTheme(theme);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, forceLightMode, restoreTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
