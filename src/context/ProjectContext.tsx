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

  const apiCall = async (url: string, options: RequestInit = {}) => {
    const startTime = performance.now();
    const userId = localStorage.getItem('userId');
    const method = options.method || 'GET';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (userId) {
      headers['x-user-id'] = userId;
    }

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
        userId,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.apiCall(method, url, undefined, duration, {
        component: 'ProjectContext',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
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