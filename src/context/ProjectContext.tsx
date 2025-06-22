import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Project, Task, CreateProjectInput, CreateTaskInput } from '@/types/types';
import { logger } from '@/lib/logger';

interface ProjectState {
  projects: Project[];
  loading: boolean;
  error: string | null;
}

type ProjectAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'ADD_TASK'; payload: { projectId: string; task: Task } }
  | { type: 'UPDATE_TASK'; payload: { projectId: string; task: Task } }
  | { type: 'DELETE_TASK'; payload: { projectId: string; taskId: string } };

const initialState: ProjectState = {
  projects: [],
  loading: false,
  error: null,
};

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p => 
          p.id === action.payload.id ? action.payload : p
        )
      };
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload)
      };
    case 'ADD_TASK':
      return {
        ...state,
        projects: state.projects.map(p => 
          p.id === action.payload.projectId 
            ? { ...p, tasks: [...p.tasks, action.payload.task] }
            : p
        )
      };
    case 'UPDATE_TASK':
      return {
        ...state,
        projects: state.projects.map(p => 
          p.id === action.payload.projectId 
            ? { 
                ...p, 
                tasks: p.tasks.map(t => 
                  t.id === action.payload.task.id ? action.payload.task : t
                )
              }
            : p
        )
      };
    case 'DELETE_TASK':
      return {
        ...state,
        projects: state.projects.map(p => 
          p.id === action.payload.projectId 
            ? { ...p, tasks: p.tasks.filter(t => t.id !== action.payload.taskId) }
            : p
        )
      };
    default:
      return state;
  }
}

interface ProjectContextValue extends ProjectState {
  createProject: (input: CreateProjectInput) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<void>;
  updateTask: (projectId: string, taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  const apiCall = async (url: string, options: RequestInit = {}, retries = 3) => {
    const startTime = performance.now();
    const token = localStorage.getItem('authToken');
    const method = options.method || 'GET';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            ...headers,
            ...options.headers,
          },
          ...options,
        });

        const duration = performance.now() - startTime;
        
        // Log the API call
        logger.apiCall(method, url, response.status, duration, {
          component: 'ProjectContext',
          hasToken: !!token,
          attempt,
        });

        // Handle token expiration
        if (response.status === 401) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.code === 'TOKEN_EXPIRED' || errorData.code === 'INVALID_TOKEN') {
            // Token expired or invalid, clear auth and redirect to login
            localStorage.removeItem('authToken');
            window.location.href = '/login';
            throw new Error('Session expired. Please log in again.');
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
      } catch (error) {
        const duration = performance.now() - startTime;
        
        // Check if this is a connection error that we should retry
        const isConnectionError = error instanceof TypeError && 
          (error.message.includes('fetch') || error.message.includes('Failed to fetch'));
        
        if (isConnectionError && attempt < retries) {
          logger.apiCall(method, url, undefined, duration, {
            component: 'ProjectContext',
            hasToken: !!token,
            attempt,
            willRetry: true,
            error: error.message,
          });
          
          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        logger.apiCall(method, url, undefined, duration, {
          component: 'ProjectContext',
          hasToken: !!token,
          attempt,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }
    
    // If we get here, all retries failed
    throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
  };

  const refreshProjects = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      const projects = await apiCall('/api/projects');
      dispatch({ type: 'SET_PROJECTS', payload: projects });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to fetch projects' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const createProject = async (input: CreateProjectInput) => {
    try {
      const project = await apiCall('/api/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      dispatch({ type: 'ADD_PROJECT', payload: project });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to create project' });
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    try {
      const project = await apiCall(`/api/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      dispatch({ type: 'UPDATE_PROJECT', payload: project });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update project' });
    }
  };

  const deleteProject = async (id: string) => {
    // Find the project before deleting for potential rollback
    const projectToDelete = state.projects.find(p => p.id === id);
    
    logger.userAction('delete_project', 'ProjectContext', {
      projectId: id,
      projectName: projectToDelete?.name,
      tasksCount: projectToDelete?.tasks.length
    });
    
    // Optimistically remove from UI
    dispatch({ type: 'DELETE_PROJECT', payload: id });
    
    try {
      await apiCall(`/api/projects/${id}`, { method: 'DELETE' });
      logger.info('Project deleted successfully', {
        component: 'ProjectContext',
        action: 'deleteProject',
        projectId: id,
        projectName: projectToDelete?.name
      });
    } catch (error) {
      // Rollback: re-add the project if API call fails
      if (projectToDelete) {
        dispatch({ type: 'ADD_PROJECT', payload: projectToDelete });
      }
      logger.error('Failed to delete project - rolled back', {
        component: 'ProjectContext',
        action: 'deleteProject',
        projectId: id,
        projectName: projectToDelete?.name
      }, error as Error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to delete project' });
    }
  };

  const createTask = async (input: CreateTaskInput) => {
    try {
      const task = await apiCall(`/api/projects/${input.projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      dispatch({ type: 'ADD_TASK', payload: { projectId: input.projectId, task } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to create task' });
    }
  };

  const updateTask = async (projectId: string, taskId: string, updates: Partial<Task>) => {
    try {
      const task = await apiCall(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      dispatch({ type: 'UPDATE_TASK', payload: { projectId, task } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update task' });
    }
  };

  const deleteTask = async (projectId: string, taskId: string) => {
    // Find the task before deleting for potential rollback
    const project = state.projects.find(p => p.id === projectId);
    const taskToDelete = project?.tasks.find(t => t.id === taskId);
    
    logger.userAction('delete_task', 'ProjectContext', {
      projectId,
      taskId,
      taskTitle: taskToDelete?.title
    });
    
    // Optimistically remove from UI
    dispatch({ type: 'DELETE_TASK', payload: { projectId, taskId } });
    
    try {
      await apiCall(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' });
      logger.info('Task deleted successfully', {
        component: 'ProjectContext',
        action: 'deleteTask',
        projectId,
        taskId,
        taskTitle: taskToDelete?.title
      });
    } catch (error) {
      // Rollback: re-add the task if API call fails
      if (taskToDelete) {
        dispatch({ type: 'ADD_TASK', payload: { projectId, task: taskToDelete } });
      }
      logger.error('Failed to delete task - rolled back', {
        component: 'ProjectContext',
        action: 'deleteTask',
        projectId,
        taskId,
        taskTitle: taskToDelete?.title
      }, error as Error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to delete task' });
    }
  };


  // Load projects on mount
  useEffect(() => {
    refreshProjects();
  }, []);

  const value: ProjectContextValue = {
    ...state,
    createProject,
    updateProject,
    deleteProject,
    createTask,
    updateTask,
    deleteTask,
    refreshProjects,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}