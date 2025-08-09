import express from 'express';
import { streamText, tool } from 'ai';
import { createTaskTools } from '../tools/task-tools.js';
import { z } from 'zod';
import { AIProviderService } from '../services/ai-provider.js';
import { databaseService } from '../db/database-service.js';
import { StatusStreamer, wrapToolsWithStatus } from '../utils/status-streaming.js';
import * as Sentry from '@sentry/node';

// Utility function to detect and log AI errors (same as ai.ts)
function logAIError(error: any, context: { userId: string; operation: string; provider?: string }) {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const errorCode = error?.code || error?.status || error?.statusCode;
  
  const isRateLimit = 
    errorCode === 429 ||
    errorMessage.toLowerCase().includes('rate limit') ||
    errorMessage.toLowerCase().includes('quota exceeded') ||
    errorMessage.toLowerCase().includes('too many requests');

  console.error(`[AI_ERROR] ${context.operation.toUpperCase()}_FAILED - User: ${context.userId}, RateLimit: ${isRateLimit}, Error:`, error);

  Sentry.captureException(error, {
    tags: {
      operation: context.operation,
      userId: context.userId,
      isRateLimit: isRateLimit,
      aiProvider: context.provider
    },
    extra: {
      errorMessage,
      errorCode,
      isRateLimit
    },
    level: isRateLimit ? 'warning' : 'error'
  });
}

export const chatRoutes = express.Router();

