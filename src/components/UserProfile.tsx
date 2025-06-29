import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiUrl } from '@/lib/api-config';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, User, Mail, Shield, Key, Plus, Trash2, Copy, Eye, EyeOff } from 'lucide-react';

interface UserProfileProps {
  children: React.ReactNode;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  displayKey: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  isActive: boolean;
}

interface NewApiKey {
  id: string;
  name: string;
  key: string;
  displayKey: string;
  createdAt: string;
  expiresAt: string | null;
  message: string;
}

export function UserProfile({ children }: UserProfileProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newApiKey, setNewApiKey] = useState<NewApiKey | null>(null);
  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [isCreating, setIsCreating] = useState(false);
  const [showFullKey, setShowFullKey] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch API keys when dialog opens
  useEffect(() => {
    if (open && user) {
      fetchApiKeys();
    }
  }, [open, user]);

  const getToken = () => {
    return localStorage.getItem('authToken');
  };

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch(getApiUrl('api-keys/list'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!keyName.trim()) return;
    
    try {
      setIsCreating(true);
      const token = getToken();
      const payload: { name: string; expiresInDays?: number } = { name: keyName.trim() };
      
      if (expiresInDays && typeof expiresInDays === 'number') {
        payload.expiresInDays = expiresInDays;
      }
      
      const response = await fetch(getApiUrl('api-keys/create'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        const data = await response.json();
        setNewApiKey(data);
        setKeyName('');
        setExpiresInDays('');
        fetchApiKeys(); // Refresh the list
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create API key');
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
      alert('Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = getToken();
      const response = await fetch(getApiUrl(`api-keys/${keyId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        fetchApiKeys(); // Refresh the list
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete API key');
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      alert('Failed to delete API key');
    }
  };

  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${description} copied to clipboard!`);
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  if (!user) return null;

  const getProviderDisplayName = (provider?: string) => {
    switch (provider) {
      case 'sentry':
        return 'Sentry';
      case 'github':
        return 'GitHub';
      case 'google':
        return 'Google';
      case 'fake':
        return 'Demo';
      default:
        return provider || 'Unknown';
    }
  };

  const getProviderColor = (provider?: string) => {
    switch (provider) {
      case 'sentry':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'github':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      case 'google':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'fake':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };


  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl bg-background/95 backdrop-blur-md text-foreground border-border shadow-xl ring-1 ring-black/5 dark:ring-white/10">
        <DialogHeader>
          <DialogTitle className="text-foreground">User Profile</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-4">
            {/* Avatar and Basic Info */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage 
                  src={user.avatar} 
                  alt={user.name}
                  onError={(e) => {
                    // Hide broken images gracefully
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <AvatarFallback className="text-lg">
                  {getUserInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{user.name}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.provider && (
                  <Badge variant="secondary" className={getProviderColor(user.provider)}>
                    <Shield className="w-3 h-3 mr-1" />
                    {getProviderDisplayName(user.provider)}
                  </Badge>
                )}
              </div>
            </div>

            {/* Profile Details */}
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center space-x-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{user.name}</span>
                </div>
                
                <div className="flex items-center space-x-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{user.email}</span>
                </div>

                {user.provider && (
                  <div className="flex items-center space-x-3 text-sm">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Provider:</span>
                    <span className="font-medium">{getProviderDisplayName(user.provider)}</span>
                  </div>
                )}

                {user.providerId && (
                  <div className="flex items-center space-x-3 text-sm">
                    <span className="text-muted-foreground">Provider ID:</span>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {user.providerId}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="api-keys" className="space-y-4">
            {/* New API Key Display */}
            {newApiKey && (
              <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <CardHeader>
                  <CardTitle className="text-green-800 dark:text-green-200 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    API Key Created Successfully
                  </CardTitle>
                  <CardDescription className="text-green-700 dark:text-green-300">
                    {newApiKey.message}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-green-800 dark:text-green-200">API Key</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          value={showFullKey ? newApiKey.key : newApiKey.displayKey}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowFullKey(!showFullKey)}
                        >
                          {showFullKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(newApiKey.key, 'API key')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewApiKey(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Create New API Key */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create New API Key
                </CardTitle>
                <CardDescription>
                  Generate a new API key for accessing your account via API calls.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    placeholder="e.g., Production Server"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label htmlFor="expires-in">Expires In (Days, Optional)</Label>
                  <Input
                    id="expires-in"
                    type="number"
                    placeholder="Leave empty for no expiration"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : '')}
                    min={1}
                    max={365}
                  />
                </div>
                <Button
                  onClick={createApiKey}
                  disabled={!keyName.trim() || isCreating}
                  className="w-full"
                >
                  {isCreating ? 'Creating...' : 'Create API Key'}
                </Button>
              </CardContent>
            </Card>

            {/* API Keys List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Your API Keys
                </CardTitle>
                <CardDescription>
                  Manage your existing API keys. Use these keys to authenticate API requests.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-4">Loading API keys...</div>
                ) : apiKeys.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No API keys found. Create one above to get started.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">{key.name}</div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {key.displayKey}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Created: {new Date(key.createdAt).toLocaleDateString()}
                            {key.expiresAt && (
                              <span> • Expires: {new Date(key.expiresAt).toLocaleDateString()}</span>
                            )}
                            {key.lastUsedAt && (
                              <span> • Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteApiKey(key.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}