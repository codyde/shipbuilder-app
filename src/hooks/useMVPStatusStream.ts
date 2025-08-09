import { useState, useCallback, useRef } from 'react';
import { StatusMessage } from '@/components/ui/tool-status-display';
import { getApiUrl } from '@/lib/api-config';
import { MVPProgressStep } from '@/components/ui/mvp-progress-bar';
import { useProjects } from '@/context/ProjectContext';
import { Project, Task } from '@/types/types';

interface MVPPlan {
  projectName: string;
  description: string;
  features: string[];
  techStack: {
    frontend: string;
    backend: string;
    database: string;
    hosting?: string;
  };
  tasks: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }[];
}

interface UseMVPStatusStreamOptions {
  onStatusUpdate?: (status: StatusMessage) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onProgressUpdate?: (steps: MVPProgressStep[], currentIndex: number) => void;
}

export function useMVPStatusStream(options: UseMVPStatusStreamOptions = {}) {
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [createdTasksCount, setCreatedTasksCount] = useState(0);
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [progressSteps, setProgressSteps] = useState<MVPProgressStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { addProjectRealtime, addTaskRealtime } = useProjects();

  const addStatusMessage = useCallback((message: StatusMessage) => {
    setStatusMessages(prev => [...prev, message]);
    options.onStatusUpdate?.(message);

    // Update progress steps based on tool operations
    if (message.type === 'tool-success') {
      // Handle the new combined createMVPProject tool
      if (message.operation === 'createMVPProject') {
        // This tool creates both project and all tasks
        const data = message.data as any;
        if (data?.data) {
          const { projectId, projectName, tasksCreated, totalTasks } = data.data;
          
          // Mark project as completed
          setProgressSteps(prev => prev.map(step => {
            if (step.type === 'project') {
              return { ...step, status: 'completed' as const };
            }
            // Mark all tasks as completed
            if (step.type === 'task') {
              return { ...step, status: 'completed' as const };
            }
            return step;
          }));
          
          // Update counts
          setCreatedTasksCount(tasksCreated || 0);
          setTotalTasksCount(totalTasks || 0);
          setCurrentStepIndex(progressSteps.length - 1);
          
          console.log(`[MVP_STATUS] Project "${projectName}" created with ${tasksCreated}/${totalTasks} tasks`);
        }
      } else if (message.operation === 'createProject') {
        // Project created - update progress and add to UI
        setProgressSteps(prev => prev.map((step, index) => {
          if (step.type === 'project') {
            return { ...step, status: 'completed' as const };
          }
          return step;
        }));
        setCurrentStepIndex(2); // Move to first task

        // Add project to UI in real-time (robustly extract id/name)
        if (message.data && typeof message.data === 'object') {
          const dataAny: any = message.data;
          const projectId = dataAny?.data?.id || dataAny?.projectId || dataAny?.id;
          const projectName = dataAny?.data?.name || dataAny?.name || 'New Project';
          const projectDescription = dataAny?.data?.description || dataAny?.description || '';
          const projectUserId = dataAny?.data?.userId || dataAny?.userId || 'unknown';
          if (projectId) {
            const project: Project = {
              id: projectId as string,
              name: projectName as string,
              description: projectDescription as string,
              status: 'active',
              userId: projectUserId as string,
              tasks: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            addProjectRealtime(project);
          }
        }
      } else if (message.operation === 'createTask') {
        // Task created - update progress and add to UI
        setCreatedTasksCount(prev => {
          const newCount = prev + 1;
          const nextStepIndex = 1 + newCount; // 1 for project + tasks created
          
          setProgressSteps(prevSteps => prevSteps.map((step, index) => {
            if (step.type === 'task' && index === nextStepIndex - 1) {
              return { ...step, status: 'completed' as const };
            }
            return step;
          }));
          setCurrentStepIndex(nextStepIndex);
          
          return newCount;
        });

        // Add task to UI in real-time
        if (message.data && typeof message.data === 'object' && 'id' in message.data && 'projectId' in message.data) {
          const task: Task = {
            id: message.data.id as string,
            title: message.data.title as string || 'New Task',
            description: message.data.description as string || '',
            status: 'backlog',
            priority: (message.data.priority as 'low' | 'medium' | 'high') || 'medium',
            projectId: message.data.projectId as string,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          addTaskRealtime(message.data.projectId as string, task);
        }
      } else if (message.operation === 'createAllTasks') {
        // All tasks created at once - mark all task steps as completed
        if (message.data && typeof message.data === 'object' && 'count' in message.data) {
          const taskCount = message.data.count as number;
          setCreatedTasksCount(taskCount);
          
          // Mark all task steps as completed
          setProgressSteps(prevSteps => prevSteps.map((step) => {
            if (step.type === 'task') {
              return { ...step, status: 'completed' as const };
            }
            return step;
          }));
          setCurrentStepIndex(progressSteps.length - 1);
        }
      }
    } else if (message.type === 'tool-start') {
      // Mark current step as in-progress
      if (message.operation === 'createMVPProject') {
        // Mark both project and all tasks as in-progress
        setProgressSteps(prev => prev.map((step) => {
          if (step.type === 'project' || step.type === 'task') {
            return { ...step, status: 'in-progress' as const };
          }
          return step;
        }));
        setCurrentStepIndex(1);
      } else if (message.operation === 'createProject') {
        setProgressSteps(prev => prev.map((step, index) => {
          if (step.type === 'project') {
            return { ...step, status: 'in-progress' as const };
          }
          return step;
        }));
        setCurrentStepIndex(1);
      } else if (message.operation === 'createTask') {
        setProgressSteps(prev => prev.map((step, index) => {
          if (step.type === 'task' && step.status === 'pending') {
            return { ...step, status: 'in-progress' as const };
          }
          return step;
        }));
      } else if (message.operation === 'createAllTasks') {
        // Mark all task steps as in-progress when createAllTasks starts
        setProgressSteps(prev => prev.map((step) => {
          if (step.type === 'task') {
            return { ...step, status: 'in-progress' as const };
          }
          return step;
        }));
      }
    }

    // Check for completion
    if (message.type === 'stream-complete') {
      setIsComplete(true);
      setIsCreating(false);
      options.onComplete?.();
    }

    // Trigger progress update callback
    options.onProgressUpdate?.(progressSteps, currentStepIndex);
  }, [options, progressSteps, currentStepIndex, addProjectRealtime, addTaskRealtime]);

  const clearStatusMessages = useCallback(() => {
    setStatusMessages([]);
    setCreatedTasksCount(0);
    setTotalTasksCount(0);
    setIsComplete(false);
    setProgressSteps([]);
    setCurrentStepIndex(0);
  }, []);

  const createMVPProject = useCallback(async (mvpPlan: MVPPlan) => {
    setIsCreating(true);
    setIsComplete(false);
    setCreatedTasksCount(0);
    setTotalTasksCount(mvpPlan.tasks.length);
    clearStatusMessages();

    // Initialize progress steps
    const steps: MVPProgressStep[] = [];
    
    // Planning step (already completed)
    steps.push({
      id: 'planning-complete',
      title: 'MVP Plan Generated',
      description: `Created plan for "${mvpPlan.projectName}" with ${mvpPlan.tasks.length} tasks`,
      status: 'completed',
      type: 'planning',
    });

    // Project creation step
    steps.push({
      id: 'create-project',
      title: `Create Project: ${mvpPlan.projectName}`,
      description: 'Setting up the main project structure and configuration',
      status: 'pending',
      type: 'project',
    });

    // Task creation steps
    mvpPlan.tasks.forEach((task, index) => {
      steps.push({
        id: `create-task-${index}`,
        title: `Create Task: ${task.title}`,
        description: task.description.length > 80 
          ? task.description.substring(0, 80) + '...'
          : task.description,
        status: 'pending',
        type: 'task',
      });
    });

    setProgressSteps(steps);
    setCurrentStepIndex(0);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token missing. Please log in again.');
      }

      const response = await fetch(getApiUrl('ai/create-mvp-project'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          // Hint proxies/browsers not to buffer
          'Accept': 'text/event-stream, application/json;q=0.5, */*;q=0.1',
        },
        body: JSON.stringify({ mvpPlan }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error || response.statusText;
        
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Failed to create MVP project: ${errorMessage}`);
        }
      }

      // Log response headers for debugging
      console.log('[MVP_STREAM][client] response headers', {
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type'),
        transferEncoding: response.headers.get('transfer-encoding'),
        cacheControl: response.headers.get('cache-control'),
      });

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const start = Date.now();
      let sawFirstChunk = false;
       
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (!sawFirstChunk) {
            sawFirstChunk = true;
            console.log('[MVP_STREAM][client] first chunk after', Date.now() - start, 'ms');
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines; keep the last partial line in buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line) continue;
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                // Accept our legacy custom events and AI SDK v5 native events
                if (data.type === 'tool-call' && data.toolName) {
                  // Map to tool-start
                  const operation = data.toolName as string;
                  const args = data.args;
                  let message = `🔧 Executing ${operation}...`;
                  if (operation === 'createMVPProject' && args?.name) {
                    message = `🚀 Creating project "${args.name}" with ${args?.tasks?.length || 0} tasks...`;
                  } else if (operation === 'createProject' && args?.name) {
                    message = `🚀 Creating project: ${args.name}...`;
                  } else if (operation === 'createTask' && args?.title) {
                    message = `📝 Creating task: ${args.title}...`;
                  } else if (operation === 'createAllTasks' && args?.tasks) {
                    message = `📝 Creating ${args.tasks.length} tasks...`;
                  }
                  addStatusMessage({
                    type: 'tool-start',
                    operation,
                    status: 'starting',
                    message,
                    data: { toolName: operation, args }
                  });
                } else if (data.type === 'tool-result' && data.toolName) {
                  // Map to tool-success/error
                  const operation = data.toolName as string;
                  let resultObj: any = data.result;
                  try {
                    if (typeof resultObj === 'string') resultObj = JSON.parse(resultObj);
                  } catch {}
                  const isError = resultObj && resultObj.success === false;
                  let successMessage = `✅ ${operation} completed successfully`;
                  if (!isError && operation === 'createMVPProject' && resultObj?.data) {
                    const { projectName, tasksCreated, totalTasks } = resultObj.data;
                    successMessage = `✅ Created project "${projectName}" with ${tasksCreated}/${totalTasks} tasks`;
                  }
                  addStatusMessage({
                    type: isError ? 'tool-error' : 'tool-success',
                    operation,
                    status: isError ? 'error' : 'success',
                    message: isError ? `❌ ${operation} failed` : successMessage,
                    data: resultObj || data.result
                  });
                } else if (
                  data.type === 'response.reasoning.delta' ||
                  data.type === 'reasoning.delta' ||
                  data.type === 'response.output_text.delta' ||
                  data.type === 'response.text.delta' ||
                  data.type === 'text.delta'
                ) {
                  const delta: string =
                    typeof data.delta === 'string'
                      ? data.delta
                      : typeof data.textDelta === 'string'
                        ? data.textDelta
                        : '';
                  if (delta) {
                    addStatusMessage({
                      type: 'status',
                      status: 'running',
                      message: `💭 ${delta}`,
                    });
                  }
                } else if (data.type === 'response.finish') {
                  addStatusMessage({
                    type: 'stream-complete',
                    status: 'success',
                    message: 'Operation completed',
                  });
                } else if (data.type && ['status', 'tool-start', 'tool-success', 'tool-error', 'stream-complete'].includes(data.type)) {
                  const statusMessage: StatusMessage = {
                    type: data.type,
                    operation: data.operation,
                    status: data.status,
                    message: data.message,
                    data: data.data,
                    timestamp: data.timestamp
                  };
                  addStatusMessage(statusMessage);
                }
                // Log every SDK event we receive for debugging
                console.log('[MVP_STREAM][client] event', data?.type, data?.toolName ? `(${data.toolName})` : '');
              } catch {
                // Ignore malformed JSON lines
              }
            }
          }
        }
        // Process any remaining buffered complete event
        if (buffer.startsWith('data: ')) {
          try {
            const data = JSON.parse(buffer.slice(6));
            if (data.type === 'response.finish') {
              addStatusMessage({ type: 'stream-complete', status: 'success', message: 'Operation completed' });
            }
          } catch {
            // ignore leftover partial
          }
        }
      } finally {
        reader.releaseLock();
      }

      // If we didn't get a completion message, send one
      if (!isComplete) {
        addStatusMessage({
          type: 'stream-complete',
          status: 'success',
          message: `🎉 MVP "${mvpPlan.projectName}" created successfully!`,
          data: {
            projectName: mvpPlan.projectName,
            taskCount: mvpPlan.tasks.length
          }
        });
      }

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Request was aborted, don't show error
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to create MVP project. Please try again.';
      options.onError?.(errorMessage);
      
      addStatusMessage({
        type: 'tool-error',
        status: 'error',
        message: `❌ MVP creation failed: ${errorMessage}`,
        data: { error: errorMessage }
      });
      
      setIsCreating(false);
    } finally {
      abortControllerRef.current = null;
    }
  }, [addStatusMessage, clearStatusMessages, isComplete, options]);

  const cancelCreation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsCreating(false);
    addStatusMessage({
      type: 'tool-error',
      status: 'error',
      message: '❌ MVP creation cancelled by user',
      data: { error: 'Cancelled' }
    });
  }, [addStatusMessage]);

  const getProgress = useCallback(() => {
    if (totalTasksCount === 0) return 0;
    return Math.round((createdTasksCount / totalTasksCount) * 100);
  }, [createdTasksCount, totalTasksCount]);

  return {
    statusMessages,
    isCreating,
    isComplete,
    createdTasksCount,
    totalTasksCount,
    progress: getProgress(),
    progressSteps,
    currentStepIndex,
    createMVPProject,
    cancelCreation,
    clearStatusMessages,
    addStatusMessage
  };
}