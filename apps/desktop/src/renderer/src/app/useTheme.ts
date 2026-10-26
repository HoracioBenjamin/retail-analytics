import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from './themeContext'

/** Hook de tema (plan Paso 4): usar dentro de <ThemeProvider>. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}
