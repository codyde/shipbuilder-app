import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatusMessage {
  type: 'status' | 'tool-start' | 'tool-success' | 'tool-error' | 'stream-complete';
  operation?: string;
  status?: 'starting' | 'running' | 'success' | 'error';
  message: string;
  data?: any;
  timestamp?: string;
}

interface ToolStatusDisplayProps {
  className?: string;
  maxItems?: number;
  showTimestamps?: boolean;
  autoScroll?: boolean;
}

export function ToolStatusDisplay({ 
  className = '', 
  maxItems = 50,
  showTimestamps = false,
  autoScroll = true 
}: ToolStatusDisplayProps) {
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Function kept for potential future use
  // const _addStatusMessage = (message: StatusMessage) => {
  //   setStatusMessages(prev => {
  //     const newMessages = [...prev, message];
  //     // Keep only the last maxItems messages
  //     return newMessages.slice(-maxItems);
  //   });
  //   
  //   // Show the component when first message arrives
  //   if (!isVisible) {
  //     setIsVisible(true);
  //   }
  // };

  const clearStatus = () => {
    setStatusMessages([]);
    setIsVisible(false);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [statusMessages, autoScroll]);


  const getStatusIcon = (message: StatusMessage) => {
    switch (message.type) {
      case 'tool-start':
        return <Loader2 className="w-3 h-3 animate-spin text-blue-500" />;
      case 'tool-success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'tool-error':
        return <XCircle className="w-3 h-3 text-red-500" />;
      case 'stream-complete':
        return <Zap className="w-3 h-3 text-purple-500" />;
      case 'status':
      default:
        return <Clock className="w-3 h-3 text-orange-500" />;
    }
  };

  const getStatusColor = (message: StatusMessage) => {
    switch (message.type) {
      case 'tool-start':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'tool-success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'tool-error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'stream-complete':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'status':
      default:
        return 'text-orange-600 bg-orange-50 border-orange-200';
    }
  };

  const getOperationBadgeColor = (operation?: string) => {
    switch (operation) {
      case 'createProject':
        return 'bg-blue-100 text-blue-800';
      case 'createTask':
        return 'bg-green-100 text-green-800';
      case 'updateTaskStatus':
        return 'bg-yellow-100 text-yellow-800';
      case 'listProjects':
      case 'getProject':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-purple-100 text-purple-800';
    }
  };

  if (!isVisible || statusMessages.length === 0) {
    return null;
  }

  return (
    <Card className={cn('p-3 border', className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">Tool Execution Status</h3>
        <button
          onClick={clearStatus}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
      
      <div 
        ref={scrollRef}
        className="max-h-32 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        {statusMessages.map((message, index) => (
          <div 
            key={index}
            className={cn(
              'flex items-start gap-2 p-2 rounded-md border text-xs',
              getStatusColor(message)
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getStatusIcon(message)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {message.operation && (
                  <Badge 
                    variant="secondary" 
                    className={cn('text-xs px-1.5 py-0.5 h-auto', getOperationBadgeColor(message.operation))}
                  >
                    {message.operation}
                  </Badge>
                )}
                {showTimestamps && message.timestamp && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
              
              <p className="text-xs leading-tight break-words">
                {message.message}
              </p>
              
              {/* Show additional data for certain message types */}
              {message.type === 'tool-success' && message.data?.data && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {message.data.data.id && (
                    <span>ID: {message.data.data.id}</span>
                  )}
                  {message.data.data.name && message.data.data.id && ' • '}
                  {message.data.data.name && (
                    <span>Name: {message.data.data.name}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Custom hook for parsing status messages from streaming responses
export function useStatusParser() {
  const [currentStatuses, setCurrentStatuses] = useState<StatusMessage[]>([]);
  const statusDisplayRef = useRef<{ addStatusMessage: (msg: StatusMessage) => void; clearStatus: () => void }>(null);

  const parseChunk = (chunk: string) => {
    try {
      // Look for status messages in the chunk
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // Check if this is a status message from our backend
            if (data.type && ['status', 'tool-start', 'tool-success', 'tool-error', 'stream-complete'].includes(data.type)) {
              const statusMessage: StatusMessage = {
                type: data.type,
                operation: data.operation,
                status: data.status,
                message: data.message,
                data: data.data,
                timestamp: data.timestamp
              };
              
              setCurrentStatuses(prev => [...prev, statusMessage]);
              statusDisplayRef.current?.addStatusMessage(statusMessage);
            }
          } catch {
            // Ignore JSON parsing errors for non-status messages
          }
        }
      }
    } catch {
      // Ignore parsing errors
    }
  };

  const clearStatuses = () => {
    setCurrentStatuses([]);
    statusDisplayRef.current?.clearStatus();
  };

  const connectToStatusDisplay = (ref: React.RefObject<{ addStatusMessage: (msg: StatusMessage) => void; clearStatus: () => void }>) => {
    if (ref.current) {
      statusDisplayRef.current = ref.current;
    }
  };

  return {
    parseChunk,
    clearStatuses,
    currentStatuses,
    connectToStatusDisplay
  };
}