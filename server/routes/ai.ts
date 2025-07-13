import express from 'express';
import { streamText, generateText, tool } from 'ai';
import { z } from 'zod';
import { databaseService } from '../db/database-service.js';
import { Priority } from '../types/types.js';
import * as Sentry from '@sentry/node';
import { AIProviderService } from '../services/ai-provider.js';

export const aiRoutes = express.Router();

// Utility function to detect and categorize AI API errors
function detectAIError(error: any): { type: string; isRateLimit: boolean; provider?: string; message: string } {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const errorCode = error?.code || error?.status || error?.statusCode;
  
  // Rate limiting detection patterns
  const isRateLimit = 
    errorCode === 429 ||
    errorMessage.toLowerCase().includes('rate limit') ||
    errorMessage.toLowerCase().includes('quota exceeded') ||
    errorMessage.toLowerCase().includes('too many requests') ||
    errorMessage.toLowerCase().includes('rate_limit_exceeded') ||
    errorMessage.toLowerCase().includes('insufficient_quota');

  // Provider-specific error detection
  let provider = 'unknown';
  if (errorMessage.includes('anthropic') || errorMessage.includes('claude')) {
    provider = 'anthropic';
  } else if (errorMessage.includes('openai') || errorMessage.includes('gpt')) {
    provider = 'openai';
  } else if (errorMessage.includes('xai') || errorMessage.includes('grok')) {
    provider = 'xai';
  }

  // Error type categorization
  let type = 'unknown';
  if (isRateLimit) {
    type = 'rate_limit';
  } else if (errorCode === 401 || errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('invalid api key')) {
    type = 'auth_error';
  } else if (errorCode === 400 || errorMessage.toLowerCase().includes('bad request')) {
    type = 'bad_request';
  } else if (errorCode === 500 || errorMessage.toLowerCase().includes('internal server error')) {
    type = 'server_error';
  } else if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out')) {
    type = 'timeout';
  } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
    type = 'network_error';
  }

  return {
    type,
    isRateLimit,
    provider,
    message: errorMessage
  };
}

// Enhanced error logging function
function logAIError(error: any, context: { userId: string; operation: string; provider?: string }) {
  const errorInfo = detectAIError(error);
  
  console.error(`[AI_ERROR] ${context.operation.toUpperCase()}_FAILED - User: ${context.userId}, Type: ${errorInfo.type}, Provider: ${errorInfo.provider}, RateLimit: ${errorInfo.isRateLimit}, Error:`, error);

  Sentry.captureException(error, {
    tags: {
      operation: context.operation,
      userId: context.userId,
      errorType: errorInfo.type,
      isRateLimit: errorInfo.isRateLimit,
      aiProvider: errorInfo.provider || context.provider
    },
    extra: {
      errorMessage: errorInfo.message,
      errorCode: error?.code || error?.status || error?.statusCode,
      isRateLimit: errorInfo.isRateLimit,
      detectedProvider: errorInfo.provider
    },
    level: errorInfo.isRateLimit ? 'warning' : 'error'
  });

  return errorInfo;
}

aiRoutes.post('/generate-details', async (req: any, res: any) => {
  // Declare variables at function scope so they're accessible in catch blocks
  let userId: string | undefined, userProvider: string | undefined;
  
  try {
    const { prompt, context } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get authenticated user ID
    userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the appropriate AI model based on user preferences
    let model;
    try {
      model = await AIProviderService.getModel(userId);
    } catch (error) {
      console.error('Error getting AI model:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get AI model' 
      });
    }

    const systemPrompt = `You are a senior technical lead helping to generate detailed implementation plans and build processes for development tasks.

Context:
- Task Title: ${context?.title || 'Not provided'}
- Task Description: ${context?.description || 'Not provided'}
- Task Priority: ${context?.priority || 'Not provided'}

Generate a comprehensive build process and implementation details for this task. Focus on creating an actionable step-by-step implementation guide that a developer can follow. Your response should include:

## Implementation Details
- Step-by-step build process
- Technical approach and architecture decisions
- Code structure and file organization
- Key components/modules needed

## Acceptance Criteria
- Clear definition of "done" for this task
- Testable requirements
- Expected functionality and behavior

## Technical Requirements
- Dependencies and libraries needed
- Configuration requirements
- Environment setup needs
- Database schema changes (if applicable)

Format your response in markdown with clear sections and actionable steps. Be specific about implementation details while keeping it practical and achievable.`;

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const result = await streamText({
      model,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generate-details"
      },
      system: systemPrompt,
      onError: (error) => {
        console.error('AI generation error:', error);
      },
      prompt: prompt,
      maxTokens: 2000,
    });

    // Stream the text chunks to the client
    for await (const chunk of result.textStream) {
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    console.error('AI generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate details' });
    } else {
      res.end();
    }
  }
});


