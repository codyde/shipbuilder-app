import { useState, useEffect, useRef } from 'react'
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
  Trash2
} from 'lucide-react'
import { useProjects } from '@/context/ProjectContext'
import { TaskStatus, ProjectStatus } from '@/types/types'
import { cn } from '@/lib/utils'

type View = 'all-issues' | 'active' | 'backlog' | 'archived' | 'project' | 'tasks'

interface ProjectViewProps {
  view: View
  onProjectSelect: (projectId: string) => void
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'text-blue-500'
    case 'backlog':
      return 'text-orange-500'
    case 'completed':
      return 'text-green-500'
    case 'archived':
      return 'text-gray-500'
    default:
      return 'text-gray-500'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <Circle className="h-3 w-3 fill-current" />
    default:
      return <Circle className="h-3 w-3" />
  }
}

export function ProjectView({ view, onProjectSelect }: ProjectViewProps) {
  const { projects, createProject, updateProject, deleteProject, loading } = useProjects()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
  })
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null)
      }
    }

    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activeDropdown])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newProject.name.trim()) {
      await createProject({
        name: newProject.name.trim(),
        description: newProject.description.trim() || undefined,
      })
      setNewProject({ name: '', description: '' })
      setIsCreateDialogOpen(false)
    }
  }

  const getViewTitle = () => {
    switch (view) {
      case 'all-issues':
        return 'All Projects'
      case 'active':
        return 'Active'
      case 'backlog':
        return 'Backlog'
      case 'archived':
        return 'Archive'
      default:
        return 'Projects'
    }
  }

  const handleDeleteProject = (projectId: string, projectName: string) => {
    setProjectToDelete({ id: projectId, name: projectName })
    setDeleteConfirmOpen(true)
    setActiveDropdown(null)
  }

  const confirmDeleteProject = async () => {
    if (projectToDelete) {
      await deleteProject(projectToDelete.id)
      setDeleteConfirmOpen(false)
      setProjectToDelete(null)
    }
  }

  const handleStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    await updateProject(projectId, { status: newStatus })
  }

  const filteredProjects = projects.filter(project => {
    switch (view) {
      case 'active':
        return project.status === 'active'
      case 'backlog':
        return project.status === 'backlog'
      case 'archived':
        return project.status === 'archived'
      case 'all-issues':
        // Hide archived projects from main view
        return project.status !== 'archived'
      default:
        return project.status !== 'archived'
    }
  })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{getViewTitle()}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create new project</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Project name</Label>
                    <Input
                      id="name"
                      value={newProject.name}
                      onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter project name..."
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newProject.description}
                      onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Add a description..."
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!newProject.name.trim()}>
                      Create project
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-2 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {filteredProjects.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Circle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No projects found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by creating your first project
              </p>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create project
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
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => {
                const completedTasks = project.tasks.filter(task => task.status === TaskStatus.COMPLETED).length
                const totalTasks = project.tasks.length
                const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

                return (
                  <TableRow 
                    key={project.id}
                    className="cursor-pointer hover:bg-muted/50 border-b"
                    onClick={() => onProjectSelect(project.id)}
                  >
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {getStatusIcon(project.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{project.name}</div>
                        {project.description && (
                          <div className="text-sm text-muted-foreground">
                            {project.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={project.status}
                        onValueChange={(value: ProjectStatus) => handleStatusChange(project.id, value)}
                      >
                        <SelectTrigger className={cn(
                          "w-fit h-auto py-1 px-2 border-none bg-transparent hover:bg-muted/50 text-sm capitalize",
                          getStatusColor(project.status)
                        )}>
                          <SelectValue>
                            {project.status.replace('_', ' ')}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ProjectStatus.ACTIVE}>Active</SelectItem>
                          <SelectItem value={ProjectStatus.BACKLOG}>Backlog</SelectItem>
                          <SelectItem value={ProjectStatus.COMPLETED}>Completed</SelectItem>
                          <SelectItem value={ProjectStatus.ARCHIVED}>Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {totalTasks === 0 ? '—' : `${completedTasks}/${totalTasks}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8">
                          {progress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveDropdown(activeDropdown === project.id ? null : project.id)
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        {activeDropdown === project.id && (
                          <div 
                            ref={dropdownRef}
                            className="absolute right-0 top-8 z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteProject(project.id, project.name)
                              }}
                              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-destructive/10 hover:text-destructive text-left"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete project
                            </button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>"{projectToDelete?.name}"</strong>? 
              This action cannot be undone and will permanently remove the project and all its tasks.
            </p>
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={confirmDeleteProject}
              >
                Delete Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}