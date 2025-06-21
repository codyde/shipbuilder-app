import express from 'express';
import { streamText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { taskTools } from '../tools/task-tools.js';
import { z } from 'zod';

export const chatRoutes = express.Router();

chatRoutes.post('/stream', async (req, res) => {
  try {
    console.log('Chat request received:', req.body);
    const { messages } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not set');
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY environment variable is not set' 
      });
    }

    console.log('Processing messages:', messages);

    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      experimental_telemetry: {
        isEnabled: true,
        functionId: "my-awesome-function"
      },
      messages,
      system: `You are a helpful AI assistant for a project management application. You can help users create and manage their projects, tasks, and subtasks using the available tools.

When users ask you to create tasks or projects, use the appropriate tools to actually create them in the system. Always provide clear feedback about what was created.

You have access to these tools:
- createProject: Create a new project
- createTask: Create a task within a project
- createSubtask: Create a subtask within a task
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
        createSubtask: tool({
          description: taskTools.createSubtask.description,
          parameters: z.object({
            taskId: z.string().describe('The ID of the task to add the subtask to'),
            title: z.string().describe('The title of the subtask'),
            description: z.string().optional().describe('Optional description of the subtask'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('Priority level of the subtask')
          }),
          execute: async (args) => taskTools.createSubtask.execute(args)
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
      }
    });

    console.log('Creating AI SDK compatible response');
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
          console.log('Streaming AI SDK chunk:', chunk);
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
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});