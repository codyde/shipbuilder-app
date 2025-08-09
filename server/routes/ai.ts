import express from 'express';
import { streamText, streamObject, tool } from 'ai';
import { z } from 'zod';
import { databaseService } from '../db/database-service.js';
// Status streamer not used for MVP creation in v5; rely on SDK events
// import { StatusStreamer, wrapToolsWithStatus } from '../utils/status-streaming.js';
import * as Sentry from '@sentry/node';
import { AIProviderService } from '../services/ai-provider.js';

const { logger } = Sentry;

// All tool calls now go through AI models

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
    const projectIdea = req.body?.projectIdea || req.body?.input?.projectIdea || req.body?.prompt;
    const selectedComponents = req.body?.selectedComponents || req.body?.input?.selectedComponents;
    
    if (!projectIdea) {
      return res.status(400).json({ error: 'Project idea is required' });
    }

    // Get authenticated user ID
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the appropriate AI model for MVP generation
    let model, providerOptions;
    try {
      const config = await AIProviderService.getMVPGenerationModel(userId);
      model = config.model;
      providerOptions = config.providerOptions;
      
      // Debug logging
      console.log('[MVP_GEN] Model configuration:', {
        modelId: model?.modelId,
        specVersion: model?.specificationVersion,
        provider: model?.config?.provider,
        providerOptions
      });
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

DEPLOYMENT TARGET PREFERENCES:
When recommending hosting solutions, prioritize these modern deployment platforms based on the project type:

- **Vercel**: Best for Next.js applications without persistent backend requirements and React frontends. Choose for:
  * Next.js applications using serverless functions
  * React SPAs with API routes (no persistent database)
  * Static sites with dynamic features
  * Projects needing edge computing/CDN but no persistent storage
  
- **Railway**: Best for full-stack applications requiring persistent databases and backend services. Choose for:
  * Full-stack applications with PostgreSQL/MySQL databases
  * Express/Node.js backends with persistent storage
  * Applications requiring background jobs or workers
  * Projects needing integrated database hosting and backend services
  
- **Netlify**: Best for static sites, JAMstack applications, and frontend-heavy projects. Choose for:
  * Static site generators (Gatsby, Hugo, etc.)
  * Frontend-only applications
  * JAMstack architectures
  * Sites with serverless functions but minimal backend needs

Always recommend the most appropriate platform based on the Mvp's architecture and requirements, and briefly explain why that platform is the best choice for the specific project type.

${selectedComponents && selectedComponents.length > 0 ? `
SELECTED COMPONENTS:
The user has selected the following reusable components to incorporate into their MVP:

${selectedComponents.map((comp: any, index: number) => `
${index + 1}. ${comp.name}
   Description: ${comp.description}
   Tags: ${comp.tags?.join(', ') || 'None'}
`).join('')}

Please incorporate the guidance and patterns from these selected components when creating the tech stack recommendations and development tasks. Use the component descriptions to inform your approach to the project architecture and implementation strategy.
` : ''}

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

    // Log provider and model configuration  
    const provider = model?.config?.provider || 'unknown';
    // Fix reasoning detection: provider shows as 'openai.responses', so check for 'openai'
    const isReasoningModel = provider.includes('openai') && providerOptions?.openai?.reasoningEffort;
    
    console.log('[MVP_GEN] Starting generation:', {
      provider,
      modelId: model?.modelId,
      providerOptions,
      isReasoningModel,
      hasReasoningEffort: providerOptions?.openai?.reasoningEffort,
      projectIdea: projectIdea.substring(0, 100) + '...'
    });
    
    // For reasoning models, add explicit instructions for reasoning
    const enhancedSystemPrompt = isReasoningModel 
      ? systemPrompt + '\n\nThink step-by-step about the project requirements before generating the JSON.'
      : provider === 'anthropic' 
        ? systemPrompt + '\n\nAnalyze the project requirements thoroughly before generating your response.'
        : systemPrompt;

    // Set up SSE headers
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Send initial event
    const sendSSE = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial status to client
    sendSSE({
      type: 'generation.start',
      provider,
      supportsReasoning: isReasoningModel,
      model: model?.modelId || 'unknown'
    });

    try {
      // For reasoning models, use streamText but focus on getting the content working first
      if (isReasoningModel) {
        console.log('[MVP_GEN] Using streamText for reasoning model');
        
        const result = await streamText({
          model,
          system: enhancedSystemPrompt,
          prompt: `Create an MVP plan for: ${projectIdea}`,
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'mvp-plan-generation-with-reasoning',
          },
          ...(Object.keys(providerOptions || {}).length > 0 && { providerOptions }),
        });

        // Simplified approach: use textStream directly since fullStream isn't giving us the content
        let fullText = '';
        
        try {
          for await (const textChunk of result.textStream) {
            if (textChunk && typeof textChunk === 'string') {
              fullText += textChunk;
              sendSSE({
                type: 'text.delta',
                delta: textChunk
              });
            }
          }
          
          // Also check if there's reasoning available in the fullStream
          let reasoningFound = false;
          try {
            for await (const chunk of result.fullStream) {
              if (chunk.type === 'finish-step') {
                const stepChunk = chunk as any;
                if (stepChunk.response?.reasoning) {
                  console.log('[MVP_GEN] Found reasoning in finish-step');
                  sendSSE({
                    type: 'reasoning.delta',
                    delta: stepChunk.response.reasoning
                  });
                  sendSSE({
                    type: 'reasoning.done',
                    reasoning: stepChunk.response.reasoning
                  });
                  reasoningFound = true;
                }
              }
            }
          } catch (streamError) {
            console.log('[MVP_GEN] Could not process fullStream for reasoning, continuing...');
          }
          
          // Parse the final result
          if (fullText && fullText.trim()) {
            try {
              const cleanedText = fullText.trim()
                .replace(/^```json\s*/, '')
                .replace(/\s*```$/, '');
              
              const parsedPlan = JSON.parse(cleanedText);
              
              sendSSE({
                type: 'object.completed',
                object: parsedPlan
              });
            } catch (parseError) {
              console.error('[MVP_GEN] Failed to parse JSON:', parseError);
              sendSSE({
                type: 'error',
                error: 'Failed to parse generated plan'
              });
            }
          } else {
            console.error('[MVP_GEN] No content received from textStream');
            sendSSE({
              type: 'error',
              error: 'No content received from AI model'
            });
          }
          
        } catch (streamError) {
          console.error('[MVP_GEN] Error in textStream:', streamError);
          sendSSE({
            type: 'error',
            error: 'Streaming error occurred'
          });
        }
      } else {
        // For non-reasoning models, use streamObject
        console.log('[MVP_GEN] Using streamObject for non-reasoning model');
        
        const schema = z.object({
          projectName: z.string().min(1),
          description: z.string().min(1),
          features: z.array(z.string()).min(1),
          techStack: z.object({
            frontend: z.string().min(1),
            backend: z.string().min(1),
            database: z.string().min(1),
            hosting: z.string().optional(),
          }),
          tasks: z.array(z.object({
            title: z.string().min(1),
            description: z.string().min(1),
            priority: z.enum(['high', 'medium', 'low']).default('medium'),
          })).min(1),
        });
        
        const result = await streamObject({
          model,
          schema,
          system: enhancedSystemPrompt,
          prompt: `Create an MVP plan for: ${projectIdea}`,
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'mvp-plan-generation-structured',
          },
          ...(Object.keys(providerOptions || {}).length > 0 && { providerOptions }),
        });

        for await (const chunk of result.fullStream) {
          switch (chunk.type) {
            case 'text-delta':
              sendSSE({
                type: 'text.delta',
                delta: chunk.textDelta
              });
              break;
              
            case 'object-delta':
              if (chunk.partialObject) {
                sendSSE({
                  type: 'object.delta',
                  object: chunk.partialObject
                });
              }
              break;
              
            case 'object':
              sendSSE({
                type: 'object.completed',
                object: chunk.object
              });
              break;
              
            case 'finish':
              // Final object should be available
              if (result.object) {
                sendSSE({
                  type: 'object.completed',
                  object: await result.object
                });
              }
              break;
          }
        }
      }
      
      // Send completion event
      sendSSE({ type: 'done' });
      res.end();
      
    } catch (streamError) {
      console.error('[MVP_GEN] Streaming error:', streamError);
      sendSSE({
        type: 'error',
        error: streamError instanceof Error ? streamError.message : 'Streaming failed'
      });
      res.end();
    }

  } catch (error) {
    console.error('[MVP_GEN] Fatal error:', error);
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

    console.log(`\n\n🎆 \x1b[35m[MVP_CREATE]\x1b[0m Starting MVP creation\n   📝 Project: \x1b[33m${mvpPlan.projectName}\x1b[0m\n   🗺️ Tasks: \x1b[36m${mvpPlan.tasks.length}\x1b[0m\n   🤖 Provider: \x1b[32m${userProvider}\x1b[0m\n   🧾 Accept: ${req.headers['accept']}\n   🌐 UA: ${req.headers['user-agent']}\n`);
    
    // Log the exact plan being sent
    console.log('[MVP_CREATE] Full MVP Plan:', JSON.stringify({
      projectName: mvpPlan.projectName,
      description: mvpPlan.description,
      taskCount: mvpPlan.tasks.length,
      tasks: mvpPlan.tasks
    }, null, 2));
    logger.info('Starting MVP creation', {
      userId,
      provider: userProvider,
      projectName: mvpPlan.projectName,
      taskCount: mvpPlan.tasks.length
    });

    // All tool calls go through AI models – use SDK's native stream events

    // Log what we're sending to the model
    const systemPrompt = `You are an MVP project creation assistant. You have ONE tool: createMVPProject.

This tool creates both the project AND all its tasks in a single atomic operation.

You MUST call createMVPProject with:
1. The project name and description
2. ALL tasks from the MVP plan (do not filter or modify them)

The tool will handle creating the project first, then all tasks automatically.`;
    
    const userMessage = `Create an MVP project with these details:

PROJECT:
Name: ${mvpPlan.projectName}
Description: ${mvpPlan.description}
Tech Stack: ${mvpPlan.techStack.frontend}, ${mvpPlan.techStack.backend}, ${mvpPlan.techStack.database}${mvpPlan.techStack.hosting ? `, ${mvpPlan.techStack.hosting}` : ''}
Features: ${mvpPlan.features.join(', ')}

TASKS (${mvpPlan.tasks.length} tasks):
${JSON.stringify(mvpPlan.tasks, null, 2)}

REQUIRED ACTION:
Call the createMVPProject tool NOW with these exact parameters:
{
  "name": "${mvpPlan.projectName}",
  "description": "${mvpPlan.description.replace(/"/g, '\\"')}",
  "tasks": ${JSON.stringify(mvpPlan.tasks, null, 2)}
}

This is a TOOL CALL. Do not respond with text. Execute createMVPProject immediately.`;
    
    console.log('\n📋 [MVP_CREATE] System Prompt:', systemPrompt);
    console.log('\n💬 [MVP_CREATE] User Message (first 500 chars):', userMessage.substring(0, 500) + '...');
    
    // Log the tools we're providing
    console.log('\n🔧 [MVP_CREATE] Available tools:', ['createMVPProject']);
    console.log('\n📊 [MVP_CREATE] Model configuration:', {
      modelId: model?.modelId || 'unknown',
      provider: userProvider,
      providerOptions,
      maxSteps: 10,
      toolChoice: 'auto'
    });
    
    // Use streaming for other providers
    const result = streamText({
      model,
      system: systemPrompt,
      prompt: userMessage,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "mvp-project-tool-calling"
      },
      maxSteps: 10, // Allow some steps but not too many
      // Ensure multi-step tool calling proceeds beyond first tool
      abortSignal: AbortSignal.timeout(300000), // 5-minute timeout
      // Enhanced debugging
      onStepStart: (step) => {
        console.log(`\n🔵 [MVP_STREAM] =============== STEP ${(step as any).stepIndex || 'N/A'} STARTING ===============`);
        console.log(`   📌 Step Type: ${step.stepType}`);
        console.log(`   ⏰ Timestamp: ${new Date().toISOString()}`);
        console.log(`   🔍 Step details:`, {
          hasToolCalls: !!(step as any).toolCalls,
          toolCallCount: (step as any).toolCalls?.length || 0,
          hasText: !!(step as any).text,
          textPreview: (step as any).text?.substring(0, 100)
        });
      },
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
        // Enhanced logging to understand what's happening
        console.log(`\n🟢 [MVP_STREAM] Step Finished:`, {
          provider: userProvider,
          stepType: step.stepType,
          toolCallCount: step.toolCalls?.length || 0,
          finishReason: (step as any).finishReason,
          isContinued: (step as any).isContinued,
          usage: (step as any).usage,
          text: (step as any).text?.substring(0, 200),
          rawResponse: (step as any).rawResponse ? 'present' : 'absent',
          allStepKeys: Object.keys(step)
        });
        
        // Log the actual tool calls made
        if (step.toolCalls && step.toolCalls.length > 0) {
          console.log(`   📞 Tool calls in this step:`);
          step.toolCalls.forEach((tc, idx) => {
            console.log(`      ${idx + 1}. ${tc.toolName}:`, {
              argsPreview: tc.args ? JSON.stringify(tc.args).substring(0, 200) : 'no args',
              hasResult: !!tc.result,
              resultPreview: tc.result ? JSON.stringify(tc.result).substring(0, 200) : null
            });
          });
        }
        
        // Detect parallel tool calls and log, but do not hard-fail. The model configuration already disables parallel calls for supported providers.
        if (step.toolCalls && step.toolCalls.length > 1) {
          console.log(`   🚨 \x1b[31m[PARALLEL_DETECTED]\x1b[0m Provider attempted ${step.toolCalls.length} parallel tool calls.`);
          logger.warn('Parallel tool calls detected', {
            userId,
            provider: userProvider,
            parallelCallCount: step.toolCalls.length,
            toolNames: step.toolCalls.map(tc => tc.toolName)
          });
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
              try {
                const pid = toolCall?.result?.data?.id || toolCall?.result?.projectId || toolCall?.args?.projectId;
                if (pid) {
                  ;(global as any).__lastCreatedProjectId = pid;
                }
              } catch {}
              console.log('   🧭 [MVP_HINT] Project created. Model should now call createAllTasks with the provided tasks.');
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
        console.log(`   🎯 \x1b[36m[MVP_PROGRESS]\x1b[0m Expected total operations: \x1b[35m${expectedTotal}\x1b[0m`);
        
        // Log step completion reason
        if ((step as any).finishReason) {
          console.log(`   🏁 \x1b[33m[MVP_FINISH_REASON]\x1b[0m Step finished because: \x1b[35m${(step as any).finishReason}\x1b[0m`);
          if ((step as any).finishReason === 'stop' || (step as any).finishReason === 'length') {
            console.log(`   ⚠️  \x1b[31m[MVP_WARNING]\x1b[0m Model stopped (${(step as any).finishReason}). This may prevent task creation.`);
          }
        }
      },
      // Log available tools
      onChunk: (chunk: any) => {
        if (chunk?.type === 'text-delta') {
          console.log(`   💭 [MVP_REASONING] Text delta: "${chunk.textDelta?.substring(0, 100)}..."`);
        } else if (chunk?.type === 'tool-call-delta') {
          console.log(`   🔧 [MVP_TOOL_DELTA] Tool: ${chunk.toolName}, args chunk received`);
        } else if (chunk?.type) {
          console.log(`   📦 [MVP_CHUNK] Type: ${chunk.type}`);
        }
      },
      tools: {
        createMVPProject: tool({
          description: 'Create a complete MVP project with all tasks in one atomic operation',
          inputSchema: z.object({
            name: z.string().describe('The name of the project'),
            description: z.string().describe('Comprehensive project description including tech stack and core features'),
            tasks: z.array(z.object({
              title: z.string().describe('Task title'),
              description: z.string().describe('Detailed task description'),
              priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority (default: medium)')
            })).describe('Array of ALL tasks to create for this project')
          }),
          execute: async (args) => {
            console.log(`\n🚀 [MVP_CREATE_TOOL] ==================== TOOL EXECUTION START ====================`);
            console.log(`📋 [MVP_CREATE_TOOL] Full arguments received:`);
            console.log(JSON.stringify({
              projectName: args.name,
              description: args.description,
              taskCount: args.tasks?.length || 0,
              tasks: args.tasks
            }, null, 2));
            console.log(`⏰ [MVP_CREATE_TOOL] Execution timestamp: ${new Date().toISOString()}`);
            
            // Step 1: Create the project
            let projectId: string;
            try {
              console.log('   📦 [MVP_CREATE_TOOL] Step 1: Creating project...');
              const projectResult = await taskTools.createProject.execute({
                name: args.name,
                description: args.description
              } as any);
              
              if (!projectResult?.success || !projectResult?.data?.id) {
                console.error('[MVP_CREATE] Project creation failed:', projectResult);
                return {
                  success: false,
                  error: 'Failed to create project',
                  data: null
                };
              }
              
              projectId = projectResult.data.id;
              console.log(`   ✅ [MVP_CREATE_TOOL] Project created successfully: ${projectId}`);
            } catch (error) {
              console.error('[MVP_CREATE] Error creating project:', error);
              return {
                success: false,
                error: `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`,
                data: null
              };
            }
            
            // Step 2: Create all tasks
            const createdTasks: string[] = [];
            const taskErrors: string[] = [];
            
            for (let i = 0; i < (args.tasks?.length || 0); i++) {
              const task = args.tasks![i];
              try {
                console.log(`   📝 [MVP_CREATE_TOOL] Creating task ${i + 1}/${args.tasks!.length}: "${task.title}"`);
                const taskResult = await taskTools.createTask.execute({
                  projectId,
                  title: task.title,
                  description: task.description,
                  priority: task.priority || 'medium'
                } as any);
                
                if (taskResult?.success && taskResult?.data?.id) {
                  createdTasks.push(taskResult.data.id);
                } else {
                  taskErrors.push(`Task #${i + 1} "${task.title}": Creation failed`);
                }
              } catch (error) {
                console.error(`[MVP_CREATE] Error creating task #${i + 1}:`, error);
                taskErrors.push(`Task #${i + 1} "${task.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
            
            const allTasksCreated = createdTasks.length === args.tasks?.length;
            
            console.log(`\n🏁 [MVP_CREATE_TOOL] ==================== TOOL EXECUTION END ====================`);
            console.log(`📊 [MVP_CREATE_TOOL] Final Results:`, {
              success: allTasksCreated,
              projectId,
              tasksCreated: createdTasks.length,
              totalTasks: args.tasks?.length || 0,
              hadErrors: taskErrors.length > 0,
              errors: taskErrors
            });
            console.log(`⏰ [MVP_CREATE_TOOL] Completion timestamp: ${new Date().toISOString()}`);
            
            return {
              success: allTasksCreated,
              message: allTasksCreated 
                ? `Successfully created project "${args.name}" with all ${createdTasks.length} tasks`
                : `Created project "${args.name}" with ${createdTasks.length} of ${args.tasks?.length || 0} tasks. Some tasks failed.`,
              data: {
                projectId,
                projectName: args.name,
                tasksCreated: createdTasks.length,
                totalTasks: args.tasks?.length || 0,
                taskIds: createdTasks,
                errors: taskErrors.length > 0 ? taskErrors : undefined
              }
            };
          }
        }),
        // Keep the old tools as fallback but hide them from the model
        __createProject: tool({
          description: 'Create a new project with the given name and description',
          inputSchema: z.object({
            name: z.string().describe('The name of the project'),
            description: z.string().describe('Comprehensive description including tech stack and core features')
          }),
          execute: async (args) => {
            console.log('[MVP_STREAM][server] createProject.execute called');
            const res = await taskTools.createProject.execute(args as any);
            console.log('[MVP_STREAM][server] createProject.execute result', !!res?.success, res?.data?.id);
            return res;
          }
        }),
        __createAllTasks: tool({
          description: 'Create all tasks at once for the given project. This is the only way to create tasks.',
          inputSchema: z.object({
            projectId: z.string().describe('The ID of the project (obtained from createProject result)'),
            tasks: z.array(z.object({
              title: z.string().describe('Task title'),
              description: z.string().describe('Detailed task description'),
              priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority')
            })).describe('Array of all tasks to create')
          }),
          execute: async (args) => {
            const created: string[] = [];
            const errors: string[] = [];
            console.log(`[MVP_STREAM][server] createAllTasks called with ${(args as any).tasks?.length || 0} tasks`);
            
            for (const t of (args as any).tasks || []) {
              try {
                console.log('[MVP_STREAM][server] createAllTasks → createTask', t?.title);
                const result = await taskTools.createTask.execute({
                  projectId: (args as any).projectId,
                  title: t.title,
                  description: t.description,
                  priority: t.priority || 'medium'
                } as any);
                
                if (result?.success && result?.data?.id) {
                  created.push(result.data.id);
                } else {
                  errors.push(`Failed to create task: ${t.title}`);
                }
              } catch (error) {
                console.error('[MVP_STREAM][server] Error creating task:', error);
                errors.push(`Error creating task "${t.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
            
            console.log(`[MVP_STREAM][server] createAllTasks completed: ${created.length} tasks created, ${errors.length} errors`);
            
            if (errors.length > 0) {
              return { 
                success: false, 
                error: `Created ${created.length} tasks but encountered ${errors.length} errors: ${errors.join(', ')}`,
                data: { count: created.length, taskIds: created, errors }
              };
            }
            
            return { success: true, data: { count: created.length, taskIds: created } };
          }
        })
      },
      providerOptions,
    });


    
    // Fallback implementation: emit SSE from the SDK's fullStream
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    try {
      (res as any).flushHeaders?.();
    } catch {}

    const sendEvent = (obj: any) => {
      try {
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      } catch (e) {
        console.error('[MVP_STREAM][server] Failed to write SSE event:', e);
      }
    };

    let sawFirst = false;
    const startedAt = Date.now();
    try {
      for await (const part of result.fullStream) {
        if (!sawFirst) {
          sawFirst = true;
          console.log(`[MVP_STREAM][server] first chunk after ${Date.now() - startedAt}ms`);
        }
        switch (part.type) {
          case 'text-delta':
            sendEvent({ type: 'text.delta', delta: part.textDelta });
            break;
          case 'tool-call':
            sendEvent({ type: 'tool-call', toolName: (part as any).toolName, args: (part as any).args });
            break;
          case 'tool-result':
            sendEvent({ type: 'tool-result', toolName: (part as any).toolName, result: (part as any).result });
            break;
          case 'finish':
            sendEvent({ type: 'response.finish', finishReason: (part as any).finishReason, usage: (part as any).usage });
            break;
          default:
            // Forward other event types for debugging/compatibility
            sendEvent({ type: (part as any).type, ...part });
            break;
        }
      }
    } catch (streamErr) {
      console.error('[MVP_STREAM][server] Error while streaming:', streamErr);
      // Inform client of stream error
      sendEvent({ type: 'tool-error', status: 'error', message: 'Stream error', data: { error: String(streamErr) } });
    } finally {
      try { res.end(); } catch {}
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
