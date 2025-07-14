import React, { useRef, useEffect } from 'react';
import { useProjects } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { ToolInvocation } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { ToolStatusDisplay } from '@/components/ui/tool-status-display';
import { useChatWithStatus } from '@/hooks/useChatWithStatus';
import { X, MessageCircle, Send, ChevronDown, GripHorizontal } from 'lucide-react';
import { useDraggable } from '@/hooks/useDraggable';
import { useIsMobile } from '@/hooks/use-mobile';
import { getApiUrl } from '@/lib/api-config';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';

interface ChatMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'data' | 'system';
    content: string;
    toolInvocations?: ToolInvocation[];
  };
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
      <Card className={`p-3 ${
        isUser 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted'
      }`}>
        {isUser ? (
          <div className="text-sm leading-relaxed">
            {message.content}
          </div>
        ) : (
          <MarkdownRenderer 
            content={message.content} 
            className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" 
          />
        )}
        {message.toolInvocations && message.toolInvocations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30">
            {message.toolInvocations.map((tool, index) => (
              <div key={index} className="mb-2 last:mb-0">
                <Badge variant="secondary" className="text-xs">
                  {tool.toolName}
                </Badge>
                {tool.result && (
                  <div className="mt-1 text-xs">
                    {tool.result.success ? (
                      <span className="text-green-600">✓ {tool.result.message}</span>
                    ) : (
                      <span className="text-red-600">✗ {tool.result.message}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className={`text-xs text-muted-foreground mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
        {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}

interface ChatInterfaceProps {
  className?: string;
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ChatInterface({ className = '', onClose, open = true, onOpenChange }: ChatInterfaceProps) {
  const { refreshProjects } = useProjects();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  

  // Initialize draggable functionality with position persistence
  const { ref: dragRef, handleMouseDown, style: dragStyle } = useDraggable({
    initialPosition: { x: window.innerWidth - 400, y: 100 },
    storageKey: 'chat-window-position',
    bounds: {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    },
  });

  const { 
    messages, 
    input, 
    handleInputChange, 
    handleSubmit, 
    isLoading,
    statusMessages,
    isToolExecuting,
    clearStatusMessages
  } = useChatWithStatus({
    api: getApiUrl('chat/stream'),
    fetch: async (url, options) => {
      const token = localStorage.getItem('authToken');
      
      const headers = {
        ...options?.headers,
        'Content-Type': 'application/json',
      } as Record<string, string>;
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      return fetch(url, {
        ...options,
        headers,
      });
    },
    onFinish: () => {
      // Refresh projects when AI tools might have made changes
      refreshProjects();
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCollapse = () => {
    onClose?.();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert('Please log in to use the chat feature');
      return;
    }
    
    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Authentication token missing. Please log in again.');
      return;
    }
    
    handleSubmit(e);
  };

  const quickActions = [
    'List all my projects',
    'Create a new project called "Website Redesign"',
    'Add a task to implement user authentication',
    'Show me the status of my current tasks',
    'Mark the login task as completed',
  ];

  const handleQuickAction = (action: string) => {
    // Simulate user input
    const syntheticEvent = {
      target: { value: action },
      preventDefault: () => {},
    } as React.ChangeEvent<HTMLInputElement>;
    
    handleInputChange(syntheticEvent);
    
    // Submit after a brief delay to ensure the input is set
    setTimeout(() => {
      const form = document.querySelector('.chat-form') as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }, 100);
  };

  // Mobile version: use Drawer component
  if (isMobile) {
    const handleOpenChange = (newOpen: boolean) => {
      if (onOpenChange) {
        onOpenChange(newOpen);
      } else if (!newOpen && onClose) {
        onClose();
      }
    };

    return (
      <Drawer open={open} onOpenChange={handleOpenChange} direction="bottom" shouldScaleBackground={false}>
        <DrawerContent className="h-[75vh] !max-h-[75vh] flex flex-col fixed">
          <DrawerHeader className="border-b p-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <DrawerTitle className="text-left text-base">AI Assistant</DrawerTitle>
                </div>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {/* Mobile Messages */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 min-h-0" style={{ maxHeight: 'calc(75vh - 140px)' }}>
            <div className="flex flex-col gap-4 min-h-fit">
              {messages
                .filter(message => message.role === 'user' || message.role === 'assistant')
                .map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
              {(isLoading || isToolExecuting) && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                  <span>{isToolExecuting ? 'Executing tools...' : 'AI is thinking...'}</span>
                </div>
              )}
              
              {/* Tool Status Display for Mobile */}
              {statusMessages.length > 0 && (
                <ToolStatusDisplay className="bg-muted/30" maxItems={5} autoScroll />
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Mobile Input */}
          <div className="p-4 border-t bg-background flex-shrink-0">
            <form onSubmit={handleFormSubmit} className="chat-form flex gap-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask about your projects..."
                disabled={isLoading}
                className="flex-1 h-9"
              />
              <Button type="submit" disabled={isLoading} size="sm" className="h-9 px-3">
                <Send className="w-4 h-4" />
              </Button>
            </form>
            
            {/* Mobile Quick Actions - Only show 2 on first load */}
            {messages.length === 0 && (
              <div className="flex gap-2 mt-2">
                {quickActions.slice(0, 2).map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action)}
                    className="text-xs h-7 px-2 flex-1 truncate"
                    disabled={isLoading}
                  >
                    {action}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop version - only render if open
  if (!open) {
    return null;
  }

  return (
    <div 
      ref={dragRef}
      style={dragStyle}
      className={`w-96 h-[600px] ${className}`}
    >
      {/* Chat Window */}
      <div className="h-full bg-background shadow-2xl border rounded-lg flex flex-col overflow-hidden">
          {/* Header */}
          <div 
            className="p-4 border-b bg-muted/50 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">AI Assistant</h3>
                  <p className="text-muted-foreground text-xs">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <GripHorizontal className="w-4 h-4 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCollapse}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-primary" />
                </div>
                <p className="mb-2 font-medium">Hi! I'm your AI assistant</p>
                <p className="text-sm mb-4 text-muted-foreground">I can help you manage your projects and tasks</p>
                
                {/* Welcome quick actions */}
                <div className="space-y-2">
                  {quickActions.slice(0, 3).map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAction(action)}
                      className="w-full text-left justify-start h-auto py-2 px-3"
                      disabled={isLoading}
                    >
                      {action}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages
                  .filter(message => message.role === 'user' || message.role === 'assistant')
                  .map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                {(isLoading || isToolExecuting) && (
                  <div className="max-w-[85%] self-start">
                    <Card className="p-3 bg-muted">
                      <div className="typing-indicator flex gap-1 items-center">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse"></span>
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse [animation-delay:0.4s]"></span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {isToolExecuting ? 'Executing tools...' : 'AI is thinking...'}
                        </span>
                      </div>
                    </Card>
                  </div>
                )}
                
                {/* Tool Status Display for Desktop */}
                {statusMessages.length > 0 && (
                  <div className="w-full">
                    <ToolStatusDisplay className="bg-muted/30" maxItems={8} autoScroll />
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions (when there are messages) */}
          {messages.length > 0 && (
            <div className="px-4 py-2 border-t">
              <details className="group">
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-2 list-none py-1">
                  <span>Quick actions</span>
                  <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                  {quickActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleQuickAction(action)}
                      className="w-full text-left justify-start h-auto py-1 px-2 text-xs"
                      disabled={isLoading}
                    >
                      {action}
                    </Button>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* Chat Input */}
          <form onSubmit={handleFormSubmit} className="chat-form p-4 border-t">
            <div className="flex gap-2">
              <Input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                type="submit" 
                size="sm"
                disabled={isLoading || !input.trim()}
                className="h-10 w-10 p-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
    </div>
  );
}