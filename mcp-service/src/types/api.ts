// API response types for MCP service
// These should match the main application's API responses

export interface User {
  id: string;
  email: string;
  name: string;
  provider: string;
  providerId: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  tasks: Task[];
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  details: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}