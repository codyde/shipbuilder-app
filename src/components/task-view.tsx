import { useState } from 'react'
import { KanbanBoard } from './KanbanBoard'
import { TaskDetailPanel } from './TaskDetailPanel'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Plus, 
  Circle, 
  MoreHorizontal,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  List,
  Kanban,
  Trash2
} from 'lucide-react'
import { useProjects } from '@/context/ProjectContext'
import { TaskStatus, Priority } from '@/types/types'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

interface TaskViewProps {
  projectId: string
  onBack?: () => void
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

const getStatusColor = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.COMPLETED:
      return 'text-chart-2'
    case TaskStatus.IN_PROGRESS:
      return 'text-primary'
    case TaskStatus.BACKLOG:
      return 'text-chart-3'
    default:
      return 'text-chart-3'
  }
}

const getPriorityColor = (priority: Priority) => {
  switch (priority) {
    case Priority.HIGH:
      return 'text-destructive'
    case Priority.MEDIUM:
      return 'text-chart-3'
    case Priority.LOW:
      return 'text-muted-foreground'
    default:
      return 'text-muted-foreground'
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

type ViewMode = 'list' | 'kanban'

export function TaskView({ projectId, onBack }: TaskViewProps) {
  const { projects, createTask, updateTask, deleteTask } = useProjects()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isClosingPanel, setIsClosingPanel] = useState(false)
  const [closingTask, setClosingTask] = useState<any>(null)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: Priority.MEDIUM as Priority,
    dueDate: '',
  })

  const project = projects.find(p => p.id === projectId)
  const selectedTask = selectedTaskId ? project?.tasks.find(t => t.id === selectedTaskId) : null

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newTask.title.trim()) {
      await createTask({
        projectId,
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        priority: newTask.priority,
        dueDate: newTask.dueDate || undefined,
      })
      setNewTask({
        title: '',
        description: '',
        priority: Priority.MEDIUM as Priority,
        dueDate: '',
      })
      setIsCreateDialogOpen(false)
    }
  }

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      // Make the API call - the context already handles optimistic updates
      await updateTask(projectId, taskId, { status })
    } catch (error) {
      logger.error('Failed to update task status', {
        component: 'TaskView',
        action: 'updateTaskStatus',
        taskId,
        status,
        projectId,
      }, error as Error)
      // The context will handle rollback if needed
    }
  }

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (confirm(`Are you sure you want to delete the task "${taskTitle}"? This action cannot be undone.`)) {
      await deleteTask(projectId, taskId)
    }
  }

  const handleQuickAdd = async (status: TaskStatus, title: string) => {
    try {
      await createTask({
        projectId,
        title,
        status,
        priority: Priority.MEDIUM as Priority,
      })
    } catch (error) {
      logger.error('Failed to create quick task', {
        component: 'TaskView',
        action: 'quickAdd',
        projectId,
        status,
        title,
      }, error as Error)
    }
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Project not found</div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-background">
      <div className={cn("flex-1 flex flex-col transition-all duration-300 ease-in-out", (selectedTaskId || isClosingPanel) && "mr-96")}>
        {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{project.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {project.tasks.length} {project.tasks.length === 1 ? 'task' : 'tasks'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  viewMode === 'list' && "bg-background text-foreground shadow-sm"
                )}
              >
                <List className="h-4 w-4 mr-2" />
                List
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  viewMode === 'kanban' && "bg-background text-foreground shadow-sm"
                )}
              >
                <Kanban className="h-4 w-4 mr-2" />
                Board
              </button>
            </div>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New task
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create new task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <Label htmlFor="title">Task title</Label>
                  <Input
                    id="title"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter task title..."
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Add a description..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(value: Priority) => setNewTask(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={Priority.LOW}>Low</SelectItem>
                        <SelectItem value={Priority.MEDIUM}>Medium</SelectItem>
                        <SelectItem value={Priority.HIGH}>High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dueDate">Due date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!newTask.title.trim()}>
                    Create task
                  </Button>
                </div>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {project.tasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Circle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No tasks found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by creating your first task
              </p>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create task
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="h-full overflow-auto px-6 pb-6">
            <KanbanBoard 
              tasks={project.tasks} 
              onTaskStatusChange={(taskId, newStatus) => handleStatusChange(taskId, newStatus)}
              onTaskClick={(taskId) => setSelectedTaskId(selectedTaskId === taskId ? null : taskId)}
              selectedTaskId={selectedTaskId}
              onQuickAdd={handleQuickAdd}
            />
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.tasks.map((task) => {
                  return (
                    <TableRow 
                      key={task.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 border-b transition-colors",
                        selectedTaskId === task.id && "bg-muted/30 border-l-4 border-l-primary"
                      )}
                      onClick={() => setSelectedTaskId(selectedTaskId === task.id ? null : task.id)}
                    >
                      <TableCell>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const newStatus = task.status === TaskStatus.COMPLETED 
                              ? TaskStatus.BACKLOG 
                              : TaskStatus.COMPLETED
                            handleStatusChange(task.id, newStatus)
                          }}
                          className="flex items-center justify-center hover:scale-110 transition-transform"
                        >
                          {getStatusIcon(task.status)}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className={cn(
                            'font-medium',
                            task.status === TaskStatus.COMPLETED && 'line-through text-muted-foreground'
                          )}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-sm text-muted-foreground">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={task.status}
                            onValueChange={(value: TaskStatus) => handleStatusChange(task.id, value)}
                          >
                            <SelectTrigger className={cn("w-32 h-7 text-xs capitalize", getStatusColor(task.status))}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={TaskStatus.BACKLOG}>Backlog</SelectItem>
                              <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
                              <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={cn('flex items-center gap-1 text-sm', getPriorityColor(task.priority))}>
                          {getPriorityIcon(task.priority)}
                          <span className="capitalize">{task.priority}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.dueDate ? (
                          <span className="text-sm text-muted-foreground">
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteTask(task.id, task.title)
                          }}
                          title="Delete task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
        </div>
      </div>

      {/* Task Detail Panel */}
      {(selectedTask || closingTask) && (
        <TaskDetailPanel
          task={selectedTask || closingTask}
          isOpen={!!selectedTaskId}
          onClose={() => {
            setIsClosingPanel(true)
            setClosingTask(selectedTask)
            setSelectedTaskId(null)
            // Reset closing state after animation completes
            setTimeout(() => {
              setIsClosingPanel(false)
              setClosingTask(null)
            }, 300)
          }}
        />
      )}
    </div>
  )
}