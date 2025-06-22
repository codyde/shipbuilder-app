import React, { useRef, useEffect } from 'react';
import { useChat } from 'ai/react';
import { useProjects } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { ToolInvocation } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, MessageCircle, Send, ChevronDown } from 'lucide-react';

interface ChatMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
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
        <div className="text-sm leading-relaxed">
          {message.content}
        </div>
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
}

export function ChatInterface({ className = '', onClose }: ChatInterfaceProps) {
  const { refreshProjects } = useProjects();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat/stream',
    headers: {
      'x-user-id': user?.id || '',
    },
    onFinish: () => {
      // Refresh projects when AI tools might have made changes
      refreshProjects();
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

  return (
    <div className={`fixed top-0 right-0 z-50 h-full w-96 ${className}`}>
      {/* Chat Window */}
      <div className="h-full bg-background shadow-xl border-l flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-muted/50">
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
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {isLoading && (
                  <div className="max-w-[85%] self-start">
                    <Card className="p-3 bg-muted">
                      <div className="typing-indicator flex gap-1 items-center">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse"></span>
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse [animation-delay:0.4s]"></span>
                      </div>
                    </Card>
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