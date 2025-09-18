import { createContext, useContext, useEffect, useState, ReactNode, memo } from 'react'

export type Theme = 'dark' | 'light' | 'ocean' | 'sunset' | 'midnight' | 'sentry'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider = memo(function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme')
    return (stored as Theme) || 'dark'
  })

  useEffect(() => {
    localStorage.setItem('theme', theme)
    
    const root = document.documentElement
    
    // Remove all theme classes
    root.classList.remove('dark', 'light', 'ocean', 'sunset', 'midnight', 'sentry')
    
    // Add the current theme class
    root.classList.add(theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
});