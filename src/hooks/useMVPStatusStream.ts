import { useState, useCallback, useRef } from 'react';
import { StatusMessage } from '@/components/ui/tool-status-display';
import { getApiUrl } from '@/lib/api-config';

interface MVPPlan {
  projectName: string;
  description: string;
  features: string[];
  techStack: {
    frontend: string;
    backend: string;
    database: string;
    hosting?: string;
  };
  tasks: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }[];
}

interface UseMVPStatusStreamOptions {
  onStatusUpdate?: (status: StatusMessage) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useMVPStatusStream(options: UseMVPStatusStreamOptions = {}) {
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [createdTasksCount, setCreatedTasksCount] = useState(0);
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addStatusMessage = useCallback((message: StatusMessage) => {
    setStatusMessages(prev => [...prev, message]);
    options.onStatusUpdate?.(message);

    // Track task creation progress
    if (message.type === 'tool-success' && message.operation === 'createTask') {
      setCreatedTasksCount(prev => prev + 1);
    }

    // Check for completion
    if (message.type === 'stream-complete') {
      setIsComplete(true);
      setIsCreating(false);
      options.onComplete?.();
    }
  }, [options]);

  const clearStatusMessages = useCallback(() => {
    setStatusMessages([]);
    setCreatedTasksCount(0);
    setTotalTasksCount(0);
    setIsComplete(false);
  }, []);

  const createMVPProject = useCallback(async (mvpPlan: MVPPlan) => {
    setIsCreating(true);
    setIsComplete(false);
    setCreatedTasksCount(0);
    setTotalTasksCount(mvpPlan.tasks.length);
    clearStatusMessages();

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token missing. Please log in again.');
      }

      const response = await fetch(getApiUrl('ai/create-mvp-project'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ mvpPlan }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error || response.statusText;
        
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Failed to create MVP project: ${errorMessage}`);
        }
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;

          // Parse chunk for status messages
          try {
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  // Check if this is a status message
                  if (data.type && ['status', 'tool-start', 'tool-success', 'tool-error', 'stream-complete'].includes(data.type)) {
                    const statusMessage: StatusMessage = {
                      type: data.type,
                      operation: data.operation,
                      status: data.status,
                      message: data.message,
                      data: data.data,
                      timestamp: data.timestamp
                    };
                    
                    addStatusMessage(statusMessage);
                  }
                } catch (parseError) {
                  // Ignore JSON parsing errors for non-status messages
                }
              }
            }
          } catch (error) {
            // Ignore parsing errors
          }
        }
      } finally {
        reader.releaseLock();
      }

      // If we didn't get a completion message, send one
      if (!isComplete) {
        addStatusMessage({
          type: 'stream-complete',
          status: 'success',
          message: `🎉 MVP "${mvpPlan.projectName}" created successfully!`,
          data: {
            projectName: mvpPlan.projectName,
            taskCount: mvpPlan.tasks.length
          }
        });
      }

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Request was aborted, don't show error
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to create MVP project. Please try again.';
      options.onError?.(errorMessage);
      
      addStatusMessage({
        type: 'tool-error',
        status: 'error',
        message: `❌ MVP creation failed: ${errorMessage}`,
        data: { error: errorMessage }
      });
      
      setIsCreating(false);
    } finally {
      abortControllerRef.current = null;
    }
  }, [addStatusMessage, clearStatusMessages, isComplete, options]);

  const cancelCreation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsCreating(false);
    addStatusMessage({
      type: 'tool-error',
      status: 'error',
      message: '❌ MVP creation cancelled by user',
      data: { error: 'Cancelled' }
    });
  }, [addStatusMessage]);

  const getProgress = useCallback(() => {
    if (totalTasksCount === 0) return 0;
    return Math.round((createdTasksCount / totalTasksCount) * 100);
  }, [createdTasksCount, totalTasksCount]);

  return {
    statusMessages,
    isCreating,
    isComplete,
    createdTasksCount,
    totalTasksCount,
    progress: getProgress(),
    createMVPProject,
    cancelCreation,
    clearStatusMessages,
    addStatusMessage
  };
}