import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { getApiUrl } from '@/lib/api-config';

export function LoginScreen() {
  const { loading, error } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Check for OAuth callback errors in URL
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setUrlError(errorParam);
    }
  }, []);

  const handleSentryLogin = () => {
    setIsRedirecting(true);
    const loginUrl = getApiUrl('auth/sentry');
    console.log('Redirecting to login URL:', loginUrl);
    window.location.href = loginUrl;
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
                  {/* Error Messages */}
                  {(error || urlError) && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-red-600 text-sm">
                        {error || `Login failed: ${urlError}`}
                      </p>
                    </div>
                  )}

                  {/* Sentry OAuth Login */}
                  <Button
                    onClick={handleSentryLogin}
                    size="lg"
                    className="w-full h-12 text-base font-medium"
                    disabled={loading || isRedirecting}
                  >
                    {isRedirecting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12"/>
                        </svg>
                        Continue with Sentry
                      </>
                    )}
                  </Button>

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