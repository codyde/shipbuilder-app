import express from 'express';
import { databaseService } from '../db/database-service.js';
import { CreateProjectInput, CreateTaskInput, CreateCommentInput } from '../../src/types/types.js';

export const projectRoutes = express.Router();

// Projects
projectRoutes.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const projects = await databaseService.getProjects(req.user.id);
    res.json(projects);
  } catch (error) {
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
      return res.status(401).json({ error: 'Authentication required' });
    }
    const deleted = await databaseService.deleteProject(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
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