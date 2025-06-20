import { useState, useEffect } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { 
  Circle, 
  Plus, 
  Settings, 
  HelpCircle,
  Folder,
  CheckCircle2,
  Archive
} from 'lucide-react'
import { useProjects } from '@/context/ProjectContext'

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const { projects } = useProjects()
  const [search, setSearch] = useState('')

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
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
        onOpenChange(true)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [onOpenChange])

  const runCommand = (command: () => void) => {
    onOpenChange(false)
    command()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Type a command or search..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => {
            // Open create project dialog
            const createButton = document.querySelector('[data-command="create-project"]') as HTMLButtonElement
            createButton?.click()
          })}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Create new project</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {
            // Open create task dialog
            const createButton = document.querySelector('[data-command="create-task"]') as HTMLButtonElement
            createButton?.click()
          })}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Create new task</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => {
            // Navigate to all issues
            window.dispatchEvent(new CustomEvent('navigate', { detail: 'all-issues' }))
          })}>
            <Circle className="mr-2 h-4 w-4" />
            <span>All issues</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {
            // Navigate to active
            window.dispatchEvent(new CustomEvent('navigate', { detail: 'active' }))
          })}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            <span>Active</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {
            // Navigate to backlog
            window.dispatchEvent(new CustomEvent('navigate', { detail: 'backlog' }))
          })}>
            <Archive className="mr-2 h-4 w-4" />
            <span>Backlog</span>
          </CommandItem>
        </CommandGroup>

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects
                .filter((project) =>
                  project.name.toLowerCase().includes(search.toLowerCase())
                )
                .slice(0, 5)
                .map((project) => (
                  <CommandItem
                    key={project.id}
                    onSelect={() => runCommand(() => {
                      window.dispatchEvent(new CustomEvent('navigate-project', { detail: project.id }))
                    })}
                  >
                    <Folder className="mr-2 h-4 w-4" />
                    <span>{project.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {project.tasks.length} tasks
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Other">
          <CommandItem onSelect={() => runCommand(() => {
            // Open settings
            console.log('Open settings')
          })}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {
            // Open help
            console.log('Open help')
          })}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Help</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}