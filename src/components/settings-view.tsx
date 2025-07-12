import { Label } from '@/components/ui/label'
import { useTheme, Theme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { Palette, Moon, Sun, Waves, Sunset, Star, Monitor, Check, Bug, Sparkles, Brain, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState, useCallback } from 'react'
import { getApiUrl } from '@/lib/api-config'
import { ErrorBoundary } from './ErrorBoundary'

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

const aiProviderOptions = [
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    icon: Brain,
    description: 'Claude Sonnet 4 & Opus 4 models',
    models: ['Claude Sonnet 4', 'Claude Opus 4']
  },
  {
    value: 'openai',
    label: 'OpenAI',
    icon: Sparkles,
    description: 'GPT-4o & GPT-4o Mini models',
    models: ['GPT-4o', 'GPT-4o Mini', 'GPT-4 Turbo']
  }
] as const

export function SettingsView() {
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const [aiProvider, setAiProvider] = useState<'anthropic' | 'openai'>('anthropic')
  const [availableProviders, setAvailableProviders] = useState<string[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [updatingProvider, setUpdatingProvider] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available AI providers and current selection
  const fetchProviders = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken')

      if (!token || !user) {
        setLoadingProviders(false)
        return
      }

      const url = getApiUrl('auth/ai-providers')

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setAvailableProviders(data.providers || [])
        if (data.current) {
          setAiProvider(data.current)
        }
      } else {
        const errorData = await response.json()
        setError('Failed to load AI provider settings: ${errorData}')
      }
    } catch (error) {
      setError('Unable to connect to server. Please check your connection.')
    } finally {
      setLoadingProviders(false)
    }
  }, [user?.id]) // Only depend on user.id to prevent unnecessary re-renders

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  const handleThemeChange = (value: string) => {
    setTheme(value as Theme)
  }

  const handleAIProviderChange = async (provider: 'anthropic' | 'openai') => {
    const token = localStorage.getItem('authToken')

    if (!token) {
      setError('You must be logged in to change AI provider')
      return
    }

    if (!user) {
      setError('User session not found. Please refresh the page.')
      return
    }

    setUpdatingProvider(true)
    setError(null)

    try {
      const url = getApiUrl('auth/ai-provider')

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ provider })
      })

      const data = await response.json()

      if (response.ok) {
        setAiProvider(provider)
      } else {
        setError(data.error || 'Failed to update AI provider')
      }
    } catch (error) {
      setError('Failed to update AI provider. Please try again.')
    } finally {
      setUpdatingProvider(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b px-4 md:px-8 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your application preferences and customize your experience
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-8 py-6">
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

          {/* AI Provider Section */}
          <ErrorBoundary
            fallback={
              <div className="space-y-6 border-t pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">AI Provider</h2>
                    <p className="text-sm text-muted-foreground">
                      Choose your preferred AI model provider
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">Unable to load AI provider settings. Please refresh the page.</p>
                </div>
              </div>
            }
          >
            <div className="space-y-6 border-t pt-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">AI Provider</h2>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred AI model provider
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">AI Model Provider</Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Select between different AI providers and models
                  </p>
                </div>

                {loadingProviders ? (
                  <div className="text-sm text-muted-foreground">Loading available providers...</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {aiProviderOptions.map((option) => {
                      const Icon = option.icon
                      const isSelected = aiProvider === option.value
                      const isAvailable = availableProviders.includes(option.value)

                      return (
                        <button
                          key={option.value}
                          onClick={() => isAvailable && handleAIProviderChange(option.value as 'anthropic' | 'openai')}
                          disabled={!isAvailable || updatingProvider}
                          className={cn(
                            "relative group flex flex-col items-start p-4 rounded-lg border-2 text-left transition-all duration-200",
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border bg-card",
                            isAvailable
                              ? "hover:shadow-md hover:scale-[1.02] hover:border-primary/50 cursor-pointer"
                              : "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="flex items-center gap-3 mb-3 w-full">
                            <Icon className="h-5 w-5 text-foreground/80" />
                            <span className="font-medium">{option.label}</span>
                            <div className="flex-1" />
                            {isSelected && (
                              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground mb-3">
                            {option.description}
                          </p>

                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Available models:</span>
                            <div className="mt-1 space-y-1">
                              {option.models.map((model) => (
                                <div key={model} className="text-xs">• {model}</div>
                              ))}
                            </div>
                          </div>

                          {!isAvailable && (
                            <div className="mt-2 text-xs text-destructive">
                              API key not configured
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-4">
                  Note: Make sure the appropriate API keys are configured in your environment variables.
                </p>
              </div>
            </div>
          </ErrorBoundary>

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