aiRoutes.post('/generatemvp', async (req: any, res: any) => {
  try {
    const { projectIdea } = req.body;
    
    if (!projectIdea) {
      return res.status(400).json({ error: 'Project idea is required' });
    }

    // Get authenticated user ID
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the appropriate AI model based on user preferences
    let model;
    try {
      model = await AIProviderService.getModel(userId);
      console.log(`[MVP_DEBUG] Model obtained for user ${userId}, model type:`, typeof model);
    } catch (error) {
      console.error('Error getting AI model:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get AI model' 
      });
    }

    const systemPrompt = `You are an expert product manager and technical architect who helps create detailed MVP (Minimum Viable Product) plans for software projects.

Based on the user's project idea, create a comprehensive MVP plan that includes:

1. A clear project name and description
2. Core features that are essential for the MVP (keep it minimal but functional)
3. Recommended tech stack (frontend, backend, database, hosting)
4. Detailed development tasks broken down into actionable items that would enable the MVP to be built and launched quickly while still providing the core functionality. 

Focus on creating an MVP that can be built and launched quickly while still providing value to users. Prioritize essential features only.

Task descriptions should be in the format of prompts that an AI can use to generate code for that specific task. It should be a detailed description of the task, written from the perspective of a senior developer focused on that task space.

For UI related tasks, prefer to use Shadcn UI and Tailwind CSS as part of the build.

For database related tasks, prefer to use PostgreSQL and use Drizzle ORM to manage it. Include these in the tasks.

Respond with a JSON object in this exact format:
{
  "projectName": "Clear, concise project name",
  "description": "Brief description of what the MVP does",
  "features": [
    "List of core features needed for MVP",
    "Each feature should be essential and user-facing"
  ],
  "techStack": {
    "frontend": "Recommended frontend technology/framework",
    "backend": "Recommended backend technology/framework", 
    "database": "Recommended database solution",
    "hosting": "Optional hosting recommendation"
  },
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed description of what needs to be done",
      "priority": "high|medium|low"
    }
  ]
}

CRITICAL: Your response must be ONLY the JSON object, with no markdown formatting, no code blocks, no additional text before or after. Start directly with { and end with }.`;

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log(`[MVP_DEBUG] Starting streamText call for user ${userId}`);
    const result = await streamText({
      model,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generate-mvp-stream"
      },
      system: systemPrompt,
      prompt: `Create an MVP plan for: ${projectIdea}`,
      maxTokens: 2000,
    });

    console.log(`[MVP_DEBUG] streamText call completed, starting to iterate chunks`);
    
    // Stream the text chunks to the client
    let chunkCount = 0;
    for await (const chunk of result.textStream) {
      chunkCount++;
      console.log(`[MVP_DEBUG] Chunk ${chunkCount}: ${chunk.substring(0, 50)}...`);
      res.write(chunk);
    }

    console.log(`[MVP_DEBUG] Streaming completed, total chunks: ${chunkCount}`);
    res.end();
  } catch (error) {
    console.error('MVP generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate MVP plan' });
    } else {
      res.end();
    }
  }
});

