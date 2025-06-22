import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function LoginScreen() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Extract name from email for demo purposes
    const name = email.split('@')[0];

    try {
      await login(email, name);
    } catch (error) {
      // Error is handled by context
    }
  };

  const handleQuickLogin = async (userType: 'demo' | 'test') => {
    const users = {
      demo: { email: 'demo@example.com', name: 'Demo User' },
      test: { email: 'test@example.com', name: 'Test User' },
    };

    const user = users[userType];
    try {
      await login(user.email, user.name);
    } catch (error) {
      // Error is handled by context
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Branding */}
          <div className="text-center lg:text-left space-y-8">
            <div className="flex items-center justify-center lg:justify-start space-x-4">
              <img 
                src="/shipbuilder-icon.png" 
                alt="ShipBuilder" 
                className="w-16 h-16 rounded-lg"
              />
              <div>
                <h1 className="text-3xl font-bold text-foreground">ShipBuilder</h1>
                <p className="text-muted-foreground">Track what you're building</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                Stop Forgetting to Finish Your Projects
              </h1>
              <h2 className="text-xl text-muted-foreground">
                Keep track of what you're building, what you've already done, and what's left. Use AI to build your tasks.
              </h2>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="flex justify-center lg:justify-end">
            <div className="max-w-md w-full">
              <Card className="border-2">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Welcome Back</CardTitle>
                  <CardDescription>
                    Sign in to your ShipBuilder account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Primary Sentry OAuth Login */}
                  <Button
                    onClick={() => window.location.href = '/api/auth/sentry'}
                    size="lg"
                    className="w-full h-12 text-base font-medium"
                    disabled={loading}
                  >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12"/>
                    </svg>
                    Continue with Sentry
                  </Button>

                  {/* Developer/Testing Options */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <Label 
                        htmlFor="dev-login" 
                        className="text-xs text-muted-foreground font-medium"
                      >
                        Developer Options
                      </Label>
                      <Switch 
                        id="dev-login" 
                        checked={showEmailLogin}
                        onCheckedChange={setShowEmailLogin}
                        className="scale-75"
                      />
                    </div>

                    {/* Email Login Form - Collapsible */}
                    {showEmailLogin && (
                      <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                          <div className="text-xs text-muted-foreground text-center">
                            Development login - no password required
                          </div>
                          
                          <form onSubmit={handleSubmit} className="space-y-3">
                            <Input
                              id="email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="developer@example.com"
                              className="h-10"
                              required
                            />

                            {error && (
                              <div className="text-destructive text-xs text-center">{error}</div>
                            )}

                            <Button 
                              type="submit" 
                              variant="secondary"
                              size="sm"
                              className="w-full" 
                              disabled={loading || !email}
                            >
                              {loading ? 'Signing in...' : 'Dev Sign In'}
                            </Button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Security Notice */}
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      Secured by Sentry OAuth 2.0
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}