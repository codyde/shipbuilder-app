import express from 'express';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, generateText, tool } from 'ai';
import { z } from 'zod';
import { databaseService } from '../db/database-service.js';
import { Priority } from '../types/types.js';
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

## Testing Strategy
- Unit tests to write
- Integration testing approach
- Manual testing checklist

Format your response in markdown with clear sections and actionable steps. Be specific about implementation details while keeping it practical and achievable.`;

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
      onError: (error) => {
        console.error('AI generation error:', error);
        Sentry.captureException(error);
      },
      prompt: prompt,
      maxTokens: 1,
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

    const result = await streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generate-mvp-stream"
      },
      system: systemPrompt,
      prompt: `Create an MVP plan for: ${projectIdea}`,
      maxTokens: 2000,
    });

    // Stream the text chunks to the client
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      res.write(chunk);
    }

    res.end();
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
            description: z.string().describe('Detailed description of what needs to be done, structured as a prompt that an AI can use to generate code for that specific task. It should be a detailed description of the task, written from the perspective of a senior developer focused on that task space.'),
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