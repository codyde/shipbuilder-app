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