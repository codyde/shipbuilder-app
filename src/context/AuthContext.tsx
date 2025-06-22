import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User } from '@/types/types';

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

  const checkAuth = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const userId = localStorage.getItem('userId');
      if (!userId) {
        dispatch({ type: 'SET_USER', payload: null });
        return;
      }

      const response = await apiCall('/api/auth/me');
      dispatch({ type: 'SET_USER', payload: response.user });
    } catch (error) {
      // If auth check fails, clear stored user
      localStorage.removeItem('userId');
      dispatch({ type: 'SET_USER', payload: null });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    checkAuth,
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