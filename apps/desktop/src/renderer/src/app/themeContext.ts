import { createContext } from 'react'

/** Contexto compartido del tema — definido fuera del provider para
 * permitir que useTheme viva en su propio módulo (react-refresh). */
export interface ThemeContextValue {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
