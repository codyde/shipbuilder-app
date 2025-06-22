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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Task, TaskStatus, Priority, Subtask } from '@/types/types'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  Clock,
  Circle,
  AlertCircle,
  Calendar,
  Plus,
} from 'lucide-react'

interface KanbanBoardProps {
  tasks: Task[]
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void
  onTaskClick?: (taskId: string) => void
  selectedTaskId?: string | null
  onQuickAdd?: (status: TaskStatus, title: string) => void
}

interface KanbanColumnProps {
  title: string
  status: TaskStatus
  tasks: Task[]
  count: number
  onTaskClick?: (taskId: string) => void
  selectedTaskId?: string | null
  onQuickAdd?: (status: TaskStatus, title: string) => void
}

interface KanbanTaskProps {
  task: Task
  onTaskClick?: (taskId: string) => void
  isSelected?: boolean
}

const getStatusIcon = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.COMPLETED:
      return <CheckCircle2 className="h-4 w-4 text-chart-2" />
    case TaskStatus.IN_PROGRESS:
      return <Clock className="h-4 w-4 text-primary" />
    case TaskStatus.BACKLOG:
      return <Circle className="h-4 w-4 text-chart-3" />
    default:
      return <Circle className="h-4 w-4 text-chart-3" />
  }
}

const getPriorityColor = (priority: Priority) => {
  switch (priority) {
    case Priority.HIGH:
      return 'border-l-destructive'
    case Priority.MEDIUM:
      return 'border-l-chart-3'
    case Priority.LOW:
      return 'border-l-muted-foreground'
    default:
      return 'border-l-muted-foreground'
  }
}

const getStatusColor = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.BACKLOG:
      return 'border-chart-3/30 bg-chart-3/5'
    case TaskStatus.IN_PROGRESS:
      return 'border-primary/30 bg-primary/5'
    case TaskStatus.COMPLETED:
      return 'border-chart-2/30 bg-chart-2/5'
    default:
      return 'border-border bg-card'
  }
}

const getPriorityIcon = (priority: Priority) => {
  switch (priority) {
    case Priority.HIGH:
      return <AlertCircle className="h-3 w-3 text-destructive" />
    case Priority.MEDIUM:
      return <Circle className="h-3 w-3 text-chart-3" />
    case Priority.LOW:
      return <Circle className="h-3 w-3 text-muted-foreground" />
    default:
      return <Circle className="h-3 w-3 text-muted-foreground" />
  }
}

function KanbanTask({ task, onTaskClick, isSelected }: KanbanTaskProps) {
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
      <Card 
        className={cn(
          'mb-3 border-l-4 transition-all duration-300 cursor-pointer group',
          'hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5',
          'hover:border-l-primary/70 hover:bg-card/80 backdrop-blur-sm',
          getPriorityColor(task.priority),
          getStatusColor(task.status),
          isSelected && 'ring-2 ring-primary ring-offset-2 shadow-lg scale-[1.02]',
          isDragging && 'rotate-2 shadow-2xl shadow-primary/20'
        )}
        onClick={(e) => {
          e.stopPropagation()
          onTaskClick?.(task.id)
        }}
      >
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

function KanbanColumn({ title, status, tasks, count, onTaskClick, selectedTaskId, onQuickAdd }: KanbanColumnProps) {
  const taskIds = tasks.map(task => task.id)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddTitle, setQuickAddTitle] = useState('')
  
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  })

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (quickAddTitle.trim() && onQuickAdd) {
      onQuickAdd(status, quickAddTitle.trim())
      setQuickAddTitle('')
      setShowQuickAdd(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowQuickAdd(false)
      setQuickAddTitle('')
    }
  }

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
      
      <CardContent className="flex-1 pt-0 flex flex-col">
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-32 rounded-lg transition-all duration-300 flex-1",
            isOver && "bg-primary/10 border-2 border-dashed border-primary/30 shadow-inner"
          )}
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-0">
              {tasks.map((task) => (
                <KanbanTask 
                  key={task.id} 
                  task={task} 
                  onTaskClick={onTaskClick}
                  isSelected={selectedTaskId === task.id}
                />
              ))}
            </div>
          </SortableContext>
          
          {tasks.length === 0 && !showQuickAdd && (
            <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-muted rounded-lg hover:border-muted-foreground/50 transition-colors">
              <Circle className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground mb-1">No tasks</p>
              <p className="text-xs text-muted-foreground/70">Drag tasks here or click + to add</p>
            </div>
          )}
        </div>
        
        {/* Quick Add Section */}
        <div className="mt-3 pt-2 border-t border-muted/50">
          {showQuickAdd ? (
            <form onSubmit={handleQuickAdd} className="space-y-2">
              <Input
                value={quickAddTitle}
                onChange={(e) => setQuickAddTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Task title..."
                className="text-sm"
                autoFocus
              />
              <div className="flex gap-1">
                <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={!quickAddTitle.trim()}>
                  Add
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setShowQuickAdd(false)
                    setQuickAddTitle('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs text-muted-foreground hover:text-foreground border border-dashed border-transparent hover:border-muted-foreground/50 transition-all"
              onClick={() => setShowQuickAdd(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add task
            </Button>
          )}
        </div>
      </CardContent>
    </div>
  )
}

export function KanbanBoard({ tasks, onTaskStatusChange, onTaskClick, selectedTaskId, onQuickAdd }: KanbanBoardProps) {
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
            onTaskClick={onTaskClick}
            selectedTaskId={selectedTaskId}
            onQuickAdd={onQuickAdd}
          />
        </Card>
        
        <Card className="bg-muted/20 border-muted">
          <KanbanColumn
            title="In Progress"
            status={TaskStatus.IN_PROGRESS}
            tasks={inProgressTasks}
            count={inProgressTasks.length}
            onTaskClick={onTaskClick}
            selectedTaskId={selectedTaskId}
            onQuickAdd={onQuickAdd}
          />
        </Card>
        
        <Card className="bg-muted/20 border-muted">
          <KanbanColumn
            title="Completed"
            status={TaskStatus.COMPLETED}
            tasks={completedTasks}
            count={completedTasks.length}
            onTaskClick={onTaskClick}
            selectedTaskId={selectedTaskId}
            onQuickAdd={onQuickAdd}
          />
        </Card>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rotate-3 scale-105">
            <KanbanTask task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}