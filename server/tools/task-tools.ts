import { databaseService } from '../db/database-service.js';
import { Priority, TaskStatus } from '../../src/types/types.js';

export const taskTools = {
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
        const project = await databaseService.createProject(args);
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
        const task = await databaseService.createTask(args);
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

  createSubtask: {
    description: 'Create a new subtask within a task',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to add the subtask to'
        },
        title: {
          type: 'string',
          description: 'The title of the subtask'
        },
        description: {
          type: 'string',
          description: 'Optional description of the subtask'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Priority level of the subtask'
        }
      },
      required: ['taskId', 'title']
    },
    execute: async (args: { taskId: string; title: string; description?: string; priority?: Priority }) => {
      try {
        const subtask = await databaseService.createSubtask(args);
        if (!subtask) {
          return {
            success: false,
            error: 'Task not found',
            message: `Could not find task with ID ${args.taskId}`
          };
        }
        return {
          success: true,
          data: subtask,
          message: `Created subtask "${subtask.title}" in task ${args.taskId}`
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to create subtask',
          message: 'An error occurred while creating the subtask'
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
        const task = await databaseService.updateTask(args.projectId, args.taskId, { status: args.status });
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
        const projects = await databaseService.getProjects();
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
        const project = await databaseService.getProject(args.projectId);
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
        const task = await databaseService.getTask(args.projectId, args.taskId);
        if (!task) {
          return {
            success: false,
            error: 'Task not found',
            message: `Could not find task with ID ${args.taskId} in project ${args.projectId}`
          };
        }
        
        const deleted = await databaseService.deleteTask(args.projectId, args.taskId);
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
  }
};