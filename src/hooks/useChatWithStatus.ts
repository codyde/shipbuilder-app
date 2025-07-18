import { useChat, UseChatOptions } from 'ai/react';
import { useState, useCallback, useRef } from 'react';
import { StatusMessage } from '@/components/ui/tool-status-display';

interface UseChatWithStatusOptions extends UseChatOptions {
  onStatusUpdate?: (status: StatusMessage) => void;
}

export function useChatWithStatus(options: UseChatWithStatusOptions = {}) {
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [isToolExecuting, setIsToolExecuting] = useState(false);
  const statusCallbackRef = useRef(options.onStatusUpdate);

  // Update the callback ref when it changes
  statusCallbackRef.current = options.onStatusUpdate;

  const addStatusMessage = useCallback((message: StatusMessage) => {
    setStatusMessages(prev => [...prev, message]);
    statusCallbackRef.current?.(message);
    
    // Track tool execution state
    if (message.type === 'tool-start') {
      setIsToolExecuting(true);
    } else if (message.type === 'tool-success' || message.type === 'tool-error' || message.type === 'stream-complete') {
      setIsToolExecuting(false);
    }
  }, []);

  const clearStatusMessages = useCallback(() => {
    setStatusMessages([]);
    setIsToolExecuting(false);
  }, []);

  // Create a custom fetch function that intercepts responses and parses status messages
  const customFetch = useCallback(async (url: string, init?: RequestInit) => {
    const originalFetch = options.fetch || fetch;
    
    try {
      const response = await originalFetch(url, init);
      
      if (!response.body) {
        return response;
      }

      // Create a new readable stream that intercepts chunks
      const readable = new ReadableStream({
        start(controller) {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();

          function pump(): Promise<void> {
            return reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }

              const chunk = decoder.decode(value, { stream: true });
              
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
                    } catch {
                      // Ignore JSON parsing errors for non-status messages
                    }
                  }
                }
              } catch {
                // Ignore parsing errors
              }

              // Forward the original chunk to the AI SDK
              controller.enqueue(value);
              return pump();
            });
          }

          return pump();
        }
      });

      // Return a new response with our intercepted stream
      return new Response(readable, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      console.error('Error in custom fetch:', error);
      throw error;
    }
  }, [options.fetch, addStatusMessage]);

  // Use the original useChat hook with our custom fetch
  const chatResult = useChat({
    ...options,
    fetch: customFetch as typeof fetch,
    onFinish: (message, { usage, finishReason }) => {
      // Clear tool execution state when chat finishes
      setIsToolExecuting(false);
      
      // Call the original onFinish if provided
      options?.onFinish?.(message, { usage, finishReason });
    }
  });

  // Clear status messages when starting a new message
  const originalHandleSubmit = chatResult.handleSubmit;
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    clearStatusMessages();
    originalHandleSubmit(e);
  }, [clearStatusMessages, originalHandleSubmit]);

  return {
    ...chatResult,
    handleSubmit,
    statusMessages,
    isToolExecuting,
    addStatusMessage,
    clearStatusMessages
  };
}