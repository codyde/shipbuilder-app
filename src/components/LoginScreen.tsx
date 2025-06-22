import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export function LoginScreen() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');

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
              <Card>
                <CardHeader>
                  <CardTitle>Sign In</CardTitle>
                  <CardDescription>
                    For demo purposes, enter any email to continue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                      />
                    </div>

                    {error && (
                      <div className="text-destructive text-sm">{error}</div>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loading || !email}
                    >
                      {loading ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </form>

                  <div className="mt-6">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-background text-muted-foreground">Or try demo accounts</span>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => handleQuickLogin('demo')}
                        disabled={loading}
                        className="w-full"
                      >
                        Demo User
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleQuickLogin('test')}
                        disabled={loading}
                        className="w-full"
                      >
                        Test User
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 text-center">
                    <p className="text-xs text-muted-foreground">
                      This is a demo application. In production, this would integrate with OAuth providers like GitHub and Google.
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