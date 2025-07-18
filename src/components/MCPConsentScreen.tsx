import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Shield, Eye, Database, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';

export function MCPConsentScreen() {
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Extract OAuth parameters from URL
  const mcpService = searchParams.get('mcp_service');
  const authorizationCode = searchParams.get('authorization_code');
  const clientId = searchParams.get('client_id');
  const scope = searchParams.get('scope');

  // Parse scope into readable permissions
  const permissions = scope?.split(' ') || [];
  const scopeDescriptions = {
    'projects:read': 'Read your projects and their details',
    'tasks:read': 'Read your tasks and their status',
    'projects:write': 'Create and modify your projects',
    'tasks:write': 'Create and modify your tasks'
  };

  useEffect(() => {
    // Validate required parameters
    if (!mcpService || !authorizationCode || !clientId) {
      setError('Missing required OAuth parameters. Please try the authorization flow again.');
    }
  }, [mcpService, authorizationCode, clientId]);

  const handleConsent = async (action: 'approve' | 'deny') => {
    if (!mcpService || !authorizationCode || !token) {
      setError('Missing required authentication information');
      return;
    }

    setLoading(true);
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${mcpService}/api/auth/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authorization_code: authorizationCode,
          action,
          main_app_token: token
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Show success message briefly before redirecting
        setProcessing(false);
        
        // Redirect to the client's callback URL
        setTimeout(() => {
          window.location.href = data.redirect_uri;
        }, 1000);
      } else {
        setError(data.error_description || 'Failed to process consent');
        setProcessing(false);
      }
    } catch (err) {
      setError('Network error occurred. Please check your connection and try again.');
      setProcessing(false);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while processing
  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="text-lg font-semibold">Processing your consent...</h2>
              <p className="text-gray-600">Please wait while we complete the authorization.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show login required state
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <CardTitle className="text-2xl">Authentication Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600 text-center">
              Please log in to your Shipbuilder account to authorize MCP access.
            </p>
            <Button 
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <CardTitle className="text-2xl">Authorization Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button 
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main consent screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <CardTitle className="text-2xl">MCP Authorization Request</CardTitle>
          <p className="text-gray-600 mt-2">
            A Model Context Protocol client is requesting access to your Shipbuilder data
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* User Info */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Signed in as:</h3>
            <div className="flex items-center space-x-3">
              {user.avatar && (
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div>
                <p className="font-medium text-blue-900">{user.name}</p>
                <p className="text-sm text-blue-700">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Client Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Client Information:</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Client ID:</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {clientId}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Service:</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {mcpService}
                </Badge>
              </div>
            </div>
          </div>

          {/* Requested Permissions */}
          <div className="bg-yellow-50 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-3 flex items-center">
              <Eye className="h-4 w-4 mr-2" />
              Requested Permissions:
            </h3>
            <div className="space-y-2">
              {permissions.map((permission) => (
                <div key={permission} className="flex items-start space-x-3">
                  <Database className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900">
                      {scopeDescriptions[permission as keyof typeof scopeDescriptions] || permission}
                    </p>
                    <p className="text-xs text-yellow-700">{permission}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Notice */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Notice:</strong> This client will only have access to your data 
              for the specific permissions you approve. You can revoke this access at any time 
              from your account settings.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              onClick={() => handleConsent('deny')}
              disabled={loading}
              variant="outline"
              className="flex-1"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Deny Access
            </Button>
            <Button
              onClick={() => handleConsent('approve')}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve Access
            </Button>
          </div>

          {/* Footer */}
          <div className="text-center pt-4 border-t">
            <p className="text-xs text-gray-500">
              By approving, you allow this client to access your Shipbuilder data according to 
              the requested permissions. 
              <a href="/privacy" className="text-blue-600 hover:underline ml-1">
                Privacy Policy
                <ExternalLink className="h-3 w-3 inline ml-1" />
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}