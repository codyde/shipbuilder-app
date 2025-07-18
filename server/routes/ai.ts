import express from 'express';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { databaseService } from '../db/database-service.js';
import { StatusStreamer, wrapToolsWithStatus } from '../utils/status-streaming.js';
import * as Sentry from '@sentry/node';
import { AIProviderService } from '../services/ai-provider.js';

const { logger } = Sentry;

// Removed XAI bypass function - all tool calls now go through AI models

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
  let userId: string | undefined;
  
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

    // Get the appropriate AI model
    let model;
    try {
      model = await AIProviderService.getModel(userId);
    } catch (error) {
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
      // Removed maxTokens - not supported by responses API
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

    // Get the appropriate AI model for MVP generation
    let model;
    try {
      const config = await AIProviderService.getMVPGenerationModel(userId);
      model = config.model;
    } catch (error) {
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

    // Get provider options for o3 reasoning summaries
    const user = await databaseService.getUserById(userId);
    const provider = user?.aiProvider || 'anthropic';
    const providerOptions = AIProviderService.getProviderOptions(provider);
    
    const result = await streamText({
      model,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "mvp-plan-generation"
      },
      system: systemPrompt,
      prompt: `Create an MVP plan for: ${projectIdea}`,
      // Add provider options for reasoning summaries
      ...(Object.keys(providerOptions).length > 0 && { providerOptions })
    });

    // Stream the text chunks to the client
    for await (const chunk of result.textStream) {
      res.write(chunk);
    }
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
  let userId: string | undefined, userProvider: string | undefined, mvpPlan: any;
  
  try {
    mvpPlan = req.body.mvpPlan;
    
    if (!mvpPlan) {
      return res.status(400).json({ error: 'MVP plan is required' });
    }

    // Get authenticated user ID
    userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the unified tool calling model
    let model, providerOptions;
    try {
      // Get user's provider for error context
      const user = await databaseService.getUserById(userId);
      userProvider = user?.aiProvider || 'anthropic';
      
      // Use unified tool calling model
      const config = await AIProviderService.getToolCallingModel(userId);
      model = config.model;
      providerOptions = config.providerOptions;
      
    } catch (error) {
      logAIError(error, { userId: userId || 'unknown', operation: 'get_model_config' });
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get AI model' 
      });
    }

    // Import task tools (same as chat.ts)
    const { createTaskTools } = await import('../tools/task-tools.js');
    const taskTools = createTaskTools(userId);

    // Check if the current provider supports tool calling (including fallbacks)
    const supportsToolCalling = AIProviderService.supportsToolCallingWithFallback(userProvider as any);

    if (!supportsToolCalling) {
      return res.status(400).json({ 
        error: `The current AI provider (${userProvider}) does not support tool calling. Please switch to a different provider for MVP project creation.`,
        code: 'TOOL_CALLING_NOT_SUPPORTED'
      });
    }

    console.log(`\n\n🎆 \x1b[35m[MVP_CREATE]\x1b[0m Starting MVP creation\n   📝 Project: \x1b[33m${mvpPlan.projectName}\x1b[0m\n   🗺️ Tasks: \x1b[36m${mvpPlan.tasks.length}\x1b[0m\n   🤖 Provider: \x1b[32m${userProvider}\x1b[0m\n`);
    logger.info('Starting MVP creation', {
      userId,
      provider: userProvider,
      projectName: mvpPlan.projectName,
      taskCount: mvpPlan.tasks.length
    });

    // All tool calls now go through AI models - no XAI bypass

    // Set headers before creating status streamer
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create status streamer for real-time updates
    const statusStreamer = StatusStreamer.createWrapper(res, {
      userId,
      provider: userProvider || 'unknown',
      operation: 'create_mvp_project',
      projectName: mvpPlan.projectName,
      taskCount: mvpPlan.tasks.length
    }, false);

    // Wrap tools with status updates for streaming providers
    const wrappedTools = wrapToolsWithStatus({
      createProject: taskTools.createProject,
      createTask: taskTools.createTask
    }, statusStreamer);

    // Use streaming for other providers
    const result = streamText({
      model,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "mvp-project-tool-calling"
      },
      maxSteps: 30, // Allow enough steps for large MVPs
      abortSignal: AbortSignal.timeout(120000), // 2-minute timeout
      onError: (error) => {
        console.error(`\n🚨 \x1b[31m[MVP_STREAM_ERROR]\x1b[0m Provider: \x1b[33m${userProvider}\x1b[0m`, error);
        logAIError(error, { 
          userId: userId || 'unknown', 
          operation: 'mvp_stream_error', 
          provider: userProvider 
        });
        logger.error('MVP stream error occurred', {
          userId,
          provider: userProvider,
          projectName: mvpPlan.projectName,
          taskCount: mvpPlan.tasks.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      },
      onStepFinish: (step) => {
        // Enhanced logging to detect parallel function calling
        console.log(`   🔄 \x1b[36m[MVP_STEP]\x1b[0m Provider: \x1b[33m${userProvider}\x1b[0m, Step: \x1b[32m${step.stepType}\x1b[0m, ToolCalls: \x1b[35m${step.toolCalls?.length || 0}\x1b[0m`);
        
        // CRITICAL: Check for parallel tool calls (Grok's parallel execution)
        if (step.toolCalls && step.toolCalls.length > 1) {
          console.log(`   🚨 \x1b[31m[PARALLEL_DETECTED]\x1b[0m Grok is trying \x1b[35m${step.toolCalls.length}\x1b[0m parallel tool calls!`);
          console.log(`   🔍 \x1b[33m[PARALLEL_TOOLS]\x1b[0m Tools: ${step.toolCalls.map(tc => tc.toolName).join(', ')}`);
          logger.warn('Parallel tool calls detected from Grok', {
            userId,
            provider: userProvider,
            parallelCallCount: step.toolCalls.length,
            toolNames: step.toolCalls.map(tc => tc.toolName)
          });
          
          // Prevent race condition by throwing an error
          const error = new Error(`Parallel tool calls detected (${step.toolCalls.length} calls). This can cause race conditions. Please retry the operation.`);
          error.name = 'ParallelToolCallError';
          throw error;
        }
        
        // Track task creation progress
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const toolCall of step.toolCalls) {
            if (toolCall.toolName === 'createProject') {
              console.log(`   🎆 \x1b[32m[MVP_PROGRESS]\x1b[0m Project created: \x1b[33m${toolCall.args?.name}\x1b[0m`);
              logger.info('MVP project created in stream', {
                userId,
                provider: userProvider,
                projectName: toolCall.args?.name
              });
            } else if (toolCall.toolName === 'createTask') {
              console.log(`   📝 \x1b[32m[MVP_PROGRESS]\x1b[0m Task created: \x1b[33m${toolCall.args?.title}\x1b[0m`);
              logger.info('MVP task created in stream', {
                userId,
                provider: userProvider,
                taskTitle: toolCall.args?.title,
                projectId: toolCall.args?.projectId
              });
            }
          }
        } else if (step.stepType === 'tool-result' && (!step.toolCalls || step.toolCalls.length === 0)) {
          console.log(`   ⚠️  \x1b[33m[EMPTY_TOOL_RESULT]\x1b[0m No tool calls in result step - possible parallel call failure!`);
          logger.warn('Empty tool result step detected', {
            userId,
            provider: userProvider,
            stepType: step.stepType,
            projectName: mvpPlan.projectName
          });
        }
        
        // Check if we're getting close to completion
        const expectedTotal = mvpPlan.tasks.length + 1; // tasks + project
        console.log(`   🎯 \x1b[36m[MVP_PROGRESS]\x1b[0m Expected total steps: \x1b[35m${expectedTotal}\x1b[0m`);
      },
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

CRITICAL SEQUENTIAL EXECUTION REQUIREMENTS:
1. First, use createProject to create the project with a comprehensive description
2. Wait for the project creation to complete before proceeding
3. Then create tasks ONE BY ONE using createTask - DO NOT create multiple tasks simultaneously
4. You MUST wait for each createTask call to complete before calling createTask again
5. Create ALL ${mvpPlan.tasks.length} tasks sequentially - no parallel execution
6. Use the project ID from step 1 for all createTask calls

IMPORTANT: You must create tasks sequentially, not in parallel. Call createTask once, wait for it to complete, then call createTask again for the next task. Repeat until all ${mvpPlan.tasks.length} tasks are created.`
        }
      ],
      system: `You are creating an MVP project using the available tools. You must use both createProject and createTask tools to create a complete project.

CRITICAL REQUIREMENTS:
1. You must create the project AND all the tasks
2. Do not stop after creating just the project
3. SEQUENTIAL EXECUTION ONLY: Call createTask one at a time, wait for completion, then call the next one
4. DO NOT use parallel function calling - create tasks sequentially
5. Continue calling createTask until every single task is created

IMPORTANT: You are using the XAI provider which supports parallel function calling, but for this task you MUST execute functions sequentially. Call one createTask, wait for it to complete, then call the next createTask. Do not call multiple createTask functions simultaneously.

The user will be very disappointed if you only create the project but not all the tasks. Make sure you complete the entire job by creating every task sequentially.`,
      tools: {
        createProject: tool({
          description: wrappedTools.createProject.description,
          parameters: z.object({
            name: z.string().describe('The name of the project'),
            description: z.string().describe('Comprehensive description including tech stack and core features')
          }),
          execute: async (args) => {
            return await wrappedTools.createProject.execute(args);
          }
        }),
        createTask: tool({
          description: wrappedTools.createTask.description,
          parameters: z.object({
            projectId: z.string().describe('The ID of the project to add the task to'),
            title: z.string().describe('The title of the task'),
            description: z.string().describe('Detailed description of what needs to be done, structured as a prompt that an AI can use to generate code for that specific task. It should be a detailed description of the task, written from the perspective of a senior developer focused on that task space.'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('Priority level of the task')
          }),
          execute: async (args) => {
            return await wrappedTools.createTask.execute(args);
          }
        })
      },
      ...(Object.keys(providerOptions).length > 0 && { providerOptions })
    });

    const response = result.toDataStreamResponse();
    
    // Send initial status update
    statusStreamer.sendProgressUpdate(`🚀 Starting MVP creation for "${mvpPlan.projectName}" with ${mvpPlan.tasks.length} tasks`);
    
    // Skip setting headers from AI SDK response since StatusStreamer has already set streaming headers
    
    // Stream the response body with status updates integration
    if (response.body) {
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      
      try {
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          
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
          } catch (parseError) {
            // Log specific parsing errors for debugging
            console.warn(`JSON parsing error in chunk: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
            logger.warn('JSON parsing error in streaming chunk', {
              userId,
              provider: userProvider,
              error: parseError instanceof Error ? parseError.message : 'Unknown error',
              chunkPreview: chunk.substring(0, 100)
            });
          }
          
          res.write(chunk);
        }
        
        statusStreamer.sendCompletion(`🎉 MVP "${mvpPlan.projectName}" created successfully with ${mvpPlan.tasks.length} tasks!`);
        
        console.log(`\n✨ \x1b[32m[MVP_CREATE]\x1b[0m Stream completed for project: \x1b[33m${mvpPlan.projectName}\x1b[0m\n${'='.repeat(60)}\n`);
        logger.info('MVP creation stream completed', {
          userId,
          provider: userProvider,
          projectName: mvpPlan.projectName,
          taskCount: mvpPlan.tasks.length
        });
      } finally {
        // Safe cleanup - only release lock if reader exists
        if (reader) {
          try {
            reader.releaseLock();
          } catch (releaseError) {
            console.warn('Error releasing reader lock:', releaseError);
          }
        }
        statusStreamer.close();
      }
    } else {
      statusStreamer.close();
    }
  } catch (error) {
    console.error(`\n🚨 \x1b[31m[MVP_CREATE]\x1b[0m Fatal error during MVP creation:`, error);
    logAIError(error, { userId: userId || 'unknown', operation: 'create_mvp_project', provider: userProvider });
    logger.error('MVP creation failed', {
      userId: userId || 'unknown',
      provider: userProvider,
      projectName: mvpPlan?.projectName,
      taskCount: mvpPlan?.tasks?.length,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});