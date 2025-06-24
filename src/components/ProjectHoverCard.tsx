import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Calendar, Activity, CheckCircle } from 'lucide-react';
import { Project, ProjectStatus, TaskStatus } from '@/types/types';
import { cn } from '@/lib/utils';

interface ProjectHoverCardProps {
  project: Project;
  children: React.ReactNode;
}

const getStatusColor = (status: ProjectStatus) => {
  switch (status) {
    case ProjectStatus.ACTIVE:
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case ProjectStatus.COMPLETED:
      return 'bg-green-100 text-green-800 border-green-200';
    case ProjectStatus.BACKLOG:
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case ProjectStatus.ARCHIVED:
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusIcon = (status: ProjectStatus) => {
  switch (status) {
    case ProjectStatus.ACTIVE:
      return <Activity className="w-3 h-3" />;
    case ProjectStatus.COMPLETED:
      return <CheckCircle className="w-3 h-3" />;
    default:
      return <Activity className="w-3 h-3" />;
  }
};

export function ProjectHoverCard({ project, children }: ProjectHoverCardProps) {
  const completedTasks = project.tasks.filter(task => task.status === TaskStatus.COMPLETED).length;
  const totalTasks = project.tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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
              project.status === ProjectStatus.COMPLETED && 'line-through text-muted-foreground'
            )}>
              {project.name}
            </h4>
          </div>

          {/* Description */}
          {project.description && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Description:</span>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          )}

          {/* Progress */}
          {totalTasks > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Progress:</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {completedTasks}/{totalTasks} ({progress}%)
                </span>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {/* Status */}
            <Badge 
              variant="outline" 
              className={cn("text-xs capitalize flex items-center gap-1", getStatusColor(project.status))}
            >
              {getStatusIcon(project.status)}
              {project.status.replace('_', ' ')}
            </Badge>

            {/* Created Date */}
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Created {new Date(project.createdAt).toLocaleDateString()}
            </Badge>

            {/* Task Count */}
            {totalTasks > 0 && (
              <Badge variant="outline" className="text-xs">
                {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}
              </Badge>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}