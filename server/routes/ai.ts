import express from 'express';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, generateText, tool } from 'ai';
import { z } from 'zod';
import { databaseService } from '../db/database-service.js';
import { Priority } from '../../src/types/types.js';
import * as Sentry from '@sentry/node';

export const aiRoutes = express.Router();

aiRoutes.post('/generate-details', async (req: any, res: any) => {
  try {
    const { prompt, context } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not set');
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY environment variable is not set' 
      });
    }

    const systemPrompt = `You are a project management assistant helping to generate detailed task information. 
    
Context:
- Task Title: ${context?.title || 'Not provided'}
- Task Description: ${context?.description || 'Not provided'}
- Task Priority: ${context?.priority || 'Not provided'}

Generate detailed task information based on the user's request. Focus on being practical, actionable, and relevant to the task context. Include relevant sections like implementation details, acceptance criteria, technical requirements, or other appropriate information based on the task type.

Keep the response well-structured and professional.`;

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const result = await streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generate-details"
      },
      system: systemPrompt,
      prompt: prompt,
      maxTokens: 1000,
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

aiRoutes.post('/generate-mvp', async (req: any, res: any) => {
  const { logger } = Sentry;
  const startTime = Date.now();
  
  try {
    const { projectIdea } = req.body;
    
    // Get authenticated user ID first for logging context
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('MVP generation attempted without authentication');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('MVP generation started', {
      userId,
      projectIdeaLength: projectIdea?.length || 0,
      hasProjectIdea: !!projectIdea
    });

    if (!projectIdea) {
      logger.warn('MVP generation failed: missing project idea', { userId });
      return res.status(400).json({ error: 'Project idea is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      logger.error('MVP generation failed: ANTHROPIC_API_KEY not set', { userId });
      Sentry.captureException(new Error('ANTHROPIC_API_KEY not configured'), {
        tags: { feature: 'mvp_generation', step: 'config_validation' },
        extra: { userId }
      });
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY environment variable is not set' 
      });
    }

    const systemPrompt = `You are an expert product manager and technical architect who helps create detailed MVP (Minimum Viable Product) plans for software projects.

Based on the user's project idea, create a comprehensive MVP plan that includes:

1. A clear project name and description
2. Core features that are essential for the MVP (keep it minimal but functional)
3. Recommended tech stack (frontend, backend, database, hosting)
4. Detailed development tasks broken down into actionable items

Focus on creating an MVP that can be built and launched quickly while still providing value to users. Prioritize essential features only.

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

CRITICAL: Your response must be ONLY the JSON object, with no markdown formatting, no code blocks, no additional text before or after. Start directly with { and end with }. Do not include \`\`\`json or any other formatting.`;

    logger.info('Calling Anthropic API for MVP generation', {
      userId,
      projectIdeaPreview: projectIdea.substring(0, 100)
    });

    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generate-mvp"
      },
      system: systemPrompt,
      prompt: `Create an MVP plan for: ${projectIdea}`,
      maxTokens: 2000,
    });

    logger.info('Anthropic API response received', {
      userId,
      responseLength: result.text.length,
      responsePreview: result.text.substring(0, 200)
    });

    // Parse the JSON response
    let mvpPlan;
    try {
      logger.info('Starting JSON parsing of AI response', {
        userId,
        rawLength: result.text.length
      });
      
      // Clean the response text - remove potential markdown formatting
      let cleanedText = result.text.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        logger.info('Removed JSON markdown formatting', { userId });
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        logger.info('Removed generic markdown formatting', { userId });
      }
      cleanedText = cleanedText.trim();
      
      mvpPlan = JSON.parse(cleanedText);
      
      logger.info('Successfully parsed MVP plan', {
        userId,
        projectName: mvpPlan.projectName,
        tasksCount: mvpPlan.tasks?.length,
        featuresCount: mvpPlan.features?.length,
        hasTechStack: !!mvpPlan.techStack
      });
    } catch (parseError) {
      logger.error('Failed to parse AI response as JSON', {
        userId,
        error: parseError instanceof Error ? parseError.message : String(parseError),
        rawText: result.text.substring(0, 500)
      });
      
      Sentry.captureException(parseError instanceof Error ? parseError : new Error('JSON parse failed'), {
        tags: { feature: 'mvp_generation', step: 'json_parsing' },
        extra: { 
          userId,
          rawResponse: result.text.substring(0, 1000),
          responseLength: result.text.length
        }
      });
      
      return res.status(500).json({ 
        error: 'Failed to parse MVP plan from AI response' 
      });
    }

    // Validate the MVP plan structure
    const validationResult = {
      hasProjectName: !!mvpPlan.projectName,
      hasDescription: !!mvpPlan.description,
      hasFeaturesArray: Array.isArray(mvpPlan.features),
      hasTechStack: !!mvpPlan.techStack,
      hasTasksArray: Array.isArray(mvpPlan.tasks)
    };
    
    logger.info('MVP plan validation results', {
      userId,
      ...validationResult
    });

    if (!mvpPlan.projectName || !mvpPlan.description || !Array.isArray(mvpPlan.features) || !mvpPlan.techStack || !Array.isArray(mvpPlan.tasks)) {
      logger.error('Invalid MVP plan structure', {
        userId,
        validationResult,
        receivedStructure: {
          projectName: typeof mvpPlan.projectName,
          description: typeof mvpPlan.description,
          features: Array.isArray(mvpPlan.features) ? `array[${mvpPlan.features.length}]` : typeof mvpPlan.features,
          techStack: typeof mvpPlan.techStack,
          tasks: Array.isArray(mvpPlan.tasks) ? `array[${mvpPlan.tasks.length}]` : typeof mvpPlan.tasks
        }
      });
      
      Sentry.captureException(new Error('Invalid MVP plan structure'), {
        tags: { feature: 'mvp_generation', step: 'structure_validation' },
        extra: { 
          userId,
          validationResult,
          mvpPlanKeys: Object.keys(mvpPlan),
          receivedStructure: JSON.stringify(mvpPlan, null, 2).substring(0, 1000)
        }
      });
      
      return res.status(500).json({ 
        error: 'Generated MVP plan has invalid structure' 
      });
    }

    const duration = Date.now() - startTime;
    logger.info('MVP generation completed successfully', {
      userId,
      duration,
      projectName: mvpPlan.projectName,
      tasksCount: mvpPlan.tasks.length,
      featuresCount: mvpPlan.features.length
    });

    res.json({ mvpPlan });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('MVP generation failed with unexpected error', {
      userId: req.user?.id,
      duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    Sentry.captureException(error instanceof Error ? error : new Error('MVP generation failed'), {
      tags: { feature: 'mvp_generation', step: 'unexpected_error' },
      extra: { 
        userId: req.user?.id,
        duration,
        projectIdea: req.body?.projectIdea?.substring(0, 100)
      }
    });
    
    res.status(500).json({ error: 'Failed to generate MVP plan' });
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

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not set');
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY environment variable is not set' 
      });
    }

    const systemPrompt = `You are an expert product manager and technical architect who helps create detailed MVP (Minimum Viable Product) plans for software projects.

Based on the user's project idea, create a comprehensive MVP plan that includes:

1. A clear project name and description
2. Core features that are essential for the MVP (keep it minimal but functional)
3. Recommended tech stack (frontend, backend, database, hosting)
4. Detailed development tasks broken down into actionable items

Focus on creating an MVP that can be built and launched quickly while still providing value to users. Prioritize essential features only.

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

    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generate-mvp"
      },
      system: systemPrompt,
      prompt: `Create an MVP plan for: ${projectIdea}`,
      maxTokens: 2000,
    });


    // Parse the JSON response
    let mvpPlan;
    try {
      let cleanedText = result.text.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      cleanedText = cleanedText.trim();
      
      mvpPlan = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return res.status(500).json({ 
        error: 'Failed to parse MVP plan from AI response' 
      });
    }

    // Validate the MVP plan structure
    if (!mvpPlan.projectName || !mvpPlan.description || !Array.isArray(mvpPlan.features) || !mvpPlan.techStack || !Array.isArray(mvpPlan.tasks)) {
      console.error('Invalid MVP plan structure:', mvpPlan);
      return res.status(500).json({ 
        error: 'Generated MVP plan has invalid structure' 
      });
    }

    res.json({ mvpPlan });
  } catch (error) {
    console.error('MVP generation error:', error);
    res.status(500).json({ error: 'Failed to generate MVP plan' });
  }
});

aiRoutes.post('/create-mvp-project', async (req: any, res: any) => {
  try {
    const { mvpPlan } = req.body;
    
    if (!mvpPlan) {
      return res.status(400).json({ error: 'MVP plan is required' });
    }

    // Get authenticated user ID
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not set');
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY environment variable is not set' 
      });
    }

    // Import task tools (same as chat.ts)
    const { createTaskTools } = await import('../tools/task-tools.js');
    const taskTools = createTaskTools(userId);

    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
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
            description: z.string().describe('Comprehensive description including tech stack and core features')
          }),
          execute: async (args) => taskTools.createProject.execute(args)
        }),
        createTask: tool({
          description: taskTools.createTask.description,
          parameters: z.object({
            projectId: z.string().describe('The ID of the project to add the task to'),
            title: z.string().describe('The title of the task'),
            description: z.string().describe('Detailed description of what needs to be done'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('Priority level of the task')
          }),
          execute: async (args) => taskTools.createTask.execute(args)
        })
      }
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
    console.error('MVP project creation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});