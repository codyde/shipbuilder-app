import { useState, useEffect } from 'react'
import { ProjectProvider } from '@/context/ProjectContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ProjectView } from '@/components/project-view'
import { TaskView } from '@/components/task-view'
import { SettingsView } from '@/components/settings-view'
import { ChatInterface } from '@/components/ChatInterface'
import { CommandMenu } from '@/components/command-menu'
import { LoginScreen } from '@/components/LoginScreen'
import { LoadingAnimation } from '@/components/ui/loading-animation'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { SidebarInset } from '@/components/ui/sidebar'

type View = 'all-issues' | 'active' | 'backlog' | 'archived' | 'project' | 'tasks' | 'settings'

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('all-issues')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

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

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen />;
  }

  // Show main app if authenticated
  return (
    <ProjectProvider>
      <SidebarProvider defaultOpen={true} className="sidebar-enhanced-transitions">
        <div className="flex h-screen w-full">
          <AppSidebar 
            currentView={currentView}
            onViewChange={handleViewChange}
            onProjectSelect={handleProjectSelect}
            onChatToggle={() => setChatOpen(!chatOpen)}
          />
          <SidebarInset>
            {currentView === 'tasks' && selectedProjectId ? (
              <TaskView 
                projectId={selectedProjectId} 
                onBack={() => handleViewChange('all-issues')} 
              />
            ) : currentView === 'settings' ? (
              <SettingsView />
            ) : (
              <ProjectView view={currentView} onProjectSelect={handleProjectSelect} />
            )}
          </SidebarInset>
        </div>
        {chatOpen && <ChatInterface onClose={() => setChatOpen(false)} />}
        <CommandMenu 
          open={commandMenuOpen} 
          onOpenChange={setCommandMenuOpen} 
        />
        <ConnectionStatus />
      </SidebarProvider>
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