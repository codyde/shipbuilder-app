import express from 'express';
import { databaseService } from '../db/database-service.js';
import * as Sentry from '@sentry/node';

const { logger } = Sentry;

export const componentsRoutes = express.Router();

// Note: Authentication and rate limiting are already applied at the server level

// GET /api/components - Get all user's components
componentsRoutes.get('/', async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('Fetching components for user', { userId });
    const components = await databaseService.getComponents(userId);
    
    res.json({ components });
  } catch (error) {
    logger.error('Error fetching components', { 
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({ error: 'Failed to fetch components' });
  }
});

// POST /api/components - Create a new component
componentsRoutes.post('/', async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { name, description, tags } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Component name is required' });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Component description is required' });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Component name must be 100 characters or less' });
    }

    if (description.trim().length > 2000) {
      return res.status(400).json({ error: 'Component description must be 2000 characters or less' });
    }

    if (tags && (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string'))) {
      return res.status(400).json({ error: 'Tags must be an array of strings' });
    }

    if (tags && tags.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 tags allowed' });
    }

    logger.info('Creating component', { userId, name: name.trim() });
    
    const component = await databaseService.createComponent(userId, {
      name: name.trim(),
      description: description.trim(),
      tags: tags ? tags.map((tag: string) => tag.trim()).filter(Boolean) : []
    });

    res.status(201).json({ component });
  } catch (error) {
    logger.error('Error creating component', { 
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({ error: 'Failed to create component' });
  }
});

// GET /api/components/:componentId - Get a specific component
componentsRoutes.get('/:componentId', async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { componentId } = req.params;

    if (!componentId) {
      return res.status(400).json({ error: 'Component ID is required' });
    }

    logger.info('Fetching component', { userId, componentId });
    const component = await databaseService.getComponentById(componentId, userId);

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json({ component });
  } catch (error) {
    logger.error('Error fetching component', { 
      userId: req.user?.id,
      componentId: req.params.componentId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({ error: 'Failed to fetch component' });
  }
});

// PUT /api/components/:componentId - Update a component
componentsRoutes.put('/:componentId', async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { componentId } = req.params;
    const { name, description, tags, isActive } = req.body;

    if (!componentId) {
      return res.status(400).json({ error: 'Component ID is required' });
    }

    // Validation
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Component name cannot be empty' });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({ error: 'Component name must be 100 characters or less' });
      }
    }

    if (description !== undefined) {
      if (!description || !description.trim()) {
        return res.status(400).json({ error: 'Component description cannot be empty' });
      }
      if (description.trim().length > 2000) {
        return res.status(400).json({ error: 'Component description must be 2000 characters or less' });
      }
    }

    if (tags !== undefined) {
      if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string')) {
        return res.status(400).json({ error: 'Tags must be an array of strings' });
      }
      if (tags.length > 20) {
        return res.status(400).json({ error: 'Maximum 20 tags allowed' });
      }
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    logger.info('Updating component', { userId, componentId });
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (tags !== undefined) updateData.tags = tags.map((tag: string) => tag.trim()).filter(Boolean);
    if (isActive !== undefined) updateData.isActive = isActive;

    const component = await databaseService.updateComponent(componentId, userId, updateData);

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json({ component });
  } catch (error) {
    logger.error('Error updating component', { 
      userId: req.user?.id,
      componentId: req.params.componentId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({ error: 'Failed to update component' });
  }
});

// DELETE /api/components/:componentId - Delete a component (soft delete)
componentsRoutes.delete('/:componentId', async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { componentId } = req.params;

    if (!componentId) {
      return res.status(400).json({ error: 'Component ID is required' });
    }

    logger.info('Deleting component', { userId, componentId });
    const success = await databaseService.deleteComponent(componentId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json({ message: 'Component deleted successfully' });
  } catch (error) {
    logger.error('Error deleting component', { 
      userId: req.user?.id,
      componentId: req.params.componentId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({ error: 'Failed to delete component' });
  }
});