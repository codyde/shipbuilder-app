import { Router, Request, Response } from 'express';
import { authenticateUser, SecurityEvent, logSecurityEvent } from '../middleware/auth.js';
import { databaseService } from '../db/database-service.js';
import { generateApiKey, getDisplayKey } from '../utils/api-key-utils.js';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Rate limiting for API key operations
const apiKeyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many API key requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Create API key
router.post('/create', authenticateUser, apiKeyRateLimit, async (req: Request, res: Response) => {
  try {
    const { name, expiresInDays } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'API key name is required' });
      return;
    }
    
    if (name.length > 100) {
      res.status(400).json({ error: 'API key name must be less than 100 characters' });
      return;
    }
    
    // Validate expiration days if provided
    let expiresAt: Date | undefined;
    if (expiresInDays !== undefined) {
      if (typeof expiresInDays !== 'number' || expiresInDays < 1 || expiresInDays > 365) {
        res.status(400).json({ error: 'Expiration must be between 1 and 365 days' });
        return;
      }
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }
    
    const userId = req.user!.id;
    
    // Check if user already has too many API keys
    const existingKeys = await databaseService.getApiKeysByUserId(userId);
    if (existingKeys.length >= 10) {
      res.status(400).json({ error: 'Maximum of 10 API keys allowed per user' });
      return;
    }
    
    // Generate new API key
    const generatedKey = generateApiKey();
    
    // Save to database
    const apiKey = await databaseService.createApiKey(
      userId,
      name.trim(),
      generatedKey.keyHash,
      generatedKey.prefix,
      expiresAt
    );
    
    // Log API key creation
    logSecurityEvent(SecurityEvent.API_KEY_CREATED, req, {
      keyId: apiKey.id,
      keyName: apiKey.name,
      userId: userId,
      expiresAt: apiKey.expiresAt
    }, 'medium');
    
    // Return the plain key (only time it's shown)
    res.json({
      id: apiKey.id,
      name: apiKey.name,
      key: generatedKey.plainKey, // Only returned once
      prefix: apiKey.prefix,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      displayKey: getDisplayKey(generatedKey.plainKey),
      message: 'API key created successfully. This is the only time the full key will be shown.'
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// List user's API keys
router.get('/list', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const apiKeys = await databaseService.getApiKeysByUserId(userId);
    
    // Return API keys without the actual key values
    const safeApiKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      isActive: key.isActive,
      displayKey: `${key.prefix}${'*'.repeat(8)}...****` // Show prefix + asterisks
    }));
    
    res.json({ apiKeys: safeApiKeys });
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// Delete API key
router.delete('/:keyId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const userId = req.user!.id;
    
    if (!keyId) {
      res.status(400).json({ error: 'API key ID is required' });
      return;
    }
    
    const success = await databaseService.deleteApiKey(keyId, userId);
    
    if (!success) {
      res.status(404).json({ error: 'API key not found or not owned by user' });
      return;
    }
    
    // Log API key deletion
    logSecurityEvent(SecurityEvent.API_KEY_DELETED, req, {
      keyId: keyId,
      userId: userId
    }, 'medium');
    
    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// Get API key details
router.get('/:keyId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const userId = req.user!.id;
    
    if (!keyId) {
      res.status(400).json({ error: 'API key ID is required' });
      return;
    }
    
    const apiKeys = await databaseService.getApiKeysByUserId(userId);
    const apiKey = apiKeys.find(key => key.id === keyId);
    
    if (!apiKey) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }
    
    // Return safe API key details
    res.json({
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      isActive: apiKey.isActive,
      displayKey: `${apiKey.prefix}${'*'.repeat(8)}...****`
    });
  } catch (error) {
    console.error('Error getting API key details:', error);
    res.status(500).json({ error: 'Failed to get API key details' });
  }
});

export default router;