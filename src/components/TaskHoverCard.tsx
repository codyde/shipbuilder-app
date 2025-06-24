import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Calendar, Flag } from 'lucide-react';
import { Task, TaskStatus, Priority } from '@/types/types';
import { cn } from '@/lib/utils';

interface TaskHoverCardProps {
  task: Task;
  children: React.ReactNode;
}

const getPriorityColor = (priority: Priority) => {
  switch (priority) {
    case Priority.HIGH:
      return 'bg-red-100 text-red-800 border-red-200';
    case Priority.MEDIUM:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case Priority.LOW:
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusColor = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.COMPLETED:
      return 'bg-green-100 text-green-800 border-green-200';
    case TaskStatus.IN_PROGRESS:
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case TaskStatus.BACKLOG:
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function TaskHoverCard({ task, children }: TaskHoverCardProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent 
        side="right" 
        className="bg-background text-foreground border shadow-lg p-0 w-80 max-w-80"
        sideOffset={10}
      >
        <div className="p-4 space-y-3">
          {/* Title */}
          <div>
            <h4 className={cn(
              'font-semibold text-sm leading-tight',
              task.status === TaskStatus.COMPLETED && 'line-through text-muted-foreground'
            )}>
              {task.title}
            </h4>
          </div>

          {/* Description */}
          {task.description && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Description:</span>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {/* Status */}
            <Badge 
              variant="outline" 
              className={cn("text-xs capitalize", getStatusColor(task.status))}
            >
              {task.status.replace('_', ' ')}
            </Badge>

            {/* Priority */}
            <Badge 
              variant="outline" 
              className={cn("text-xs capitalize flex items-center gap-1", getPriorityColor(task.priority))}
            >
              <Flag className="w-3 h-3" />
              {task.priority}
            </Badge>

            {/* Due Date */}
            {task.dueDate && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(task.dueDate).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}