/**
 * MCP Tool Definitions and Schemas
 * 
 * This file contains all tool definitions for the Shipbuilder MCP server.
 * Each tool includes both basic metadata and detailed JSON schemas.
 */

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolBasicInfo {
  name: string;
  description: string;
}

/**
 * Detailed tool definitions with full JSON schemas
 */
export const MCP_TOOLS: MCPToolDefinition[] = [
  // Core query tools
  {
    name: 'query_projects',
    description: 'Get all projects for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'backlog', 'completed', 'archived'],
          description: 'Filter projects by status'
        },
        include_tasks: {
          type: 'boolean',
          default: true,
          description: 'Whether to include tasks in the response'
        }
      }
    }
  },
  {
    name: 'query_tasks',
    description: 'Get tasks for a specific project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project slug (e.g., "photoshare")'
        },
        status: {
          type: 'string',
          enum: ['backlog', 'in_progress', 'completed'],
          description: 'Filter tasks by status'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Filter tasks by priority'
        }
      },
      required: ['project_id']
    }
  },

  // Essential project management
  {
    name: 'create_project',
    description: 'Create a new project for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the project',
          minLength: 1,
          maxLength: 100
        },
        description: {
          type: 'string',
          description: 'Optional description of the project'
        },
        status: {
          type: 'string',
          enum: ['active', 'backlog', 'completed', 'archived'],
          default: 'active',
          description: 'Initial status of the project'
        }
      },
      required: ['name']
    }
  },

  // Essential task management
  {
    name: 'create_task',
    description: 'Create a new task within a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project slug (e.g., "photoshare")'
        },
        title: {
          type: 'string',
          description: 'The title of the task',
          minLength: 1
        },
        description: {
          type: 'string',
          description: 'Optional description of the task'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          default: 'medium',
          description: 'Priority level of the task'
        },
        status: {
          type: 'string',
          enum: ['backlog', 'in_progress', 'completed'],
          default: 'backlog',
          description: 'Initial status of the task'
        }
      },
      required: ['project_id', 'title']
    }
  },
  {
    name: 'update_task_status',
    description: 'Update the status of a task',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project slug (e.g., "photoshare")'
        },
        task_id: {
          type: 'string',
          description: 'Task slug (e.g., "photoshare-1")'
        },
        status: {
          type: 'string',
          enum: ['backlog', 'in_progress', 'completed'],
          description: 'New status for the task'
        }
      },
      required: ['project_id', 'task_id', 'status']
    }
  },
  {
    name: 'delete_task',
    description: 'Delete a task from a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project slug (e.g., "photoshare")'
        },
        task_id: {
          type: 'string',
          description: 'Task slug (e.g., "photoshare-1")'
        }
      },
      required: ['project_id', 'task_id']
    }
  },
  {
    name: 'delete_project',
    description: 'Delete a project and all its tasks',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project slug (e.g., "photoshare")'
        }
      },
      required: ['project_id']
    }
  },
  {
    name: 'generate_task_details',
    description: 'Generate detailed implementation guidance for a task using AI',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project slug (e.g., "photoshare")'
        },
        task_id: {
          type: 'string',
          description: 'Task slug (e.g., "photoshare-1")'
        },
        prompt: {
          type: 'string',
          description: 'Additional context or specific guidance request',
          minLength: 1
        }
      },
      required: ['project_id', 'task_id', 'prompt']
    }
  },

  // Core AI tools
  {
    name: 'create_mvp_project',
    description: 'Create a complete MVP project with all tasks from an AI-generated plan',
    inputSchema: {
      type: 'object',
      properties: {
        mvp_plan: {
          type: 'object',
          description: 'The MVP plan object from generate_mvp_plan',
          properties: {
            projectName: { type: 'string' },
            description: { type: 'string' },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high'] }
                }
              }
            }
          },
          required: ['projectName', 'description', 'tasks']
        }
      },
      required: ['mvp_plan']
    }
  }
];

/**
 * Basic tool info for server metadata (subset of full definitions)
 */
export const MCP_TOOLS_BASIC: MCPToolBasicInfo[] = MCP_TOOLS.map(tool => ({
  name: tool.name,
  description: tool.description
}));

/**
 * Get tool definition by name
 */
export function getToolDefinition(name: string): MCPToolDefinition | undefined {
  return MCP_TOOLS.find(tool => tool.name === name);
}

/**
 * Get all available tool names
 */
export function getToolNames(): string[] {
  return MCP_TOOLS.map(tool => tool.name);
}

/**
 * Validate if a tool name is supported
 */
export function isValidToolName(name: string): boolean {
  return MCP_TOOLS.some(tool => tool.name === name);
}