import { useState } from 'react'
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
  Filter,
  Search,
  ChevronDown,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react'
import { useProjects } from '@/context/ProjectContext'
import { TaskStatus, Priority } from '@/types/types'
import { cn } from '@/lib/utils'

interface TaskViewProps {
  projectId: string
}

const getStatusIcon = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.COMPLETED:
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case TaskStatus.IN_PROGRESS:
      return <Clock className="h-4 w-4 text-blue-500" />
    default:
      return <Circle className="h-4 w-4 text-gray-400" />
  }
}

const getPriorityColor = (priority: Priority) => {
  switch (priority) {
    case Priority.HIGH:
      return 'text-red-500'
    case Priority.MEDIUM:
      return 'text-yellow-500'
    case Priority.LOW:
      return 'text-gray-500'
    default:
      return 'text-gray-500'
  }
}

const getPriorityIcon = (priority: Priority) => {
  switch (priority) {
    case Priority.HIGH:
      return <AlertCircle className="h-3 w-3" />
    case Priority.MEDIUM:
      return <Circle className="h-3 w-3" />
    case Priority.LOW:
      return <Circle className="h-3 w-3" />
    default:
      return <Circle className="h-3 w-3" />
  }
}

export function TaskView({ projectId }: TaskViewProps) {
  const { projects, createTask, updateTask } = useProjects()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: Priority.MEDIUM,
    dueDate: '',
  })

  const project = projects.find(p => p.id === projectId)

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
        priority: Priority.MEDIUM,
        dueDate: '',
      })
      setIsCreateDialogOpen(false)
    }
  }

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    await updateTask(projectId, taskId, { status })
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Project not found</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">
              {project.tasks.length} {project.tasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                className="pl-8 w-64"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
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

      {/* Content */}
      <div className="flex-1 overflow-auto">
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
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Subtasks</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {project.tasks.map((task) => {
                const completedSubtasks = task.subtasks.filter(st => st.status === TaskStatus.COMPLETED).length
                const totalSubtasks = task.subtasks.length

                return (
                  <TableRow 
                    key={task.id}
                    className="cursor-pointer hover:bg-muted/50 border-b"
                  >
                    <TableCell>
                      <button
                        onClick={() => {
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
                      <Select
                        value={task.status}
                        onValueChange={(value: TaskStatus) => handleStatusChange(task.id, value)}
                      >
                        <SelectTrigger className="w-32 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TaskStatus.BACKLOG}>Backlog</SelectItem>
                          <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
                          <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
                        </SelectContent>
                      </Select>
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
                      {totalSubtasks > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {completedSubtasks}/{totalSubtasks}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Handle more actions
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}