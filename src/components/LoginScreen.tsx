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
import sentryLogoDark from '@/assets/sentryglyphdark.png';
import sentryLogoWhite from '@/assets/sentryglyphwhite.png';

export function LoginScreen() {
  const { loading, error, loginAsDeveloper } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [smoothMousePosition, setSmoothMousePosition] = useState({ x: 0, y: 0 });
  const [mouseVelocity, setMouseVelocity] = useState({ x: 0, y: 0 });
  
  // Check if developer mode should be available
  const isDevModeEnabled = React.useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('devmode') === 'true';
  }, []);

  const [isDeveloperMode, setIsDeveloperMode] = useState(isDevModeEnabled);
  const [developerEmail, setDeveloperEmail] = useState('');
  const [isDeveloperLoading, setIsDeveloperLoading] = useState(false);
  const [authProvider, setAuthProvider] = useState<'google' | 'sentry'>('google');

  // Track mouse movement and velocity
  React.useEffect(() => {
    let lastPosition = { x: 0, y: 0 };
    
    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = { x: e.clientX, y: e.clientY };
      
      // Calculate velocity using closure variable
      setMouseVelocity({
        x: newPosition.x - lastPosition.x,
        y: newPosition.y - lastPosition.y
      });
      
      // Update closure variable for next calculation
      lastPosition = newPosition;
      setMousePosition(newPosition);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []); // Empty dependency array - effect runs once on mount

  // Smooth mouse position with trailing effect
  React.useEffect(() => {
    const smoothingFactor = 0.15; // Lower = more trailing, higher = more responsive
    let animationFrame: number;

    const updateSmoothPosition = () => {
      setSmoothMousePosition(prev => ({
        x: prev.x + (mousePosition.x - prev.x) * smoothingFactor,
        y: prev.y + (mousePosition.y - prev.y) * smoothingFactor
      }));
      animationFrame = requestAnimationFrame(updateSmoothPosition);
    };

    animationFrame = requestAnimationFrame(updateSmoothPosition);
    return () => cancelAnimationFrame(animationFrame);
  }, [mousePosition]);

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8 bg-black">
      {/* Animated gradient orb effect with smooth trailing */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: `radial-gradient(600px circle at ${smoothMousePosition.x}px ${smoothMousePosition.y}px, 
            rgba(147, 51, 234, 0.15), 
            rgba(79, 70, 229, 0.1), 
            rgba(16, 185, 129, 0.05), 
            transparent 70%)`
        }}
      />
      
      {/* Secondary orb with different trailing speed */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: `radial-gradient(400px circle at ${smoothMousePosition.x * 0.7 + mousePosition.x * 0.3}px ${smoothMousePosition.y * 0.8 + mousePosition.y * 0.2}px, 
            rgba(236, 72, 153, 0.08), 
            rgba(168, 85, 247, 0.05), 
            transparent 60%)`
        }}
      />
      
      {/* Trailing orb effect */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: `radial-gradient(800px circle at ${smoothMousePosition.x * 0.6}px ${smoothMousePosition.y * 0.7}px, 
            rgba(147, 51, 234, 0.05), 
            rgba(79, 70, 229, 0.03), 
            transparent 80%)`
        }}
      />
      
      {/* Velocity-based tail effect */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: `radial-gradient(ellipse ${Math.max(200, Math.abs(mouseVelocity.x) * 8)}px ${Math.max(200, Math.abs(mouseVelocity.y) * 8)}px at ${smoothMousePosition.x - mouseVelocity.x * 15}px ${smoothMousePosition.y - mouseVelocity.y * 15}px, 
            rgba(147, 51, 234, ${Math.min(0.08, Math.hypot(mouseVelocity.x, mouseVelocity.y) * 0.002)}), 
            rgba(79, 70, 229, ${Math.min(0.05, Math.hypot(mouseVelocity.x, mouseVelocity.y) * 0.001)}), 
            transparent 60%)`
        }}
      />
      
      {/* Secondary tail for more depth */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: `radial-gradient(ellipse ${Math.max(150, Math.abs(mouseVelocity.x) * 6)}px ${Math.max(150, Math.abs(mouseVelocity.y) * 6)}px at ${smoothMousePosition.x - mouseVelocity.x * 25}px ${smoothMousePosition.y - mouseVelocity.y * 25}px, 
            rgba(236, 72, 153, ${Math.min(0.04, Math.hypot(mouseVelocity.x, mouseVelocity.y) * 0.001)}), 
            rgba(168, 85, 247, ${Math.min(0.03, Math.hypot(mouseVelocity.x, mouseVelocity.y) * 0.0008)}), 
            transparent 70%)`
        }}
      />
      
      <div className="max-w-[80%] w-full relative z-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[70vh]">
          {/* Left side - Branding */}
          <div className="text-left space-y-10">
            <div 
              className="flex items-center space-x-5 transition-all duration-300 ease-out"
              style={{
                filter: `brightness(${1 + Math.max(0, 1 - Math.hypot(mousePosition.x - (window.innerWidth * 0.25), mousePosition.y - (window.innerHeight * 0.4)) / 300) * 0.3})`
              }}
            >
              <img 
                src="/shipbuilder-icon.png" 
                alt="ShipBuilder" 
                className="w-20 h-20 rounded-lg"
              />
              <div>
                <h1 className="text-4xl font-bold text-gray-300">Shipbuilder</h1>
              </div>
            </div>
            
            <div className="space-y-6">
              <h1 
                className="text-6xl lg:text-7xl font-bold text-gray-200 leading-tight transition-all duration-300 ease-out"
                style={{
                  filter: `brightness(${1 + Math.max(0, 1 - Math.hypot(mousePosition.x - (window.innerWidth * 0.25), mousePosition.y - (window.innerHeight * 0.5)) / 400) * 0.4})`
                }}
              >
                Plan. Build. Ship. Repeat.
              </h1>
              <h2 
                className="text-4xl lg:text-5xl text-gray-300 leading-tight transition-all duration-300 ease-out"
                style={{
                  filter: `brightness(${1 + Math.max(0, 1 - Math.hypot(mousePosition.x - (window.innerWidth * 0.25), mousePosition.y - (window.innerHeight * 0.6)) / 350) * 0.3})`
                }}
              >
                Finally get that half-built side project shipped.
              </h2>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="flex justify-end">
            <div className="max-w-xl w-full">
              <Card 
                className="border-2 bg-black/95 backdrop-blur-sm border-gray-700 transition-all duration-300 ease-out"
                style={{
                  filter: `brightness(${1 + Math.max(0, 1 - Math.hypot(mousePosition.x - (window.innerWidth * 0.75), mousePosition.y - (window.innerHeight * 0.5)) / 400) * 0.2})`,
                  boxShadow: `0 0 ${Math.max(0, 100 - Math.hypot(mousePosition.x - (window.innerWidth * 0.75), mousePosition.y - (window.innerHeight * 0.5)) / 4)}px rgba(147, 51, 234, 0.3)`
                }}
              >
                <CardHeader className="text-center">
                  <CardTitle className="text-3xl text-white">Welcome Back</CardTitle>
                  <CardDescription className="text-lg text-gray-300">
                    Sign in to your ShipBuilder account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Error Messages */}
                  {(error || urlError) && (
                    <div className="p-4 bg-red-900/50 border border-red-600 rounded-md">
                      <p className="text-red-300 text-base">
                        {error || `Login failed: ${urlError}`}
                      </p>
                    </div>
                  )}

                  {/* OAuth Provider Toggle */}
                  <div className="space-y-6">
                    {/* Toggle Switch */}
                    <div className="flex items-center justify-center space-x-6">
                      <div className={`flex items-center space-x-3 transition-opacity ${authProvider === 'google' ? 'opacity-100' : 'opacity-50'}`}>
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span className="text-base font-medium text-white">Google</span>
                      </div>
                      
                      <Switch
                        checked={authProvider === 'sentry'}
                        onCheckedChange={(checked) => setAuthProvider(checked ? 'sentry' : 'google')}
                        disabled={loading || isRedirecting || isDeveloperLoading}
                        className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-600 scale-125"
                      />
                      
                      <div className={`flex items-center space-x-3 transition-opacity ${authProvider === 'sentry' ? 'opacity-100' : 'opacity-50'}`}>
                        <img src={sentryLogoWhite} alt="Sentry" className="w-6 h-6" />
                        <span className="text-base font-medium text-white">Sentry</span>
                      </div>
                    </div>

                    {/* Single Auth Button */}
                    <Button
                      onClick={authProvider === 'google' ? handleGoogleLogin : handleSentryLogin}
                      size="lg"
                      className="w-full h-16 text-lg font-medium bg-white text-black hover:bg-gray-200 border-none"
                      disabled={loading || isRedirecting || isDeveloperLoading}
                    >
                      {isRedirecting ? (
                        <>
                          <Loader2 className="w-6 h-6 mr-4 animate-spin text-black" />
                          Redirecting...
                        </>
                      ) : authProvider === 'google' ? (
                        <>
                          <svg className="w-6 h-6 mr-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          Continue with Google
                        </>
                      ) : (
                        <>
                          <img src={sentryLogoDark} alt="Sentry" className="w-6 h-6 mr-4" />
                          Continue with Sentry
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Developer Mode Section - Only show if ?devmode=true */}
                  {isDevModeEnabled && (
                    <>
                      {/* Divider */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-600"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-black px-3 text-sm text-gray-400">
                            or
                          </span>
                        </div>
                      </div>

                      {/* Developer Mode Toggle */}
                      <div className="flex items-center space-x-3">
                        <Switch
                          id="developer-mode"
                          checked={isDeveloperMode}
                          onCheckedChange={setIsDeveloperMode}
                          disabled={loading || isRedirecting || isDeveloperLoading}
                          className="data-[state=checked]:bg-amber-600 data-[state=unchecked]:bg-gray-600 scale-125"
                        />
                        <Label htmlFor="developer-mode" className="text-base font-medium text-white">
                          Developer Mode
                        </Label>
                      </div>

                      {/* Developer Mode Form */}
                      {isDeveloperMode && (
                        <div className="space-y-5 p-5 border border-gray-600 rounded-lg bg-gray-900/50">
                          <div className="flex items-center space-x-3 text-amber-400">
                            <Code2 className="w-5 h-5" />
                            <span className="text-base font-medium">Development Access</span>
                          </div>
                          
                          <div className="space-y-3">
                            <Label htmlFor="developer-email" className="text-base text-white">
                              Email Address
                            </Label>
                            <Input
                              id="developer-email"
                              type="email"
                              placeholder="Enter your email"
                              value={developerEmail}
                              onChange={(e) => setDeveloperEmail(e.target.value)}
                              disabled={loading || isRedirecting || isDeveloperLoading}
                              className="h-12 text-base bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && developerEmail.trim()) {
                                  handleDeveloperLogin();
                                }
                              }}
                            />
                          </div>
                          
                          <Button
                            onClick={handleDeveloperLogin}
                            size="lg"
                            variant="outline"
                            className="w-full h-12 text-base bg-white text-black hover:bg-gray-200 border-gray-600"
                            disabled={loading || isRedirecting || isDeveloperLoading || !developerEmail.trim()}
                          >
                            {isDeveloperLoading ? (
                              <>
                                <Loader2 className="w-5 h-5 mr-3 animate-spin text-black" />
                                Logging in...
                              </>
                            ) : (
                              <>
                                <Code2 className="w-5 h-5 mr-3 text-black" />
                                Login as Developer
                              </>
                            )}
                          </Button>
                          
                          <p className="text-sm text-gray-400">
                            This will log you in as <strong className="text-white">{developerEmail.trim() ? `${developerEmail.trim().split('@')[0]}+demo@${developerEmail.trim().split('@')[1] || 'example.com'}` : 'email+demo@domain.com'}</strong>
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Security Notice */}
                  <div className="text-center">
                    <p className="text-sm text-gray-400">
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