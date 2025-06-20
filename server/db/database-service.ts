import { db } from './connection.js';
import { projects, tasks, subtasks } from './schema.js';
import { eq, sql } from 'drizzle-orm';
import type { Project, Task, Subtask, CreateProjectInput, CreateTaskInput, CreateSubtaskInput, TaskStatus, ProjectStatus, Priority } from '../../src/types/types.js';

class DatabaseService {
  // Projects
  async createProject(input: CreateProjectInput): Promise<Project> {
    const [project] = await db.insert(projects)
      .values({
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

  async getProjects(): Promise<Project[]> {
    const projectsWithTasks = await db.query.projects.findMany({
      with: {
        tasks: {
          with: {
            subtasks: true,
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
        subtasks: t.subtasks.map(s => ({
          ...s,
          status: s.status as TaskStatus,
          priority: s.priority as Priority,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        tasks: {
          with: {
            subtasks: true,
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
        subtasks: t.subtasks.map(s => ({
          ...s,
          status: s.status as TaskStatus,
          priority: s.priority as Priority,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<Project | null> {
    const [updated] = await db.update(projects)
      .set({
        ...updates,
        updatedAt: sql`NOW()`,
      })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) return null;

    return this.getProject(id) as Promise<Project>;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects)
      .where(eq(projects.id, id));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Tasks
  async createTask(input: CreateTaskInput): Promise<Task | null> {
    // Check if project exists
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });
    
    if (!project) return null;

    const [task] = await db.insert(tasks)
      .values({
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        priority: input.priority || 'medium',
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
      subtasks: [],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  async getTask(projectId: string, taskId: string): Promise<Task | null> {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        subtasks: true,
      },
    });

    if (!task || task.projectId !== projectId) return null;

    return {
      ...task,
      status: task.status as TaskStatus,
      priority: task.priority as Priority,
      dueDate: task.dueDate?.toISOString(),
      subtasks: task.subtasks.map(s => ({
        ...s,
        status: s.status as TaskStatus,
        priority: s.priority as Priority,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  async updateTask(projectId: string, taskId: string, updates: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>): Promise<Task | null> {
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

    return this.getTask(projectId, taskId);
  }

  async deleteTask(projectId: string, taskId: string): Promise<boolean> {
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

  // Subtasks
  async createSubtask(input: CreateSubtaskInput): Promise<Subtask | null> {
    // Check if task exists
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, input.taskId),
    });
    
    if (!task) return null;

    const [subtask] = await db.insert(subtasks)
      .values({
        taskId: input.taskId,
        title: input.title,
        description: input.description,
        priority: input.priority || 'medium',
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
      ...subtask,
      status: subtask.status as TaskStatus,
      priority: subtask.priority as Priority,
      createdAt: subtask.createdAt.toISOString(),
      updatedAt: subtask.updatedAt.toISOString(),
    };
  }

  async updateSubtask(taskId: string, subtaskId: string, updates: Partial<Omit<Subtask, 'id' | 'taskId' | 'createdAt'>>): Promise<Subtask | null> {
    // Check if subtask belongs to task
    const existingSubtask = await db.query.subtasks.findFirst({
      where: eq(subtasks.id, subtaskId),
    });
    
    if (!existingSubtask || existingSubtask.taskId !== taskId) return null;

    const [updated] = await db.update(subtasks)
      .set({
        ...updates,
        updatedAt: sql`NOW()`,
      })
      .where(eq(subtasks.id, subtaskId))
      .returning();

    if (!updated) return null;

    // Update task and project updatedAt
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });
    
    if (task) {
      await db.update(tasks)
        .set({ updatedAt: sql`NOW()` })
        .where(eq(tasks.id, taskId));
      
      await db.update(projects)
        .set({ updatedAt: sql`NOW()` })
        .where(eq(projects.id, task.projectId));
    }

    return {
      ...updated,
      status: updated.status as TaskStatus,
      priority: updated.priority as Priority,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteSubtask(taskId: string, subtaskId: string): Promise<boolean> {
    // Check if subtask belongs to task
    const existingSubtask = await db.query.subtasks.findFirst({
      where: eq(subtasks.id, subtaskId),
    });
    
    if (!existingSubtask || existingSubtask.taskId !== taskId) return false;

    const result = await db.delete(subtasks)
      .where(eq(subtasks.id, subtaskId));

    if (result.rowCount && result.rowCount > 0) {
      // Update task and project updatedAt
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
      });
      
      if (task) {
        await db.update(tasks)
          .set({ updatedAt: sql`NOW()` })
          .where(eq(tasks.id, taskId));
        
        await db.update(projects)
          .set({ updatedAt: sql`NOW()` })
          .where(eq(projects.id, task.projectId));
      }
      
      return true;
    }
    
    return false;
  }
}

export const databaseService = new DatabaseService();