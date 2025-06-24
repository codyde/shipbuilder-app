import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { Task, TaskStatus } from '@/types/types';
import { cn } from '@/lib/utils';

interface TaskHoverCardProps {
  task: Task;
  children: React.ReactNode;
}

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

          {/* Due Date */}
          {task.dueDate && (
            <div className="pt-2 border-t">
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(task.dueDate).toLocaleDateString()}
              </Badge>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}