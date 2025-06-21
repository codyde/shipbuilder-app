import { useState } from 'react'
import * as React from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Task, TaskStatus, Priority, Subtask } from '@/types/types'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  Clock,
  Circle,
  AlertCircle,
  Calendar,
} from 'lucide-react'

interface KanbanBoardProps {
  tasks: Task[]
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void
}

interface KanbanColumnProps {
  title: string
  status: TaskStatus
  tasks: Task[]
  count: number
}

interface KanbanTaskProps {
  task: Task
}

const getStatusIcon = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.COMPLETED:
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case TaskStatus.IN_PROGRESS:
      return <Clock className="h-4 w-4 text-blue-500" />
    case TaskStatus.BACKLOG:
      return <Circle className="h-4 w-4 text-amber-500" />
    default:
      return <Circle className="h-4 w-4 text-amber-500" />
  }
}

const getPriorityColor = (priority: Priority) => {
  switch (priority) {
    case Priority.HIGH:
      return 'border-l-red-500'
    case Priority.MEDIUM:
      return 'border-l-yellow-500'
    case Priority.LOW:
      return 'border-l-gray-400'
    default:
      return 'border-l-gray-400'
  }
}

const getStatusColor = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.BACKLOG:
      return 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
    case TaskStatus.IN_PROGRESS:
      return 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20'
    case TaskStatus.COMPLETED:
      return 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
    default:
      return 'border-border bg-card'
  }
}

const getPriorityIcon = (priority: Priority) => {
  switch (priority) {
    case Priority.HIGH:
      return <AlertCircle className="h-3 w-3 text-red-500" />
    case Priority.MEDIUM:
      return <Circle className="h-3 w-3 text-yellow-500" />
    case Priority.LOW:
      return <Circle className="h-3 w-3 text-gray-500" />
    default:
      return <Circle className="h-3 w-3 text-gray-500" />
  }
}

function KanbanTask({ task }: KanbanTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const subtasks = task.subtasks || []
  const completedSubtasks = subtasks.filter((st: Subtask) => st.status === TaskStatus.COMPLETED).length
  const totalSubtasks = subtasks.length

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      <Card className={cn(
        'mb-3 border-l-4 transition-all duration-200 hover:shadow-md',
        getPriorityColor(task.priority),
        getStatusColor(task.status)
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(task.status)}
              <h4 className={cn(
                'font-medium text-sm',
                task.status === TaskStatus.COMPLETED && 'line-through text-muted-foreground'
              )}>
                {task.title}
              </h4>
            </div>
            <div className="flex items-center gap-1">
              {getPriorityIcon(task.priority)}
            </div>
          </div>
          
          {task.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {task.description}
            </p>
          )}
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {task.dueDate && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date(task.dueDate).toLocaleDateString()}
                </Badge>
              )}
            </div>
            
            {totalSubtasks > 0 && (
              <Badge variant="secondary" className="text-xs">
                {completedSubtasks}/{totalSubtasks} subtasks
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function KanbanColumn({ title, status, tasks, count }: KanbanColumnProps) {
  const taskIds = tasks.map(task => task.id)
  
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  })

  return (
    <div className="flex flex-col h-full min-w-80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span>{title}</span>
          <Badge variant="secondary" className="text-xs">
            {count}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 pt-0">
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-32 rounded-lg transition-colors",
            isOver && "bg-muted/50"
          )}
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-0">
              {tasks.map((task) => (
                <KanbanTask key={task.id} task={task} />
              ))}
            </div>
          </SortableContext>
          
          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-32 border-2 border-dashed border-muted rounded-lg">
              <p className="text-sm text-muted-foreground">No tasks</p>
            </div>
          )}
        </div>
      </CardContent>
    </div>
  )
}

export function KanbanBoard({ tasks, onTaskStatusChange }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>(tasks)
  
  // Update optimistic tasks when props change
  React.useEffect(() => {
    setOptimisticTasks(tasks)
  }, [tasks])
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const backlogTasks = optimisticTasks.filter(task => task.status === TaskStatus.BACKLOG)
  const inProgressTasks = optimisticTasks.filter(task => task.status === TaskStatus.IN_PROGRESS)
  const completedTasks = optimisticTasks.filter(task => task.status === TaskStatus.COMPLETED)

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const task = optimisticTasks.find(t => t.id === active.id)
    setActiveTask(task || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const taskId = active.id as string
    const newStatus = over.id as TaskStatus

    // Check if the task is being dropped in a valid column
    if (Object.values(TaskStatus).includes(newStatus)) {
      const task = optimisticTasks.find(t => t.id === taskId)
      if (task && task.status !== newStatus) {
        // Optimistic update - immediately update the UI
        const updatedTasks = optimisticTasks.map(t => 
          t.id === taskId ? { ...t, status: newStatus } : t
        )
        setOptimisticTasks(updatedTasks)
        
        // Then make the API call
        onTaskStatusChange(taskId, newStatus)
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 h-full overflow-x-auto pb-4">
        <Card className="bg-muted/20 border-muted">
          <KanbanColumn
            title="Backlog"
            status={TaskStatus.BACKLOG}
            tasks={backlogTasks}
            count={backlogTasks.length}
          />
        </Card>
        
        <Card className="bg-muted/20 border-muted">
          <KanbanColumn
            title="In Progress"
            status={TaskStatus.IN_PROGRESS}
            tasks={inProgressTasks}
            count={inProgressTasks.length}
          />
        </Card>
        
        <Card className="bg-muted/20 border-muted">
          <KanbanColumn
            title="Completed"
            status={TaskStatus.COMPLETED}
            tasks={completedTasks}
            count={completedTasks.length}
          />
        </Card>
      </div>

      <DragOverlay>
        {activeTask ? <KanbanTask task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  )
}