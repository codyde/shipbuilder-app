import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import type { MCPSession } from './session-service.js';

/**
 * Abstract session storage interface
 */
export interface SessionStorage {
  get(key: string): Promise<MCPSession | null>;
  set(key: string, session: MCPSession, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  cleanup(): Promise<number>;
  getStats(): Promise<{ totalSessions: number; activeUsers: number }>;
  shutdown(): Promise<void>;
}

/**
 * In-memory session storage for local development
 */
export class MemorySessionStorage implements SessionStorage {
  private sessions = new Map<string, { session: MCPSession; expiresAt: number }>();
  private userSessions = new Map<string, Set<string>>();
  
  async get(key: string): Promise<MCPSession | null> {
    const entry = this.sessions.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      await this.delete(key);
      return null;
    }
    
    return entry.session;
  }
  
  async set(key: string, session: MCPSession, ttlSeconds: number = 7200): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.sessions.set(key, { session, expiresAt });
    
    // Track user sessions
    if (!this.userSessions.has(session.userId)) {
      this.userSessions.set(session.userId, new Set());
    }
    this.userSessions.get(session.userId)!.add(key);
  }
  
  async delete(key: string): Promise<void> {
    const entry = this.sessions.get(key);
    if (entry) {
      // Remove from user tracking
      const userSessionSet = this.userSessions.get(entry.session.userId);
      if (userSessionSet) {
        userSessionSet.delete(key);
        if (userSessionSet.size === 0) {
          this.userSessions.delete(entry.session.userId);
        }
      }
    }
    
    this.sessions.delete(key);
  }
  
  async keys(pattern: string): Promise<string[]> {
    // Simple pattern matching for memory storage
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.sessions.keys()).filter(key => regex.test(key));
  }
  
  async cleanup(): Promise<number> {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.sessions.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      await this.delete(key);
    }
    
    return expiredKeys.length;
  }
  
  async getStats(): Promise<{ totalSessions: number; activeUsers: number }> {
    return {
      totalSessions: this.sessions.size,
      activeUsers: this.userSessions.size
    };
  }
  
  async shutdown(): Promise<void> {
    this.sessions.clear();
    this.userSessions.clear();
  }
}

/**
 * Redis session storage for production
 */
export class RedisSessionStorage implements SessionStorage {
  private redis: Redis;
  private readonly keyPrefix = 'mcp:session:';
  private readonly userKeyPrefix = 'mcp:user:';
  
  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      // Connection options for production resilience
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Keep connections alive
      keepAlive: 30000,
      // Reconnect on connection lost
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      }
    });
    
    this.redis.on('connect', () => {
      logger.info('Redis connected for session storage');
    });
    
    this.redis.on('error', (error) => {
      logger.error('Redis connection error', {
        error: error.message,
        stack: error.stack
      });
    });
    
    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }
  
  private sessionKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
  
  private userKey(userId: string): string {
    return `${this.userKeyPrefix}${userId}`;
  }
  
  async get(key: string): Promise<MCPSession | null> {
    try {
      const data = await this.redis.get(this.sessionKey(key));
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      
      // Convert date strings back to Date objects
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        lastActivity: new Date(parsed.lastActivity),
        activeStreams: new Set(parsed.activeStreams || [])
      };
    } catch (error) {
      logger.error('Failed to get session from Redis', {
        key: key.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  
  async set(key: string, session: MCPSession, ttlSeconds: number = 7200): Promise<void> {
    try {
      // Serialize the session
      const serializable = {
        ...session,
        activeStreams: Array.from(session.activeStreams)
      };
      
      const pipeline = this.redis.pipeline();
      
      // Set session with TTL
      pipeline.setex(this.sessionKey(key), ttlSeconds, JSON.stringify(serializable));
      
      // Track user sessions
      pipeline.sadd(this.userKey(session.userId), key);
      pipeline.expire(this.userKey(session.userId), ttlSeconds);
      
      await pipeline.exec();
      
      logger.debug('Session stored in Redis', {
        key: key.slice(0, 8) + '...',
        userId: session.userId,
        ttl: ttlSeconds
      });
    } catch (error) {
      logger.error('Failed to store session in Redis', {
        key: key.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  async delete(key: string): Promise<void> {
    try {
      // Get session to find userId for cleanup
      const session = await this.get(key);
      
      const pipeline = this.redis.pipeline();
      pipeline.del(this.sessionKey(key));
      
      if (session) {
        pipeline.srem(this.userKey(session.userId), key);
      }
      
      await pipeline.exec();
      
      logger.debug('Session deleted from Redis', {
        key: key.slice(0, 8) + '...'
      });
    } catch (error) {
      logger.error('Failed to delete session from Redis', {
        key: key.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  async keys(pattern: string): Promise<string[]> {
    try {
      const redisPattern = `${this.keyPrefix}${pattern}`;
      const keys = await this.redis.keys(redisPattern);
      return keys.map(key => key.replace(this.keyPrefix, ''));
    } catch (error) {
      logger.error('Failed to get keys from Redis', {
        pattern,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  
  async cleanup(): Promise<number> {
    try {
      // Redis handles TTL automatically, but we can clean up orphaned user sets
      const userKeys = await this.redis.keys(`${this.userKeyPrefix}*`);
      let cleaned = 0;
      
      for (const userKey of userKeys) {
        const sessionKeys = await this.redis.smembers(userKey);
        const existingKeys = await this.redis.mget(
          ...sessionKeys.map(key => this.sessionKey(key))
        );
        
        // Remove non-existent sessions from user set
        const orphanedKeys = sessionKeys.filter((_, index) => !existingKeys[index]);
        if (orphanedKeys.length > 0) {
          await this.redis.srem(userKey, ...orphanedKeys);
          cleaned += orphanedKeys.length;
        }
        
        // Remove empty user sets
        const remainingCount = await this.redis.scard(userKey);
        if (remainingCount === 0) {
          await this.redis.del(userKey);
        }
      }
      
      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup Redis sessions', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
  
  async getStats(): Promise<{ totalSessions: number; activeUsers: number }> {
    try {
      const sessionCount = await this.redis.eval(`
        return #redis.call('keys', ARGV[1])
      `, 0, `${this.keyPrefix}*`) as number;
      
      const userCount = await this.redis.eval(`
        return #redis.call('keys', ARGV[1])
      `, 0, `${this.userKeyPrefix}*`) as number;
      
      return {
        totalSessions: sessionCount,
        activeUsers: userCount
      };
    } catch (error) {
      logger.error('Failed to get Redis session stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { totalSessions: 0, activeUsers: 0 };
    }
  }
  
  async shutdown(): Promise<void> {
    try {
      await this.redis.quit();
      logger.info('Redis session storage shutdown completed');
    } catch (error) {
      logger.error('Error during Redis shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Create session storage based on environment
 */
export function createSessionStorage(): SessionStorage {
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl && process.env.NODE_ENV === 'production') {
    logger.info('Using Redis session storage for production');
    return new RedisSessionStorage(redisUrl);
  } else {
    logger.info('Using memory session storage for development');
    return new MemorySessionStorage();
  }
}