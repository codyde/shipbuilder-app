import { Label } from '@/components/ui/label'
import { useTheme, Theme } from '@/context/ThemeContext'
import { Palette, Moon, Sun, Waves, Sunset, Star, Monitor, Check, Bug } from 'lucide-react'
import { cn } from '@/lib/utils'

const themeOptions = [
  { 
    value: 'system', 
    label: 'System', 
    icon: Monitor, 
    description: 'Follow system preference',
    colors: { primary: '#64748b', secondary: '#e2e8f0', background: '#ffffff' }
  },
  { 
    value: 'light', 
    label: 'Light', 
    icon: Sun, 
    description: 'Clean light theme',
    colors: { primary: '#0f172a', secondary: '#64748b', background: '#ffffff' }
  },
  { 
    value: 'dark', 
    label: 'Dark', 
    icon: Moon, 
    description: 'Dark theme with high contrast',
    colors: { primary: '#f8fafc', secondary: '#64748b', background: '#0f172a' }
  },
  { 
    value: 'ocean', 
    label: 'Ocean', 
    icon: Waves, 
    description: 'Deep blues and teals',
    colors: { primary: '#0891b2', secondary: '#06b6d4', background: '#164e63' }
  },
  { 
    value: 'sunset', 
    label: 'Sunset', 
    icon: Sunset, 
    description: 'Warm oranges and yellows',
    colors: { primary: '#f97316', secondary: '#fbbf24', background: '#7c2d12' }
  },
  { 
    value: 'midnight', 
    label: 'Midnight', 
    icon: Star, 
    description: 'Deep blues and purples like a starry night',
    colors: { primary: '#6366f1', secondary: '#8b5cf6', background: '#1e1b4b' }
  },
  { 
    value: 'sentry', 
    label: 'Sentry', 
    icon: Bug, 
    description: 'Dark purple theme inspired by Sentry',
    colors: { primary: '#8b5cf6', secondary: '#a78bfa', background: '#1a1b3a' }
  },
] as const

export function SettingsView() {
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (value: string) => {
    setTheme(value as Theme)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b px-8 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your application preferences and customize your experience
          </p>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-4xl space-y-8">
          {/* Appearance Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <Palette className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Appearance</h2>
                <p className="text-sm text-muted-foreground">
                  Customize the visual theme of your application
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Theme</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Choose your preferred color scheme
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  const isSelected = theme === option.value
                  
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleThemeChange(option.value)}
                      className={cn(
                        "relative group flex flex-col items-start p-4 rounded-lg border-2 text-left transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
                        isSelected 
                          ? "border-primary bg-primary/5 shadow-sm" 
                          : "border-border hover:border-primary/50 bg-card"
                      )}
                    >
                      {/* Color Preview */}
                      <div className="flex items-center gap-3 mb-3 w-full">
                        <div className="flex gap-1">
                          <div 
                            className="w-3 h-3 rounded-full border border-border/20"
                            style={{ backgroundColor: option.colors.background }}
                          />
                          <div 
                            className="w-3 h-3 rounded-full border border-border/20"
                            style={{ backgroundColor: option.colors.primary }}
                          />
                          <div 
                            className="w-3 h-3 rounded-full border border-border/20"
                            style={{ backgroundColor: option.colors.secondary }}
                          />
                        </div>
                        <div className="flex-1" />
                        {isSelected && (
                          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>

                      {/* Theme Info */}
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-4 w-4 text-foreground/80" />
                        <span className="font-medium text-sm">{option.label}</span>
                      </div>
                      
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {option.description}
                      </p>

                      {/* Mini Preview */}
                      <div 
                        className="mt-3 w-full h-8 rounded border border-border/20 overflow-hidden"
                        style={{ backgroundColor: option.colors.background }}
                      >
                        <div className="flex h-full">
                          <div 
                            className="flex-1" 
                            style={{ backgroundColor: option.colors.background }}
                          />
                          <div 
                            className="w-6" 
                            style={{ backgroundColor: option.colors.primary }}
                          />
                          <div 
                            className="w-4" 
                            style={{ backgroundColor: option.colors.secondary }}
                          />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Future sections can be added here */}
          <div className="border-t pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
                <Monitor className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-muted-foreground">Coming Soon</h2>
                <p className="text-sm text-muted-foreground">
                  More customization options will be available in future updates
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}