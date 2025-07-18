import { useState, useEffect } from 'react'
import { ProjectProvider } from '@/context/ProjectContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from '@/components/app-sidebar'
import { ProjectView } from '@/components/project-view'
import { TaskView } from '@/components/task-view'
import { AllTasksView } from '@/components/all-tasks-view'
import { SettingsView } from '@/components/settings-view'
import { AIAssistant } from '@/components/AIAssistant'
import { CommandMenu } from '@/components/command-menu'
import { LoginScreen } from '@/components/LoginScreen'
import { LoadingAnimation } from '@/components/ui/loading-animation'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { SidebarInset } from '@/components/ui/sidebar'
import { GlobalTaskPopout } from '@/components/GlobalTaskPopout'
import { MCPConsentScreen } from '@/pages/MCPConsentScreen'

type View = 'all-issues' | 'active' | 'backlog' | 'archived' | 'project' | 'tasks' | 'all-tasks' | 'settings'

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('all-issues')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false)
  const [initialTab, setInitialTab] = useState<'mvp' | 'chat'>('mvp')
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false)

  // Check if this is an MCP login flow
  const isMCPLogin = window.location.pathname === '/mcp-login' || 
                     new URLSearchParams(window.location.search).has('oauth_params')
  
  // Store MCP login state in localStorage to persist through auth
  useEffect(() => {
    if (isMCPLogin) {
      localStorage.setItem('mcpLoginFlow', 'true')
      // Store OAuth params if present
      const oauthParams = new URLSearchParams(window.location.search).get('oauth_params')
      if (oauthParams) {
        localStorage.setItem('mcpOAuthParams', oauthParams)
      }
    }
  }, [isMCPLogin])
  
  // Check if we're returning from auth during MCP flow
  const wasMCPLogin = localStorage.getItem('mcpLoginFlow') === 'true'
  const shouldShowMCPConsent = isMCPLogin || wasMCPLogin

  const handleViewChange = (view: View) => {
    setCurrentView(view)
    if (view !== 'tasks') {
      setSelectedProjectId(null)
    }
  }

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId)
    setCurrentView('tasks')
  }

  const handleNewProject = () => {
    setNewProjectDialogOpen(true)
  }

  // Listen for navigation events from command menu
  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      handleViewChange(e.detail as View)
    }

    const handleNavigateProject = (e: CustomEvent) => {
      handleProjectSelect(e.detail)
    }

    window.addEventListener('navigate', handleNavigate as EventListener)
    window.addEventListener('navigate-project', handleNavigateProject as EventListener)

    return () => {
      window.removeEventListener('navigate', handleNavigate as EventListener)
      window.removeEventListener('navigate-project', handleNavigateProject as EventListener)
    }
  }, [])

  // Global keyboard shortcut for command menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return
        }

        e.preventDefault()
        setCommandMenuOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Show loading animation while checking authentication
  if (loading) {
    return <LoadingAnimation />;
  }


  // Show MCP consent screen if this is an MCP OAuth flow
  if (shouldShowMCPConsent) {
    // For MCP login, user must be authenticated first
    if (!user) {
      return <LoginScreen />;
    }
    return <MCPConsentScreen />;
  }

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen />;
  }

  // Show main app if authenticated
  return (
    <ProjectProvider>
      <TooltipProvider>
        <SidebarProvider defaultOpen={true} className="sidebar-enhanced-transitions">
        <div className="flex h-screen w-full overflow-hidden">
          <AppSidebar 
            currentView={currentView}
            onViewChange={handleViewChange}
            onProjectSelect={handleProjectSelect}
            onMVPBuilderToggle={() => {
              setInitialTab('mvp')
              setAiAssistantOpen(!aiAssistantOpen)
            }}
            onNewProject={handleNewProject}
          />
          <SidebarInset>
            {currentView === 'tasks' && selectedProjectId ? (
              <TaskView 
                projectId={selectedProjectId} 
                onBack={() => handleViewChange('all-issues')} 
              />
            ) : currentView === 'all-tasks' ? (
              <AllTasksView onProjectSelect={handleProjectSelect} />
            ) : currentView === 'settings' ? (
              <SettingsView />
            ) : (
              <ProjectView 
                view={currentView} 
                onProjectSelect={handleProjectSelect}
                newProjectDialogOpen={newProjectDialogOpen}
                onNewProjectDialogChange={setNewProjectDialogOpen}
              />
            )}
          </SidebarInset>
        </div>
        <AIAssistant
          open={aiAssistantOpen}
          onOpenChange={setAiAssistantOpen}
          onClose={() => setAiAssistantOpen(false)}
          initialTab={initialTab}
        />
        <GlobalTaskPopout />
        <CommandMenu 
          open={commandMenuOpen} 
          onOpenChange={setCommandMenuOpen} 
        />
        <ConnectionStatus />
        </SidebarProvider>
      </TooltipProvider>
    </ProjectProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App