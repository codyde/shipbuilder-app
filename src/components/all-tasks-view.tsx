import { useState, useMemo, useEffect } from 'react'
import { TaskHoverCard } from './TaskHoverCard'
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
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  ExternalLink
} from 'lucide-react'
import { useProjects } from '@/context/ProjectContext'
import { TaskStatus, Priority } from '@/types/types'
import { cn } from '@/lib/utils'
import { TaskDetailPanel } from './TaskDetailPanel'

interface AllTasksViewProps {
  onProjectSelect: (projectId: string) => void
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

export function AllTasksView({ onProjectSelect }: AllTasksViewProps) {
  const { projects, createTask, updateTask, deleteTask, loading, setPoppedOutTask, poppedOutTask, clearPoppedOutTask } = useProjects()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedTaskProjectId, setSelectedTaskProjectId] = useState<string | null>(null)
  const [isClosingPanel, setIsClosingPanel] = useState(false)
  const [closingTask, setClosingTask] = useState<any>(null)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: Priority.MEDIUM as Priority,
    dueDate: '',
  })

  // Aggregate all tasks from all projects (excluding archived projects)
  const allTasks = useMemo(() => {
    return projects
      .filter(project => project.status !== 'archived')
      .flatMap(project => 
        project.tasks.map(task => ({
          ...task,
          projectName: project.name,
          projectId: project.id
        }))
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [projects])

  const handleStatusChange = async (projectId: string, taskId: string, status: TaskStatus) => {
    try {
      await updateTask(projectId, taskId, { status })
    } catch (error) {
      console.error('Failed to update task status:', error)
    }
  }

  const handleDeleteTask = async (projectId: string, taskId: string, taskTitle: string) => {
    if (confirm(`Are you sure you want to delete the task "${taskTitle}"? This action cannot be undone.`)) {
      await deleteTask(projectId, taskId)
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newTask.title.trim() && selectedProjectId) {
      await createTask({
        projectId: selectedProjectId,
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
      setSelectedProjectId('')
      setIsCreateDialogOpen(false)
    }
  }

  const activeProjects = projects.filter(p => p.status !== 'archived')

  // Find the selected task
  const selectedTask = selectedTaskId && selectedTaskProjectId 
    ? projects.find(p => p.id === selectedTaskProjectId)?.tasks.find(t => t.id === selectedTaskId)
    : null

  // Check if current task is popped out
  const isPoppedOut = poppedOutTask?.projectId === selectedTaskProjectId && poppedOutTask?.taskId === selectedTaskId

  // Auto-select the popped out task when it gets minimized back to this view
  useEffect(() => {
    if (poppedOutTask && !selectedTaskId) {
      setSelectedTaskId(poppedOutTask.taskId)
      setSelectedTaskProjectId(poppedOutTask.projectId)
    }
  }, [poppedOutTask, selectedTaskId])

  const handleTaskClick = (projectId: string, taskId: string) => {
    if (selectedTaskId === taskId && selectedTaskProjectId === projectId) {
      // If clicking the same task, pop it out
      setPoppedOutTask(projectId, taskId)
    } else {
      // Select the task and show inline panel
      setSelectedTaskId(taskId)
      setSelectedTaskProjectId(projectId)
    }
  }

  const handlePopOut = () => {
    if (selectedTaskId && selectedTaskProjectId) {
      setPoppedOutTask(selectedTaskProjectId, selectedTaskId)
    }
  }

  const handleTaskClose = () => {
    setIsClosingPanel(true)
    setClosingTask(selectedTask)
    setSelectedTaskId(null)
    setSelectedTaskProjectId(null)
    clearPoppedOutTask()
    // Reset closing state after animation completes
    setTimeout(() => {
      setIsClosingPanel(false)
      setClosingTask(null)
    }, 300)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-background">
      <div className={cn("flex-1 flex flex-col transition-all duration-300 ease-in-out", (selectedTaskId || isClosingPanel) && !isPoppedOut && "mr-96")}>
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">All Tasks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {allTasks.length} {allTasks.length === 1 ? 'task' : 'tasks'} across {activeProjects.length} {activeProjects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
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
                    <Label htmlFor="project">Project</Label>
                    <Select
                      value={selectedProjectId}
                      onValueChange={setSelectedProjectId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeProjects.map(project => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    <Button type="submit" disabled={!newTask.title.trim() || !selectedProjectId}>
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
        {allTasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Circle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No tasks found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first project and add some tasks to get started
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
        ) : (
          <div className="h-full overflow-auto">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[200px]">Task</TableHead>
                  <TableHead className="w-[150px]">Project</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px]">Priority</TableHead>
                  <TableHead className="w-[120px]">Due date</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTasks.map((task) => (
                  <TableRow 
                    key={`${task.projectId}-${task.id}`}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50 border-b transition-colors",
                      selectedTaskId === task.id && selectedTaskProjectId === task.projectId && "bg-muted/30 border-l-4 border-l-primary"
                    )}
                    onClick={() => handleTaskClick(task.projectId, task.id)}
                  >
                    <TableCell>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const newStatus = task.status === TaskStatus.COMPLETED 
                            ? TaskStatus.BACKLOG 
                            : TaskStatus.COMPLETED
                          handleStatusChange(task.projectId, task.id, newStatus)
                        }}
                        className="flex items-center justify-center hover:scale-110 transition-transform"
                      >
                        {getStatusIcon(task.status)}
                      </button>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <TaskHoverCard task={task}>
                        <div className="space-y-1 cursor-help">
                        <div className={cn(
                          'font-medium text-sm break-words',
                          task.status === TaskStatus.COMPLETED && 'line-through text-muted-foreground'
                        )}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-xs text-muted-foreground break-words line-clamp-2">
                            {task.description}
                          </div>
                        )}
                        </div>
                      </TaskHoverCard>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => onProjectSelect(task.projectId)}
                        className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        {task.projectName}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={task.status}
                          onValueChange={(value: TaskStatus) => handleStatusChange(task.projectId, task.id, value)}
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
                          handleDeleteTask(task.projectId, task.id, task.title)
                        }}
                        title="Delete task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      </div>

      {/* Task Detail Panel - Only show when not popped out */}
      {(selectedTask || closingTask) && !isPoppedOut && (
        <TaskDetailPanel
          task={selectedTask || closingTask}
          isOpen={!!selectedTaskId}
          onClose={handleTaskClose}
          onPopOut={handlePopOut}
        />
      )}
    </div>
  )
}