chatRoutes.post('/stream', async (req: any, res: any) => {
  // Declare variables at function scope so they're accessible in catch blocks
  let userId: string | undefined, userProvider: string | undefined;
  
  try {
    const { messages } = req.body;

    // Get authenticated user ID
    userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the unified tool calling model
    let model, providerOptions;
    try {
      const config = await AIProviderService.getToolCallingModel(userId);
      model = config.model;
      providerOptions = config.providerOptions;
      // Get user's provider for error context
      const user = await databaseService.getUserById(userId);
      userProvider = user?.aiProvider || 'anthropic';
    } catch (error) {
      logAIError(error, { userId: userId || 'unknown', operation: 'get_model_config' });
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get AI model' 
      });
    }

    // Create task tools with user context
    const taskTools = createTaskTools(userId);

    // Create status streamer for real-time updates
    const statusStreamer = StatusStreamer.createWrapper(res, {
      userId,
      provider: userProvider || 'unknown',
      operation: 'chat_stream'
    });

    // Wrap tools with status updates
    const wrappedTools = wrapToolsWithStatus({
      createProject: taskTools.createProject,
      createTask: taskTools.createTask,
      updateTaskStatus: taskTools.updateTaskStatus,
      listProjects: taskTools.listProjects,
      getProject: taskTools.getProject,
      // MCP tools
      query_projects: {
        description: 'Get all projects for the authenticated user (MCP tool)',
        execute: async (args: any) => {
          // Call the listProjects tool which does the same thing
          const result = await taskTools.listProjects.execute();
          return result;
        }
      },
      query_tasks: {
        description: 'Get tasks for a specific project (MCP tool)',
        execute: async (args: { project_id: string }) => {
          // Call the getProject tool to get project with tasks
          const result = await taskTools.getProject.execute({ projectId: args.project_id });
          return result;
        }
      }
    }, statusStreamer);

    const result = streamText({
      model,
      maxOutputTokens: 1000,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "chat-tool-calling"
      },
      maxSteps: 10, // Allow multiple tool calls in sequence
      messages,
      system: `You are a helpful AI assistant for a software development task management application. You can help users create and manage their projects, tasks, and subtasks using the available tools.

When users ask you to create tasks or projects, use the appropriate tools to actually create them in the system. Always provide clear feedback about what was created.

You have access to these tools:
- createProject: Create a new project
- createTask: Create a task within a project
- updateTaskStatus: Update a task's status (backlog, in_progress, completed)
- listProjects: List all projects
- getProject: Get details of a specific project
- query_projects: Get all projects (MCP tool - same as listProjects)
- query_tasks: Get tasks for a specific project (MCP tool - use project_id parameter)

Be helpful and proactive in suggesting project management best practices.`,
      tools: {
        createProject: tool({
          description: wrappedTools.createProject.description,
          inputSchema: z.object({
            name: z.string().describe('The name of the project'),
            description: z.string().optional().describe('Optional description of the project')
          }),
          execute: async (args) => wrappedTools.createProject.execute(args)
        }),
        createTask: tool({
          description: wrappedTools.createTask.description,
          inputSchema: z.object({
            projectId: z.string().describe('The ID of the project to add the task to'),
            title: z.string().describe('The title of the task'),
            description: z.string().optional().describe('Optional description of the task'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('Priority level of the task'),
            dueDate: z.string().optional().describe('Optional due date in ISO format')
          }),
          execute: async (args) => wrappedTools.createTask.execute(args)
        }),
        updateTaskStatus: tool({
          description: wrappedTools.updateTaskStatus.description,
          inputSchema: z.object({
            projectId: z.string().describe('The ID of the project containing the task'),
            taskId: z.string().describe('The ID of the task to update'),
            status: z.enum(['backlog', 'in_progress', 'completed']).describe('The new status for the task')
          }),
          execute: async (args) => wrappedTools.updateTaskStatus.execute(args)
        }),
        listProjects: tool({
          description: wrappedTools.listProjects.description,
          inputSchema: z.object({}),
          execute: async () => wrappedTools.listProjects.execute()
        }),
        getProject: tool({
          description: wrappedTools.getProject.description,
          inputSchema: z.object({
            projectId: z.string().describe('The ID of the project to retrieve')
          }),
          execute: async (args) => wrappedTools.getProject.execute(args)
        }),
        // MCP tools
        query_projects: tool({
          description: wrappedTools.query_projects.description,
          inputSchema: z.object({
            status: z.enum(['active', 'backlog', 'completed', 'archived']).optional().describe('Filter projects by status'),
            include_tasks: z.boolean().optional().default(true).describe('Whether to include tasks in the response')
          }),
          execute: async (args) => wrappedTools.query_projects.execute(args)
        }),
        query_tasks: tool({
          description: wrappedTools.query_tasks.description,
          inputSchema: z.object({
            project_id: z.string().describe('Project slug (e.g., "photoshare")'),
            status: z.enum(['backlog', 'in_progress', 'completed']).optional().describe('Filter tasks by status'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('Filter tasks by priority')
          }),
          execute: async (args) => wrappedTools.query_tasks.execute(args)
        })
      },
      ...(Object.keys(providerOptions).length > 0 && { providerOptions })
    });

    const response = result.toUIMessageStreamResponse();
    
    // Skip setting headers from AI SDK response since StatusStreamer has already set streaming headers
    
    // Stream the response body with status updates integration
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          
          // Parse chunk to detect tool calls and send status updates
          try {
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));
                
                // Send status updates for tool calls
                if (data.type === 'tool-call') {
                  statusStreamer.sendToolStart(data.toolName, data.args);
                } else if (data.type === 'tool-result') {
                  const result = JSON.parse(data.result);
                  if (result.success !== false) {
                    statusStreamer.sendToolSuccess(data.toolName, result);
                  } else {
                    statusStreamer.sendToolError(data.toolName, result);
                  }
                }
              }
            }
          } catch {
            // Ignore parsing errors for non-JSON chunks
          }
          
          res.write(chunk);
        }
        
        statusStreamer.sendCompletion('Chat operation completed');
      } finally {
        reader.releaseLock();
        statusStreamer.close();
      }
    } else {
      statusStreamer.close();
    }
  } catch (error) {
    logAIError(error, { userId: userId || 'unknown', operation: 'chat_stream', provider: userProvider });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});