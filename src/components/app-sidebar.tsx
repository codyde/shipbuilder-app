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
import { Input } from '@/components/ui/input'
import { 
  Circle, 
  CircleCheckBig, 
  MoreHorizontal, 
  Plus, 
  Search,
  Archive,
  Folder,
  Settings,
  HelpCircle,
  Command,
  MessageCircle,
  LogOut
} from 'lucide-react'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'

type View = 'all-issues' | 'active' | 'backlog' | 'archived' | 'project' | 'tasks' | 'settings'

interface AppSidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  onProjectSelect: (projectId: string) => void
  onChatToggle: () => void
}

const navigationItems = [
  {
    id: 'all-issues' as View,
    title: 'All Projects',
    icon: Circle,
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

export function AppSidebar({ currentView, onViewChange, onProjectSelect, onChatToggle }: AppSidebarProps) {
  const { projects } = useProjects()
  const { user, logout } = useAuth()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      // Handle command palette
    }
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
        
        <div className="relative mt-2 group-data-[collapsible=icon]:hidden">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search or jump to..."
            className="h-7 pl-7 text-xs"
            onFocus={() => {}}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
              <Command className="h-2 w-2" />K
            </kbd>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
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
          <SidebarGroupLabel className="text-xs text-muted-foreground flex items-center justify-between group-data-[collapsible=icon]:hidden">
            Projects
            <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
              <Plus className="h-3 w-3" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects.map((project) => {
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
                      <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-muted-foreground">
                          {totalTasks > 0 && `${completedTasks}/${totalTasks}`}
                        </span>
                        <div 
                          className="inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground h-4 w-4 cursor-pointer transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            // Add menu functionality here
                          }}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </div>
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
              tooltip="AI Chat"
              onClick={onChatToggle}
            >
              <MessageCircle className="h-8 w-8" />
              <span className="text-xs">AI Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
            <SidebarMenuButton className="h-7" tooltip="Help">
              <HelpCircle className="h-8 w-8" />
              <span className="text-xs">Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="h-7 text-red-600 hover:text-red-700" 
              tooltip={`Logout (${user?.name})`}
              onClick={logout}
            >
              <LogOut className="h-8 w-8" />
              <span className="text-xs">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      <SidebarRail />
    </Sidebar>
  )
}