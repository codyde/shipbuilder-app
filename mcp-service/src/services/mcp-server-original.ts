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
    
    logger.info('MCP server created with patched Sentry wrapper');
  }

  private setupErrorHandling() {
    // MCP server error handling is handled through the transport layer
    // and try/catch blocks in tool implementations
  }

  private setupTools() {
    // Register query_projects tool
    this.server.tool(
      'query_projects',
      'Get all projects for the authenticated user',
      {
        status: z.enum(['active', 'backlog', 'completed', 'archived']).optional().describe('Filter projects by status'),
        include_tasks: z.boolean().default(true).describe('Whether to include tasks in the response'),
      },
      async ({ status, include_tasks }: { status?: string; include_tasks?: boolean }) => {
        if (!this.authContext) {
          throw new Error('Authentication required. Please provide valid API key or user context.');
        }

        try {
          return await this.handleQueryProjects({ status, include_tasks });
        } catch (error) {
          logger.error('MCP query_projects error', {
            args: { status, include_tasks },
            error: error instanceof Error ? error.message : String(error),
            userId: this.authContext.userId,
          });

          if (process.env.SENTRY_DSN) {
            Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
              tags: {
                component: 'mcp_server',
                tool_name: 'query_projects',
              },
              extra: {
                args: { status, include_tasks },
                userId: this.authContext.userId,
              },
            });
          }

          throw error;
        }
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
        if (!this.authContext) {
          throw new Error('Authentication required. Please provide valid API key or user context.');
        }

        try {
          return await this.handleQueryTasks({ project_id, status, priority });
        } catch (error) {
          logger.error('MCP query_tasks error', {
            args: { project_id, status, priority },
            error: error instanceof Error ? error.message : String(error),
            userId: this.authContext.userId,
          });

          if (process.env.SENTRY_DSN) {
            Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
              tags: {
                component: 'mcp_server',
                tool_name: 'query_tasks',
              },
              extra: {
                args: { project_id, status, priority },
                userId: this.authContext.userId,
              },
            });
          }

          throw error;
        }
      }
    );

    // Register get_project tool
    this.server.tool(
      'get_project',
      'Get details of a specific project including all its tasks',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
      },
      async ({ project_id }: { project_id: string }) => {
        return await this.executeWithAuth('get_project', { project_id }, () => 
          this.handleGetProject({ project_id })
        );
      }
    );

    // Register get_task tool
    this.server.tool(
      'get_task',
      'Get details of a specific task',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
        task_id: z.string().min(1).describe('Task slug (e.g., "photoshare-1")'),
      },
      async ({ project_id, task_id }: { project_id: string; task_id: string }) => {
        return await this.executeWithAuth('get_task', { project_id, task_id }, () => 
          this.handleGetTask({ project_id, task_id })
        );
      }
    );

    // Register create_project tool (fix existing implementation)
    this.server.tool(
      'create_project',
      'Create a new project for the authenticated user',
      {
        name: z.string().min(1).max(100).describe('The name of the project'),
        description: z.string().optional().describe('Optional description of the project'),
        status: z.enum(['active', 'backlog', 'completed', 'archived']).default('active').describe('Initial status of the project'),
      },
      async ({ name, description, status }: { name: string; description?: string; status?: string }) => {
        return await this.executeWithAuth('create_project', { name, description, status }, () => 
          this.handleCreateProject({ name, description, status })
        );
      }
    );

    // Register update_project tool
    this.server.tool(
      'update_project',
      'Update project details',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
        name: z.string().min(1).max(100).optional().describe('Updated project name'),
        description: z.string().optional().describe('Updated project description'),
        status: z.enum(['active', 'backlog', 'completed', 'archived']).optional().describe('Updated project status'),
      },
      async ({ project_id, name, description, status }: { project_id: string; name?: string; description?: string; status?: string }) => {
        return await this.executeWithAuth('update_project', { project_id, name, description, status }, () => 
          this.handleUpdateProject({ project_id, name, description, status })
        );
      }
    );

    // Register delete_project tool
    this.server.tool(
      'delete_project',
      'Delete a project and all its tasks',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
      },
      async ({ project_id }: { project_id: string }) => {
        return await this.executeWithAuth('delete_project', { project_id }, () => 
          this.handleDeleteProject({ project_id })
        );
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
      async ({ project_id, title, description, priority, status }: { project_id: string; title: string; description?: string; priority?: string; status?: string }) => {
        return await this.executeWithAuth('create_task', { project_id, title, description, priority, status }, () => 
          this.handleCreateTask({ project_id, title, description, priority, status })
        );
      }
    );

    // Register update_task tool
    this.server.tool(
      'update_task',
      'Update task details (title, description, priority)',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
        task_id: z.string().min(1).describe('Task slug (e.g., "photoshare-1")'),
        title: z.string().min(1).optional().describe('Updated task title'),
        description: z.string().optional().describe('Updated task description'),
        priority: z.enum(['low', 'medium', 'high']).optional().describe('Updated task priority'),
      },
      async ({ project_id, task_id, title, description, priority }: { project_id: string; task_id: string; title?: string; description?: string; priority?: string }) => {
        return await this.executeWithAuth('update_task', { project_id, task_id, title, description, priority }, () => 
          this.handleUpdateTask({ project_id, task_id, title, description, priority })
        );
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
        return await this.executeWithAuth('update_task_status', { project_id, task_id, status }, () => 
          this.handleUpdateTaskStatus({ project_id, task_id, status })
        );
      }
    );

    // Register delete_task tool
    this.server.tool(
      'delete_task',
      'Delete a task from a project',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
        task_id: z.string().min(1).describe('Task slug (e.g., "photoshare-1")'),
      },
      async ({ project_id, task_id }: { project_id: string; task_id: string }) => {
        return await this.executeWithAuth('delete_task', { project_id, task_id }, () => 
          this.handleDeleteTask({ project_id, task_id })
        );
      }
    );

    // Register create_multiple_tasks tool
    this.server.tool(
      'create_multiple_tasks',
      'Create multiple tasks at once for efficient bulk operations',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
        tasks: z.array(z.object({
          title: z.string().min(1).describe('Task title'),
          description: z.string().optional().describe('Task description'),
          priority: z.enum(['low', 'medium', 'high']).default('medium'),
          status: z.enum(['backlog', 'in_progress', 'completed']).default('backlog'),
        })).min(1).describe('Array of tasks to create'),
      },
      async ({ project_id, tasks }: { project_id: string; tasks: any[] }) => {
        return await this.executeWithAuth('create_multiple_tasks', { project_id, tasks }, () => 
          this.handleCreateMultipleTasks({ project_id, tasks })
        );
      }
    );

    // Register bulk_update_task_status tool
    this.server.tool(
      'bulk_update_task_status',
      'Update status for multiple tasks at once',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
        task_ids: z.array(z.string()).min(1).describe('Array of task slugs to update'),
        status: z.enum(['backlog', 'in_progress', 'completed']).describe('New status for all specified tasks'),
      },
      async ({ project_id, task_ids, status }: { project_id: string; task_ids: string[]; status: string }) => {
        return await this.executeWithAuth('bulk_update_task_status', { project_id, task_ids, status }, () => 
          this.handleBulkUpdateTaskStatus({ project_id, task_ids, status })
        );
      }
    );

    // generate_mvp_plan tool removed - use create_mvp_project instead

    // Register create_mvp_project tool
    this.server.tool(
      'create_mvp_project',
      'Create a complete MVP project with all tasks from an AI-generated plan',
      {
        mvp_plan: z.object({
          projectName: z.string(),
          description: z.string(),
          features: z.array(z.string()),
          techStack: z.object({
            frontend: z.string(),
            backend: z.string(),
            database: z.string(),
            hosting: z.string().optional(),
          }),
          tasks: z.array(z.object({
            title: z.string(),
            description: z.string(),
            priority: z.enum(['low', 'medium', 'high']),
          })),
        }).describe('The MVP plan object from generate_mvp_plan'),
      },
      async ({ mvp_plan }: { mvp_plan: any }) => {
        return await this.executeWithAuth('create_mvp_project', { mvp_plan }, () => 
          this.handleCreateMVPProject({ mvp_plan })
        );
      }
    );

    // Register generate_task_details tool
    this.server.tool(
      'generate_task_details',
      'Generate detailed implementation guidance for a task using AI',
      {
        prompt: z.string().min(10).describe('What specific implementation details you need'),
        context: z.object({
          title: z.string().optional(),
          description: z.string().optional(),
          priority: z.string().optional(),
          project_id: z.string().optional(),
        }).optional().describe('Task context for better AI guidance'),
      },
      async ({ prompt, context }: { prompt: string; context?: any }) => {
        return await this.executeWithAuth('generate_task_details', { prompt, context }, () => 
          this.handleGenerateTaskDetails({ prompt, context })
        );
      }
    );

    // Register get_task_comments tool
    this.server.tool(
      'get_task_comments',
      'Get all comments for a specific task',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
        task_id: z.string().min(1).describe('Task slug (e.g., "photoshare-1")'),
      },
      async ({ project_id, task_id }: { project_id: string; task_id: string }) => {
        return await this.executeWithAuth('get_task_comments', { project_id, task_id }, () => 
          this.handleGetTaskComments({ project_id, task_id })
        );
      }
    );

    // Register create_task_comment tool
    this.server.tool(
      'create_task_comment',
      'Add a comment to a task',
      {
        project_id: z.string().min(1).describe('Project slug (e.g., "photoshare")'),
        task_id: z.string().min(1).describe('Task slug (e.g., "photoshare-1")'),
        content: z.string().min(1).describe('Comment content'),
      },
      async ({ project_id, task_id, content }: { project_id: string; task_id: string; content: string }) => {
        return await this.executeWithAuth('create_task_comment', { project_id, task_id, content }, () => 
          this.handleCreateTaskComment({ project_id, task_id, content })
        );
      }
    );

    // Register get_components tool
    this.server.tool(
      'get_components',
      'Get all user components with optional filtering',
      {
        search: z.string().optional().describe('Search term to filter components by name, description, or tags'),
        tags: z.array(z.string()).optional().describe('Filter components by specific tags'),
        active_only: z.boolean().default(true).describe('Only return active components'),
      },
      async ({ search, tags, active_only }: { search?: string; tags?: string[]; active_only?: boolean }) => {
        return await this.executeWithAuth('get_components', { search, tags, active_only }, () => 
          this.handleGetComponents({ search, tags, active_only })
        );
      }
    );

    // Register get_component tool
    this.server.tool(
      'get_component',
      'Get details of a specific component',
      {
        component_id: z.string().min(1).describe('Component UUID'),
      },
      async ({ component_id }: { component_id: string }) => {
        return await this.executeWithAuth('get_component', { component_id }, () => 
          this.handleGetComponent({ component_id })
        );
      }
    );

    // Register create_component tool
    this.server.tool(
      'create_component',
      'Create a new reusable component template',
      {
        name: z.string().min(1).max(100).describe('Component name (e.g., "React+Node.js API", "Django+PostgreSQL")'),
        description: z.string().min(1).max(2000).describe('Detailed description of what this component provides and how to use it'),
        tags: z.array(z.string()).max(20).optional().describe('Tags for categorizing and searching (max 20)'),
      },
      async ({ name, description, tags }: { name: string; description: string; tags?: string[] }) => {
        return await this.executeWithAuth('create_component', { name, description, tags }, () => 
          this.handleCreateComponent({ name, description, tags })
        );
      }
    );

    // Register update_component tool
    this.server.tool(
      'update_component',
      'Update an existing component',
      {
        component_id: z.string().min(1).describe('Component UUID'),
        name: z.string().min(1).max(100).optional().describe('Updated component name'),
        description: z.string().min(1).max(2000).optional().describe('Updated component description'),
        tags: z.array(z.string()).max(20).optional().describe('Updated tags'),
        is_active: z.boolean().optional().describe('Whether the component is active'),
      },
      async ({ component_id, name, description, tags, is_active }: { component_id: string; name?: string; description?: string; tags?: string[]; is_active?: boolean }) => {
        return await this.executeWithAuth('update_component', { component_id, name, description, tags, is_active }, () => 
          this.handleUpdateComponent({ component_id, name, description, tags, is_active })
        );
      }
    );

    // Register delete_component tool
    this.server.tool(
      'delete_component',
      'Delete (deactivate) a component',
      {
        component_id: z.string().min(1).describe('Component UUID'),
      },
      async ({ component_id }: { component_id: string }) => {
        return await this.executeWithAuth('delete_component', { component_id }, () => 
          this.handleDeleteComponent({ component_id })
        );
      }
    );

    // Register search_components tool
    this.server.tool(
      'search_components',
      'Advanced component search with filtering and ranking',
      {
        query: z.string().optional().describe('Search query for component name, description, or tags'),
        tags: z.array(z.string()).optional().describe('Must match all specified tags'),
        exclude_tags: z.array(z.string()).optional().describe('Exclude components with these tags'),
        limit: z.number().min(1).max(100).default(20).describe('Maximum number of results'),
      },
      async ({ query, tags, exclude_tags, limit }: { query?: string; tags?: string[]; exclude_tags?: string[]; limit?: number }) => {
        return await this.executeWithAuth('search_components', { query, tags, exclude_tags, limit }, () => 
          this.handleSearchComponents({ query, tags, exclude_tags, limit })
        );
      }
    );

    // Register generate_mvp_plan_with_components tool
    this.server.tool(
      'generate_mvp_plan_with_components',
      'Generate an AI-powered MVP plan using specific components',
      {
        project_idea: z.string().min(10).max(500).describe('The project idea to analyze and plan'),
        component_ids: z.array(z.string()).min(1).describe('Array of component UUIDs to incorporate into the MVP plan'),
      },
      async ({ project_idea, component_ids }: { project_idea: string; component_ids: string[] }) => {
        return await this.executeWithAuth('generate_mvp_plan_with_components', { project_idea, component_ids }, () => 
          this.handleGenerateMVPPlanWithComponents({ project_idea, component_ids })
        );
      }
    );
  }

  private async handleQueryProjects(args: any) {
    const validatedArgs = {
      status: args.status,
      include_tasks: args.include_tasks ?? true,
    };

    logger.info('MCP query_projects called', {
      userId: this.authContext!.userId,
      filters: validatedArgs,
    });

    // Get projects from API
    const projects = await mcpAPIService.getProjects(this.authContext!.userId, this.authContext!.userToken);

    // Filter by status if specified
    let filteredProjects = projects;
    if (validatedArgs.status) {
      filteredProjects = projects.filter(p => p.status === validatedArgs.status);
    }

    // Transform for MCP response
    const responseData = filteredProjects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      task_count: project.tasks.length,
      tasks: validatedArgs.include_tasks ? project.tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      })) : undefined,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    }));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: responseData,
            count: responseData.length,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleQueryTasks(args: any) {
    const validatedArgs = {
      project_id: args.project_id,
      status: args.status,
      priority: args.priority,
    };

    // Validate project slug format
    if (!this.validateProjectSlug(validatedArgs.project_id)) {
      throw new Error(`Invalid project ID format: ${validatedArgs.project_id}. Must be alphanumeric with hyphens.`);
    }

    logger.info('MCP query_tasks called', {
      userId: this.authContext!.userId,
      projectId: validatedArgs.project_id,
      filters: { status: validatedArgs.status, priority: validatedArgs.priority },
    });

    // Get project (which includes tasks) from API
    const project = await mcpAPIService.getProject(validatedArgs.project_id, this.authContext!.userToken);

    if (!project) {
      throw new Error(`Project not found: ${validatedArgs.project_id}`);
    }

    // Filter tasks based on provided filters
    let tasks = project.tasks || [];

    if (validatedArgs.status) {
      tasks = tasks.filter(task => task.status === validatedArgs.status);
    }

    if (validatedArgs.priority) {
      tasks = tasks.filter(task => task.priority === validatedArgs.priority);
    }


    // Transform for MCP response
    const responseData = {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
      },
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        details: task.details,
        status: task.status,
        priority: task.priority,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      })),
      count: tasks.length,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: responseData,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Set authentication context for the MCP session
   */
  setAuthContext(authContext: Omit<MCPAuthContext, 'userToken'>) {
    // Generate an API-compatible JWT token for service calls
    const userToken = this.authService.generateAPIToken(
      authContext.userId,
      authContext.email,
      authContext.name
    );

    this.authContext = {
      ...authContext,
      userToken
    };

    logger.info('MCP authentication context set', {
      userId: authContext.userId,
      email: authContext.email,
    });
  }

  /**
   * Clear authentication context
   */
  clearAuthContext() {
    this.authContext = null;
    logger.info('MCP authentication context cleared');
  }

  /**
   * Get current authentication context
   */
  getAuthContext(): MCPAuthContext | null {
    return this.authContext;
  }

  /**
   * Get the underlying MCP server instance
   */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Public method to handle query_projects tool calls
   */
  async handleQueryProjectsPublic(args: any) {
    return await this.handleQueryProjects(args);
  }

  /**
   * Public method to handle query_tasks tool calls
   */
  async handleQueryTasksPublic(args: any) {
    return await this.handleQueryTasks(args);
  }

  /**
   * Helper method to execute tool calls with authentication and error handling
   */
  private async executeWithAuth<T>(toolName: string, args: any, handler: () => Promise<T>): Promise<T> {
    if (!this.authContext) {
      throw new Error('Authentication required. Please provide valid API key or user context.');
    }

    try {
      return await handler();
    } catch (error) {
      logger.error(`MCP ${toolName} error`, {
        args,
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
            args,
            userId: this.authContext.userId,
          },
        });
      }

      throw error;
    }
  }

  /**
   * Handle get_project tool calls
   */
  private async handleGetProject(args: any) {
    const projectId = args.project_id;

    if (!this.validateProjectSlug(projectId)) {
      throw new Error(`Invalid project ID format: ${projectId}. Must be alphanumeric with hyphens.`);
    }

    logger.info('MCP get_project called', {
      userId: this.authContext!.userId,
      projectId,
    });

    const project = await mcpAPIService.getProject(projectId, this.authContext!.userToken);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              id: project.id,
              name: project.name,
              description: project.description,
              status: project.status,
              tasks: project.tasks.map(task => ({
                id: task.id,
                title: task.title,
                description: task.description,
                details: task.details,
                status: task.status,
                priority: task.priority,
                created_at: task.createdAt,
                updated_at: task.updatedAt,
              })),
              created_at: project.createdAt,
              updated_at: project.updatedAt,
            },
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get_task tool calls
   */
  private async handleGetTask(args: any) {
    const { project_id, task_id } = args;

    if (!this.validateProjectSlug(project_id)) {
      throw new Error(`Invalid project ID format: ${project_id}. Must be alphanumeric with hyphens.`);
    }

    logger.info('MCP get_task called', {
      userId: this.authContext!.userId,
      projectId: project_id,
      taskId: task_id,
    });

    const task = await mcpAPIService.getTask(project_id, task_id, this.authContext!.userToken);

    if (!task) {
      throw new Error(`Task not found: ${task_id} in project ${project_id}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              id: task.id,
              title: task.title,
              description: task.description,
              details: task.details,
              status: task.status,
              priority: task.priority,
              created_at: task.createdAt,
              updated_at: task.updatedAt,
            },
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle update_project tool calls
   */
  private async handleUpdateProject(args: any) {
    const { project_id, name, description, status } = args;

    if (!this.validateProjectSlug(project_id)) {
      throw new Error(`Invalid project ID format: ${project_id}. Must be alphanumeric with hyphens.`);
    }

    const updates: { name?: string; description?: string; status?: string } = {};
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (status) updates.status = status;

    logger.info('MCP update_project called', {
      userId: this.authContext!.userId,
      projectId: project_id,
      updates,
    });

    const project = await mcpAPIService.updateProject(project_id, updates, this.authContext!.userToken);

    if (!project) {
      throw new Error(`Project not found: ${project_id}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              id: project.id,
              name: project.name,
              description: project.description,
              status: project.status,
              created_at: project.createdAt,
              updated_at: project.updatedAt,
            },
            message: `Project "${project.name}" updated successfully`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle delete_project tool calls
   */
  private async handleDeleteProject(args: any) {
    const { project_id } = args;

    if (!this.validateProjectSlug(project_id)) {
      throw new Error(`Invalid project ID format: ${project_id}. Must be alphanumeric with hyphens.`);
    }

    logger.info('MCP delete_project called', {
      userId: this.authContext!.userId,
      projectId: project_id,
    });

    const deleted = await mcpAPIService.deleteProject(project_id, this.authContext!.userToken);

    if (!deleted) {
      throw new Error(`Project not found: ${project_id}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: { id: project_id },
            message: `Project "${project_id}" deleted successfully`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle create_task tool calls
   */
  private async handleCreateTask(args: any) {
    const { project_id, title, description, priority, status } = args;

    if (!this.validateProjectSlug(project_id)) {
      throw new Error(`Invalid project ID format: ${project_id}. Must be alphanumeric with hyphens.`);
    }

    const taskData: { title: string; description?: string; priority?: string; status?: string } = {
      title: title.trim()
    };

    if (description) taskData.description = description.trim();
    if (priority) taskData.priority = priority;
    if (status) taskData.status = status;

    logger.info('MCP create_task called', {
      userId: this.authContext!.userId,
      projectId: project_id,
      taskTitle: title,
      priority: priority || 'medium',
      status: status || 'backlog',
    });

    const task = await mcpAPIService.createTask(project_id, taskData, this.authContext!.userToken);

    if (!task) {
      throw new Error(`Project not found: ${project_id}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              id: task.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: task.status,
              created_at: task.createdAt,
              updated_at: task.updatedAt,
            },
            message: `Task "${task.title}" created successfully in project ${project_id}`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle update_task tool calls
   */
  private async handleUpdateTask(args: any) {
    const { project_id, task_id, title, description, priority } = args;

    if (!this.validateProjectSlug(project_id)) {
      throw new Error(`Invalid project ID format: ${project_id}. Must be alphanumeric with hyphens.`);
    }

    const updates: { title?: string; description?: string; priority?: string } = {};
    if (title) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (priority) updates.priority = priority;

    logger.info('MCP update_task called', {
      userId: this.authContext!.userId,
      projectId: project_id,
      taskId: task_id,
      updates,
    });

    const task = await mcpAPIService.updateTask(project_id, task_id, updates, this.authContext!.userToken);

    if (!task) {
      throw new Error(`Task not found: ${task_id} in project ${project_id}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              id: task.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: task.status,
              created_at: task.createdAt,
              updated_at: task.updatedAt,
            },
            message: `Task "${task.title}" updated successfully`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle update_task_status tool calls
   */
  private async handleUpdateTaskStatus(args: any) {
    const { project_id, task_id, status } = args;

    if (!this.validateProjectSlug(project_id)) {
      throw new Error(`Invalid project ID format: ${project_id}. Must be alphanumeric with hyphens.`);
    }

    logger.info('MCP update_task_status called', {
      userId: this.authContext!.userId,
      projectId: project_id,
      taskId: task_id,
      newStatus: status,
    });

    const task = await mcpAPIService.updateTask(project_id, task_id, { status }, this.authContext!.userToken);

    if (!task) {
      throw new Error(`Task not found: ${task_id} in project ${project_id}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              id: task.id,
              title: task.title,
              status: task.status,
              updated_at: task.updatedAt,
            },
            message: `Task "${task.title}" status updated to ${status}`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle delete_task tool calls
   */
  private async handleDeleteTask(args: any) {
    const { project_id, task_id } = args;

    if (!this.validateProjectSlug(project_id)) {
      throw new Error(`Invalid project ID format: ${project_id}. Must be alphanumeric with hyphens.`);
    }

    logger.info('MCP delete_task called', {
      userId: this.authContext!.userId,
      projectId: project_id,
      taskId: task_id,
    });

    // Get task details before deleting for response message
    const task = await mcpAPIService.getTask(project_id, task_id, this.authContext!.userToken);
    if (!task) {
      throw new Error(`Task not found: ${task_id} in project ${project_id}`);
    }

    const deleted = await mcpAPIService.deleteTask(project_id, task_id, this.authContext!.userToken);
    if (!deleted) {
      throw new Error(`Failed to delete task: ${task_id}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: { id: task_id, title: task.title },
            message: `Task "${task.title}" deleted successfully from project ${project_id}`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle create_multiple_tasks tool calls
   */
  private async handleCreateMultipleTasks(args: any) {
    const { project_id, tasks } = args;

    if (!this.validateProjectSlug(project_id)) {
      throw new Error(`Invalid project ID format: ${project_id}. Must be alphanumeric with hyphens.`);
    }

    logger.info('MCP create_multiple_tasks called', {
      userId: this.authContext!.userId,
      projectId: project_id,
      taskCount: tasks.length,
    });

    const createdTasks = [];
    const errors = [];

    // Create tasks one by one to handle duplicates and errors properly
    for (let i = 0; i < tasks.length; i++) {
      const taskData = tasks[i];
      try {
        const task = await mcpAPIService.createTask(project_id, {
          title: taskData.title.trim(),
          description: taskData.description?.trim(),
          priority: taskData.priority || 'medium',
          status: taskData.status || 'backlog',
        }, this.authContext!.userToken);

        if (task) {
          createdTasks.push(task);
        } else {
          errors.push(`Failed to create task: ${taskData.title}`);
        }
      } catch (error) {
        errors.push(`Error creating task "${taskData.title}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: createdTasks.length > 0,
            data: {
              created_tasks: createdTasks.map(task => ({
                id: task.id,
                title: task.title,
                description: task.description,
                priority: task.priority,
                status: task.status,
                created_at: task.createdAt,
              })),
              errors: errors,
            },
            message: `Created ${createdTasks.length} of ${tasks.length} tasks successfully${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle bulk_update_task_status tool calls
   */
  private async handleBulkUpdateTaskStatus(args: any) {
    const { project_id, task_ids, status } = args;

    if (!this.validateProjectSlug(project_id)) {
      throw new Error(`Invalid project ID format: ${project_id}. Must be alphanumeric with hyphens.`);
    }

    logger.info('MCP bulk_update_task_status called', {
      userId: this.authContext!.userId,
      projectId: project_id,
      taskCount: task_ids.length,
      newStatus: status,
    });

    const updatedTasks = [];
    const errors = [];

    // Update tasks one by one to handle errors properly
    for (const task_id of task_ids) {
      try {
        const task = await mcpAPIService.updateTask(project_id, task_id, { status }, this.authContext!.userToken);
        if (task) {
          updatedTasks.push(task);
        } else {
          errors.push(`Task not found: ${task_id}`);
        }
      } catch (error) {
        errors.push(`Error updating task ${task_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: updatedTasks.length > 0,
            data: {
              updated_tasks: updatedTasks.map(task => ({
                id: task.id,
                title: task.title,
                status: task.status,
                updated_at: task.updatedAt,
              })),
              errors: errors,
            },
            message: `Updated status to ${status} for ${updatedTasks.length} of ${task_ids.length} tasks${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle generate_mvp_plan tool calls
   */
  private async handleGenerateMVPPlan(args: any) {
    const { project_idea } = args;

    logger.info('MCP generate_mvp_plan called', {
      userId: this.authContext!.userId,
      projectIdea: project_idea.substring(0, 50) + '...',
    });

    // Method removed - generateMVPPlan is no longer available
    throw new Error('generateMVPPlan method has been removed. Use create_mvp_project instead.');
  }

  /**
   * Handle create_mvp_project tool calls
   */
  private async handleCreateMVPProject(args: any) {
    const { mvp_plan } = args;

    logger.info('MCP create_mvp_project called', {
      userId: this.authContext!.userId,
      projectName: mvp_plan.projectName,
      taskCount: mvp_plan.tasks.length,
    });

    const result = await mcpAPIService.createMVPProject(mvp_plan, this.authContext!.userToken);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              project_name: mvp_plan.projectName,
              task_count: mvp_plan.tasks.length,
              streaming_result: result,
            },
            message: `MVP project "${mvp_plan.projectName}" creation initiated with ${mvp_plan.tasks.length} tasks`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle generate_task_details tool calls
   */
  private async handleGenerateTaskDetails(args: any) {
    const { prompt, context } = args;

    logger.info('MCP generate_task_details called', {
      userId: this.authContext!.userId,
      prompt: prompt.substring(0, 50) + '...',
      hasContext: !!context,
    });

    const details = await mcpAPIService.generateTaskDetails(prompt, context, this.authContext!.userToken);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              implementation_details: details,
              context: context,
            },
            message: 'Generated detailed implementation guidance for task',
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get_task_comments tool calls
   */
  private async handleGetTaskComments(args: any) {
    const { project_id, task_id } = args;

    if (!this.validateProjectSlug(project_id)) {
      throw new Error(`Invalid project ID format: ${project_id}. Must be alphanumeric with hyphens.`);
    }

    logger.info('MCP get_task_comments called', {
      userId: this.authContext!.userId,
      projectId: project_id,
      taskId: task_id,
    });

    const comments = await mcpAPIService.getTaskComments(project_id, task_id, this.authContext!.userToken);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              project_id,
              task_id,
              comments: comments,
              count: comments.length,
            },
            message: `Found ${comments.length} comment(s) for task ${task_id}`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle create_task_comment tool calls
   */
  private async handleCreateTaskComment(args: any) {
    const { project_id, task_id, content } = args;

    if (!this.validateProjectSlug(project_id)) {
      throw new Error(`Invalid project ID format: ${project_id}. Must be alphanumeric with hyphens.`);
    }

    logger.info('MCP create_task_comment called', {
      userId: this.authContext!.userId,
      projectId: project_id,
      taskId: task_id,
      contentLength: content.length,
    });

    const comment = await mcpAPIService.createTaskComment(project_id, task_id, content.trim(), this.authContext!.userToken);

    if (!comment) {
      throw new Error(`Task not found: ${task_id} in project ${project_id}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: comment,
            message: `Comment added to task ${task_id}`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get_components tool calls
   */
  private async handleGetComponents(args: any) {
    const { search, tags, active_only } = args;

    logger.info('MCP get_components called', {
      userId: this.authContext!.userId,
      search: search ? search.substring(0, 50) + '...' : null,
      tagCount: tags?.length || 0,
      activeOnly: active_only !== false,
    });

    const components = await mcpAPIService.getComponents(this.authContext!.userToken);

    // Apply client-side filtering since the API doesn't support all these filters
    let filteredComponents = components;

    // Filter by active status
    if (active_only !== false) {
      filteredComponents = filteredComponents.filter(c => c.isActive === 'true' || c.isActive === true);
    }

    // Apply search filter
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredComponents = filteredComponents.filter(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        c.description.toLowerCase().includes(searchTerm) ||
        (c.tags && c.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm)))
      );
    }

    // Apply tag filter (must match all specified tags)
    if (tags && tags.length > 0) {
      filteredComponents = filteredComponents.filter(c =>
        c.tags && tags.every((tag: string) => c.tags.includes(tag))
      );
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              components: filteredComponents.map(c => ({
                id: c.id,
                name: c.name,
                description: c.description,
                tags: c.tags || [],
                isActive: c.isActive,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
              })),
              count: filteredComponents.length,
              total_count: components.length,
              filters_applied: {
                search: !!search,
                tags: tags?.length || 0,
                active_only: active_only !== false,
              },
            },
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get_component tool calls
   */
  private async handleGetComponent(args: any) {
    const { component_id } = args;

    logger.info('MCP get_component called', {
      userId: this.authContext!.userId,
      componentId: component_id,
    });

    const component = await mcpAPIService.getComponent(component_id, this.authContext!.userToken);

    if (!component) {
      throw new Error(`Component not found: ${component_id}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              id: component.id,
              name: component.name,
              description: component.description,
              tags: component.tags || [],
              isActive: component.isActive,
              createdAt: component.createdAt,
              updatedAt: component.updatedAt,
            },
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle create_component tool calls
   */
  private async handleCreateComponent(args: any) {
    const { name, description, tags } = args;

    const componentData: { name: string; description: string; tags?: string[] } = {
      name: name.trim(),
      description: description.trim(),
    };

    if (tags && tags.length > 0) {
      componentData.tags = tags.map((tag: string) => tag.trim()).filter(Boolean);
    }

    logger.info('MCP create_component called', {
      userId: this.authContext!.userId,
      componentName: name,
      tagCount: componentData.tags?.length || 0,
    });

    const component = await mcpAPIService.createComponent(componentData, this.authContext!.userToken);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              id: component.id,
              name: component.name,
              description: component.description,
              tags: component.tags || [],
              isActive: component.isActive,
              createdAt: component.createdAt,
              updatedAt: component.updatedAt,
            },
            message: `Component "${component.name}" created successfully`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle update_component tool calls
   */
  private async handleUpdateComponent(args: any) {
    const { component_id, name, description, tags, is_active } = args;

    const updates: { name?: string; description?: string; tags?: string[]; isActive?: boolean } = {};
    
    if (name) updates.name = name.trim();
    if (description) updates.description = description.trim();
    if (tags !== undefined) updates.tags = tags.map((tag: string) => tag.trim()).filter(Boolean);
    if (is_active !== undefined) updates.isActive = is_active;

    logger.info('MCP update_component called', {
      userId: this.authContext!.userId,
      componentId: component_id,
      updates: Object.keys(updates),
    });

    const component = await mcpAPIService.updateComponent(component_id, updates, this.authContext!.userToken);

    if (!component) {
      throw new Error(`Component not found: ${component_id}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              id: component.id,
              name: component.name,
              description: component.description,
              tags: component.tags || [],
              isActive: component.isActive,
              createdAt: component.createdAt,
              updatedAt: component.updatedAt,
            },
            message: `Component "${component.name}" updated successfully`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle delete_component tool calls
   */
  private async handleDeleteComponent(args: any) {
    const { component_id } = args;

    logger.info('MCP delete_component called', {
      userId: this.authContext!.userId,
      componentId: component_id,
    });

    // Get component details before deleting for response message
    const component = await mcpAPIService.getComponent(component_id, this.authContext!.userToken);
    if (!component) {
      throw new Error(`Component not found: ${component_id}`);
    }

    const deleted = await mcpAPIService.deleteComponent(component_id, this.authContext!.userToken);
    if (!deleted) {
      throw new Error(`Failed to delete component: ${component_id}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: { id: component_id, name: component.name },
            message: `Component "${component.name}" deleted successfully`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle search_components tool calls
   */
  private async handleSearchComponents(args: any) {
    const { query, tags, exclude_tags, limit } = args;

    logger.info('MCP search_components called', {
      userId: this.authContext!.userId,
      query: query ? query.substring(0, 50) + '...' : null,
      tagCount: tags?.length || 0,
      excludeTagCount: exclude_tags?.length || 0,
      limit: limit || 20,
    });

    const components = await mcpAPIService.getComponents(this.authContext!.userToken);

    // Apply search and filtering logic
    let filteredComponents = components.filter(c => c.isActive === 'true' || c.isActive === true);

    // Apply query search
    if (query) {
      const searchTerm = query.toLowerCase();
      filteredComponents = filteredComponents.filter(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        c.description.toLowerCase().includes(searchTerm) ||
        (c.tags && c.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm)))
      );
    }

    // Apply tag filter (must match all specified tags)
    if (tags && tags.length > 0) {
      filteredComponents = filteredComponents.filter(c =>
        c.tags && tags.every((tag: string) => c.tags.includes(tag))
      );
    }

    // Apply exclude tags filter
    if (exclude_tags && exclude_tags.length > 0) {
      filteredComponents = filteredComponents.filter(c =>
        !c.tags || !exclude_tags.some((tag: string) => c.tags.includes(tag))
      );
    }

    // Apply limit
    const resultLimit = limit || 20;
    filteredComponents = filteredComponents.slice(0, resultLimit);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              components: filteredComponents.map(c => ({
                id: c.id,
                name: c.name,
                description: c.description,
                tags: c.tags || [],
                isActive: c.isActive,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
              })),
              count: filteredComponents.length,
              search_params: {
                query,
                required_tags: tags || [],
                excluded_tags: exclude_tags || [],
                limit: resultLimit,
              },
            },
            message: `Found ${filteredComponents.length} component(s) matching search criteria`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle generate_mvp_plan_with_components tool calls
   */
  private async handleGenerateMVPPlanWithComponents(args: any) {
    const { project_idea, component_ids } = args;

    logger.info('MCP generate_mvp_plan_with_components called', {
      userId: this.authContext!.userId,
      projectIdea: project_idea.substring(0, 50) + '...',
      componentCount: component_ids.length,
    });

    // First, fetch the selected components
    const selectedComponents = [];
    for (const componentId of component_ids) {
      try {
        const component = await mcpAPIService.getComponent(componentId, this.authContext!.userToken);
        if (component) {
          selectedComponents.push(component);
        } else {
          logger.warn('Component not found during MVP generation', {
            userId: this.authContext!.userId,
            componentId,
          });
        }
      } catch (error) {
        logger.warn('Error fetching component during MVP generation', {
          userId: this.authContext!.userId,
          componentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (selectedComponents.length === 0) {
      throw new Error('No valid components found for the provided IDs');
    }

    const mvpPlan = await mcpAPIService.generateMVPPlanWithComponents(
      project_idea, 
      selectedComponents, 
      this.authContext!.userToken
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              mvp_plan: mvpPlan,
              selected_components: selectedComponents.map(c => ({
                id: c.id,
                name: c.name,
                description: c.description,
                tags: c.tags || [],
              })),
            },
            message: `Generated MVP plan for "${mvpPlan.projectName}" using ${selectedComponents.length} component(s) with ${mvpPlan.tasks.length} tasks`,
            user: {
              id: this.authContext!.userId,
              email: this.authContext!.email,
              name: this.authContext!.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle create_project tool calls
   */
  private async handleCreateProject(args: any) {
    if (!this.authContext) {
      throw new Error('No authentication context available');
    }

    // Validate required fields
    if (!args.name || typeof args.name !== 'string' || args.name.trim().length === 0) {
      throw new Error('Project name is required and must be a non-empty string');
    }

    // Validate name length
    if (args.name.length > 100) {
      throw new Error('Project name must not exceed 100 characters');
    }

    // Prepare project data
    const projectData: { name: string; description?: string; status?: string } = {
      name: args.name.trim()
    };

    if (args.description && typeof args.description === 'string') {
      projectData.description = args.description.trim();
    }

    if (args.status && ['active', 'backlog', 'completed', 'archived'].includes(args.status)) {
      projectData.status = args.status;
    }

    logger.info('Creating project via MCP', {
      userId: this.authContext.userId,
      projectName: projectData.name,
      hasDescription: !!projectData.description,
      status: projectData.status || 'active'
    });

    // Create project using the API service
    const project = await mcpAPIService.createProject(projectData, this.authContext.userToken);

    logger.info('Project created successfully via MCP', {
      userId: this.authContext.userId,
      projectId: project.id,
      projectName: project.name
    });

    // Transform for MCP response
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            data: {
              project: {
                id: project.id,
                name: project.name,
                description: project.description,
                status: project.status,
                created_at: project.createdAt,
                updated_at: project.updatedAt,
                task_count: project.tasks?.length || 0
              }
            },
            message: `Project "${project.name}" created successfully with ID: ${project.id}`,
            user: {
              id: this.authContext.userId,
              email: this.authContext.email,
              name: this.authContext.name,
            },
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Public method to handle create_project tool calls
   */
  async handleCreateProjectPublic(args: any) {
    return await this.handleCreateProject(args);
  }

  /**
   * Validate if project slug is correctly formatted
   */
  private validateProjectSlug(slug: string): boolean {
    // Project slug validation: alphanumeric and hyphens, max 20 chars
    const slugRegex = /^[a-z0-9-]+$/;
    return slug.length <= 20 && slugRegex.test(slug);
  }
}
