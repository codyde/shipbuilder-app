import { useState } from 'react'
import * as React from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
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
  dragOverInfo: {
    overId: string | null
    overType: 'task' | 'column' | null
    insertIndex?: number
  }
  optimisticTasks: Task[]
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
  } = useSortable({ 
    id: task.id,
    data: {
      type: 'task',
      task: task,
    }
  })

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
          'border-l-4 transition-all duration-200 cursor-pointer group',
          'hover:shadow-md hover:shadow-primary/10 hover:-translate-y-0.5',
          'hover:border-l-primary/70 hover:bg-card/80',
          getPriorityColor(task.priority),
          getStatusColor(task.status),
          isSelected && 'ring-2 ring-primary ring-offset-1 shadow-md scale-[1.02]',
          isDragging && 'rotate-2 shadow-xl shadow-primary/20'
        )}
        onClick={(e) => {
          e.stopPropagation()
          onTaskClick?.(task.id)
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              {getStatusIcon(task.status)}
              <h4 className={cn(
                'font-medium text-sm leading-tight truncate',
                task.status === TaskStatus.COMPLETED && 'line-through text-muted-foreground'
              )}>
                {task.title}
              </h4>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {getPriorityIcon(task.priority)}
            </div>
          </div>
          
          {task.description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
              {task.description.length > 80 ? `${task.description.substring(0, 80)}...` : task.description}
            </p>
          )}
          
          <div className="flex items-center justify-between text-xs mt-2">
            <div className="flex items-center gap-2">
              {task.dueDate && (
                <Badge variant="outline" className="text-xs h-5">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date(task.dueDate).toLocaleDateString()}
                </Badge>
              )}
            </div>
            
            {totalSubtasks > 0 && (
              <Badge variant="secondary" className="text-xs h-5">
                {completedSubtasks}/{totalSubtasks}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function KanbanColumn({ title, status, tasks, count, onTaskClick, selectedTaskId, onQuickAdd, dragOverInfo, optimisticTasks }: KanbanColumnProps) {
  const taskIds = tasks.map(task => task.id)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddTitle, setQuickAddTitle] = useState('')
  
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'column',
      status: status,
    },
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
    <div className="flex flex-col h-full w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-base font-medium">
          <span>{title}</span>
          <Badge variant="secondary" className="text-xs">
            {count}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 pt-0 flex flex-col">
        {/* Quick Add Section - Moved to top */}
        <div className="pb-3 border-b border-muted/50">
          {showQuickAdd ? (
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <Input
                value={quickAddTitle}
                onChange={(e) => setQuickAddTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Task title..."
                className="text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={!quickAddTitle.trim()}>
                  Add
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-3 text-xs"
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
              className="w-full h-9 text-sm text-muted-foreground hover:text-foreground border border-dashed border-transparent hover:border-muted-foreground/50 transition-all"
              onClick={() => setShowQuickAdd(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add task
            </Button>
          )}
        </div>
        
        {/* Task List Section */}
        <div 
          ref={setNodeRef}
          className={cn(
            "flex-1 pt-3 rounded-lg transition-all duration-300 overflow-y-auto",
            isOver && "bg-primary/10 border-2 border-dashed border-primary/30 shadow-inner"
          )}
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 p-3 min-h-0">
              {tasks.map((task, index) => {
                // Find the target task to determine which column we're in
                const targetTask = optimisticTasks.find(t => t.id === dragOverInfo.overId)
                const isCurrentColumn = targetTask?.status === status
                
                const showPlaceholderAbove = 
                  dragOverInfo.overType === 'task' && 
                  dragOverInfo.insertIndex === index &&
                  isCurrentColumn
                
                const showPlaceholderBelow = 
                  dragOverInfo.overType === 'task' && 
                  dragOverInfo.insertIndex === index + 1 &&
                  isCurrentColumn
                
                return (
                  <div key={task.id}>
                    {showPlaceholderAbove && (
                      <div className="h-2 bg-primary/20 border-2 border-dashed border-primary rounded-md mb-3 transition-all duration-200" />
                    )}
                    <KanbanTask 
                      task={task} 
                      onTaskClick={onTaskClick}
                      isSelected={selectedTaskId === task.id}
                    />
                    {showPlaceholderBelow && (
                      <div className="h-2 bg-primary/20 border-2 border-dashed border-primary rounded-md mt-3 transition-all duration-200" />
                    )}
                  </div>
                )
              })}
              
              {/* Show placeholder at the end if dropping on empty column */}
              {dragOverInfo.overType === 'column' && 
               dragOverInfo.overId === status && 
               tasks.length > 0 && (
                <div className="h-2 bg-primary/20 border-2 border-dashed border-primary rounded-md mt-3 transition-all duration-200" />
              )}
            </div>
          </SortableContext>
          
          {tasks.length === 0 && !showQuickAdd && (
            <div className="flex flex-col items-center justify-center min-h-64 border-2 border-dashed border-muted rounded-lg hover:border-muted-foreground/50 transition-colors m-3">
              <Circle className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No tasks</p>
              <p className="text-xs text-muted-foreground/70">Drag tasks here or click + to add</p>
            </div>
          )}
        </div>
      </CardContent>
    </div>
  )
}

export function KanbanBoard({ tasks, onTaskStatusChange, onTaskClick, selectedTaskId, onQuickAdd }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>(tasks)
  const [dragOverInfo, setDragOverInfo] = useState<{
    overId: string | null
    overType: 'task' | 'column' | null
    insertIndex?: number
  }>({ overId: null, overType: null })
  
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

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    
    if (!over || !active) {
      setDragOverInfo({ overId: null, overType: null })
      return
    }

    const draggedTask = optimisticTasks.find(t => t.id === active.id)
    if (!draggedTask) return

    if (over.data.current?.type === 'column') {
      // Dragging over a column
      setDragOverInfo({
        overId: over.id as string,
        overType: 'column'
      })
    } else {
      // Dragging over a task
      const targetTask = optimisticTasks.find(t => t.id === over.id)
      if (targetTask) {
        const targetColumnTasks = optimisticTasks.filter(t => t.status === targetTask.status)
        const targetIndex = targetColumnTasks.findIndex(t => t.id === over.id)
        
        let insertIndex: number
        if (draggedTask.status === targetTask.status) {
          // Same column - calculate relative position
          const currentIndex = targetColumnTasks.findIndex(t => t.id === active.id)
          insertIndex = currentIndex < targetIndex ? targetIndex : targetIndex + 1
        } else {
          // Different column - insert after target
          insertIndex = targetIndex + 1
        }
        
        setDragOverInfo({
          overId: over.id as string,
          overType: 'task',
          insertIndex
        })
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    setDragOverInfo({ overId: null, overType: null })

    if (!over) return

    const taskId = active.id as string
    const draggedTask = optimisticTasks.find(t => t.id === taskId)
    if (!draggedTask) return

    let newStatus: TaskStatus
    let insertIndex: number | undefined

    // Check if we're dropping on a column (droppable) or a task (sortable)
    if (over.data.current?.type === 'column') {
      // Dropped on a column - use the column's status, append to end
      newStatus = over.data.current.status
    } else {
      // Dropped on a task - find which column that task belongs to and insert at that position
      const targetTask = optimisticTasks.find(t => t.id === over.id)
      if (targetTask) {
        newStatus = targetTask.status
        
        // Use the same calculation as handleDragOver
        const targetColumnTasks = optimisticTasks.filter(t => t.status === targetTask.status)
        const targetIndex = targetColumnTasks.findIndex(t => t.id === over.id)
        
        if (draggedTask.status === targetTask.status) {
          // Same column - calculate relative position
          const currentIndex = targetColumnTasks.findIndex(t => t.id === taskId)
          insertIndex = currentIndex < targetIndex ? targetIndex : targetIndex + 1
        } else {
          // Different column - insert after target
          insertIndex = targetIndex + 1
        }
      } else {
        return
      }
    }

    // Update the task list with proper sorting
    if (Object.values(TaskStatus).includes(newStatus)) {
      let updatedTasks = [...optimisticTasks]
      
      // Remove the dragged task from its current position
      updatedTasks = updatedTasks.filter(t => t.id !== taskId)
      
      // Update the task's status
      const updatedTask = { ...draggedTask, status: newStatus }
      
      // Insert the task at the correct position
      if (insertIndex !== undefined) {
        // Insert at specific position - use the same filtered array approach
        const targetColumnTasks = updatedTasks.filter(t => t.status === newStatus)
        const otherTasks = updatedTasks.filter(t => t.status !== newStatus)
        
        const newColumnTasks = [
          ...targetColumnTasks.slice(0, insertIndex),
          updatedTask,
          ...targetColumnTasks.slice(insertIndex)
        ]
        
        updatedTasks = [...otherTasks, ...newColumnTasks]
      } else {
        // Append to the end of the column
        updatedTasks.push(updatedTask)
      }
      
      setOptimisticTasks(updatedTasks)
      
      // Only call API if status changed
      if (draggedTask.status !== newStatus) {
        onTaskStatusChange(taskId, newStatus)
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 pb-4 px-2 w-full min-w-0 overflow-x-auto min-h-0 flex-1">
        <Card className="bg-muted/20 border-muted flex flex-col flex-1 min-w-72">
          <KanbanColumn
            title="Backlog"
            status={TaskStatus.BACKLOG}
            tasks={backlogTasks}
            count={backlogTasks.length}
            onTaskClick={onTaskClick}
            selectedTaskId={selectedTaskId}
            onQuickAdd={onQuickAdd}
            dragOverInfo={dragOverInfo}
            optimisticTasks={optimisticTasks}
          />
        </Card>
        
        <Card className="bg-muted/20 border-muted flex flex-col flex-1 min-w-72">
          <KanbanColumn
            title="In Progress"
            status={TaskStatus.IN_PROGRESS}
            tasks={inProgressTasks}
            count={inProgressTasks.length}
            onTaskClick={onTaskClick}
            selectedTaskId={selectedTaskId}
            onQuickAdd={onQuickAdd}
            dragOverInfo={dragOverInfo}
            optimisticTasks={optimisticTasks}
          />
        </Card>
        
        <Card className="bg-muted/20 border-muted flex flex-col flex-1 min-w-72">
          <KanbanColumn
            title="Completed"
            status={TaskStatus.COMPLETED}
            tasks={completedTasks}
            count={completedTasks.length}
            onTaskClick={onTaskClick}
            selectedTaskId={selectedTaskId}
            onQuickAdd={onQuickAdd}
            dragOverInfo={dragOverInfo}
            optimisticTasks={optimisticTasks}
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