import { db } from './connection.js';
import { projects, tasks, comments, users, apiKeys } from './schema.js';
import { eq, sql, and } from 'drizzle-orm';
import { logger } from '../lib/logger.js';
import { generateUniqueProjectSlug, generateUniqueTaskSlug, getProjectIdFromTaskSlug } from '../utils/slug-utils.js';
import type { Project, Task, Comment, User, CreateProjectInput, CreateTaskInput, CreateCommentInput, TaskStatus, ProjectStatus, Priority } from '../../src/types/types.js';

class DatabaseService {
  // Helper methods for slug generation
  private async checkProjectSlugExists(userId: string, slug: string): Promise<boolean> {
    const existing = await db.query.projects.findFirst({
      where: and(eq(projects.userId, userId), eq(projects.id, slug)),
    });
    return !!existing;
  }

  private async checkTaskSlugExists(taskSlug: string): Promise<boolean> {
    const existing = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskSlug),
    });
    return !!existing;
  }

  // Users
  async createUser(email: string, name: string, provider?: string, providerId?: string, avatar?: string): Promise<User> {
    const [user] = await db.insert(users)
      .values({
        email,
        name,
        provider,
        providerId,
        avatar,
      })
      .returning();

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) return undefined;

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async getUserById(id: string): Promise<User | undefined> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) return undefined;

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async updateUser(id: string, updates: Partial<Pick<User, 'name' | 'provider' | 'providerId' | 'avatar'>>): Promise<User | null> {
    const [updated] = await db.update(users)
      .set({
        ...updates,
        updatedAt: sql`NOW()`,
      })
      .where(eq(users.id, id))
      .returning();

    if (!updated) return null;

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // Projects
  async createProject(input: CreateProjectInput, userId: string): Promise<Project> {
    // Generate unique slug for the project
    const projectSlug = await generateUniqueProjectSlug(
      input.name,
      userId,
      this.checkProjectSlugExists.bind(this)
    );

    const [project] = await db.insert(projects)
      .values({
        id: projectSlug,
        userId,
        name: input.name,
        description: input.description,
      })
      .returning();

    return {
      ...project,
      status: project.status as ProjectStatus,
      tasks: [],
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async getProjects(userId: string): Promise<Project[]> {
    const projectsWithTasks = await db.query.projects.findMany({
      where: eq(projects.userId, userId),
      with: {
        tasks: {
          with: {
            comments: true,
          },
        },
      },
    });

    return projectsWithTasks.map(p => ({
      ...p,
      status: p.status as ProjectStatus,
      tasks: p.tasks.map(t => ({
        ...t,
        status: t.status as TaskStatus,
        priority: t.priority as Priority,
        dueDate: t.dueDate?.toISOString(),
        comments: t.comments?.map(c => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })) || [],
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async getProject(id: string, userId: string): Promise<Project | undefined> {
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, userId)),
      with: {
        tasks: {
          with: {
            comments: true,
          },
        },
      },
    });

    if (!project) return undefined;

    return {
      ...project,
      status: project.status as ProjectStatus,
      tasks: project.tasks.map(t => ({
        ...t,
        status: t.status as TaskStatus,
        priority: t.priority as Priority,
        dueDate: t.dueDate?.toISOString(),
        comments: t.comments?.map(c => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })) || [],
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async updateProject(id: string, userId: string, updates: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>): Promise<Project | null> {
    const [updated] = await db.update(projects)
      .set({
        ...updates,
        updatedAt: sql`NOW()`,
      })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();

    if (!updated) return null;

    return this.getProject(id, userId) as Promise<Project>;
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    const startTime = Date.now();
    
    logger.debug('Starting project deletion', {
      projectId: id,
      userId,
      service: 'DatabaseService'
    });
    
    try {
      // Check if the project exists and belongs to the user
      const projectToDelete = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
        with: {
          tasks: true
        }
      });
      
      if (!projectToDelete) {
        logger.warn('Project not found or not owned by user', {
          projectId: id,
          userId,
          service: 'DatabaseService'
        });
        return false;
      }
      
      logger.info('Found project to delete', {
        projectId: id,
        projectName: projectToDelete.name,
        tasksCount: projectToDelete.tasks.length,
        userId,
        service: 'DatabaseService'
      });
      
      // Delete the project - let database cascades handle tasks and comments
      logger.debug('Executing project deletion with cascade', {
        projectId: id,
        userId,
        service: 'DatabaseService'
      });
      
      const result = await db.delete(projects)
        .where(and(eq(projects.id, id), eq(projects.userId, userId)));
      
      const success = result.rowCount ? result.rowCount > 0 : false;
      const duration = Date.now() - startTime;
      
      if (success) {
        logger.info('Project deleted successfully', {
          projectId: id,
          projectName: projectToDelete.name,
          userId,
          duration,
          rowCount: result.rowCount,
          service: 'DatabaseService',
          important: true
        });
      } else {
        logger.error('Project deletion failed - no rows affected', {
          projectId: id,
          userId,
          duration,
          rowCount: result.rowCount,
          service: 'DatabaseService'
        });
      }
      
      return success;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Project deletion failed with exception', {
        projectId: id,
        userId,
        duration,
        service: 'DatabaseService',
        error: error instanceof Error ? error.message : String(error)
      }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Tasks
  async createTask(input: CreateTaskInput, userId: string): Promise<Task | null> {
    // Check if project exists and belongs to user
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, input.projectId), eq(projects.userId, userId)),
    });
    
    if (!project) return null;

    // Generate unique task slug
    const taskSlug = await generateUniqueTaskSlug(
      input.projectId,
      this.checkTaskSlugExists.bind(this)
    );

    const [task] = await db.insert(tasks)
      .values({
        id: taskSlug,
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        priority: input.priority || 'medium',
        status: input.status || 'backlog',
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      })
      .returning();

    // Update project's updatedAt
    await db.update(projects)
      .set({ updatedAt: sql`NOW()` })
      .where(eq(projects.id, input.projectId));

    return {
      ...task,
      status: task.status as TaskStatus,
      priority: task.priority as Priority,
      dueDate: task.dueDate?.toISOString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  async getTask(projectId: string, taskId: string, userId: string): Promise<Task | null> {
    // First verify project belongs to user
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    });
    
    if (!project) return null;

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        comments: true,
      },
    });

    if (!task || task.projectId !== projectId) return null;

    return {
      ...task,
      status: task.status as TaskStatus,
      priority: task.priority as Priority,
      dueDate: task.dueDate?.toISOString(),
      comments: task.comments?.map(c => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })) || [],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  // Convenience method to get task by slug only
  async getTaskBySlug(taskSlug: string, userId: string): Promise<Task | null> {
    const projectId = getProjectIdFromTaskSlug(taskSlug);
    return this.getTask(projectId, taskSlug, userId);
  }

  async updateTask(projectId: string, taskId: string, userId: string, updates: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>): Promise<Task | null> {
    // First verify project belongs to user
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    });
    
    if (!project) return null;

    // Check if task belongs to project
    const existingTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });
    
    if (!existingTask || existingTask.projectId !== projectId) return null;

    const [updated] = await db.update(tasks)
      .set({
        ...updates,
        dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined,
        updatedAt: sql`NOW()`,
      })
      .where(eq(tasks.id, taskId))
      .returning();

    if (!updated) return null;

    // Update project's updatedAt
    await db.update(projects)
      .set({ updatedAt: sql`NOW()` })
      .where(eq(projects.id, projectId));

    return this.getTask(projectId, taskId, userId);
  }

  async deleteTask(projectId: string, taskId: string, userId: string): Promise<boolean> {
    // First verify project belongs to user
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    });
    
    if (!project) return false;

    // Check if task belongs to project
    const existingTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });
    
    if (!existingTask || existingTask.projectId !== projectId) return false;

    const result = await db.delete(tasks)
      .where(eq(tasks.id, taskId));

    if (result.rowCount && result.rowCount > 0) {
      // Update project's updatedAt
      await db.update(projects)
        .set({ updatedAt: sql`NOW()` })
        .where(eq(projects.id, projectId));
      
      return true;
    }
    
    return false;
  }

  // Comments
  async getComments(taskId: string, userId: string): Promise<Comment[]> {
    // First verify that the task belongs to a project owned by the user
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        project: true,
      },
    });
    
    if (!task || task.project.userId !== userId) return [];

    const taskComments = await db.query.comments.findMany({
      where: eq(comments.taskId, taskId),
    });

    return taskComments.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  async createComment(input: CreateCommentInput, userId: string): Promise<Comment | null> {
    // Check if task exists and belongs to user's project
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, input.taskId),
      with: {
        project: true,
      },
    });
    
    if (!task || task.project.userId !== userId) return null;

    const [comment] = await db.insert(comments)
      .values({
        taskId: input.taskId,
        content: input.content,
        author: input.author,
      })
      .returning();

    // Update task and project updatedAt
    await db.update(tasks)
      .set({ updatedAt: sql`NOW()` })
      .where(eq(tasks.id, input.taskId));
    
    await db.update(projects)
      .set({ updatedAt: sql`NOW()` })
      .where(eq(projects.id, task.projectId));

    return {
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  // API Keys
  async createApiKey(userId: string, name: string, keyHash: string, prefix: string, expiresAt?: Date): Promise<{ id: string; name: string; prefix: string; createdAt: string; expiresAt: string | null; isActive: boolean }> {
    const [apiKey] = await db.insert(apiKeys)
      .values({
        userId,
        name,
        keyHash,
        prefix,
        expiresAt,
        isActive: 'true',
      })
      .returning();

    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      createdAt: apiKey.createdAt.toISOString(),
      expiresAt: apiKey.expiresAt?.toISOString() || null,
      isActive: apiKey.isActive === 'true',
    };
  }

  async getApiKeysByUserId(userId: string): Promise<{ id: string; name: string; prefix: string; createdAt: string; expiresAt: string | null; lastUsedAt: string | null; isActive: boolean }[]> {
    const userApiKeys = await db.query.apiKeys.findMany({
      where: and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, 'true')),
    });

    return userApiKeys.map(key => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      createdAt: key.createdAt.toISOString(),
      expiresAt: key.expiresAt?.toISOString() || null,
      lastUsedAt: key.lastUsedAt?.toISOString() || null,
      isActive: key.isActive === 'true',
    }));
  }

  async getApiKeyByHash(keyHash: string): Promise<{ id: string; userId: string; name: string; expiresAt: Date | null; isActive: boolean } | null> {
    const apiKey = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, 'true')),
    });

    if (!apiKey) return null;

    return {
      id: apiKey.id,
      userId: apiKey.userId,
      name: apiKey.name,
      expiresAt: apiKey.expiresAt,
      isActive: apiKey.isActive === 'true',
    };
  }

  async updateApiKeyLastUsed(keyId: string): Promise<void> {
    await db.update(apiKeys)
      .set({ lastUsedAt: sql`NOW()` })
      .where(eq(apiKeys.id, keyId));
  }

  async deleteApiKey(keyId: string, userId: string): Promise<boolean> {
    const result = await db.update(apiKeys)
      .set({ isActive: 'false' })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));

    return result.rowCount ? result.rowCount > 0 : false;
  }
}

export const databaseService = new DatabaseService();