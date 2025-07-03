import { Project, Task, Subtask, CreateProjectInput, CreateTaskInput, CreateSubtaskInput, TaskStatus, ProjectStatus, Priority } from '../types/types.js';
import { v4 as uuidv4 } from 'uuid';

class MemoryStore {
  private projects: Map<string, Project> = new Map();

  // Projects
  createProject(input: CreateProjectInput, userId: string): Project {
    if (!userId) {
      throw new Error('User ID is required to create a project');
    }
    const project: Project = {
      id: uuidv4(),
      userId,
      name: input.name,
      description: input.description,
      status: ProjectStatus.ACTIVE,
      tasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.projects.set(project.id, project);
    return project;
  }

  getProjects(): Project[] {
    return Array.from(this.projects.values());
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null {
    const project = this.projects.get(id);
    if (!project) return null;

    const updatedProject = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  deleteProject(id: string): boolean {
    return this.projects.delete(id);
  }

  // Tasks
  createTask(input: CreateTaskInput): Task | null {
    const project = this.projects.get(input.projectId);
    if (!project) return null;

    const task: Task = {
      id: uuidv4(),
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      status: TaskStatus.BACKLOG,
      priority: input.priority || Priority.MEDIUM,
      dueDate: input.dueDate,
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    project.tasks.push(task);
    project.updatedAt = new Date().toISOString();
    this.projects.set(project.id, project);
    
    return task;
  }

  getTask(projectId: string, taskId: string): Task | null {
    const project = this.projects.get(projectId);
    if (!project) return null;
    
    return project.tasks.find(task => task.id === taskId) || null;
  }

  updateTask(projectId: string, taskId: string, updates: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>): Task | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const taskIndex = project.tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return null;

    const updatedTask = {
      ...project.tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    project.tasks[taskIndex] = updatedTask;
    project.updatedAt = new Date().toISOString();
    this.projects.set(project.id, project);
    
    return updatedTask;
  }

  deleteTask(projectId: string, taskId: string): boolean {
    const project = this.projects.get(projectId);
    if (!project) return false;

    const taskIndex = project.tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return false;

    project.tasks.splice(taskIndex, 1);
    project.updatedAt = new Date().toISOString();
    this.projects.set(project.id, project);
    
    return true;
  }

  // Subtasks
  createSubtask(taskId: string, input: CreateSubtaskInput): Subtask | null {
    const project = Array.from(this.projects.values()).find(p => 
      p.tasks.some(t => t.id === taskId)
    );
    if (!project) return null;

    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return null;

    const subtask: Subtask = {
      id: uuidv4(),
      taskId: taskId,
      title: input.title,
      description: input.description,
      status: TaskStatus.BACKLOG,
      priority: input.priority || Priority.MEDIUM,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!task.subtasks) {
      task.subtasks = [];
    }
    task.subtasks.push(subtask);
    task.updatedAt = new Date().toISOString();
    project.updatedAt = new Date().toISOString();
    this.projects.set(project.id, project);
    
    return subtask;
  }

  updateSubtask(taskId: string, subtaskId: string, updates: Partial<Omit<Subtask, 'id' | 'taskId' | 'createdAt'>>): Subtask | null {
    const project = Array.from(this.projects.values()).find(p => 
      p.tasks.some(t => t.id === taskId)
    );
    if (!project) return null;

    const task = project.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return null;

    const subtaskIndex = task.subtasks.findIndex(st => st.id === subtaskId);
    if (subtaskIndex === -1) return null;

    const updatedSubtask = {
      ...task.subtasks[subtaskIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    task.subtasks[subtaskIndex] = updatedSubtask;
    task.updatedAt = new Date().toISOString();
    project.updatedAt = new Date().toISOString();
    this.projects.set(project.id, project);
    
    return updatedSubtask;
  }

  deleteSubtask(taskId: string, subtaskId: string): boolean {
    const project = Array.from(this.projects.values()).find(p => 
      p.tasks.some(t => t.id === taskId)
    );
    if (!project) return false;

    const task = project.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return false;

    const subtaskIndex = task.subtasks.findIndex(st => st.id === subtaskId);
    if (subtaskIndex === -1) return false;

    task.subtasks.splice(subtaskIndex, 1);
    task.updatedAt = new Date().toISOString();
    project.updatedAt = new Date().toISOString();
    this.projects.set(project.id, project);
    
    return true;
  }
}

export const memoryStore = new MemoryStore();