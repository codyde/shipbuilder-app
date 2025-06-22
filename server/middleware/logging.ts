import { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

/**
 * Express middleware for automatic HTTP request logging
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now()
  
  // Add request ID if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Log incoming request
  logger.debug(`Incoming request: ${req.method} ${req.originalUrl}`, {
    requestId: req.headers['x-request-id'] as string,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
  })

  // Override res.end to capture response
  const originalEnd = res.end
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - startTime
    
    // Log completed request
    logger.httpRequest(req, res, duration, {
      requestId: req.headers['x-request-id'] as string,
      userId: req.user?.id,
    })
    
    // Call original end method and return this for method chaining
    originalEnd.call(this, chunk, encoding, cb)
    return this
  }

  next()
}

/**
 * Error logging middleware - should be used after all other middleware
 */
export function errorLoggingMiddleware(error: Error, req: Request, res: Response, next: NextFunction) {
  logger.error(`Unhandled error in ${req.method} ${req.originalUrl}`, {
    requestId: req.headers['x-request-id'] as string,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    stack: error.stack,
  }, error)

  next(error)
}