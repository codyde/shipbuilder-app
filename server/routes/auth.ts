import express from 'express';
import { databaseService } from '../db/database-service.js';

const router = express.Router();

// Fake login endpoint - creates or finds user by email
router.post('/fake-login', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // Check if user exists
    let user = await databaseService.getUserByEmail(email);
    
    if (!user) {
      // Create new user
      user = await databaseService.createUser(email, name, 'fake');
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Fake login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user endpoint
router.get('/me', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await databaseService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Logout endpoint (for fake auth, just returns success)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;