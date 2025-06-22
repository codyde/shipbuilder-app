import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Mail, Calendar, Shield } from 'lucide-react';

interface UserProfileProps {
  children: React.ReactNode;
}

export function UserProfile({ children }: UserProfileProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Unknown';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return 'Unknown';
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
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-md text-foreground border-border shadow-xl ring-1 ring-black/5 dark:ring-white/10">
        <DialogHeader>
          <DialogTitle className="text-foreground">User Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}