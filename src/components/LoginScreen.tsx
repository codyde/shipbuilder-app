import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, Code2 } from 'lucide-react';
import { getApiUrl } from '@/lib/api-config';
import shipbuilderVideo from '@/assets/shipbuilder.mp4';

export function LoginScreen() {
  const { loading, error, loginAsDeveloper } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  // Check if developer mode should be available
  const isDevModeEnabled = React.useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('devmode') === 'true';
  }, []);

  const [isDeveloperMode, setIsDeveloperMode] = useState(isDevModeEnabled);
  const [developerEmail, setDeveloperEmail] = useState('');
  const [isDeveloperLoading, setIsDeveloperLoading] = useState(false);

  // Check for OAuth callback errors and devmode parameter in URL
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

  const handleGoogleLogin = () => {
    setIsRedirecting(true);
    const loginUrl = getApiUrl('auth/google');
    console.log('Redirecting to Google login URL:', loginUrl);
    window.location.href = loginUrl;
  };

  const handleDeveloperLogin = async () => {
    if (!developerEmail.trim()) {
      return;
    }
    
    setIsDeveloperLoading(true);
    try {
      await loginAsDeveloper(developerEmail.trim());
    } catch (error) {
      console.error('Developer login failed:', error);
    } finally {
      setIsDeveloperLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src={shipbuilderVideo} type="video/mp4" />
      </video>
      
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/70 z-10" />
      
      <div className="max-w-6xl w-full relative z-20">
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
              <Card className="border-2 bg-background/95 backdrop-blur-sm">
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
                    disabled={loading || isRedirecting || isDeveloperLoading}
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

                  {/* Google OAuth Login */}
                  <Button
                    onClick={handleGoogleLogin}
                    size="lg"
                    variant="outline"
                    className="w-full h-12 text-base font-medium"
                    disabled={loading || isRedirecting || isDeveloperLoading}
                  >
                    {isRedirecting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </Button>

                  {/* Developer Mode Section - Only show if ?devmode=true */}
                  {isDevModeEnabled && (
                    <>
                      {/* Divider */}
                      <div className="relative">
                        <Separator />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="bg-card px-2 text-xs text-muted-foreground">
                            or
                          </span>
                        </div>
                      </div>

                      {/* Developer Mode Toggle */}
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="developer-mode"
                          checked={isDeveloperMode}
                          onCheckedChange={setIsDeveloperMode}
                          disabled={loading || isRedirecting || isDeveloperLoading}
                        />
                        <Label htmlFor="developer-mode" className="text-sm font-medium">
                          Developer Mode
                        </Label>
                      </div>

                      {/* Developer Mode Form */}
                      {isDeveloperMode && (
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                          <div className="flex items-center space-x-2 text-amber-600">
                            <Code2 className="w-4 h-4" />
                            <span className="text-sm font-medium">Development Access</span>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="developer-email" className="text-sm">
                              Email Address
                            </Label>
                            <Input
                              id="developer-email"
                              type="email"
                              placeholder="Enter your email"
                              value={developerEmail}
                              onChange={(e) => setDeveloperEmail(e.target.value)}
                              disabled={loading || isRedirecting || isDeveloperLoading}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && developerEmail.trim()) {
                                  handleDeveloperLogin();
                                }
                              }}
                            />
                          </div>
                          
                          <Button
                            onClick={handleDeveloperLogin}
                            size="sm"
                            variant="outline"
                            className="w-full"
                            disabled={loading || isRedirecting || isDeveloperLoading || !developerEmail.trim()}
                          >
                            {isDeveloperLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Logging in...
                              </>
                            ) : (
                              <>
                                <Code2 className="w-4 h-4 mr-2" />
                                Login as Developer
                              </>
                            )}
                          </Button>
                          
                          <p className="text-xs text-muted-foreground">
                            This will log you in as <strong>{developerEmail.trim() ? `${developerEmail.trim().split('@')[0]}+demo@${developerEmail.trim().split('@')[1] || 'example.com'}` : 'email+demo@domain.com'}</strong>
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Security Notice */}
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      Secured by OAuth 2.0 authentication
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