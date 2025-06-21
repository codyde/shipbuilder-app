import { useState, useEffect } from 'react'
import { ProjectProvider } from '@/context/ProjectContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ProjectView } from '@/components/project-view'
import { TaskView } from '@/components/task-view'
import { SettingsView } from '@/components/settings-view'
import { ChatInterface } from '@/components/ChatInterface'
import { CommandMenu } from '@/components/command-menu'

type View = 'all-issues' | 'active' | 'backlog' | 'archived' | 'project' | 'tasks' | 'settings'

function App() {
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

  return (
    <ThemeProvider>
      <ProjectProvider>
        <SidebarProvider defaultOpen={true}>
          <div className="flex h-screen w-full">
            <AppSidebar 
              currentView={currentView}
              onViewChange={handleViewChange}
              onProjectSelect={handleProjectSelect}
              onChatToggle={() => setChatOpen(!chatOpen)}
            />
            <main className="flex-1 overflow-hidden">
              {currentView === 'tasks' && selectedProjectId ? (
                <TaskView projectId={selectedProjectId} />
              ) : currentView === 'settings' ? (
                <SettingsView />
              ) : (
                <ProjectView view={currentView} onProjectSelect={handleProjectSelect} />
              )}
            </main>
          </div>
          {chatOpen && <ChatInterface />}
          <CommandMenu 
            open={commandMenuOpen} 
            onOpenChange={setCommandMenuOpen} 
          />
        </SidebarProvider>
      </ProjectProvider>
    </ThemeProvider>
  )
}

export default App