import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTheme, Theme } from '@/context/ThemeContext'
import { Palette, Moon, Sun, Waves, Sunset, Sparkles, Star } from 'lucide-react'

const themeOptions = [
  { value: 'dark', label: 'Dark', icon: Moon, description: 'Dark theme with high contrast' },
  { value: 'light', label: 'Light', icon: Sun, description: 'Clean light theme' },
  { value: 'ocean', label: 'Ocean', icon: Waves, description: 'Deep blues and teals' },
  { value: 'sunset', label: 'Sunset', icon: Sunset, description: 'Warm oranges and yellows' },
  { value: 'glassmorphism', label: 'Glassmorphism', icon: Sparkles, description: 'Translucent glass effect with blur' },
  { value: 'midnight', label: 'Midnight', icon: Star, description: 'Deep blues and purples like a starry night' },
] as const

export function SettingsView() {
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (value: string) => {
    setTheme(value as Theme)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your application preferences
          </p>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme-select">Theme</Label>
                <Select value={theme} onValueChange={handleThemeChange}>
                  <SelectTrigger id="theme-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themeOptions.map((option) => {
                      const Icon = option.icon
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{option.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {option.description}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}