export const TaskStatus = {
  BACKLOG: 'backlog',
  IN_PROGRESS: 'in_progress', 
  COMPLETED: 'completed'
} as const

export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus]

export const ProjectStatus = {
  ACTIVE: 'active',
  BACKLOG: 'backlog',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
} as const

export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus]

export const Priority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
} as const

export type Priority = typeof Priority[keyof typeof Priority]

export interface User {
  id: string; // UUID format
  email: string;
  name: string;
  provider?: string;
  providerId?: string;
  avatar?: string;
  aiProvider: 'anthropic' | 'openai';
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string; // Slug format: {project-slug}-{number} (e.g., "photoshare-1")
  projectId: string; // Slug format: alphanumeric + hyphens (e.g., "photoshare")
  title: string;
  description?: string;
  details?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  subtasks?: Subtask[];
  comments?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string; // Slug format: alphanumeric + hyphens (e.g., "photoshare")
  userId: string; // UUID format
  name: string;
  description?: string;
  status: ProjectStatus;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface CreateTaskInput {
  projectId: string; // Project slug (e.g., "photoshare")
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;
  status?: TaskStatus;
}

export interface CreateSubtaskInput {
  title: string;
  description?: string;
  priority?: Priority;
}


export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolInvocations?: ToolInvocation[];
}

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: {
    success: boolean;
    message: string;
    data?: unknown;
  };
}

export interface Comment {
  id: string; // UUID format
  taskId: string; // Task slug (e.g., "photoshare-1")
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentInput {
  taskId: string; // Task slug (e.g., "photoshare-1")
  content: string;
  author: string;
}

// Slug validation types
export type ProjectSlug = string; // Format: alphanumeric + hyphens (e.g., "photoshare")
export type TaskSlug = string;    // Format: {project-slug}-{number} (e.g., "photoshare-1") 