import express from 'express';
import { streamText, tool } from 'ai';
import { createTaskTools } from '../tools/task-tools.js';
import { z } from 'zod';
import { AIProviderService } from '../services/ai-provider.js';
import { databaseService } from '../db/database-service.js';
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

    // Get the appropriate AI model based on user preferences
    let model, providerOptions;
    try {
      const config = await AIProviderService.getModelConfig(userId);
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

    const result = streamText({
      model,
      maxTokens: 1000,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generate-application"
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

Be helpful and proactive in suggesting project management best practices.`,
      tools: {
        createProject: tool({
          description: taskTools.createProject.description,
          parameters: z.object({
            name: z.string().describe('The name of the project'),
            description: z.string().optional().describe('Optional description of the project')
          }),
          execute: async (args) => taskTools.createProject.execute(args)
        }),
        createTask: tool({
          description: taskTools.createTask.description,
          parameters: z.object({
            projectId: z.string().describe('The ID of the project to add the task to'),
            title: z.string().describe('The title of the task'),
            description: z.string().optional().describe('Optional description of the task'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('Priority level of the task'),
            dueDate: z.string().optional().describe('Optional due date in ISO format')
          }),
          execute: async (args) => taskTools.createTask.execute(args)
        }),
        updateTaskStatus: tool({
          description: taskTools.updateTaskStatus.description,
          parameters: z.object({
            projectId: z.string().describe('The ID of the project containing the task'),
            taskId: z.string().describe('The ID of the task to update'),
            status: z.enum(['backlog', 'in_progress', 'completed']).describe('The new status for the task')
          }),
          execute: async (args) => taskTools.updateTaskStatus.execute(args)
        }),
        listProjects: tool({
          description: taskTools.listProjects.description,
          parameters: z.object({}),
          execute: async () => taskTools.listProjects.execute()
        }),
        getProject: tool({
          description: taskTools.getProject.description,
          parameters: z.object({
            projectId: z.string().describe('The ID of the project to retrieve')
          }),
          execute: async (args) => taskTools.getProject.execute(args)
        })
      },
      ...(Object.keys(providerOptions).length > 0 && { providerOptions })
    });

    const response = result.toDataStreamResponse();
    
    // Set headers from the AI SDK response
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    // Stream the response body
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } finally {
        reader.releaseLock();
        res.end();
      }
    } else {
      res.end();
    }
  } catch (error) {
    logAIError(error, { userId: userId || 'unknown', operation: 'chat_stream', provider: userProvider });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});