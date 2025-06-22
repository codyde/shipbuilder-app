import React from 'react';
import { Settings } from 'lucide-react';

export function LoadingAnimation() {
  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .animate-spin-slow {
          animation: spin 2s linear infinite;
        }
      `}</style>
      
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="mb-8">
          <Settings className="w-12 h-12 text-primary animate-spin-slow" />
        </div>
        
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Loading your workspace</h3>
          <p className="text-sm text-muted-foreground">Setting up your projects and tools...</p>
        </div>
      </div>
    </>
  );
}