import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, Loader2, Rocket, Package, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MVPProgressStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  type: 'planning' | 'project' | 'task';
  icon?: React.ReactNode;
}

interface MVPProgressBarProps {
  steps: MVPProgressStep[];
  currentStepIndex: number;
  className?: string;
  showDescription?: boolean;
  compact?: boolean;
}

const getStepIcon = (step: MVPProgressStep) => {
  if (step.icon) return step.icon;
  
  switch (step.type) {
    case 'planning':
      return <Rocket className="h-4 w-4" />;
    case 'project':
      return <Package className="h-4 w-4" />;
    case 'task':
      return <Code className="h-4 w-4" />;
    default:
      return <Circle className="h-4 w-4" />;
  }
};

const getStatusIcon = (status: MVPProgressStep['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'in-progress':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'error':
      return <Circle className="h-4 w-4 text-red-500" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
};

export function MVPProgressBar({ 
  steps, 
  currentStepIndex, 
  className, 
  showDescription = true,
  compact = false 
}: MVPProgressBarProps) {
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const progressPercentage = Math.round((completedSteps / steps.length) * 100);
  
  if (compact) {
    return (
      <div className={cn("w-full space-y-2", className)}>
        {/* Compact Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <span className="text-sm font-medium text-gray-600 min-w-[4rem] text-right">
            {completedSteps}/{steps.length}
          </span>
        </div>
        
        {/* Current Step Info */}
        <AnimatePresence mode="wait">
          {currentStepIndex < steps.length && (
            <motion.div
              key={currentStepIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 text-sm"
            >
              {getStatusIcon(steps[currentStepIndex]?.status)}
              <span className="text-gray-700">{steps[currentStepIndex]?.title}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Overall Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Creating MVP Project</h3>
          <span className="text-sm font-medium text-gray-600">
            {completedSteps}/{steps.length} Complete ({progressPercentage}%)
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Step List */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all duration-200",
                {
                  "bg-green-50 border-green-200": step.status === 'completed',
                  "bg-blue-50 border-blue-200": step.status === 'in-progress',
                  "bg-red-50 border-red-200": step.status === 'error',
                  "bg-gray-50 border-gray-200": step.status === 'pending',
                }
              )}
            >
              {/* Status Icon */}
              <div className="mt-0.5">
                {getStatusIcon(step.status)}
              </div>
              
              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {getStepIcon(step)}
                  <span className={cn(
                    "font-medium text-sm",
                    {
                      "text-green-800": step.status === 'completed',
                      "text-blue-800": step.status === 'in-progress',
                      "text-red-800": step.status === 'error',
                      "text-gray-600": step.status === 'pending',
                    }
                  )}>
                    {step.title}
                  </span>
                </div>
                
                {showDescription && step.description && (
                  <p className={cn(
                    "text-xs mt-1",
                    {
                      "text-green-600": step.status === 'completed',
                      "text-blue-600": step.status === 'in-progress',
                      "text-red-600": step.status === 'error',
                      "text-gray-500": step.status === 'pending',
                    }
                  )}>
                    {step.description}
                  </p>
                )}
              </div>
              
              {/* Step Type Badge */}
              <div className={cn(
                "px-2 py-1 rounded-md text-xs font-medium",
                {
                  "bg-purple-100 text-purple-700": step.type === 'planning',
                  "bg-blue-100 text-blue-700": step.type === 'project',
                  "bg-green-100 text-green-700": step.type === 'task',
                }
              )}>
                {step.type}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Utility function to create progress steps from MVP plan
export function createMVPProgressSteps(mvpPlan: {
  projectName: string;
  description: string;
  tasks: Array<{ title: string; description: string; priority: string; }>;
}): MVPProgressStep[] {
  const steps: MVPProgressStep[] = [];
  
  // Planning step
  steps.push({
    id: 'planning-complete',
    title: 'MVP Plan Generated',
    description: `Created plan for "${mvpPlan.projectName}" with ${mvpPlan.tasks.length} tasks`,
    status: 'completed',
    type: 'planning',
    icon: <Rocket className="h-4 w-4" />
  });

  // Project creation step
  steps.push({
    id: 'create-project',
    title: `Create Project: ${mvpPlan.projectName}`,
    description: 'Setting up the main project structure and configuration',
    status: 'pending',
    type: 'project',
    icon: <Package className="h-4 w-4" />
  });

  // Task creation steps
  mvpPlan.tasks.forEach((task, index) => {
    steps.push({
      id: `create-task-${index}`,
      title: `Create Task: ${task.title}`,
      description: task.description.length > 100 
        ? task.description.substring(0, 100) + '...'
        : task.description,
      status: 'pending',
      type: 'task',
      icon: <Code className="h-4 w-4" />
    });
  });

  return steps;
}