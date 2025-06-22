import * as Sentry from '@sentry/react'

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
  component?: string
  action?: string
  metadata?: Record<string, any>
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  enableConsole: boolean
  enableSentry: boolean
  minLevel: LogLevel
  environment: 'development' | 'production' | 'test'
}

/**
 * Centralized logger utility that consolidates console and Sentry logging
 */
class Logger {
  private config: LoggerConfig

  constructor() {
    // Environment detection - works in both development and production
    const isProduction = process.env.NODE_ENV === 'production'
    
    this.config = {
      enableConsole: true,
      enableSentry: isProduction, // Only enable Sentry in production
      minLevel: isProduction ? LogLevel.INFO : LogLevel.DEBUG,
      environment: isProduction ? 'production' : 'development',
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
   * Format log message with timestamp and context
   */
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  /**
   * Send to console if enabled
   */
  private logToConsole(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.config.enableConsole) return

    const formattedMessage = this.formatMessage(level, message, context)

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, error || '')
        break
      case LogLevel.INFO:
        console.info(formattedMessage, error || '')
        break
      case LogLevel.WARN:
        console.warn(formattedMessage, error || '')
        break
      case LogLevel.ERROR:
        console.error(formattedMessage, error || '')
        break
    }
  }

  /**
   * Send to Sentry if enabled and appropriate level
   */
  private logToSentry(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.config.enableSentry) return

    // Only send warnings and errors to Sentry to avoid noise
    if (level !== LogLevel.WARN && level !== LogLevel.ERROR) return

    // Set additional context for Sentry
    if (context) {
      Sentry.setContext('logContext', context)
      
      // Set user context if provided
      if (context.userId) {
        Sentry.setUser({ id: context.userId })
      }

      // Set tags for better filtering in Sentry
      if (context.component) {
        Sentry.setTag('component', context.component)
      }
      if (context.action) {
        Sentry.setTag('action', context.action)
      }
    }

    if (level === LogLevel.ERROR) {
      if (error) {
        Sentry.captureException(error)
      } else {
        Sentry.captureMessage(message, 'error')
      }
    } else if (level === LogLevel.WARN) {
      Sentry.captureMessage(message, 'warning')
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
   * Log API request/response for debugging
   */
  apiCall(method: string, url: string, status?: number, duration?: number, context?: LogContext): void {
    const message = `API ${method.toUpperCase()} ${url}${status ? ` - ${status}` : ''}${duration ? ` (${duration}ms)` : ''}`
    const apiContext = {
      ...context,
      api: { method, url, status, duration },
    }
    
    if (status && status >= 400) {
      this.error(message, apiContext)
    } else {
      this.debug(message, apiContext)
    }
  }

  /**
   * Log user interactions for analytics
   */
  userAction(action: string, component: string, context?: LogContext): void {
    this.info(`User action: ${action}`, {
      ...context,
      component,
      action,
    })
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

    if (duration > 1000) {
      this.warn(message, perfContext)
    } else {
      this.debug(message, perfContext)
    }
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const logger = new Logger()