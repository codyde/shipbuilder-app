import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';

interface OAuthParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  state?: string;
  authorization_code: string;
}

export function MCPConsentScreen() {
  const { user } = useAuth();
  const [oauthParams, setOauthParams] = useState<OAuthParams | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Get JWT token from localStorage
  const token = localStorage.getItem('authToken');

  useEffect(() => {
    // Try to get OAuth params from URL parameters first, then localStorage
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if we have token and need to store it
    const authToken = urlParams.get('token');
    if (authToken) {
      localStorage.setItem('authToken', authToken);
    }
    
    // Check for individual parameters (from traditional MCP authorization flow)
    const authCode = urlParams.get('authorization_code');
    const clientId = urlParams.get('client_id');
    const scope = urlParams.get('scope');
    const mcpService = urlParams.get('mcp_service');
    
    if (authCode && clientId) {
      // Build OAuth params from individual URL parameters
      const params: OAuthParams = {
        response_type: 'code',
        client_id: clientId,
        redirect_uri: mcpService || '',
        authorization_code: authCode,
        scope: scope || 'projects:read tasks:read'
      };
      setOauthParams(params);
      return;
    }
    
    // Fallback: Try to get JSON-encoded oauth_params from URL or localStorage
    let encodedParams = urlParams.get('oauth_params');
    if (!encodedParams) {
      encodedParams = localStorage.getItem('mcpOAuthParams');
    }
    
    // Also check for mcp_state parameter (when coming from login screen)
    let mcpStateParam = urlParams.get('mcp_state');
    if (!mcpStateParam) {
      mcpStateParam = localStorage.getItem('mcpState');
    }
    
    if (encodedParams) {
      try {
        const params = JSON.parse(decodeURIComponent(encodedParams));
        setOauthParams(params);
      } catch (error) {
        console.error('Invalid OAuth params:', error);
        // Clear MCP flow state and redirect
        localStorage.removeItem('mcpLoginFlow');
        localStorage.removeItem('mcpOAuthParams');
        localStorage.removeItem('mcpState');
        window.location.href = '/';
      }
    } else if (mcpStateParam) {
      try {
        // This is the initial MCP flow - decode the state to show user what's being authorized
        const decoded = JSON.parse(decodeURIComponent(mcpStateParam));
        console.log('MCP state decoded:', decoded);
        
        // We're still waiting for the user to complete OAuth and get an authorization code
        // For now, just show a message that OAuth needs to be completed first
        console.log('MCP flow detected but user needs to complete OAuth first');
        // Don't set oauthParams yet - wait for OAuth completion
      } catch (error) {
        console.error('Invalid MCP state:', error);
        // Clear MCP flow state and redirect
        localStorage.removeItem('mcpLoginFlow');
        localStorage.removeItem('mcpOAuthParams');
        localStorage.removeItem('mcpState');
        window.location.href = '/';
      }
    } else {
      // No OAuth params or MCP state found, clear MCP flow state and redirect
      localStorage.removeItem('mcpLoginFlow');
      localStorage.removeItem('mcpOAuthParams');
      localStorage.removeItem('mcpState');
      window.location.href = '/';
    }
  }, []);

  const handleApprove = async () => {
    if (!oauthParams || !token) {
      console.error('Missing oauthParams or token', { hasOauthParams: !!oauthParams, hasToken: !!token });
      alert('Missing required parameters for authorization');
      return;
    }
    
    setLoading(true);
    try {
      // Submit consent approval to MCP service
      const mcpServiceUrl = new URLSearchParams(window.location.search).get('mcp_service') || 'http://localhost:3002';
      console.log('Making consent request', {
        mcpServiceUrl,
        authCode: oauthParams.authorization_code?.substring(0, 8) + '...',
        hasToken: !!token,
        tokenLength: token?.length
      });
      
      const response = await fetch(`${mcpServiceUrl}/api/auth/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authorization_code: oauthParams.authorization_code,
          action: 'approve',
          main_app_token: token,
        }),
      });
      
      console.log('Consent response received', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Clear MCP flow state
        localStorage.removeItem('mcpLoginFlow');
        localStorage.removeItem('mcpOAuthParams');
        
        // Redirect back to MCP client with authorization code
        window.location.href = result.redirect_uri;
      } else {
        console.error('Consent request failed', { status: response.status, result });
        throw new Error(result.error_description || 'Failed to authorize');
      }
    } catch (error) {
      console.error('Authorization error:', error);
      console.error('Full error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      alert(`Failed to authorize MCP access: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!oauthParams || !token) return;
    
    setLoading(true);
    try {
      // Submit consent denial to MCP service
      const mcpServiceUrl = new URLSearchParams(window.location.search).get('mcp_service') || 'http://localhost:3002';
      const response = await fetch(`${mcpServiceUrl}/api/auth/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authorization_code: oauthParams.authorization_code,
          action: 'deny',
          main_app_token: token,
        }),
      });
      
      const result = await response.json();
      
      // Clear MCP flow state
      localStorage.removeItem('mcpLoginFlow');
      localStorage.removeItem('mcpOAuthParams');
      
      // Redirect back to MCP client with error
      window.location.href = result.redirect_uri;
    } catch (error) {
      console.error('Denial error:', error);
      // Still redirect back with error
      const callbackUrl = new URL(oauthParams.redirect_uri);
      callbackUrl.searchParams.set('error', 'access_denied');
      callbackUrl.searchParams.set('error_description', 'User denied authorization');
      if (oauthParams.state) {
        callbackUrl.searchParams.set('state', oauthParams.state);
      }
      
      window.location.href = callbackUrl.toString();
    } finally {
      setLoading(false);
    }
  };

  if (!oauthParams || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-4 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
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
              <p className="text-sm font-medium text-foreground">{oauthParams.client_id}</p>
              <p className="text-xs text-muted-foreground">wants to read your projects and tasks</p>
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
                onClick={handleDeny}
                disabled={loading}
                variant="outline"
                size="lg"
                className="flex-1"
              >
                Deny
              </Button>
              <Button
                onClick={handleApprove}
                disabled={loading}
                size="lg"
                className="flex-1"
              >
                {loading ? (
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