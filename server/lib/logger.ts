import * as Sentry from '@sentry/node'

/**
 * Log levels in order of severity
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const

export type LogLevel = typeof LogLevel[keyof typeof LogLevel]

/**
 * Additional context that can be passed to logging methods
 */
export interface LogContext {
  [key: string]: any
  userId?: string
  requestId?: string
  method?: string
  url?: string
  statusCode?: number
  duration?: number
  userAgent?: string
  ip?: string
  metadata?: Record<string, any>
}

/**
 * Logger configuration for server-side logging
 */
interface ServerLoggerConfig {
  enableConsole: boolean
  enableSentry: boolean
  minLevel: LogLevel
  environment: 'development' | 'production' | 'test'
  enableStructuredLogging: boolean
}

/**
 * Server-side centralized logger utility that consolidates console and Sentry logging
 * Designed to work with Express.js and Node.js server environments
 */
class ServerLogger {
  private config: ServerLoggerConfig

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production'
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    this.config = {
      enableConsole: true,
      enableSentry: isProduction || isDevelopment,
      minLevel: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
      environment: isProduction ? 'production' : (isDevelopment ? 'development' : 'test'),
      enableStructuredLogging: isProduction,
    }
  }

  /**
   * Check if a log level meets the minimum threshold
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    return levels.indexOf(level) >= levels.indexOf(this.config.minLevel)
  }

  /**
   * Format log message for console output
   */
  private formatConsoleMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    
    if (this.config.enableStructuredLogging) {
      // Structured JSON logging for production
      return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        message,
        ...context,
      })
    } else {
      // Human-readable logs for development
      const contextStr = context ? ` | ${JSON.stringify(context, null, 2)}` : ''
      return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
    }
  }

  /**
   * Send to console if enabled
   */
  private logToConsole(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.config.enableConsole) return

    const formattedMessage = this.formatConsoleMessage(level, message, context)

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage)
        if (error) console.debug(error)
        break
      case LogLevel.INFO:
        console.info(formattedMessage)
        if (error) console.info(error)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage)
        if (error) console.warn(error)
        break
      case LogLevel.ERROR:
        console.error(formattedMessage)
        if (error) console.error(error)
        break
    }
  }

  /**
   * Send to Sentry if enabled and appropriate level
   */
  private logToSentry(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.config.enableSentry) return

    // Set additional context for Sentry
    if (context) {
      Sentry.setContext('logContext', context)
      
      // Set user context if provided
      if (context.userId) {
        Sentry.setUser({ id: context.userId })
      }

      // Set request context
      if (context.requestId || context.method || context.url) {
        Sentry.setContext('request', {
          id: context.requestId,
          method: context.method,
          url: context.url,
          userAgent: context.userAgent,
          ip: context.ip,
        })
      }

      // Set performance context
      if (context.duration || context.statusCode) {
        Sentry.setContext('performance', {
          duration: context.duration,
          statusCode: context.statusCode,
        })
      }
    }

    // Send to Sentry based on level
    switch (level) {
      case LogLevel.ERROR:
        if (error) {
          Sentry.captureException(error)
        } else {
          Sentry.captureMessage(message, 'error')
        }
        break
      case LogLevel.WARN:
        Sentry.captureMessage(message, 'warning')
        break
      case LogLevel.INFO:
        // Only send important info messages to Sentry
        if (context?.important) {
          Sentry.captureMessage(message, 'info')
        }
        break
      case LogLevel.DEBUG:
        // Debug messages are not sent to Sentry
        break
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return

    this.logToConsole(level, message, context, error)
    this.logToSentry(level, message, context, error)
  }

  /**
   * Log debug messages (development only)
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context)
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error)
  }

  /**
   * Log error messages
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error)
  }

  /**
   * Log HTTP requests with automatic context extraction
   */
  httpRequest(req: any, res: any, duration?: number, context?: LogContext): void {
    const status = res.statusCode || res.status
    const method = req.method
    const url = req.originalUrl || req.url
    const userAgent = req.get('User-Agent')
    const ip = req.ip || req.connection?.remoteAddress

    const requestContext = {
      ...context,
      method,
      url,
      statusCode: status,
      duration,
      userAgent,
      ip,
      requestId: req.id || req.headers['x-request-id'],
    }

    const message = `${method} ${url} - ${status}${duration ? ` (${duration}ms)` : ''}`

    if (status >= 500) {
      this.error(message, requestContext)
    } else if (status >= 400) {
      this.warn(message, requestContext)
    } else {
      this.info(message, requestContext)
    }
  }

  /**
   * Log database operations
   */
  database(operation: string, table: string, duration?: number, context?: LogContext): void {
    const message = `DB ${operation.toUpperCase()} ${table}${duration ? ` (${duration}ms)` : ''}`
    const dbContext = {
      ...context,
      database: { operation, table, duration },
    }

    if (duration && duration > 1000) {
      this.warn(`Slow database query: ${message}`, dbContext)
    } else {
      this.debug(message, dbContext)
    }
  }

  /**
   * Log API calls to external services
   */
  externalAPI(service: string, method: string, url: string, status?: number, duration?: number, context?: LogContext): void {
    const message = `External API ${service}: ${method.toUpperCase()} ${url}${status ? ` - ${status}` : ''}${duration ? ` (${duration}ms)` : ''}`
    const apiContext = {
      ...context,
      externalAPI: { service, method, url, status, duration },
    }
    
    if (status && status >= 400) {
      this.error(message, apiContext)
    } else if (duration && duration > 5000) {
      this.warn(`Slow external API call: ${message}`, apiContext)
    } else {
      this.debug(message, apiContext)
    }
  }

  /**
   * Log authentication events
   */
  auth(event: string, userId?: string, context?: LogContext): void {
    const message = `Auth event: ${event}`
    const authContext = {
      ...context,
      userId,
      auth: { event },
      important: true, // Auth events are important for security
    }

    if (event.includes('failed') || event.includes('error')) {
      this.error(message, authContext)
    } else {
      this.info(message, authContext)
    }
  }

  /**
   * Log user actions for analytics and debugging
   */
  userAction(action: string, component: string, context?: LogContext): void {
    const message = `User action: ${action}`
    const actionContext = {
      ...context,
      userAction: { action, component },
      important: true, // User actions are important for analytics
    }

    this.info(message, actionContext)
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    const message = `Performance: ${operation} took ${duration}ms`
    const perfContext = {
      ...context,
      performance: { operation, duration },
    }

    if (duration > 5000) {
      this.error(`Very slow operation: ${message}`, perfContext)
    } else if (duration > 1000) {
      this.warn(`Slow operation: ${message}`, perfContext)
    } else {
      this.debug(message, perfContext)
    }
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<ServerLoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): ServerLoggerConfig {
    return { ...this.config }
  }

  /**
   * Create a child logger with default context
   */
  child(defaultContext: LogContext): ServerLogger {
    const childLogger = new ServerLogger()
    childLogger.configure(this.config)
    
    // Override logging methods to include default context
    const originalLog = childLogger.log.bind(childLogger)
    childLogger.log = (level: LogLevel, message: string, context?: LogContext, error?: Error) => {
      const mergedContext = { ...defaultContext, ...context }
      return originalLog(level, message, mergedContext, error)
    }

    return childLogger
  }
}

// Export singleton instance
export const logger = new ServerLogger()

// Export class for creating child loggers
export { ServerLogger }