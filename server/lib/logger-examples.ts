/**
 * Example usage of the server-side logger utility
 * This file demonstrates various logging patterns for server-side code
 */

import { logger } from './logger'

// Example Express route with comprehensive logging
export function exampleRoute(req: any, res: any) {
  const startTime = Date.now()
  
  try {
    // Log the start of operation
    logger.debug('Processing user data request', {
      userId: req.user?.id,
      requestId: req.headers['x-request-id'],
      method: req.method,
      url: req.originalUrl,
    })

    // Example database operation logging
    const dbStartTime = Date.now()
    // ... database operation here ...
    const dbDuration = Date.now() - dbStartTime
    
    logger.database('SELECT', 'users', dbDuration, {
      userId: req.user?.id,
      query: 'getUserProfile',
    })

    // Example external API call logging
    const apiStartTime = Date.now()
    // ... external API call here ...
    const apiDuration = Date.now() - apiStartTime
    
    logger.externalAPI('GitHub', 'GET', '/user/repos', 200, apiDuration, {
      userId: req.user?.id,
      integration: 'github',
    })

    // Success response
    const totalDuration = Date.now() - startTime
    logger.info('User data request completed successfully', {
      userId: req.user?.id,
      requestId: req.headers['x-request-id'],
      duration: totalDuration,
    })

    res.json({ success: true })

  } catch (error) {
    // Error handling with context
    logger.error('Failed to process user data request', {
      userId: req.user?.id,
      requestId: req.headers['x-request-id'],
      method: req.method,
      url: req.originalUrl,
      duration: Date.now() - startTime,
    }, error as Error)

    res.status(500).json({ error: 'Internal server error' })
  }
}

// Example authentication logging
export function loginExample(email: string, success: boolean, error?: Error) {
  if (success) {
    logger.auth('login_success', email, {
      method: 'email',
      ip: '192.168.1.1',
    })
  } else {
    logger.auth('login_failed', email, {
      method: 'email',
      ip: '192.168.1.1',
      reason: error?.message,
    })
  }
}

// Example performance monitoring
export function performanceExample() {
  const start = Date.now()
  
  // ... some expensive operation ...
  
  const duration = Date.now() - start
  logger.performance('data_processing', duration, {
    recordCount: 1000,
    algorithm: 'quicksort',
  })
}

// Example child logger usage
export function childLoggerExample(userId: string) {
  // Create a child logger with default context
  const userLogger = logger.child({
    userId,
    component: 'UserService',
  })

  // All logs from this child will include the userId and component
  userLogger.debug('Processing user preferences')
  userLogger.info('User preferences updated')
  userLogger.warn('User approaching rate limit', { currentRequests: 95 })
}

// Example structured logging for different scenarios
export function loggingExamples() {
  // Simple debug logging
  logger.debug('Cache hit for user profile', { userId: 'user-123', cacheKey: 'profile:user-123' })

  // Info with important flag (will be sent to Sentry)
  logger.info('Payment processed successfully', { 
    userId: 'user-123', 
    amount: 29.99, 
    currency: 'USD',
    important: true 
  })

  // Warning with potential issues
  logger.warn('High memory usage detected', {
    memoryUsage: '85%',
    threshold: '80%',
    service: 'api-server',
  })

  // Error with exception
  const error = new Error('Database connection failed')
  logger.error('Unable to connect to database', {
    host: 'localhost',
    port: 5432,
    database: 'shipbuilder',
    retryAttempt: 3,
  }, error)

  // HTTP request logging (usually handled by middleware)
  logger.httpRequest(
    { method: 'POST', originalUrl: '/api/projects', ip: '192.168.1.1' },
    { statusCode: 201 },
    150,
    { userId: 'user-123' }
  )

  // Database operation logging
  logger.database('INSERT', 'projects', 45, {
    userId: 'user-123',
    projectId: 'proj-456',
  })

  // External API logging
  logger.externalAPI('Anthropic', 'POST', '/v1/messages', 200, 2300, {
    model: 'claude-sonnet-4',
    tokens: 1,
  })
}

// Example error scenarios
export function errorExamples() {
  try {
    // Simulated operation that might fail
    throw new Error('Validation failed: email is required')
  } catch (error) {
    logger.error('User registration failed', {
      operation: 'user_registration',
      step: 'validation',
      input: { name: 'John Doe', email: '' },
    }, error as Error)
  }

  // Warning about recoverable issues
  logger.warn('API rate limit approaching', {
    service: 'external_api',
    currentRequests: 950,
    limit: 1000,
    timeWindow: '1h',
  })

  // Performance warning for slow operations
  logger.performance('image_processing', 5500, {
    imageSize: '10MB',
    format: 'PNG',
    operation: 'resize',
  })
}