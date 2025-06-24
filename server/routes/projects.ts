import express from 'express';
import { databaseService } from '../db/database-service.js';
import { CreateProjectInput, CreateTaskInput, CreateCommentInput } from '../../src/types/types.js';
import { logger } from '../lib/logger.js';

export const projectRoutes = express.Router();

// Projects
projectRoutes.get('/', async (req, res) => {
  const startTime = Date.now();
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const projects = await databaseService.getProjects(req.user.id);
    
    logger.debug('Projects fetched successfully', {
      userId: req.user.id,
      projectCount: projects.length,
      duration: Date.now() - startTime,
    });
    
    res.json(projects);
  } catch (error) {
    logger.error('Failed to fetch projects', {
      userId: req.user?.id,
      duration: Date.now() - startTime,
    }, error as Error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

projectRoutes.get('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const project = await databaseService.getProject(req.params.id, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

projectRoutes.post('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const input: CreateProjectInput = req.body;
    if (!input.name) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    const project = await databaseService.createProject(input, req.user.id);
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

projectRoutes.put('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const updates = req.body;
    const project = await databaseService.updateProject(req.params.id, req.user.id, updates);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

projectRoutes.delete('/:id', async (req, res) => {
  try {
    if (!req.user) {
      logger.warn('Delete attempt without authentication', {
        component: 'ProjectRoutes',
        projectId: req.params.id
      });
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const projectId = req.params.id;
    
    logger.userAction('delete_project_request', 'ProjectRoutes', {
      projectId,
      userId: req.user.id
    });
    
    const deleted = await databaseService.deleteProject(projectId, req.user.id);
    
    if (!deleted) {
      logger.warn('Project not found or not deleted', {
        component: 'ProjectRoutes',
        projectId,
        userId: req.user.id
      });
      return res.status(404).json({ error: 'Project not found' });
    }
    
    logger.info('Project delete request completed successfully', {
      component: 'ProjectRoutes',
      projectId,
      userId: req.user.id,
      important: true
    });
    
    res.status(204).send();
  } catch (error) {
    logger.error('Project deletion request failed', {
      component: 'ProjectRoutes',
      projectId: req.params.id,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error)
    }, error as Error);
    
    res.status(500).json({ 
      error: 'Failed to delete project',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Tasks
projectRoutes.post('/:projectId/tasks', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const input: CreateTaskInput = {
      ...req.body,
      projectId: req.params.projectId
    };
    
    if (!input.title) {
      return res.status(400).json({ error: 'Task title is required' });
    }
    
    const task = await databaseService.createTask(input, req.user.id);
    if (!task) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

projectRoutes.get('/:projectId/tasks/:taskId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const task = await databaseService.getTask(req.params.projectId, req.params.taskId, req.user.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

projectRoutes.put('/:projectId/tasks/:taskId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const updates = req.body;
    const task = await databaseService.updateTask(req.params.projectId, req.params.taskId, req.user.id, updates);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

projectRoutes.delete('/:projectId/tasks/:taskId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const deleted = await databaseService.deleteTask(req.params.projectId, req.params.taskId, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});


// Comments
projectRoutes.get('/:projectId/tasks/:taskId/comments', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const comments = await databaseService.getComments(req.params.taskId, req.user.id);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

projectRoutes.post('/:projectId/tasks/:taskId/comments', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const input: CreateCommentInput = {
      ...req.body,
      taskId: req.params.taskId
    };
    
    if (!input.content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    const comment = await databaseService.createComment(input, req.user.id);
    if (!comment) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create comment' });
  }
});