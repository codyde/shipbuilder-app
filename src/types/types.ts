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
  id: string;
  email: string;
  name: string;
  provider?: string;
  providerId?: string;
  avatar?: string;
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
  id: string;
  projectId: string;
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
  id: string;
  userId: string;
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
  projectId: string;
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;
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
  id: string;
  taskId: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentInput {
  taskId: string;
  content: string;
  author: string;
}