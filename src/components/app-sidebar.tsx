import { useState } from 'react';
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserProfile } from '@/components/UserProfile'
// Note: DropdownMenu temporarily commented out until @radix-ui/react-dropdown-menu is added
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { 
  Circle, 
  CircleCheckBig, 
  Plus, 
  Archive,
  Folder,
  Settings,
  LogOut,
  CheckSquare,
  Rocket,
  Trash2,
  Copy
} from 'lucide-react'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'

type View = 'all-issues' | 'active' | 'backlog' | 'archived' | 'project' | 'tasks' | 'all-tasks' | 'settings'

interface AppSidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  onProjectSelect: (projectId: string) => void
  onMVPBuilderToggle: () => void
  onNewProject: () => void
}

const navigationItems = [
  {
    id: 'all-issues' as View,
    title: 'All Projects',
    icon: Circle,
    count: null,
  },
  {
    id: 'all-tasks' as View,
    title: 'All Tasks',
    icon: CheckSquare,
    count: null,
  },
  {
    id: 'active' as View,
    title: 'Active',
    icon: CircleCheckBig,
    count: null,
  },
  {
    id: 'backlog' as View,
    title: 'Backlog',
    icon: Folder,
    count: null,
  },
  {
    id: 'archived' as View,
    title: 'Archive',
    icon: Archive,
    count: null,
  },
]

export function AppSidebar({ currentView, onViewChange, onProjectSelect, onMVPBuilderToggle, onNewProject }: AppSidebarProps) {
  const { projects, deleteProject } = useProjects()
  const { user, logout } = useAuth()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const [confirmationText, setConfirmationText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      // Handle command palette
    }
  }

  const handleDeleteProject = (project: { id: string; name: string }) => {
    console.log('Delete project clicked:', project);
    setProjectToDelete(project)
    setDeleteDialogOpen(true)
    setConfirmationText('')
  }

  const confirmDelete = async () => {
    console.log('Confirm delete called:', { projectToDelete, confirmationText });
    
    if (!projectToDelete || confirmationText !== projectToDelete.name) {
      console.log('Validation failed:', { 
        hasProject: !!projectToDelete, 
        namesMatch: confirmationText === projectToDelete?.name,
        expectedName: projectToDelete?.name,
        actualInput: confirmationText
      });
      return
    }

    console.log('Starting deletion of project:', projectToDelete.id);
    setIsDeleting(true)
    try {
      await deleteProject(projectToDelete.id)
      console.log('Project deleted successfully');
      setDeleteDialogOpen(false)
      setProjectToDelete(null)
      setConfirmationText('')
    } catch (error) {
      console.error('Failed to delete project:', error)
      // You might want to show an error toast here
    } finally {
      setIsDeleting(false)
    }
  }

  const cancelDelete = () => {
    setDeleteDialogOpen(false)
    setProjectToDelete(null)
    setConfirmationText('')
  }

  return (
    <Sidebar collapsible="icon" className="border-r" onKeyDown={handleKeyDown}>
      <SidebarHeader className="border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded overflow-hidden">
              <img src="/shipbuilder-icon.png" alt="ShipBuilder" className="h-6 w-6 object-contain rounded" />
            </div>
            <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">ShipBuilder</span>
          </div>
          <SidebarTrigger className="h-6 w-6" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Action Buttons */}
        <div className="p-3 border-b space-y-2">
          <Button
            onClick={onMVPBuilderToggle}
            className="w-full h-9 text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-0 min-w-0"
          >
            <Rocket className="w-4 h-4 group-data-[collapsible=icon]:mr-0 mr-2 flex-shrink-0" />
            <span className="group-data-[collapsible=icon]:sr-only truncate min-w-0">AI Assistant</span>
          </Button>
          <Button
            onClick={onNewProject}
            variant="outline"
            className="w-full h-9 text-sm font-medium border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-0 min-w-0"
          >
            <Plus className="w-4 h-4 group-data-[collapsible=icon]:mr-0 mr-2 flex-shrink-0" />
            <span className="group-data-[collapsible=icon]:sr-only truncate min-w-0">New Project</span>
          </Button>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentView === item.id}
                    onClick={() => onViewChange(item.id)}
                    className="h-7"
                    tooltip={item.title}
                  >
                    <item.icon className="h-8 w-8" />
                    <span className="text-xs">{item.title}</span>
                    {item.count && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {item.count}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Projects
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects
                .filter(project => project.status !== 'archived')
                .map((project) => {
                  const completedTasks = project.tasks.filter(task => task.status === 'completed').length
                  const totalTasks = project.tasks.length
                  
                  return (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton
                        onClick={() => onProjectSelect(project.id)}
                        className="h-7 group"
                        tooltip={project.name}
                      >
                        <Folder className="h-8 w-8" />
                        <span className="text-xs truncate">{project.name}</span>
                        <div className="ml-auto flex items-center gap-1 opacity-100 transition-opacity">
                          <span className="text-xs text-muted-foreground">
                            {totalTasks > 0 && `${completedTasks}/${totalTasks}`}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteProject({ id: project.id, name: project.name })
                            }}
                            title="Delete Project"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="h-7" 
              tooltip="Settings"
              onClick={() => onViewChange('settings')}
              isActive={currentView === 'settings'}
            >
              <Settings className="h-8 w-8" />
              <span className="text-xs">Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <UserProfile>
              <SidebarMenuButton 
                className="h-8 justify-start gap-2" 
                tooltip={`Profile (${user?.name})`}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage 
                    src={user?.avatar} 
                    alt={user?.name}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <AvatarFallback className="text-[10px]">
                    {user?.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-xs font-medium truncate">{user?.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
                </div>
              </SidebarMenuButton>
            </UserProfile>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="h-7 text-red-600 hover:text-red-700" 
              tooltip="Logout"
              onClick={logout}
            >
              <LogOut className="h-8 w-8" />
              <span className="text-xs">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      <SidebarRail />
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. This will permanently delete the project <strong>"{projectToDelete?.name}"</strong> and all its tasks.
              </p>
              <p className="text-sm font-medium">
                To confirm, type the project name exactly:
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-sm">{projectToDelete?.name}</code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 active:scale-95 active:bg-primary/90"
                  onClick={() => {
                    if (projectToDelete?.name) {
                      navigator.clipboard.writeText(projectToDelete.name)
                    }
                  }}
                  title="Click to copy project name"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Input
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Type project name to confirm..."
              autoFocus
              disabled={isDeleting}
            />
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={cancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={confirmDelete}
                disabled={isDeleting || confirmationText !== projectToDelete?.name}
              >
                {isDeleting ? 'Deleting...' : 'Delete Project'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}