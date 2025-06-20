import React, { useState, useRef, useEffect } from 'react';
import { useChat } from 'ai/react';
import { useProjects } from '@/context/ProjectContext';
import { ToolInvocation } from '@/types/types';

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
      <div className={`rounded-2xl px-4 py-3 ${
        isUser 
          ? 'bg-primary-600 text-white' 
          : 'bg-gray-800 text-gray-100 border border-gray-700'
      }`}>
        <div className="leading-relaxed text-sm">
          {message.content}
        </div>
        {message.toolInvocations && message.toolInvocations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-600 border-opacity-30">
            {message.toolInvocations.map((tool, index) => (
              <div key={index} className="mb-2 last:mb-0">
                <span className="text-xs font-medium opacity-90">{tool.toolName}</span>
                {tool.result && (
                  <div className="mt-1 text-xs">
                    {tool.result.success ? (
                      <span className="text-green-300">✓ {tool.result.message}</span>
                    ) : (
                      <span className="text-red-300">✗ {tool.result.message}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
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
  const { projects, refreshProjects } = useProjects();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat/stream',
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
      <div className="h-full bg-gray-900 shadow-2xl border-l border-gray-700 flex flex-col backdrop-blur-sm">
          {/* Header */}
          <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-primary-700 to-primary-800">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">AI Assistant</h3>
                  <p className="text-primary-200 text-xs">Online</p>
                </div>
              </div>
              <button 
                onClick={handleCollapse}
                className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1 transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <div className="w-16 h-16 bg-primary-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="mb-2 font-medium text-gray-200">Hi! I'm your AI assistant</p>
                <p className="text-sm mb-4 text-gray-400">I can help you manage your projects and tasks</p>
                
                {/* Welcome quick actions */}
                <div className="space-y-2">
                  {quickActions.slice(0, 3).map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickAction(action)}
                      className="block w-full text-left px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors duration-200 disabled:opacity-50"
                      disabled={isLoading}
                    >
                      {action}
                    </button>
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
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3">
                      <div className="typing-indicator flex gap-1 items-center">
                        <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                        <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                        <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions (when there are messages) */}
          {messages.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-700 bg-gray-900">
              <details className="group">
                <summary className="text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-200 flex items-center gap-2 list-none py-1">
                  <span>Quick actions</span>
                  <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickAction(action)}
                      className="block w-full text-left px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors duration-200 disabled:opacity-50"
                      disabled={isLoading}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* Chat Input */}
          <form onSubmit={handleFormSubmit} className="chat-form p-4 border-t border-gray-700 bg-gray-900">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-gray-800 text-gray-100 placeholder-gray-400 text-sm transition-colors duration-200"
              />
              <button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className="bg-primary-600 text-white p-2 rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
    </div>
  );
}