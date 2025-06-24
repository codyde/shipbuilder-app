import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { User } from '@/types/types';
import * as Sentry from '@sentry/react';
import { getApiUrl } from '@/lib/api-config';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'LOGOUT' };

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload, error: null };
    case 'LOGOUT':
      return { ...state, user: null };
    default:
      return state;
  }
}

interface AuthContextValue extends AuthState {
  logout: () => void;
  checkAuth: () => Promise<void>;
  handleOAuthCallback: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const apiCall = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      headers: {
        ...headers,
        ...options.headers,
      },
      ...options,
    });

    // Handle token expiration
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.code === 'TOKEN_EXPIRED' || errorData.code === 'INVALID_TOKEN') {
        // Token expired or invalid, clear auth but don't redirect (app handles this with login screen)
        localStorage.removeItem('authToken');
        dispatch({ type: 'LOGOUT' });
        throw new Error('Session expired. Please log in again.');
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  };


  const logout = () => {
    localStorage.removeItem('authToken');
    
    // Clear Sentry user context on logout
    Sentry.setUser(null);
    
    dispatch({ type: 'LOGOUT' });
  };

  const checkAuth = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        dispatch({ type: 'SET_USER', payload: null });
        return;
      }

      const response = await apiCall(getApiUrl('auth/me'));
      
      // Update Sentry user context when restoring user session
      Sentry.setUser({
        id: response.user.id,
        email: response.user.email,
        username: response.user.name
      });
      
      dispatch({ type: 'SET_USER', payload: response.user });
    } catch (error) {
      // If auth check fails, clear stored token
      localStorage.removeItem('authToken');
      
      // Clear Sentry user context when auth fails
      Sentry.setUser(null);
      
      dispatch({ type: 'SET_USER', payload: null });
      
      // Don't show error for session expiration as it's handled in apiCall
      if (error instanceof Error && !error.message.includes('Session expired')) {
        console.error('Auth check failed:', error);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const handleOAuthCallback = useCallback(async (): Promise<boolean> => {
    const { logger } = Sentry;
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const token = urlParams.get('token');

    // If no OAuth parameters, return false (not an OAuth callback)
    if (!success && !error) {
      return false;
    }

    console.log('OAuth callback detected:', { success, error, hasToken: !!token });

    logger.info('Processing OAuth callback', { success, error, hasToken: !!token });

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      if (error) {
        // Handle OAuth error
        let errorMessage = 'OAuth login failed';
        switch (error) {
          case 'missing_code':
            errorMessage = 'OAuth authorization failed';
            break;
          case 'oauth_failed':
            errorMessage = 'Failed to complete OAuth login';
            break;
          case 'user_creation_failed':
            errorMessage = 'Failed to create user account';
            break;
          case 'user_update_failed':
            errorMessage = 'Failed to update user account';
            break;
          case 'user_not_found':
            errorMessage = 'User account not found after creation';
            break;
          default:
            errorMessage = `OAuth error: ${error}`;
        }
        
        logger.error(logger.fmt`OAuth callback error: ${errorMessage}`, { 
          error, 
          success, 
          hasToken: !!token,
          urlParams: Object.fromEntries(urlParams)
        });
        
        Sentry.captureException(new Error(errorMessage), {
          tags: { oauth_step: 'frontend_callback' },
          extra: { error, success, hasToken: !!token, urlParams: Object.fromEntries(urlParams) }
        });
        
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        return true;
      }

      if (success && token) {
        logger.info('OAuth success, storing JWT token');
        
        try {
          // Decode and store the JWT token
          const decodedToken = decodeURIComponent(token);
          localStorage.setItem('authToken', decodedToken);
          
          // Fetch user details using the token
          const response = await apiCall(getApiUrl('auth/me'));
          logger.info('Successfully fetched user after OAuth', { 
            userId: response.user.id, 
            email: response.user.email 
          });
          
          // Update Sentry user context after successful login
          Sentry.setUser({
            id: response.user.id,
            email: response.user.email,
            username: response.user.name
          });
          
          dispatch({ type: 'SET_USER', payload: response.user });
        } catch (userFetchError) {
          logger.error('Failed to fetch user after OAuth success', { 
            error: userFetchError,
            hasToken: !!token
          });
          Sentry.captureException(userFetchError instanceof Error ? userFetchError : new Error('Failed to fetch user after OAuth'), {
            tags: { oauth_step: 'user_fetch_after_oauth' },
            extra: { hasToken: !!token, originalError: String(userFetchError) }
          });
          localStorage.removeItem('authToken');
          
          // Clear Sentry user context when OAuth user fetch fails
          Sentry.setUser(null);
          
          dispatch({ type: 'SET_ERROR', payload: 'Failed to complete login after OAuth' });
          return true;
        }
        
        return true;
      }

      logger.warn('OAuth callback with unexpected parameters', { success, error, hasToken: !!token });
      return false;
    } catch (callbackError) {
      logger.error('Unexpected error in OAuth callback handler', { 
        callbackError,
        success,
        oauthError: error,
        hasToken: !!token
      });
      Sentry.captureException(callbackError instanceof Error ? callbackError : new Error('Unexpected OAuth callback error'), {
        tags: { oauth_step: 'frontend_callback_unexpected' },
        extra: { success, error, hasToken: !!token, originalError: String(callbackError) }
      });
      dispatch({ type: 'SET_ERROR', payload: 'Failed to complete OAuth login' });
      return true;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      
      // Clean up URL parameters after OAuth callback
      if (success || error) {
        // Remove OAuth params from URL to clean up the browser history
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // First check if this is an OAuth callback
        const isOAuthCallback = await handleOAuthCallback();
        
        // If not an OAuth callback, proceed with normal auth check
        if (!isOAuthCallback) {
          await checkAuth();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Ensure loading is set to false even if there's an error
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    
    initAuth();
  }, [handleOAuthCallback, checkAuth]);

  const value: AuthContextValue = {
    ...state,
    logout,
    checkAuth,
    handleOAuthCallback,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}