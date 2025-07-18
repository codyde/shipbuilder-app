import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Request logging middleware
 */
export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const originalJson = res.json;

  // Override res.json to capture response details
  res.json = function(body: any) {
    const duration = Date.now() - start;
    
    // Log the request/response
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      userId: req.user?.userId,
      contentType: req.headers['content-type'],
      responseSize: JSON.stringify(body).length,
    });

    // Call original json method
    return originalJson.call(this, body);
  };

  // Log incoming request
  logger.info('Request received', {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    hasAuth: !!req.headers.authorization,
  });

  next();
};