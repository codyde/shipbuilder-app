# Logger Utility Setup Guide

This document outlines the comprehensive logging setup for both client-side and server-side logging in the ShipBuilder application.

## Overview

We now have two complementary logger utilities:
- **Client-side logger** (`src/lib/logger.ts`) - For React/browser logging with Sentry integration
- **Server-side logger** (`server/lib/logger.ts`) - For Node.js/Express logging with structured logging

## Client-Side Logger (`src/lib/logger.ts`)

### Features
- **Environment-aware**: Automatically detects dev vs production
- **Sentry integration**: Sends errors/warnings to Sentry in production
- **Console logging**: Always shows logs in development
- **Specialized methods**: API calls, user actions, performance tracking

### Usage Examples
```typescript
import { logger } from '@/lib/logger'

// Basic logging
logger.debug('Component rendered', { component: 'TaskList', taskCount: 15 })
logger.info('User authenticated', { userId: 'user-123' })
logger.warn('API rate limit approaching', { currentRequests: 95 })
logger.error('Failed to save data', { component: 'UserProfile' }, error)

// Specialized logging
logger.apiCall('GET', '/api/tasks', 200, 150, { component: 'TaskService' })
logger.userAction('create_task', 'TaskForm', { projectId: 'proj-123' })
logger.performance('render_large_list', 850, { itemCount: 1000 })
```

## Server-Side Logger (`server/lib/logger.ts`)

### Features
- **Structured logging**: JSON logs in production, readable logs in development
- **HTTP request logging**: Automatic request/response logging via middleware
- **Database operation logging**: Track query performance
- **External API logging**: Monitor third-party service calls
- **Authentication logging**: Security event tracking
- **Child loggers**: Create loggers with default context

### Usage Examples
```typescript
import { logger } from './lib/logger'

// Basic logging
logger.debug('Processing user request', { userId: 'user-123' })
logger.info('Operation completed successfully', { duration: 150 })
logger.warn('High memory usage detected', { memoryUsage: '85%' })
logger.error('Database connection failed', { host: 'localhost' }, error)

// Specialized logging
logger.httpRequest(req, res, duration, { userId: 'user-123' })
logger.database('SELECT', 'users', 45, { query: 'getUserProfile' })
logger.externalAPI('GitHub', 'GET', '/user/repos', 200, 1200)
logger.auth('login_success', 'user-123', { method: 'oauth' })
logger.performance('data_processing', 2300, { recordCount: 1000 })

// Child logger with default context
const userLogger = logger.child({ userId: 'user-123', component: 'UserService' })
userLogger.debug('Processing user preferences') // Includes userId and component automatically
```

## Middleware Integration

### Automatic Request Logging
The server includes middleware that automatically logs all HTTP requests:

```typescript
// server/middleware/logging.ts
import { loggingMiddleware, errorLoggingMiddleware } from './middleware/logging'

app.use(loggingMiddleware) // Logs all requests automatically
app.use(errorLoggingMiddleware) // Logs unhandled errors
```

### What Gets Logged Automatically
- **Incoming requests**: Method, URL, user agent, IP, user ID
- **Response completion**: Status code, duration, request ID
- **Unhandled errors**: Full error details with request context

## Configuration

### Client-Side Configuration
```typescript
// Update client logger config
logger.configure({
  enableConsole: true,
  enableSentry: false, // Override Sentry for testing
  minLevel: 'debug',
})
```

### Server-Side Configuration
```typescript
// Update server logger config
logger.configure({
  enableConsole: true,
  enableSentry: true,
  minLevel: 'info',
  enableStructuredLogging: true, // JSON logs
})
```

## Environment Behavior

### Development Environment
- **Client**: All logs to console, no Sentry
- **Server**: Readable formatted logs, no Sentry, debug level

### Production Environment
- **Client**: Errors/warnings to Sentry, info+ level
- **Server**: Structured JSON logs, Sentry integration, info+ level

## Integration with Existing Sentry Setup

Both loggers integrate seamlessly with the existing Sentry configuration:
- **Client**: Uses `@sentry/react` from `instrument.ts`
- **Server**: Uses `@sentry/node` from `server/instrument.ts`
- **No conflicts**: Works alongside existing Sentry console integration

## Best Practices

### When to Use Each Log Level

**DEBUG**: Detailed debugging information (development only)
```typescript
logger.debug('Cache hit for user profile', { cacheKey: 'profile:123' })
```

**INFO**: General application flow and important events
```typescript
logger.info('User registration completed', { userId: '123', method: 'oauth' })
```

**WARN**: Recoverable issues that need attention
```typescript
logger.warn('API rate limit approaching', { currentRequests: 95, limit: 100 })
```

**ERROR**: Actual errors requiring immediate attention
```typescript
logger.error('Payment processing failed', { orderId: '123' }, error)
```

### Context Best Practices
Always include relevant context:
```typescript
// Good
logger.error('Failed to update user profile', {
  userId: 'user-123',
  operation: 'profile_update',
  fields: ['name', 'email'],
  validationErrors: errors,
}, error)

// Bad
logger.error('Update failed', {}, error)
```

### Performance Logging
Use performance logging for operations that might be slow:
```typescript
const startTime = Date.now()
// ... expensive operation ...
logger.performance('user_export', Date.now() - startTime, {
  recordCount: 1000,
  format: 'csv',
})
```

## Files Created/Modified

### New Files
- `src/lib/logger.ts` - Client-side logger
- `src/lib/logger-examples.ts` - Client usage examples
- `server/lib/logger.ts` - Server-side logger
- `server/lib/logger-examples.ts` - Server usage examples
- `server/middleware/logging.ts` - Express logging middleware

### Modified Files
- `server/index.ts` - Added logging middleware and server startup logging
- `server/routes/projects.ts` - Added example route logging
- `src/components/TaskDetailPanel.tsx` - Updated to use new logger
- `src/components/task-view.tsx` - Updated to use new logger
- `src/components/command-menu.tsx` - Updated to use new logger
- `src/context/ProjectContext.tsx` - Added API call logging

Both loggers are now ready for use throughout the application and provide comprehensive logging capabilities for debugging, monitoring, and error tracking.