aiRoutes.post('/create-mvp-project', async (req: any, res: any) => {
  // Declare variables at function scope so they're accessible in catch blocks
  let userId: string | undefined, userProvider: string | undefined;
  
  try {
    const { mvpPlan } = req.body;
    
    if (!mvpPlan) {
      return res.status(400).json({ error: 'MVP plan is required' });
    }

    // Get authenticated user ID
    userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the appropriate AI model and provider options for tool calling
    let model, providerOptions;
    try {
      // For tool calling, we need to use getModelConfig with context
      const config = await AIProviderService.getModelConfig(userId, 'tool-calling');
      model = config.model;
      providerOptions = config.providerOptions;
      // Get user's provider for error context
      const user = await databaseService.getUserById(userId);
      userProvider = user?.aiProvider || 'anthropic';
      
      console.log(`[CREATE_MVP_PROJECT] Using provider: ${userProvider} with tool-calling context`);
    } catch (error) {
      logAIError(error, { userId: userId || 'unknown', operation: 'get_model_config' });
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get AI model' 
      });
    }

    // Import task tools (same as chat.ts)
    const { createTaskTools } = await import('../tools/task-tools.js');
    const taskTools = createTaskTools(userId);

    console.log(`[CREATE_MVP_PROJECT] Starting project creation for user ${userId} with provider ${userProvider}`);
    console.log(`[CREATE_MVP_PROJECT] MVP Plan:`, JSON.stringify(mvpPlan, null, 2));
    console.log(`[CREATE_MVP_PROJECT] Model config:`, {
      hasModel: !!model,
      providerOptions: JSON.stringify(providerOptions),
      userProvider: userProvider
    });

    const result = streamText({
      model,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "create-mvp-project"
      },
      maxSteps: 25, // Allow enough steps for project + all tasks
      messages: [
        {
          role: 'user',
          content: `I need you to create a complete MVP project with all its tasks using the available tools.

PROJECT DETAILS:
- Name: ${mvpPlan.projectName}
- Description: ${mvpPlan.description}
- Tech Stack: ${mvpPlan.techStack.frontend}, ${mvpPlan.techStack.backend}, ${mvpPlan.techStack.database}${mvpPlan.techStack.hosting ? `, ${mvpPlan.techStack.hosting}` : ''}
- Core Features: ${mvpPlan.features.join(', ')}

TASKS TO CREATE (${mvpPlan.tasks.length} total):
${mvpPlan.tasks.map((task: any, index: number) => 
`${index + 1}. "${task.title}" (${task.priority})
   Description: ${task.description}`).join('\n')}

STEP-BY-STEP INSTRUCTIONS:
1. First, use createProject to create the project with a comprehensive description
2. Then use createTask to create ALL ${mvpPlan.tasks.length} tasks listed above
3. You MUST create every single task - do not stop until all ${mvpPlan.tasks.length} tasks are created
4. Use the project ID from step 1 for all createTask calls

Please create the project and ALL ${mvpPlan.tasks.length} tasks now.`
        }
      ],
      system: `You are creating an MVP project using the available tools. You must use both createProject and createTask tools to create a complete project.

CRITICAL: You must create the project AND all the tasks. Do not stop after creating just the project. Continue calling createTask for every single task in the list.

The user will be very disappointed if you only create the project but not the tasks. Make sure you complete the entire job by creating every task.`,
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
        })
      },
      ...(Object.keys(providerOptions).length > 0 && { providerOptions })
    });

    const response = result.toDataStreamResponse();
    
    // Set headers from the AI SDK response (same as chat.ts)
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    // Stream the response body (same as chat.ts)
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let chunkCount = 0;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log(`[CREATE_MVP_PROJECT] Streaming completed for user ${userId}, total chunks: ${chunkCount}`);
            break;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          chunkCount++;
          
          // Log chunk content to see if tool calls are happening
          if (chunk.includes('tool_call') || chunk.includes('createProject') || chunk.includes('createTask')) {
            console.log(`[CREATE_MVP_PROJECT] Tool call detected in chunk ${chunkCount} for user ${userId}: ${chunk.substring(0, 200)}`);
          }
          
          res.write(chunk);
        }
      } finally {
        reader.releaseLock();
        res.end();
      }
    } else {
      console.log(`[CREATE_MVP_PROJECT] No response body for user ${userId}`);
      res.end();
    }
  } catch (error) {
    logAIError(error, { userId: userId || 'unknown', operation: 'create_mvp_project', provider: userProvider });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});