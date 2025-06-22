/**
 * Logger Usage Examples
 * 
 * This file demonstrates how to use the centralized logger utility
 * throughout the application. Import the logger and use the appropriate
 * method for your logging needs.
 */

import { logger, LogLevel } from './logger'

// =============================================================================
// BASIC LOGGING
// =============================================================================

/**
 * Debug logging (development only)
 * Use for detailed debugging information, variable dumps, etc.
 */
export function debugExample() {
  logger.debug('Component rendered', {
    component: 'TaskList',
    taskCount: 15,
    filters: { status: 'active', priority: 'high' }
  })
}

/**
 * Info logging
 * Use for general information about application flow
 */
export function infoExample() {
  logger.info('User authenticated successfully', {
    component: 'AuthContext',
    userId: 'user-123',
    loginMethod: 'oauth'
  })
}

/**
 * Warning logging
 * Use for recoverable errors or concerning conditions
 */
export function warningExample() {
  logger.warn('API rate limit approaching', {
    component: 'ApiClient',
    currentRequests: 95,
    limit: 100,
    timeWindow: '1 hour'
  })
}

/**
 * Error logging
 * Use for actual errors that need attention
 */
export function errorExample() {
  try {
    // Some operation that might fail
    throw new Error('Failed to save user preferences')
  } catch (error) {
    logger.error('Failed to save user preferences', {
      component: 'UserProfile',
      action: 'savePreferences',
      userId: 'user-123',
    }, error as Error)
  }
}

// =============================================================================
// SPECIALIZED LOGGING METHODS
// =============================================================================

/**
 * API Call logging
 * Automatically logs API requests with timing and status
 */
export function apiLoggingExample() {
  // This is automatically handled in ProjectContext.tsx
  // but you can also manually log API calls:
  
  const startTime = performance.now()
  
  fetch('/api/tasks')
    .then(response => {
      const duration = performance.now() - startTime
      logger.apiCall('GET', '/api/tasks', response.status, duration, {
        component: 'TaskService',
        cacheHit: false
      })
      return response.json()
    })
    .catch(error => {
      const duration = performance.now() - startTime
      logger.apiCall('GET', '/api/tasks', undefined, duration, {
        component: 'TaskService',
        error: error.message
      })
    })
}

/**
 * User Action logging
 * Track user interactions for analytics and debugging
 */
export function userActionExample() {
  // Log when user clicks a button
  logger.userAction('create_task', 'TaskForm', {
    projectId: 'project-123',
    taskType: 'feature',
    priority: 'high'
  })
  
  // Log navigation events
  logger.userAction('navigate_to_project', 'Navigation', {
    projectId: 'project-456',
    source: 'sidebar'
  })
  
  // Log form submissions
  logger.userAction('submit_settings', 'SettingsPage', {
    changedFields: ['theme', 'notifications'],
    formValid: true
  })
}

/**
 * Performance logging
 * Track slow operations and performance metrics
 */
export function performanceExample() {
  const startTime = performance.now()
  
  // Simulate some expensive operation
  setTimeout(() => {
    const duration = performance.now() - startTime
    
    logger.performance('render_large_task_list', duration, {
      component: 'TaskList',
      taskCount: 1000,
      renderType: 'virtual'
    })
  }, 500)
}

// =============================================================================
// REAL-WORLD SCENARIOS
// =============================================================================

/**
 * Form submission with validation
 */
export function formSubmissionExample() {
  const formData = { title: '', description: 'Task description' }
  
  // Log form submission attempt
  logger.userAction('submit_task_form', 'CreateTaskForm', {
    hasTitle: Boolean(formData.title),
    hasDescription: Boolean(formData.description)
  })
  
  // Validation failed
  if (!formData.title) {
    logger.warn('Form validation failed', {
      component: 'CreateTaskForm',
      action: 'validateForm',
      errors: ['title_required']
    })
    return
  }
  
  // Success
  logger.info('Task created successfully', {
    component: 'CreateTaskForm',
    action: 'createTask',
    taskData: { hasTitle: true, hasDescription: true }
  })
}

/**
 * Component lifecycle logging
 */
export function componentLifecycleExample() {
  // Component mount
  logger.debug('Component mounted', {
    component: 'TaskDetailPanel',
    taskId: 'task-123',
    renderCount: 1
  })
  
  // State changes
  logger.debug('Component state updated', {
    component: 'TaskDetailPanel',
    stateChange: 'editing_enabled',
    previousState: 'viewing'
  })
  
  // Component unmount
  logger.debug('Component unmounted', {
    component: 'TaskDetailPanel',
    timeOnScreen: 45000, // 45 seconds
    userInteractions: 3
  })
}

/**
 * Error boundary usage
 */
export function errorBoundaryExample() {
  // This would typically be in an Error Boundary component
  logger.error('Component crashed', {
    component: 'TaskList',
    action: 'render',
    errorBoundary: true,
    metadata: {
      reactVersion: '19.1.0',
      userAgent: navigator.userAgent
    }
  }, new Error('Cannot read property of undefined'))
}

// =============================================================================
// CONFIGURATION EXAMPLES
// =============================================================================

/**
 * Runtime configuration changes
 */
export function configurationExample() {
  // Check current config
  const currentConfig = logger.getConfig()
  console.log('Current logger config:', currentConfig)
  
  // Update configuration (rarely needed)
  logger.configure({
    enableConsole: false, // Disable console logging
    minLevel: LogLevel.WARN // Only show warnings and errors
  })
  
  // Log will respect new configuration
  logger.info('This will not appear in console') // Won't show due to config
  logger.warn('This will appear') // Will show
}