import { db } from './connection.js';
import { projects, tasks, comments, users } from './schema.js';
import { eq, sql, and } from 'drizzle-orm';
import type { Project, Task, Comment, User, CreateProjectInput, CreateTaskInput, CreateCommentInput, TaskStatus, ProjectStatus, Priority } from '../../src/types/types.js';

class DatabaseService {
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
    const [project] = await db.insert(projects)
      .values({
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
    const result = await db.delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Tasks
  async createTask(input: CreateTaskInput, userId: string): Promise<Task | null> {
    // Check if project exists and belongs to user
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, input.projectId), eq(projects.userId, userId)),
    });
    
    if (!project) return null;

    const [task] = await db.insert(tasks)
      .values({
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
}

export const databaseService = new DatabaseService();