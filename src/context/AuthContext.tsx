import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { User } from '@/types/types';
import * as Sentry from '@sentry/react';

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
  login: (email: string, name: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  handleOAuthCallback: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const apiCall = async (url: string, options: RequestInit = {}) => {
    const userId = localStorage.getItem('userId');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (userId) {
      headers['x-user-id'] = userId;
    }

    const response = await fetch(url, {
      headers: {
        ...headers,
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  };

  const login = async (email: string, name: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      const response = await apiCall('/api/auth/fake-login', {
        method: 'POST',
        body: JSON.stringify({ email, name }),
      });

      const user = response.user;
      localStorage.setItem('userId', user.id);
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Login failed' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const logout = () => {
    localStorage.removeItem('userId');
    dispatch({ type: 'LOGOUT' });
  };

  const checkAuth = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const userId = localStorage.getItem('userId');
      if (!userId) {
        dispatch({ type: 'SET_USER', payload: null });
        return;
      }

      const response = await apiCall('/api/auth/me');
      dispatch({ type: 'SET_USER', payload: response.user });
    } catch {
      // If auth check fails, clear stored user
      localStorage.removeItem('userId');
      dispatch({ type: 'SET_USER', payload: null });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const handleOAuthCallback = useCallback(async (): Promise<boolean> => {
    const { logger } = Sentry;
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const userId = urlParams.get('userId');

    // If no OAuth parameters, return false (not an OAuth callback)
    if (!success && !error) {
      return false;
    }

    logger.info('Processing OAuth callback', { success, error, userId });

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
          userId,
          urlParams: Object.fromEntries(urlParams)
        });
        
        Sentry.captureException(new Error(errorMessage), {
          tags: { oauth_step: 'frontend_callback' },
          extra: { error, success, userId, urlParams: Object.fromEntries(urlParams) }
        });
        
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        return true;
      }

      if (success && userId) {
        logger.info(logger.fmt`OAuth success, setting user ID: ${userId}`);
        
        // Handle OAuth success
        localStorage.setItem('userId', userId);
        
        // Fetch user details
        try {
          const response = await apiCall('/api/auth/me');
          logger.info('Successfully fetched user after OAuth', { 
            userId: response.user.id, 
            email: response.user.email 
          });
          dispatch({ type: 'SET_USER', payload: response.user });
        } catch (userFetchError) {
          logger.error('Failed to fetch user after OAuth success', { 
            error: userFetchError,
            userId 
          });
          Sentry.captureException(userFetchError instanceof Error ? userFetchError : new Error('Failed to fetch user after OAuth'), {
            tags: { oauth_step: 'user_fetch_after_oauth' },
            extra: { userId, originalError: String(userFetchError) }
          });
          dispatch({ type: 'SET_ERROR', payload: 'Failed to complete login after OAuth' });
          return true;
        }
        
        return true;
      }

      logger.warn('OAuth callback with unexpected parameters', { success, error, userId });
      return false;
    } catch (callbackError) {
      logger.error('Unexpected error in OAuth callback handler', { 
        error: callbackError,
        success,
        error: error,
        userId
      });
      Sentry.captureException(callbackError instanceof Error ? callbackError : new Error('Unexpected OAuth callback error'), {
        tags: { oauth_step: 'frontend_callback_unexpected' },
        extra: { success, error, userId, originalError: String(callbackError) }
      });
      dispatch({ type: 'SET_ERROR', payload: 'Failed to complete OAuth login' });
      return true;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    const initAuth = async () => {
      // First check if this is an OAuth callback
      const isOAuthCallback = await handleOAuthCallback();
      
      // If not an OAuth callback, proceed with normal auth check
      if (!isOAuthCallback) {
        await checkAuth();
      }
    };
    
    initAuth();
  }, [handleOAuthCallback, checkAuth]);

  const value: AuthContextValue = {
    ...state,
    login,
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