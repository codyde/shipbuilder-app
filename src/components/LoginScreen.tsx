import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Code2 } from 'lucide-react';
import { getApiUrl } from '@/lib/api-config';
import sentryLogoDark from '@/assets/sentryglyphdark.png';
import sentryLogoWhite from '@/assets/sentryglyphwhite.png';

// Throttle utility function
const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean;
  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Custom hook for responsive mobile detection with SSR safety
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    // Mark as client-side after hydration
    setIsClient(true);
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return { isMobile: isClient ? isMobile : false, isClient };
};

export function LoginScreen() {
  const { loading, error, loginAsDeveloper } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [smoothMousePosition, setSmoothMousePosition] = useState({ x: 0, y: 0 });
  const [mouseVelocity, setMouseVelocity] = useState({ x: 0, y: 0 });
  
  // Use useRef for reliable mutable state across renders
  const lastPositionRef = React.useRef({ x: 0, y: 0 });
  
  // SSR-safe responsive detection
  const { isMobile, isClient } = useIsMobile();
  
  // Safe window access for SSR compatibility
  const windowWidth = isClient ? window.innerWidth : 1920;
  const windowHeight = isClient ? window.innerHeight : 1080;
  
  // Check if developer mode should be available
  const isDevModeEnabled = React.useMemo(() => {
    if (!isClient) return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('devmode') === 'true';
  }, [isClient]);

  const [isDeveloperMode, setIsDeveloperMode] = useState(isDevModeEnabled);
  const [developerEmail, setDeveloperEmail] = useState('');
  const [isDeveloperLoading, setIsDeveloperLoading] = useState(false);
  const [authProvider, setAuthProvider] = useState<'google' | 'sentry'>('google');

  // Optimized throttled mouse move handler - only created for desktop
  const throttledMouseMove = useMemo(() => {
    // Don't create throttled function on mobile for better performance
    if (isMobile) return null;
    
    return throttle((e: MouseEvent) => {
      const newPosition = { x: e.clientX, y: e.clientY };
      
      // Calculate velocity using useRef for reliable mutable state
      setMouseVelocity({
        x: newPosition.x - lastPositionRef.current.x,
        y: newPosition.y - lastPositionRef.current.y
      });
      
      // Update ref for next calculation
      lastPositionRef.current = newPosition;
      setMousePosition(newPosition);
    }, 16); // 60fps limit
  }, [isMobile]);

  // Track mouse movement and velocity - only on desktop
  React.useEffect(() => {
    if (isMobile || !throttledMouseMove || !isClient) return;
    
    window.addEventListener('mousemove', throttledMouseMove);
    return () => window.removeEventListener('mousemove', throttledMouseMove);
  }, [throttledMouseMove, isMobile, isClient]);

  // Smooth mouse position with trailing effect - only on desktop
  React.useEffect(() => {
    if (isMobile || !isClient) return;
    
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
  }, [mousePosition, isMobile, isClient]);

  // Check for OAuth callback errors and devmode parameter in URL
  React.useEffect(() => {
    if (!isClient) return;
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setUrlError(errorParam);
    }
  }, [isClient]);

  // Update developer mode when devmode availability changes
  React.useEffect(() => {
    setIsDeveloperMode(isDevModeEnabled);
  }, [isDevModeEnabled]);

  const handleSentryLogin = useCallback(() => {
    setIsRedirecting(true);
    const loginUrl = getApiUrl('auth/sentry');
    console.log('Redirecting to login URL:', loginUrl);
    window.location.href = loginUrl;
  }, []);

  const handleGoogleLogin = useCallback(() => {
    setIsRedirecting(true);
    const loginUrl = getApiUrl('auth/google');
    console.log('Redirecting to Google login URL:', loginUrl);
    window.location.href = loginUrl;
  }, []);

  const handleDeveloperLogin = useCallback(async () => {
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
  }, [developerEmail, loginAsDeveloper]);

  // Memoized orb styles for performance - simplified for mobile
  const orbStyles = useMemo(() => {
    if (isMobile) {
      // Simplified static orbs for mobile
      return {
        primaryOrb: {
          transform: 'translate(-50%, -50%)',
          top: '20%',
          left: '20%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(147, 51, 234, 0.1), rgba(79, 70, 229, 0.05), transparent 70%)',
        },
        secondaryOrb: {
          transform: 'translate(-50%, -50%)',
          top: '70%',
          right: '20%',
          left: 'auto',
          width: '250px',
          height: '250px',
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.08), rgba(168, 85, 247, 0.05), transparent 60%)',
        },
        trailingOrb: {
          transform: 'translate(-50%, -50%)',
          top: '50%',
          left: '80%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(147, 51, 234, 0.03), rgba(79, 70, 229, 0.02), transparent 80%)',
        },
        velocityTail: { display: 'none' },
        secondaryTail: { display: 'none' },
      };
    }
    
    const velocity = Math.hypot(mouseVelocity.x, mouseVelocity.y);
    
    return {
      primaryOrb: {
        transform: `translate(${smoothMousePosition.x - 300}px, ${smoothMousePosition.y - 300}px)`,
        width: '600px',
        height: '600px',
        background: `radial-gradient(circle, rgba(147, 51, 234, 0.15), rgba(79, 70, 229, 0.1), rgba(16, 185, 129, 0.05), transparent 70%)`,
      },
      secondaryOrb: {
        transform: `translate(${smoothMousePosition.x * 0.7 + mousePosition.x * 0.3 - 200}px, ${smoothMousePosition.y * 0.8 + mousePosition.y * 0.2 - 200}px)`,
        width: '400px',
        height: '400px',
        background: `radial-gradient(circle, rgba(236, 72, 153, 0.08), rgba(168, 85, 247, 0.05), transparent 60%)`,
      },
      trailingOrb: {
        transform: `translate(${smoothMousePosition.x * 0.6 - 400}px, ${smoothMousePosition.y * 0.7 - 400}px)`,
        width: '800px',
        height: '800px',
        background: `radial-gradient(circle, rgba(147, 51, 234, 0.05), rgba(79, 70, 229, 0.03), transparent 80%)`,
      },
      velocityTail: {
        transform: `translate(${smoothMousePosition.x - mouseVelocity.x * 15 - Math.max(100, Math.abs(mouseVelocity.x) * 4)}px, ${smoothMousePosition.y - mouseVelocity.y * 15 - Math.max(100, Math.abs(mouseVelocity.y) * 4)}px)`,
        width: `${Math.max(200, Math.abs(mouseVelocity.x) * 8)}px`,
        height: `${Math.max(200, Math.abs(mouseVelocity.y) * 8)}px`,
        background: `radial-gradient(ellipse, rgba(147, 51, 234, ${Math.min(0.08, velocity * 0.002)}), rgba(79, 70, 229, ${Math.min(0.05, velocity * 0.001)}), transparent 60%)`,
        borderRadius: '50%',
      },
      secondaryTail: {
        transform: `translate(${smoothMousePosition.x - mouseVelocity.x * 25 - Math.max(75, Math.abs(mouseVelocity.x) * 3)}px, ${smoothMousePosition.y - mouseVelocity.y * 25 - Math.max(75, Math.abs(mouseVelocity.y) * 3)}px)`,
        width: `${Math.max(150, Math.abs(mouseVelocity.x) * 6)}px`,
        height: `${Math.max(150, Math.abs(mouseVelocity.y) * 6)}px`,
        background: `radial-gradient(ellipse, rgba(236, 72, 153, ${Math.min(0.04, velocity * 0.001)}), rgba(168, 85, 247, ${Math.min(0.03, velocity * 0.0008)}), transparent 70%)`,
        borderRadius: '50%',
      },
    };
  }, [smoothMousePosition, mouseVelocity, mousePosition, isMobile]);

  // Memoized brightness filter calculation for performance
  const getBrightnessFilter = useCallback((targetX: number, targetY: number, maxDistance: number, intensity: number) => {
    if (isMobile || !isClient) return {};
    return {
      filter: `brightness(${1 + Math.max(0, 1 - Math.hypot(mousePosition.x - targetX, mousePosition.y - targetY) / maxDistance) * intensity})`
    };
  }, [mousePosition, isMobile, isClient]);

  const getBoxShadowFilter = useCallback(() => {
    if (isMobile || !isClient) return {};
    return {
      filter: `brightness(${1 + Math.max(0, 1 - Math.hypot(mousePosition.x - (windowWidth * 0.75), mousePosition.y - (windowHeight * 0.5)) / 400) * 0.2})`,
      boxShadow: `0 0 ${Math.max(0, 100 - Math.hypot(mousePosition.x - (windowWidth * 0.75), mousePosition.y - (windowHeight * 0.5)) / 4)}px rgba(147, 51, 234, 0.3)`
    };
  }, [mousePosition, windowWidth, windowHeight, isMobile, isClient]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-4 sm:py-6 md:py-8 lg:py-10 xl:py-12 px-4 sm:px-6 lg:px-8 bg-black">
      {/* Optimized orb effects using transform for better performance */}
      <div 
        className={`absolute ${isMobile ? 'top-0 left-0' : 'top-0 left-0'} z-0 rounded-full`}
        style={orbStyles.primaryOrb}
      />
      
      <div 
        className={`absolute ${isMobile ? 'top-0 right-0' : 'top-0 left-0'} z-0 rounded-full`}
        style={orbStyles.secondaryOrb}
      />
      
      <div 
        className={`absolute ${isMobile ? 'top-0 left-0' : 'top-0 left-0'} z-0 rounded-full`}
        style={orbStyles.trailingOrb}
      />
      
      {!isMobile && (
        <>
          <div 
            className="absolute top-0 left-0 z-0"
            style={orbStyles.velocityTail}
          />
          
          <div 
            className="absolute top-0 left-0 z-0"
            style={orbStyles.secondaryTail}
          />
        </>
      )}
      
      <div className="max-w-[95%] sm:max-w-[92%] md:max-w-[90%] lg:max-w-[88%] xl:max-w-[85%] w-full relative z-20">
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 lg:gap-12 xl:gap-16 items-center min-h-[70vh]">
          {/* Left side - Branding */}
          <div className="text-center lg:text-left space-y-4 sm:space-y-6 md:space-y-7 lg:space-y-8 xl:space-y-10 order-2 lg:order-1">
            <div 
              className="flex items-center justify-center lg:justify-start space-x-3 sm:space-x-4 md:space-x-4 lg:space-x-5 transition-all duration-300 ease-out"
              style={getBrightnessFilter(windowWidth * 0.25, windowHeight * 0.4, 300, 0.3)}
            >
              <img 
                src="/shipbuilder-icon.png" 
                alt="ShipBuilder" 
                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 xl:w-20 xl:h-20 rounded-lg"
              />
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-300">ShipBuilder</h1>
              </div>
            </div>
            
            <div className="space-y-3 sm:space-y-4 md:space-y-5 lg:space-y-6">
              <h1 
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold text-gray-300 leading-tight transition-all duration-300 ease-out"
                style={getBrightnessFilter(windowWidth * 0.25, windowHeight * 0.5, 400, 0.4)}
              >
                Plan. Build. Ship. Repeat.
              </h1>
              <h2 
                className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl text-gray-400 leading-tight transition-all duration-300 ease-out"
                style={getBrightnessFilter(windowWidth * 0.25, windowHeight * 0.65, 400, 0.4)}
              >
                Finally get that half-built side project shipped.
              </h2>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="flex justify-center lg:justify-end order-1 lg:order-2">
            <div className="max-w-full sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl w-full">
              <Card 
                className="border-2 bg-black/95 backdrop-blur-sm border-gray-700 transition-all duration-300 ease-out mx-2 sm:mx-0"
                style={getBoxShadowFilter()}
              >
                <CardHeader className="text-center px-4 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6">
                  <CardTitle className="text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl text-white">Welcome Back</CardTitle>
                  <CardDescription className="text-sm sm:text-sm md:text-base lg:text-base xl:text-lg text-gray-300">
                    Sign in to your ShipBuilder account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 sm:space-y-6 md:space-y-7 lg:space-y-8 px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6">
                  {/* Error Messages */}
                  {(error || urlError) && (
                    <div className="p-3 sm:p-3 md:p-4 bg-red-900/50 border border-red-600 rounded-md">
                      <p className="text-red-300 text-sm sm:text-sm md:text-base">
                        {error || `Login failed: ${urlError}`}
                      </p>
                    </div>
                  )}

                  {/* OAuth Provider Toggle */}
                  <div className="space-y-4 sm:space-y-5 md:space-y-6">
                    {/* Toggle Switch */}
                    <div className="flex items-center justify-center space-x-3 sm:space-x-4 md:space-x-5 lg:space-x-6">
                      <div className={`flex items-center space-x-2 sm:space-x-2 md:space-x-3 transition-opacity ${authProvider === 'google' ? 'opacity-100' : 'opacity-50'}`}>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 lg:w-6 lg:h-6" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span className="text-sm sm:text-sm md:text-base font-medium text-white">Google</span>
                      </div>
                      
                      <Switch
                        checked={authProvider === 'sentry'}
                        onCheckedChange={(checked) => setAuthProvider(checked ? 'sentry' : 'google')}
                        disabled={loading || isRedirecting || isDeveloperLoading}
                        className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-600 scale-100 sm:scale-110 md:scale-110 lg:scale-125"
                      />
                      
                      <div className={`flex items-center space-x-2 sm:space-x-2 md:space-x-3 transition-opacity ${authProvider === 'sentry' ? 'opacity-100' : 'opacity-50'}`}>
                        <img src={sentryLogoWhite} alt="Sentry" className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 lg:w-6 lg:h-6" />
                        <span className="text-sm sm:text-sm md:text-base font-medium text-white">Sentry</span>
                      </div>
                    </div>

                    {/* Single Auth Button */}
                    <Button
                      onClick={authProvider === 'google' ? handleGoogleLogin : handleSentryLogin}
                      size="lg"
                      className="w-full h-11 sm:h-12 md:h-13 lg:h-14 xl:h-16 text-sm sm:text-base md:text-base lg:text-lg font-medium bg-white text-black hover:bg-gray-200 border-none touch-manipulation"
                      disabled={loading || isRedirecting || isDeveloperLoading}
                    >
                      {isRedirecting ? (
                        <>
                          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 lg:w-6 lg:h-6 mr-2 sm:mr-3 md:mr-3 lg:mr-4 animate-spin text-black" />
                          Redirecting...
                        </>
                      ) : authProvider === 'google' ? (
                        <>
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 lg:w-6 lg:h-6 mr-2 sm:mr-3 md:mr-3 lg:mr-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          Continue with Google
                        </>
                      ) : (
                        <>
                          <img src={sentryLogoDark} alt="Sentry" className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 lg:w-6 lg:h-6 mr-2 sm:mr-3 md:mr-3 lg:mr-4" />
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
                          className="data-[state=checked]:bg-amber-600 data-[state=unchecked]:bg-gray-600 scale-100 sm:scale-110 md:scale-110 lg:scale-125"
                        />
                        <Label htmlFor="developer-mode" className="text-sm sm:text-sm md:text-base font-medium text-white">
                          Developer Mode
                        </Label>
                      </div>

                      {/* Developer Mode Form */}
                      {isDeveloperMode && (
                        <div className="space-y-3 sm:space-y-4 md:space-y-5 p-3 sm:p-4 md:p-5 border border-gray-600 rounded-lg bg-gray-900/50">
                          <div className="flex items-center space-x-3 text-amber-400">
                            <Code2 className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                            <span className="text-sm sm:text-sm md:text-base font-medium">Development Access</span>
                          </div>
                          
                          <div className="space-y-2 sm:space-y-2 md:space-y-3">
                            <Label htmlFor="developer-email" className="text-sm sm:text-sm md:text-base text-white">
                              Email Address
                            </Label>
                            <Input
                              id="developer-email"
                              type="email"
                              placeholder="Enter your email"
                              value={developerEmail}
                              onChange={(e) => setDeveloperEmail(e.target.value)}
                              disabled={loading || isRedirecting || isDeveloperLoading}
                              className="h-9 sm:h-10 md:h-11 lg:h-12 text-sm sm:text-sm md:text-base bg-gray-800 border-gray-600 text-white placeholder-gray-400"
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
                            className="w-full h-9 sm:h-10 md:h-11 lg:h-12 text-sm sm:text-sm md:text-base bg-white text-black hover:bg-gray-200 border-gray-600 touch-manipulation"
                            disabled={loading || isRedirecting || isDeveloperLoading || !developerEmail.trim()}
                          >
                            {isDeveloperLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-2 sm:mr-2 md:mr-3 animate-spin text-black" />
                                Logging in...
                              </>
                            ) : (
                              <>
                                <Code2 className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-2 sm:mr-2 md:mr-3 text-black" />
                                Login as Developer
                              </>
                            )}
                          </Button>
                          
                          <p className="text-xs sm:text-xs md:text-sm text-gray-400 break-all">
                            This will log you in as <strong className="text-white">{developerEmail.trim() ? `${developerEmail.trim().split('@')[0]}+demo@${developerEmail.trim().split('@')[1] || 'example.com'}` : 'email+demo@domain.com'}</strong>
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Security Notice */}
                  <div className="text-center">
                    <p className="text-xs sm:text-xs md:text-sm text-gray-400">
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