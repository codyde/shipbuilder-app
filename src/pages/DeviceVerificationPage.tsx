import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/api-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Smartphone, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { LoginScreen } from '@/components/LoginScreen';

interface DeviceInfo {
  client_id: string;
  user_code: string;
  verification_uri: string;
  expires_in?: number;
}

export function DeviceVerificationPage() {
  const { user } = useAuth();
  const [userCode, setUserCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    deviceInfo?: DeviceInfo;
  } | null>(null);

  // Get user code from URL if present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('user_code');
    if (codeFromUrl) {
      setUserCode(codeFromUrl);
    }
  }, []);

  // Auto-format user code input
  const handleUserCodeChange = (value: string) => {
    // Remove all non-alphanumeric characters
    const cleaned = value.replace(/[^A-Z0-9]/g, '').toUpperCase();
    
    // Add hyphen after 4 characters
    let formatted = cleaned;
    if (cleaned.length > 4) {
      formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4, 8);
    }
    
    setUserCode(formatted);
  };

  const handleSubmit = async (action: 'approve' | 'deny') => {
    if (!userCode.trim()) {
      setResult({
        type: 'error',
        message: 'Please enter a user code'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/mcp/device/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          user_code: userCode,
          action,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          type: 'success',
          message: action === 'approve' 
            ? 'Device access approved! You can now return to your application.'
            : 'Device access denied.',
          deviceInfo: {
            client_id: data.client_id,
            user_code: userCode,
            verification_uri: window.location.origin + '/device',
          }
        });
        
        // Clear the user code after successful action
        setUserCode('');
      } else {
        setResult({
          type: 'error',
          message: data.error_description || data.error || 'Verification failed'
        });
      }

    } catch (error) {
      console.error('Device verification error:', error);
      setResult({
        type: 'error',
        message: 'Network error. Please check your connection and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 bg-primary/10 rounded-full">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Device Authorization</h1>
          <p className="text-muted-foreground">
            Authorize a device to access your Shipbuilder account
          </p>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-green-600" />
              <CardTitle className="text-sm">Signed in as</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Main Form */}
        <Card>
          <CardHeader>
            <CardTitle>Enter Device Code</CardTitle>
            <CardDescription>
              Enter the code displayed on your device or application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-code">User Code</Label>
              <Input
                id="user-code"
                placeholder="ABCD-1234"
                value={userCode}
                onChange={(e) => handleUserCodeChange(e.target.value)}
                className="text-center text-lg font-mono tracking-wider"
                maxLength={9} // ABCD-1234 format
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Format: XXXX-XXXX (letters and numbers)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button
                onClick={() => handleSubmit('approve')}
                disabled={loading || !userCode.trim()}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSubmit('deny')}
                disabled={loading || !userCode.trim()}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Deny
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result Message */}
        {result && (
          <Alert variant={result.type === 'error' ? 'destructive' : 'default'}>
            {result.type === 'success' && <CheckCircle className="h-4 w-4" />}
            {result.type === 'error' && <AlertTriangle className="h-4 w-4" />}
            <AlertDescription>
              {result.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="space-y-3 text-sm">
              <h3 className="font-medium flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                What happens when you approve?
              </h3>
              <ul className="space-y-1 text-muted-foreground ml-6">
                <li>• The device will gain access to your Shipbuilder projects</li>
                <li>• You can view and manage your tasks and projects</li>
                <li>• The device cannot modify your account settings</li>
                <li>• You can revoke access anytime from your profile</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Back to App */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => window.location.href = '/'}
            className="text-sm"
          >
            Back to Shipbuilder
          </Button>
        </div>
      </div>
    </div>
  );
}