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