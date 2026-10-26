import { useEffect, useState } from 'react'
import { ThemeContext } from './themeContext'

/**
 * ThemeProvider (plan, Paso 4): tema claro por defecto, alternativa oscura,
 * preferencia persistida con clave propia `retail-analytics-theme`.
 * Sin dependencias externas; respeta prefers-reduced-motion vía CSS.
 */

const STORAGE_KEY = 'retail-analytics-theme'

type Theme = 'light' | 'dark'

function readInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage puede fallar (permisos): se usa el defecto sin bloquear.
  }
  return 'light' // plan: tema claro por defecto
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = (next: Theme): void => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Persistencia es preferencia, no dato crítico: se ignora el fallo.
    }
  }

  const toggleTheme = (): void => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
