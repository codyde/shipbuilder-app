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
import { ComponentsView } from '@/components/components-view'
import { SettingsView } from '@/components/settings-view'
import { AIAssistant } from '@/components/AIAssistant'
import { CommandMenu } from '@/components/command-menu'
import { LoginScreen } from '@/components/LoginScreen'
import { LoadingAnimation } from '@/components/ui/loading-animation'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { SidebarInset } from '@/components/ui/sidebar'
import { MCPConsentScreen } from '@/pages/MCPConsentScreen'
import { MCPConsentPage } from '@/pages/MCPConsentPage'

type View = 'all-issues' | 'active' | 'backlog' | 'archived' | 'project' | 'tasks' | 'all-tasks' | 'components' | 'settings'

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
                     new URLSearchParams(window.location.search).has('oauth_params') ||
                     new URLSearchParams(window.location.search).has('mcp_state')
  
  // Check if this is the new MCP consent flow
  const urlParams = new URLSearchParams(window.location.search);
  const hasAuthIdInUrl = urlParams.has('auth_id');
  const hasAuthIdInStorage = localStorage.getItem('mcpAuthId');
  const isOAuthCallback = urlParams.has('success') && urlParams.has('token');
  
  const isMCPConsent = window.location.pathname === '/mcp-consent' || 
                       hasAuthIdInUrl ||
                       (isOAuthCallback && hasAuthIdInStorage)
  
  // Debug logging for MCP flow detection
  useEffect(() => {
    console.log('MCP Flow Debug:', {
      pathname: window.location.pathname,
      search: window.location.search,
      isMCPLogin,
      isMCPConsent,
      hasAuthIdInUrl,
      hasAuthIdInStorage: !!hasAuthIdInStorage,
      isOAuthCallback,
      hasOAuthParams: new URLSearchParams(window.location.search).has('oauth_params'),
      hasMcpState: new URLSearchParams(window.location.search).has('mcp_state'),
      hasAuthId: new URLSearchParams(window.location.search).has('auth_id'),
      hasToken: new URLSearchParams(window.location.search).has('token'),
      hasAuthCode: new URLSearchParams(window.location.search).has('authorization_code'),
      wasMCPLogin: localStorage.getItem('mcpLoginFlow') === 'true'
    });
  }, [isMCPLogin, isMCPConsent]);
  
  // Store MCP login state in localStorage to persist through auth
  useEffect(() => {
    if (isMCPLogin) {
      localStorage.setItem('mcpLoginFlow', 'true')
      // Store OAuth params if present
      const oauthParams = new URLSearchParams(window.location.search).get('oauth_params')
      if (oauthParams) {
        localStorage.setItem('mcpOAuthParams', oauthParams)
      }
      // Store MCP state if present
      const mcpState = new URLSearchParams(window.location.search).get('mcp_state')
      if (mcpState) {
        localStorage.setItem('mcpState', mcpState)
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


  // Show new MCP consent page if this is the new MCP flow
  if (isMCPConsent) {
    return <MCPConsentPage />;
  }

  // Show old MCP consent screen if this is the old MCP OAuth flow
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
            ) : currentView === 'components' ? (
              <ComponentsView />
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