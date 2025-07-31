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
    this.server = new McpServer(MCP_SERVER_INFO, {
      capabilities: MCP_DETAILED_CAPABILITIES,
    });

    this.authService = new AuthService();
    this.setupTools();
    this.setupErrorHandling();
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
    // Generate a main app compatible JWT token for API calls
    const userToken = this.authService.generateMainAppToken(
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
   * Validate if project slug is correctly formatted
   */
  private validateProjectSlug(slug: string): boolean {
    // Project slug validation: alphanumeric and hyphens, max 20 chars
    const slugRegex = /^[a-z0-9-]+$/;
    return slug.length <= 20 && slugRegex.test(slug);
  }
}
