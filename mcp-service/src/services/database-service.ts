import type { User, Project, Task } from '../types/api.js';
import { logger } from '../utils/logger.js';

class MCPAPIService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  }
  /**
   * Get all projects for a user with their tasks
   */
  async getProjects(userId: string, userToken: string): Promise<Project[]> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const projects = await response.json() as Project[];
      return projects;
    } catch (error) {
      logger.error('Failed to get projects from API', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      throw new Error('Failed to retrieve projects');
    }
  }

  /**
   * Get a specific project with tasks
   */
  async getProject(projectId: string, userToken: string): Promise<Project | null> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const project = await response.json() as Project;
      return project;
    } catch (error) {
      logger.error('Failed to get project from API', {
        error: error instanceof Error ? error.message : String(error),
        projectId
      });
      throw new Error('Failed to retrieve project');
    }
  }


  /**
   * Create a new project
   */
  async createProject(projectData: { name: string; description?: string; status?: string }, userToken: string): Promise<Project> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const project = await response.json() as Project;
      return project;
    } catch (error) {
      logger.error('Failed to create project via API', {
        error: error instanceof Error ? error.message : String(error),
        projectData
      });
      throw new Error('Failed to create project');
    }
  }

  /**
   * Update a project
   */
  async updateProject(projectId: string, updates: { name?: string; description?: string; status?: string }, userToken: string): Promise<Project | null> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const project = await response.json() as Project;
      return project;
    } catch (error) {
      logger.error('Failed to update project via API', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        updates
      });
      throw new Error('Failed to update project');
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string, userToken: string): Promise<boolean> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        return false;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return true;
    } catch (error) {
      logger.error('Failed to delete project via API', {
        error: error instanceof Error ? error.message : String(error),
        projectId
      });
      throw new Error('Failed to delete project');
    }
  }

  /**
   * Create a new task
   */
  async createTask(projectId: string, taskData: { title: string; description?: string; priority?: string; status?: string }, userToken: string): Promise<Task | null> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });

      if (response.status === 404) {
        return null; // Project not found
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const task = await response.json() as Task;
      return task;
    } catch (error) {
      logger.error('Failed to create task via API', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        taskData
      });
      throw new Error('Failed to create task');
    }
  }

  /**
   * Get a specific task
   */
  async getTask(projectId: string, taskId: string, userToken: string): Promise<Task | null> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const task = await response.json() as Task;
      return task;
    } catch (error) {
      logger.error('Failed to get task from API', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        taskId
      });
      throw new Error('Failed to retrieve task');
    }
  }

  /**
   * Update a task
   */
  async updateTask(projectId: string, taskId: string, updates: { title?: string; description?: string; priority?: string; status?: string }, userToken: string): Promise<Task | null> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const task = await response.json() as Task;
      return task;
    } catch (error) {
      logger.error('Failed to update task via API', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        taskId,
        updates
      });
      throw new Error('Failed to update task');
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(projectId: string, taskId: string, userToken: string): Promise<boolean> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        return false;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return true;
    } catch (error) {
      logger.error('Failed to delete task via API', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        taskId
      });
      throw new Error('Failed to delete task');
    }
  }

  /**
   * Get task comments
   */
  async getTaskComments(projectId: string, taskId: string, userToken: string): Promise<any[]> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const comments = await response.json() as any[];
      return comments;
    } catch (error) {
      logger.error('Failed to get task comments from API', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        taskId
      });
      throw new Error('Failed to retrieve task comments');
    }
  }

  /**
   * Create a task comment
   */
  async createTaskComment(projectId: string, taskId: string, content: string, userToken: string): Promise<any | null> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (response.status === 404) {
        return null; // Task not found
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const comment = await response.json();
      return comment;
    } catch (error) {
      logger.error('Failed to create task comment via API', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        taskId,
        content
      });
      throw new Error('Failed to create task comment');
    }
  }

  /**
   * Generate MVP plan using AI
   */
  async generateMVPPlan(projectIdea: string, userToken: string): Promise<any> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/ai/generatemvp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ projectIdea })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // This endpoint streams text, so we need to read the full response
      const responseText = await response.text();
      
      // Try to parse as JSON (the AI should return JSON)
      try {
        const mvpPlan = JSON.parse(responseText);
        return mvpPlan;
      } catch (parseError) {
        // If it's not valid JSON, return the raw text
        logger.warn('MVP plan response was not valid JSON', {
          responseText: responseText.substring(0, 200) + '...'
        });
        throw new Error('Failed to parse MVP plan response');
      }
    } catch (error) {
      logger.error('Failed to generate MVP plan via API', {
        error: error instanceof Error ? error.message : String(error),
        projectIdea
      });
      throw new Error('Failed to generate MVP plan');
    }
  }

  /**
   * Create MVP project with all tasks using streaming AI endpoint
   */
  async createMVPProject(mvpPlan: any, userToken: string): Promise<string> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/ai/create-mvp-project`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mvpPlan })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // This endpoint streams status updates, so we read the full response
      const responseText = await response.text();
      return responseText;
    } catch (error) {
      logger.error('Failed to create MVP project via API', {
        error: error instanceof Error ? error.message : String(error),
        mvpPlan: mvpPlan?.projectName
      });
      throw new Error('Failed to create MVP project');
    }
  }

  /**
   * Generate task implementation details using AI
   */
  async generateTaskDetails(prompt: string, context: any, userToken: string): Promise<string> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/ai/generate-details`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, context })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // This endpoint streams text
      const responseText = await response.text();
      return responseText;
    } catch (error) {
      logger.error('Failed to generate task details via API', {
        error: error instanceof Error ? error.message : String(error),
        prompt,
        context
      });
      throw new Error('Failed to generate task details');
    }
  }

  /**
   * Get all user components
   */
  async getComponents(userToken: string): Promise<any[]> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/components`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as { components?: any[] };
      return result.components || [];
    } catch (error) {
      logger.error('Failed to get components from API', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Failed to retrieve components');
    }
  }

  /**
   * Get a specific component by ID
   */
  async getComponent(componentId: string, userToken: string): Promise<any | null> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/components/${componentId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as { component?: any };
      return result.component;
    } catch (error) {
      logger.error('Failed to get component from API', {
        error: error instanceof Error ? error.message : String(error),
        componentId
      });
      throw new Error('Failed to retrieve component');
    }
  }

  /**
   * Create a new component
   */
  async createComponent(componentData: { name: string; description: string; tags?: string[] }, userToken: string): Promise<any> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/components`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(componentData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as { component?: any };
      return result.component;
    } catch (error) {
      logger.error('Failed to create component via API', {
        error: error instanceof Error ? error.message : String(error),
        componentData
      });
      throw new Error('Failed to create component');
    }
  }

  /**
   * Update a component
   */
  async updateComponent(componentId: string, updates: { name?: string; description?: string; tags?: string[]; isActive?: boolean }, userToken: string): Promise<any | null> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/components/${componentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as { component?: any };
      return result.component;
    } catch (error) {
      logger.error('Failed to update component via API', {
        error: error instanceof Error ? error.message : String(error),
        componentId,
        updates
      });
      throw new Error('Failed to update component');
    }
  }

  /**
   * Delete a component
   */
  async deleteComponent(componentId: string, userToken: string): Promise<boolean> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/components/${componentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        return false;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return true;
    } catch (error) {
      logger.error('Failed to delete component via API', {
        error: error instanceof Error ? error.message : String(error),
        componentId
      });
      throw new Error('Failed to delete component');
    }
  }

  /**
   * Generate MVP plan with selected components using AI
   */
  async generateMVPPlanWithComponents(projectIdea: string, selectedComponents: any[], userToken: string): Promise<any> {
    try {
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const response = await fetch(`${baseUrl}/api/ai/generatemvp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          projectIdea,
          selectedComponents: selectedComponents.map(c => ({
            name: c.name,
            description: c.description,
            tags: c.tags
          }))
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // This endpoint streams text, so we need to read the full response
      const responseText = await response.text();
      
      // Try to parse as JSON (the AI should return JSON)
      try {
        const mvpPlan = JSON.parse(responseText);
        return mvpPlan;
      } catch (parseError) {
        // If it's not valid JSON, return the raw text
        logger.warn('MVP plan response was not valid JSON', {
          responseText: responseText.substring(0, 200) + '...'
        });
        throw new Error('Failed to parse MVP plan response');
      }
    } catch (error) {
      logger.error('Failed to generate MVP plan with components via API', {
        error: error instanceof Error ? error.message : String(error),
        projectIdea,
        componentCount: selectedComponents.length
      });
      throw new Error('Failed to generate MVP plan with components');
    }
  }

  /**
   * Validate if project slug is correctly formatted
   */
  validateProjectSlug(slug: string): boolean {
    // Project slug validation: alphanumeric and hyphens, max 20 chars
    const slugRegex = /^[a-z0-9-]+$/;
    return slug.length <= 20 && slugRegex.test(slug);
  }

  /**
   * Validate if task slug is correctly formatted
   */
  validateTaskSlug(slug: string): boolean {
    // Task slug validation: project-slug-number pattern, max 20 chars
    const taskSlugRegex = /^[a-z0-9-]+-\d+$/;
    return slug.length <= 20 && taskSlugRegex.test(slug);
  }
}

export const mcpAPIService = new MCPAPIService();