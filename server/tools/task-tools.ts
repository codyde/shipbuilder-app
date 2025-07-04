import { databaseService } from '../db/database-service.js';
import { Priority, TaskStatus } from '../types/types.js';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

export const createTaskTools = (userId: string) => ({
  createProject: {
    description: 'Create a new project',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the project'
        },
        description: {
          type: 'string',
          description: 'Optional description of the project'
        }
      },
      required: ['name']
    },
    execute: async (args: { name: string; description?: string }) => {
      try {
        const project = await databaseService.createProject(args, userId);
        return {
          success: true,
          data: project,
          message: `Created project "${project.name}" with ID ${project.id}`
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to create project',
          message: 'An error occurred while creating the project'
        };
      }
    }
  },

  createTask: {
    description: 'Create a new task within a project',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project to add the task to'
        },
        title: {
          type: 'string',
          description: 'The title of the task'
        },
        description: {
          type: 'string',
          description: 'Optional description of the task'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Priority level of the task'
        },
        dueDate: {
          type: 'string',
          description: 'Optional due date in ISO format'
        }
      },
      required: ['projectId', 'title']
    },
    execute: async (args: { projectId: string; title: string; description?: string; priority?: Priority; dueDate?: string }) => {
      try {
        const task = await databaseService.createTask(args, userId);
        if (!task) {
          return {
            success: false,
            error: 'Project not found',
            message: `Could not find project with ID ${args.projectId}`
          };
        }
        return {
          success: true,
          data: task,
          message: `Created task "${task.title}" in project ${args.projectId}`
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to create task',
          message: 'An error occurred while creating the task'
        };
      }
    }
  },

  updateTaskStatus: {
    description: 'Update the status of a task',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project containing the task'
        },
        taskId: {
          type: 'string',
          description: 'The ID of the task to update'
        },
        status: {
          type: 'string',
          enum: ['backlog', 'in_progress', 'completed'],
          description: 'The new status for the task'
        }
      },
      required: ['projectId', 'taskId', 'status']
    },
    execute: async (args: { projectId: string; taskId: string; status: TaskStatus }) => {
      try {
        const task = await databaseService.updateTask(args.projectId, args.taskId, userId, { status: args.status });
        if (!task) {
          return {
            success: false,
            error: 'Task not found',
            message: `Could not find task with ID ${args.taskId} in project ${args.projectId}`
          };
        }
        return {
          success: true,
          data: task,
          message: `Updated task "${task.title}" status to ${args.status}`
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to update task status',
          message: 'An error occurred while updating the task status'
        };
      }
    }
  },

  listProjects: {
    description: 'Get a list of all projects with their tasks',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    execute: async () => {
      try {
        const projects = await databaseService.getProjects(userId);
        return {
          success: true,
          data: projects,
          message: `Found ${projects.length} project(s)`
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to list projects',
          message: 'An error occurred while retrieving projects'
        };
      }
    }
  },

  getProject: {
    description: 'Get details of a specific project including all its tasks',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project to retrieve'
        }
      },
      required: ['projectId']
    },
    execute: async (args: { projectId: string }) => {
      try {
        const project = await databaseService.getProject(args.projectId, userId);
        if (!project) {
          return {
            success: false,
            error: 'Project not found',
            message: `Could not find project with ID ${args.projectId}`
          };
        }
        return {
          success: true,
          data: project,
          message: `Retrieved project "${project.name}" with ${project.tasks.length} task(s)`
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to get project',
          message: 'An error occurred while retrieving the project'
        };
      }
    }
  },

  deleteTask: {
    description: 'Delete a task from a project',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project containing the task'
        },
        taskId: {
          type: 'string',
          description: 'The ID of the task to delete'
        }
      },
      required: ['projectId', 'taskId']
    },
    execute: async (args: { projectId: string; taskId: string }) => {
      try {
        // Get task details before deleting so we can include the name in the response
        const task = await databaseService.getTask(args.projectId, args.taskId, userId);
        if (!task) {
          return {
            success: false,
            error: 'Task not found',
            message: `Could not find task with ID ${args.taskId} in project ${args.projectId}`
          };
        }
        
        const deleted = await databaseService.deleteTask(args.projectId, args.taskId, userId);
        if (!deleted) {
          return {
            success: false,
            error: 'Failed to delete task',
            message: 'Task could not be deleted'
          };
        }
        
        return {
          success: true,
          data: { id: args.taskId, title: task.title },
          message: `Successfully deleted task "${task.title}" from project ${args.projectId}`
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to delete task',
          message: 'An error occurred while deleting the task'
        };
      }
    }
  },

  generateMVPPlan: {
    description: 'Generate an MVP plan for a project idea without creating anything',
    parameters: {
      type: 'object',
      properties: {
        projectIdea: {
          type: 'string',
          description: 'The project idea to analyze and plan'
        }
      },
      required: ['projectIdea']
    },
    execute: async (args: { projectIdea: string }) => {
      try {
        if (!process.env.ANTHROPIC_API_KEY) {
          return {
            success: false,
            error: 'ANTHROPIC_API_KEY not configured',
            message: 'AI service not available'
          };
        }

        // Generate MVP plan using AI
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

        const result = await generateText({
          model: anthropic('claude-sonnet-4-20250514'),
          experimental_telemetry: {
            isEnabled: true,
            functionId: "generate-mvp"
          },
          system: systemPrompt,
          prompt: `Create an MVP plan for: ${args.projectIdea}`,
          maxTokens: 2000,
        });

        // Parse the AI response
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
          return {
            success: false,
            error: 'Failed to parse AI response',
            message: 'Could not generate valid MVP plan'
          };
        }

        // Validate MVP plan structure
        if (!mvpPlan.projectName || !mvpPlan.description || !Array.isArray(mvpPlan.features) || !mvpPlan.techStack || !Array.isArray(mvpPlan.tasks)) {
          return {
            success: false,
            error: 'Invalid MVP plan structure',
            message: 'Generated plan is missing required fields'
          };
        }

        return {
          success: true,
          data: mvpPlan,
          message: `Generated MVP plan for "${mvpPlan.projectName}" with ${mvpPlan.tasks.length} tasks`
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to generate MVP plan',
          message: 'An unexpected error occurred while generating the MVP plan'
        };
      }
    }
  },

});