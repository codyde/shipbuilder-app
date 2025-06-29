import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Application } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Project Management API',
      version: '1.0.0',
      description: 'A comprehensive project management API with AI-powered chat interface',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001/api',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for web application authentication'
        },
        ApiKeyAuth: {
          type: 'http', 
          scheme: 'bearer',
          bearerFormat: 'API Key',
          description: 'API key for direct API access (format: sb_<64_hex_characters>)'
        }
      },
      schemas: {
        Project: {
          type: 'object',
          required: ['id', 'name', 'status', 'tasks', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique project identifier'
            },
            name: {
              type: 'string',
              description: 'Project name'
            },
            description: {
              type: 'string',
              description: 'Project description'
            },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'archived'],
              description: 'Project status'
            },
            tasks: {
              type: 'array',
              items: { $ref: '#/components/schemas/Task' },
              description: 'Array of tasks in this project'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Project creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Project last update timestamp'
            }
          }
        },
        Task: {
          type: 'object',
          required: ['id', 'projectId', 'title', 'status', 'priority', 'subtasks', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique task identifier'
            },
            projectId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the project this task belongs to'
            },
            title: {
              type: 'string',
              description: 'Task title'
            },
            description: {
              type: 'string',
              description: 'Task description'
            },
            status: {
              type: 'string',
              enum: ['todo', 'in_progress', 'completed'],
              description: 'Task status'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Task priority'
            },
            dueDate: {
              type: 'string',
              format: 'date-time',
              description: 'Task due date'
            },
            subtasks: {
              type: 'array',
              items: { $ref: '#/components/schemas/Subtask' },
              description: 'Array of subtasks'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Task creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Task last update timestamp'
            }
          }
        },
        Subtask: {
          type: 'object',
          required: ['id', 'taskId', 'title', 'status', 'priority', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique subtask identifier'
            },
            taskId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the task this subtask belongs to'
            },
            title: {
              type: 'string',
              description: 'Subtask title'
            },
            description: {
              type: 'string',
              description: 'Subtask description'
            },
            status: {
              type: 'string',
              enum: ['todo', 'in_progress', 'completed'],
              description: 'Subtask status'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Subtask priority'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Subtask creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Subtask last update timestamp'
            }
          }
        },
        CreateProjectInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              description: 'Project name'
            },
            description: {
              type: 'string',
              description: 'Project description'
            }
          }
        },
        CreateTaskInput: {
          type: 'object',
          required: ['title'],
          properties: {
            title: {
              type: 'string',
              description: 'Task title'
            },
            description: {
              type: 'string',
              description: 'Task description'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Task priority',
              default: 'medium'
            },
            dueDate: {
              type: 'string',
              format: 'date-time',
              description: 'Task due date'
            }
          }
        },
        CreateSubtaskInput: {
          type: 'object',
          required: ['title'],
          properties: {
            title: {
              type: 'string',
              description: 'Subtask title'
            },
            description: {
              type: 'string',
              description: 'Subtask description'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Subtask priority',
              default: 'medium'
            }
          }
        },
        ChatMessage: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role: {
              type: 'string',
              enum: ['user', 'assistant'],
              description: 'Message role'
            },
            content: {
              type: 'string',
              description: 'Message content'
            }
          }
        },
        ChatRequest: {
          type: 'object',
          required: ['messages'],
          properties: {
            messages: {
              type: 'array',
              items: { $ref: '#/components/schemas/ChatMessage' },
              description: 'Array of chat messages'
            }
          }
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        },
        HealthResponse: {
          type: 'object',
          required: ['status', 'timestamp'],
          properties: {
            status: {
              type: 'string',
              description: 'Health status'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Current timestamp'
            }
          }
        },
        ApiKey: {
          type: 'object',
          required: ['id', 'name', 'prefix', 'displayKey', 'createdAt', 'isActive'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique API key identifier'
            },
            name: {
              type: 'string',
              description: 'Descriptive name for the API key'
            },
            prefix: {
              type: 'string',
              description: 'API key prefix (e.g., "sb_")'
            },
            displayKey: {
              type: 'string',
              description: 'Partially masked key for display (e.g., "sb_1234****...****")'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'API key creation timestamp'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'API key expiration timestamp (null if no expiration)'
            },
            lastUsedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Last usage timestamp (null if never used)'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the API key is active'
            }
          }
        },
        CreateApiKeyInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              maxLength: 100,
              description: 'Descriptive name for the API key'
            },
            expiresInDays: {
              type: 'integer',
              minimum: 1,
              maximum: 365,
              description: 'Number of days until key expires (optional)'
            }
          }
        },
        CreateApiKeyResponse: {
          type: 'object',
          required: ['id', 'name', 'key', 'prefix', 'displayKey', 'createdAt', 'message'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique API key identifier'
            },
            name: {
              type: 'string',
              description: 'Descriptive name for the API key'
            },
            key: {
              type: 'string',
              description: 'Full API key - ONLY shown once during creation'
            },
            prefix: {
              type: 'string',
              description: 'API key prefix'
            },
            displayKey: {
              type: 'string',
              description: 'Partially masked key for display'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'API key creation timestamp'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'API key expiration timestamp'
            },
            message: {
              type: 'string',
              description: 'Important notice about key security'
            }
          }
        },
        ApiKeyListResponse: {
          type: 'object',
          required: ['apiKeys'],
          properties: {
            apiKeys: {
              type: 'array',
              items: { $ref: '#/components/schemas/ApiKey' },
              description: 'Array of user API keys'
            }
          }
        }
      }
    },
    security: [
      { BearerAuth: [] },
      { ApiKeyAuth: [] }
    ],
    paths: {
      '/projects': {
        get: {
          summary: 'Get all projects',
          description: 'Retrieve a list of all projects with their tasks and subtasks',
          tags: ['Projects'],
          security: [
            { BearerAuth: [] },
            { ApiKeyAuth: [] }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Project' }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create a new project',
          description: 'Create a new project with the provided details',
          tags: ['Projects'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateProjectInput' }
              }
            }
          },
          responses: {
            '201': {
              description: 'Project created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Project' }
                }
              }
            },
            '400': {
              description: 'Bad request - missing required fields',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/projects/{id}': {
        get: {
          summary: 'Get project by ID',
          description: 'Retrieve a specific project by its ID',
          tags: ['Projects'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Project ID'
            }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Project' }
                }
              }
            },
            '404': {
              description: 'Project not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        },
        put: {
          summary: 'Update project',
          description: 'Update an existing project',
          tags: ['Projects'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Project ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    status: {
                      type: 'string',
                      enum: ['active', 'completed', 'archived']
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Project updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Project' }
                }
              }
            },
            '404': {
              description: 'Project not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        },
        delete: {
          summary: 'Delete project',
          description: 'Delete a project and all its tasks and subtasks',
          tags: ['Projects'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Project ID'
            }
          ],
          responses: {
            '204': {
              description: 'Project deleted successfully'
            },
            '404': {
              description: 'Project not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/projects/{projectId}/tasks': {
        post: {
          summary: 'Create a new task',
          description: 'Create a new task within a project',
          tags: ['Tasks'],
          parameters: [
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Project ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateTaskInput' }
              }
            }
          },
          responses: {
            '201': {
              description: 'Task created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Task' }
                }
              }
            },
            '400': {
              description: 'Bad request - missing required fields',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '404': {
              description: 'Project not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/projects/{projectId}/tasks/{taskId}': {
        get: {
          summary: 'Get task by ID',
          description: 'Retrieve a specific task by its ID',
          tags: ['Tasks'],
          parameters: [
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Project ID'
            },
            {
              name: 'taskId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Task ID'
            }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Task' }
                }
              }
            },
            '404': {
              description: 'Task not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        },
        put: {
          summary: 'Update task',
          description: 'Update an existing task',
          tags: ['Tasks'],
          parameters: [
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Project ID'
            },
            {
              name: 'taskId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Task ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    status: {
                      type: 'string',
                      enum: ['todo', 'in_progress', 'completed']
                    },
                    priority: {
                      type: 'string',
                      enum: ['low', 'medium', 'high']
                    },
                    dueDate: {
                      type: 'string',
                      format: 'date-time'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Task updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Task' }
                }
              }
            },
            '404': {
              description: 'Task not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        },
        delete: {
          summary: 'Delete task',
          description: 'Delete a task and all its subtasks',
          tags: ['Tasks'],
          parameters: [
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Project ID'
            },
            {
              name: 'taskId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Task ID'
            }
          ],
          responses: {
            '204': {
              description: 'Task deleted successfully'
            },
            '404': {
              description: 'Task not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/projects/{projectId}/tasks/{taskId}/subtasks': {
        post: {
          summary: 'Create a new subtask',
          description: 'Create a new subtask within a task',
          tags: ['Subtasks'],
          parameters: [
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Project ID'
            },
            {
              name: 'taskId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Task ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateSubtaskInput' }
              }
            }
          },
          responses: {
            '201': {
              description: 'Subtask created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Subtask' }
                }
              }
            },
            '400': {
              description: 'Bad request - missing required fields',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '404': {
              description: 'Task not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/projects/tasks/{taskId}/subtasks/{subtaskId}': {
        put: {
          summary: 'Update subtask',
          description: 'Update an existing subtask',
          tags: ['Subtasks'],
          parameters: [
            {
              name: 'taskId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Task ID'
            },
            {
              name: 'subtaskId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Subtask ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    status: {
                      type: 'string',
                      enum: ['todo', 'in_progress', 'completed']
                    },
                    priority: {
                      type: 'string',
                      enum: ['low', 'medium', 'high']
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Subtask updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Subtask' }
                }
              }
            },
            '404': {
              description: 'Subtask not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        },
        delete: {
          summary: 'Delete subtask',
          description: 'Delete a subtask',
          tags: ['Subtasks'],
          parameters: [
            {
              name: 'taskId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Task ID'
            },
            {
              name: 'subtaskId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'Subtask ID'
            }
          ],
          responses: {
            '204': {
              description: 'Subtask deleted successfully'
            },
            '404': {
              description: 'Subtask not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/chat/stream': {
        post: {
          summary: 'AI Chat Interface',
          description: 'Interact with the AI assistant for project management using natural language. The AI can create, update, and manage projects, tasks, and subtasks.',
          tags: ['AI Chat'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Streaming response with AI-generated content and tool executions',
              content: {
                'text/plain': {
                  schema: {
                    type: 'string',
                    description: 'Server-sent events stream with AI responses'
                  }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/health': {
        get: {
          summary: 'Health check',
          description: 'Check the health status of the API',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'API is healthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' }
                }
              }
            }
          }
        }
      },
      '/api-keys/create': {
        post: {
          summary: 'Create API key',
          description: 'Create a new API key for programmatic access. Requires JWT authentication from web application.',
          tags: ['API Keys'],
          security: [
            { BearerAuth: [] }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateApiKeyInput' }
              }
            }
          },
          responses: {
            '200': {
              description: 'API key created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreateApiKeyResponse' }
                }
              }
            },
            '400': {
              description: 'Bad request - invalid input or too many keys',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '401': {
              description: 'Unauthorized - JWT token required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '429': {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/api-keys/list': {
        get: {
          summary: 'List API keys',
          description: 'Get a list of all API keys for the authenticated user. Requires JWT authentication.',
          tags: ['API Keys'],
          security: [
            { BearerAuth: [] }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiKeyListResponse' }
                }
              }
            },
            '401': {
              description: 'Unauthorized - JWT token required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/api-keys/{keyId}': {
        get: {
          summary: 'Get API key details',
          description: 'Get details for a specific API key. Requires JWT authentication.',
          tags: ['API Keys'],
          security: [
            { BearerAuth: [] }
          ],
          parameters: [
            {
              name: 'keyId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'API key ID'
            }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiKey' }
                }
              }
            },
            '401': {
              description: 'Unauthorized - JWT token required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '404': {
              description: 'API key not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        },
        delete: {
          summary: 'Delete API key',
          description: 'Delete an API key. This action cannot be undone. Requires JWT authentication.',
          tags: ['API Keys'],
          security: [
            { BearerAuth: [] }
          ],
          parameters: [
            {
              name: 'keyId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid'
              },
              description: 'API key ID'
            }
          ],
          responses: {
            '200': {
              description: 'API key deleted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: {
                        type: 'string',
                        example: 'API key deleted successfully'
                      }
                    }
                  }
                }
              }
            },
            '401': {
              description: 'Unauthorized - JWT token required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '404': {
              description: 'API key not found or not owned by user',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: [] // We're defining everything inline above
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Application) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Project Management API Documentation'
  }));
}

export { specs };