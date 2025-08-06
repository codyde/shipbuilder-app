import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, AlertTriangle } from 'lucide-react';
import { LoginScreen } from '@/components/LoginScreen';

interface PendingAuth {
  id: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  user_id?: string;
  created_at: number;
  expires_at: number;
}

export function MCPConsentPage() {
  const { user } = useAuth();
  const [pendingAuth, setPendingAuth] = useState<PendingAuth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  
  // Get JWT token from localStorage
  const token = localStorage.getItem('authToken');
  
  // Get auth_id from URL or localStorage (after OAuth callback)
  const urlParams = new URLSearchParams(window.location.search);
  const authIdFromUrl = urlParams.get('auth_id');
  const authIdFromStorage = localStorage.getItem('mcpAuthId');
  const authId = authIdFromUrl || authIdFromStorage;

  useEffect(() => {
    // Handle OAuth success callback - update token and clear URL parameters
    const isOAuthCallback = urlParams.has('success') && urlParams.has('token');
    if (isOAuthCallback) {
      const newToken = urlParams.get('token');
      if (newToken) {
        localStorage.setItem('authToken', newToken);
        // Clear the URL parameters to clean up the URL
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('success');
        cleanUrl.searchParams.delete('token');
        window.history.replaceState({}, '', cleanUrl.toString());
      }
    }
    
    if (!authId) {
      setError('Missing authorization ID');
      setLoading(false);
      return;
    }

    // Fetch pending authorization details from MCP service
    const fetchPendingAuth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_MCP_BASE_URL || 'http://localhost:3002'}/api/auth/pending/${authId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error_description || 'Failed to load authorization request');
        }
        
        const data = await response.json();
        setPendingAuth(data);
      } catch (err) {
        console.error('Failed to fetch pending authorization:', err);
        setError(err instanceof Error ? err.message : 'Failed to load authorization request');
      } finally {
        setLoading(false);
      }
    };

    fetchPendingAuth();
  }, [authId]);

  const handleAction = async (action: 'approve' | 'deny') => {
    if (!pendingAuth || !token || !authId) {
      console.error('Missing required data for consent action', {
        hasPendingAuth: !!pendingAuth,
        hasToken: !!token,
        hasAuthId: !!authId
      });
      alert('Missing required information for authorization');
      return;
    }
    
    setConsentLoading(true);
    try {
      console.log('Submitting consent action', {
        action,
        authId,
        hasToken: !!token,
        tokenLength: token?.length
      });
      
      const response = await fetch(`${import.meta.env.VITE_MCP_BASE_URL || 'http://localhost:3002'}/api/auth/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_id: authId,
          action: action,
          main_app_token: token,
        }),
      });
      
      console.log('Consent response received', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('Consent action successful', { action, result });
        
        // Clear any MCP-related localStorage items
        localStorage.removeItem('mcpLoginFlow');
        localStorage.removeItem('mcpOAuthParams');
        localStorage.removeItem('mcpState');
        localStorage.removeItem('mcpAuthId');
        
        // Redirect back to MCP client
        window.location.href = result.redirect_uri;
      } else {
        console.error('Consent action failed', { status: response.status, result });
        throw new Error(result.error_description || `Failed to ${action} authorization`);
      }
    } catch (error) {
      console.error('Authorization error:', error);
      console.error('Full error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      alert(`Failed to ${action} MCP access: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setConsentLoading(false);
    }
  };

  // Show login screen if user is not authenticated, but preserve MCP context
  // This should actually not happen since we redirect unauthenticated users to main app
  if (!user) {
    // Redirect to main app with MCP context
    if (authId) {
      window.location.href = `${window.location.origin}/?mcp_auth_id=${authId}&mcp_login=true`;
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      );
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full relative z-20">
          <Card className="border-2 bg-background/95 backdrop-blur-sm">
            <CardHeader className="text-center px-6 py-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Authorization Error</CardTitle>
              <CardDescription className="text-base">
                Missing authorization context. Please restart the MCP authorization flow.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4 px-6 pb-6">
              <Button
                onClick={() => window.location.href = '/'}
                size="lg"
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show loading state while fetching pending auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-4 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading authorization request...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !pendingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full relative z-20">
          <Card className="border-2 bg-background/95 backdrop-blur-sm">
            <CardHeader className="text-center px-6 py-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Authorization Error</CardTitle>
              <CardDescription className="text-base">
                {error || 'Authorization request not found or expired'}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4 px-6 pb-6">
              <Button
                onClick={() => window.location.href = '/'}
                size="lg"
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full relative z-20">
        <Card className="border-2 bg-background/95 backdrop-blur-sm">
          <CardHeader className="text-center px-6 py-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Authorize MCP Access</CardTitle>
            <CardDescription className="text-base">
              An application wants to access your Shipbuilder data via Model Context Protocol
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 px-6 pb-6">
            {/* Requesting Application */}
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-sm font-medium text-foreground">{pendingAuth.client_id}</p>
              <p className="text-xs text-muted-foreground">wants to {pendingAuth.scope}</p>
            </div>

            {/* Your Account */}
            <div className="text-center p-3 border rounded-lg">
              <div className="flex items-center justify-center space-x-2">
                {user.avatar && (
                  <img 
                    src={user.avatar} 
                    alt={user.name} 
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium text-sm">{user.name}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-2">
              <Button
                onClick={() => handleAction('deny')}
                disabled={consentLoading}
                variant="outline"
                size="lg"
                className="flex-1"
              >
                Deny
              </Button>
              <Button
                onClick={() => handleAction('approve')}
                disabled={consentLoading}
                size="lg"
                className="flex-1"
              >
                {consentLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Authorize
                  </>
                )}
              </Button>
            </div>

            {/* Footer Notice */}
            <div className="pt-2">
              <p className="text-xs text-muted-foreground text-center">
                Read-only access • No data modification
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}