import { Response } from 'express';
import * as Sentry from '@sentry/node';

const { logger } = Sentry;

export interface StatusMessage {
  type: 'status' | 'tool-start' | 'tool-success' | 'tool-error' | 'stream-complete';
  operation?: string;
  status?: 'starting' | 'running' | 'success' | 'error';
  message: string;
  data?: any;
  timestamp?: string;
}

export interface StreamingContext {
  userId: string;
  provider: string;
  operation: string;
  projectName?: string;
  taskCount?: number;
}

export class StatusStreamer {
  private res: Response;
  private context: StreamingContext;
  private closed: boolean = false;

  constructor(res: Response, context: StreamingContext, setHeaders: boolean = true) {
    this.res = res;
    this.context = context;
    
    // Set streaming headers only if requested
    if (setHeaders) {
      this.res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      this.res.setHeader('Transfer-Encoding', 'chunked');
      this.res.setHeader('Cache-Control', 'no-cache');
      this.res.setHeader('Connection', 'keep-alive');
      this.res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    }
  }

  private formatMessage(message: StatusMessage): string {
    const fullMessage = {
      ...message,
      timestamp: new Date().toISOString(),
      context: {
        userId: this.context.userId,
        provider: this.context.provider,
        operation: this.context.operation
      }
    };

    // Send as server-sent event format for better parsing
    return `data: ${JSON.stringify(fullMessage)}\n\n`;
  }

  public sendStatus(message: StatusMessage): void {
    if (this.closed || this.res.destroyed) {
      return;
    }

    try {
      const formattedMessage = this.formatMessage(message);
      this.res.write(formattedMessage);
      
      // Log for debugging
      console.log(`\n📡 [STATUS_STREAM] ${this.context.provider.toUpperCase()} - ${message.type}: ${message.message}`);
      
      // Log to Sentry for monitoring
      logger.info('Status update sent', {
        userId: this.context.userId,
        provider: this.context.provider,
        operation: this.context.operation,
        messageType: message.type,
        message: message.message,
        hasData: !!message.data
      });
    } catch (error) {
      console.error(`\n🚨 [STATUS_STREAM] Error sending status:`, error);
      logger.error('Failed to send status update', {
        userId: this.context.userId,
        provider: this.context.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public sendToolStart(toolName: string, args: any): void {
    let message = '';
    
    switch (toolName) {
      case 'createProject':
        message = `🚀 Creating project: ${args.name}...`;
        break;
      case 'createTask':
        message = `📝 Creating task: ${args.title}...`;
        break;
      case 'updateTaskStatus':
        message = `🔄 Updating task status to ${args.status}...`;
        break;
      case 'listProjects':
        message = `📋 Fetching projects...`;
        break;
      case 'getProject':
        message = `🔍 Fetching project details...`;
        break;
      default:
        message = `🔧 Executing ${toolName}...`;
    }

    this.sendStatus({
      type: 'tool-start',
      operation: toolName,
      status: 'starting',
      message,
      data: { toolName, args }
    });
  }

  public sendToolSuccess(toolName: string, result: any): void {
    let message = '';
    
    switch (toolName) {
      case 'createProject':
        message = `✅ Project created: ${result.data?.name || result.data?.id}`;
        break;
      case 'createTask':
        message = `✅ Task created: ${result.data?.title || result.data?.id}`;
        break;
      case 'updateTaskStatus':
        message = `✅ Task status updated: ${result.data?.status}`;
        break;
      case 'listProjects':
        message = `✅ Found ${result.data?.length || 0} projects`;
        break;
      case 'getProject':
        message = `✅ Project details retrieved: ${result.data?.name}`;
        break;
      default:
        message = `✅ ${toolName} completed successfully`;
    }

    this.sendStatus({
      type: 'tool-success',
      operation: toolName,
      status: 'success',
      message,
      data: result
    });
  }

  public sendToolError(toolName: string, error: any): void {
    const errorMessage = error?.message || error?.error || 'Unknown error';
    
    this.sendStatus({
      type: 'tool-error',
      operation: toolName,
      status: 'error',
      message: `❌ ${toolName} failed: ${errorMessage}`,
      data: { error: errorMessage }
    });
  }

  public sendProgressUpdate(message: string, data?: any): void {
    this.sendStatus({
      type: 'status',
      status: 'running',
      message,
      data
    });
  }

  public sendCompletion(message: string = 'Operation completed'): void {
    this.sendStatus({
      type: 'stream-complete',
      status: 'success',
      message,
      data: {
        projectName: this.context.projectName,
        taskCount: this.context.taskCount
      }
    });
  }

  public close(): void {
    if (!this.closed && !this.res.destroyed) {
      this.closed = true;
      try {
        this.res.end();
      } catch (error) {
        console.error('Error closing status stream:', error);
      }
    }
  }

  public static createWrapper(res: Response, context: StreamingContext, setHeaders: boolean = true) {
    return new StatusStreamer(res, context, setHeaders);
  }
}

// Enhanced tool wrapper that sends status updates
export function wrapToolsWithStatus(tools: any, streamer: StatusStreamer) {
  const wrappedTools: any = {};
  
  for (const [toolName, toolConfig] of Object.entries(tools)) {
    const originalExecute = (toolConfig as any).execute;
    
    wrappedTools[toolName] = {
      ...(toolConfig as any),
      execute: async (args: any) => {
        try {
          // Send start status
          streamer.sendToolStart(toolName, args);
          
          // Execute the original tool
          const result = await originalExecute(args);
          
          // Send success or error status
          if (result?.success !== false) {
            streamer.sendToolSuccess(toolName, result);
          } else {
            streamer.sendToolError(toolName, result);
          }
          
          return result;
        } catch (error) {
          // Send error status
          streamer.sendToolError(toolName, error);
          throw error; // Re-throw to maintain error handling
        }
      }
    };
  }
  
  return wrappedTools;
}

// Utility to create a dual-stream response that combines AI stream with status updates
export class DualStreamResponse {
  private statusStreamer: StatusStreamer;
  private aiStreamStarted: boolean = false;

  constructor(res: Response, context: StreamingContext) {
    this.statusStreamer = StatusStreamer.createWrapper(res, context);
  }

  public getStatusStreamer(): StatusStreamer {
    return this.statusStreamer;
  }

  public async streamAIResponse(aiStreamResponse: Response, onChunk?: (chunk: string) => void): Promise<void> {
    if (!aiStreamResponse.body) {
      this.statusStreamer.close();
      return;
    }

    this.aiStreamStarted = true;
    const reader = aiStreamResponse.body.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        // Send AI chunk to client (this maintains AI SDK format)
        this.statusStreamer.res.write(chunk);
        
        // Optional callback for processing chunks
        if (onChunk) {
          onChunk(chunk);
        }
      }
    } finally {
      reader.releaseLock();
      this.statusStreamer.close();
    }
  }

  public close(): void {
    this.statusStreamer.close();
  }
}