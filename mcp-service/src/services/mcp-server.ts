import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import { mcpAPIService } from './database-service.js';
import { AuthService } from './auth-service.js';
import { logger } from '../utils/logger.js';
import * as Sentry from '@sentry/node';
import {
  MCP_SERVER_INFO,
  MCP_DETAILED_CAPABILITIES
} from '../config/mcp-config.js';

interface MCPAuthContext {
  userId: string;
  email: string;
  name: string;
  userToken: string; // JWT token for API calls
}

export class ShipbuilderMCPServer {
  private server: McpServer;
  private authContext: MCPAuthContext | null = null;
  private authService: AuthService;

  constructor() {
    // Sentry wrapper re-enabled with patched SDK
    this.server = Sentry.wrapMcpServerWithSentry(new McpServer(MCP_SERVER_INFO, {
      capabilities: MCP_DETAILED_CAPABILITIES,
    }));

    this.authService = new AuthService();
    this.setupTools();
    this.setupErrorHandling();
    
    logger.info('MCP server created with simplified tools');
  }

  private setupErrorHandling() {
    // MCP server error handling is handled through the transport layer
    // and try/catch blocks in tool implementations
  }

  private setupTools() {
    // Helper function for consistent error handling
    const executeWithAuth = async <T>(toolName: string, operation: () => Promise<T>): Promise<T> => {
      if (!this.authContext) {
        throw new Error('Authentication required. Please provide valid API key or user context.');
      }

      try {
        return await operation();
      } catch (error) {
        logger.error(`MCP ${toolName} error`, {
          error: error instanceof Error ? error.message : String(error),
          userId: this.authContext.userId,
        });

        if (process.env.SENTRY_DSN) {
          Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
            tags: {
              component: 'mcp_server',
              tool_name: toolName,
            },
            extra: {
              userId: this.authContext.userId,
            },
          });
        }

        throw error;
      }
    };

    // Register query_projects tool
    this.server.tool(
      'query_projects',
      'Get all projects for the authenticated user',
      {
        status: z.enum(['active', 'backlog', 'completed', 'archived']).optional().describe('Filter projects by status'),
        include_tasks: z.boolean().default(true).describe('Whether to include tasks in the response'),
      },
      async ({ status, include_tasks }: { status?: string; include_tasks?: boolean }) => {
        return executeWithAuth('query_projects', async () => {
          const projects = await mcpAPIService.getProjects(this.authContext!.userId, this.authContext!.userToken);
          let filteredProjects = projects;

          if (status) {
            filteredProjects = projects.filter(p => p.status === status);
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                projects: filteredProjects.map(project => ({
                  id: project.id,
                  name: project.name,
                  description: project.description,
                  status: project.status,
                  createdAt: project.createdAt,
                  updatedAt: project.updatedAt,
                  tasks: include_tasks ? project.tasks : undefined
                }))
              }, null, 2)
            }]
          };
        });
      }
    );

    // Register query_tasks tool
    this.server.tool(
      'query_tasks',
      'Get tasks for a specific project',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
        status: z.enum(['backlog', 'in_progress', 'completed']).optional().describe('Filter tasks by status'),
        priority: z.enum(['low', 'medium', 'high']).optional().describe('Filter tasks by priority'),
      },
      async ({ project_id, status, priority }: { project_id: string; status?: string; priority?: string }) => {
        return executeWithAuth('query_tasks', async () => {
          const project = await mcpAPIService.getProject(project_id, this.authContext!.userToken);
          if (!project) {
            throw new Error(`Project not found: ${project_id}`);
          }

          let tasks = project.tasks || [];

          if (status) {
            tasks = tasks.filter(t => t.status === status);
          }

          if (priority) {
            tasks = tasks.filter(t => t.priority === priority);
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({ tasks }, null, 2)
            }]
          };
        });
      }
    );

    // Register create_project tool
    this.server.tool(
      'create_project',
      'Create a new project for the authenticated user',
      {
        name: z.string().min(1).max(100).describe('The name of the project'),
        description: z.string().optional().describe('Optional description of the project'),
        status: z.enum(['active', 'backlog', 'completed', 'archived']).default('active').describe('Initial status of the project'),
      },
      async ({ name, description, status }: { name: string; description?: string; status?: string }) => {
        return executeWithAuth('create_project', async () => {
          const project = await mcpAPIService.createProject(
            { name, description, status },
            this.authContext!.userToken
          );
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ project }, null, 2)
            }]
          };
        });
      }
    );

    // Register create_task tool
    this.server.tool(
      'create_task',
      'Create a new task within a project',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
        title: z.string().min(1).describe('The title of the task'),
        description: z.string().optional().describe('Optional description of the task'),
        priority: z.enum(['low', 'medium', 'high']).default('medium').describe('Priority level of the task'),
        status: z.enum(['backlog', 'in_progress', 'completed']).default('backlog').describe('Initial status of the task'),
      },
      async ({ project_id, title, description, priority, status }: { 
        project_id: string; 
        title: string; 
        description?: string; 
        priority?: string; 
        status?: string 
      }) => {
        return executeWithAuth('create_task', async () => {
          const task = await mcpAPIService.createTask(
            project_id,
            { title, description, priority, status },
            this.authContext!.userToken
          );
          
          if (!task) {
            throw new Error(`Project not found: ${project_id}`);
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({ task }, null, 2)
            }]
          };
        });
      }
    );

    // Register update_task_status tool
    this.server.tool(
      'update_task_status',
      'Update the status of a task',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
        task_id: z.string().min(1).describe('Task slug (e.g., "photoshare-1")'),
        status: z.enum(['backlog', 'in_progress', 'completed']).describe('New status for the task'),
      },
      async ({ project_id, task_id, status }: { project_id: string; task_id: string; status: string }) => {
        return executeWithAuth('update_task_status', async () => {
          const task = await mcpAPIService.updateTask(
            project_id,
            task_id,
            { status },
            this.authContext!.userToken
          );
          
          if (!task) {
            throw new Error(`Task not found: ${task_id} in project ${project_id}`);
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({ task }, null, 2)
            }]
          };
        });
      }
    );


    // Register create_mvp_project tool
    this.server.tool(
      'create_mvp_project',
      'Create a complete MVP project with all tasks from an AI-generated plan',
      {
        mvp_plan: z.object({
          projectName: z.string(),
          description: z.string(),
          tasks: z.array(z.object({
            title: z.string(),
            description: z.string(),
            priority: z.enum(['low', 'medium', 'high'])
          }))
        }).describe('The MVP plan object from generate_mvp_plan'),
      },
      async ({ mvp_plan }: { mvp_plan: any }) => {
        return executeWithAuth('create_mvp_project', async () => {
          const result = await mcpAPIService.createMVPProject(mvp_plan, this.authContext!.userToken);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ result }, null, 2)
            }]
          };
        });
      }
    );

    // Register delete_task tool
    this.server.tool(
      'delete_task',
      'Delete a task from a project',
      {
        project_id: z.string().describe('Project slug (e.g., "photoshare")'),
        task_id: z.string().describe('Task slug (e.g., "photoshare-1")'),
      },
      async ({ project_id, task_id }: { project_id: string; task_id: string }) => {
        return executeWithAuth('delete_task', async () => {
          const deleted = await mcpAPIService.deleteTask(project_id, task_id, this.authContext!.userToken);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ 
                success: deleted,
                message: deleted ? 'Task deleted successfully' : 'Task not found or could not be deleted',
                task_id,
                project_id
              }, null, 2)
            }]
          };
        });
      }
    );

    // Register delete_project tool
    this.server.tool(
      'delete_project',
      'Delete a project and all its tasks',
      {
        project_id: z.string().describe('Project slug (e.g., "photoshare")'),
      },
      async ({ project_id }: { project_id: string }) => {
        return executeWithAuth('delete_project', async () => {
          const deleted = await mcpAPIService.deleteProject(project_id, this.authContext!.userToken);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ 
                success: deleted,
                message: deleted ? 'Project deleted successfully' : 'Project not found or could not be deleted',
                project_id
              }, null, 2)
            }]
          };
        });
      }
    );

    // Register generate_task_details tool
    this.server.tool(
      'generate_task_details',
      'Generate detailed implementation guidance for a task using AI',
      {
        project_id: z.string().describe('Project slug (e.g., "photoshare")'),
        task_id: z.string().describe('Task slug (e.g., "photoshare-1")'),
        prompt: z.string().min(1).describe('Additional context or specific guidance request'),
      },
      async ({ project_id, task_id, prompt }: { project_id: string; task_id: string; prompt: string }) => {
        return executeWithAuth('generate_task_details', async () => {
          // Get task context first
          const task = await mcpAPIService.getTask(project_id, task_id, this.authContext!.userToken);
          if (!task) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({ 
                  error: 'Task not found',
                  task_id,
                  project_id
                }, null, 2)
              }]
            };
          }

          const context = {
            project_id,
            task: {
              id: task.id,
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority
            }
          };

          const details = await mcpAPIService.generateTaskDetails(prompt, context, this.authContext!.userToken);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ 
                task_id,
                project_id,
                details
              }, null, 2)
            }]
          };
        });
      }
    );

    logger.info('Registered 9 core MCP tools');
  }

  setAuthContext(context: MCPAuthContext) {
    this.authContext = context;
    logger.info('MCP auth context set', { 
      userId: context.userId, 
      email: context.email 
    });
  }

  clearAuthContext() {
    this.authContext = null;
    logger.info('MCP auth context cleared');
  }

  getAuthContext(): MCPAuthContext | null {
    return this.authContext;
  }

  getServer(): McpServer {
    return this.server;
  }
}