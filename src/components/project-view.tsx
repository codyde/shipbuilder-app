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
  Trash2,
  Settings,
  Edit
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
  const [manageDialogOpen, setManageDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [projectToManage, setProjectToManage] = useState<{ id: string; name: string; description?: string } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [editingName, setEditingName] = useState('')
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
  })


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

  const handleManageProject = (project: { id: string; name: string; description?: string }) => {
    setProjectToManage(project)
    setEditingName(project.name)
    setManageDialogOpen(true)
  }

  const handleUpdateProjectName = async () => {
    if (projectToManage && editingName.trim() && editingName.trim() !== projectToManage.name) {
      await updateProject(projectToManage.id, { name: editingName.trim() })
      setProjectToManage(prev => prev ? { ...prev, name: editingName.trim() } : null)
    }
  }

  const handleDeleteProject = () => {
    if (projectToManage) {
      setDeleteConfirmOpen(true)
      setDeleteConfirmText('')
    }
  }

  const confirmDeleteProject = async () => {
    if (projectToManage && deleteConfirmText === projectToManage.name) {
      await deleteProject(projectToManage.id)
      setDeleteConfirmOpen(false)
      setManageDialogOpen(false)
      setProjectToManage(null)
      setDeleteConfirmText('')
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

      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
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
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleManageProject({ 
                              id: project.id, 
                              name: project.name, 
                              description: project.description 
                            })
                          }}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Manage
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

      {/* Project Management Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Project Name</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="edit-name"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="Enter project name..."
                />
                <Button 
                  size="sm" 
                  onClick={handleUpdateProjectName}
                  disabled={!editingName.trim() || editingName.trim() === projectToManage?.name}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Update
                </Button>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-destructive">Danger Zone</Label>
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteProject}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. This will permanently delete the project <strong>"{projectToManage?.name}"</strong> and all its tasks.
              </p>
              <p className="text-sm font-medium">
                To confirm, type the project name exactly: <code className="bg-muted px-1 rounded text-xs">{projectToManage?.name}</code>
              </p>
            </div>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type project name to confirm..."
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setDeleteConfirmOpen(false)
                  setDeleteConfirmText('')
                }}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={confirmDeleteProject}
                disabled={deleteConfirmText !== projectToManage?.name}
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