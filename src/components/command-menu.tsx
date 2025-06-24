import { useState } from 'react'
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
  Archive,
  CheckSquare
} from 'lucide-react'
import { useProjects } from '@/context/ProjectContext'
import { logger } from '@/lib/logger'

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const { projects } = useProjects()
  const [search, setSearch] = useState('')


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
            // Navigate to all projects
            window.dispatchEvent(new CustomEvent('navigate', { detail: 'all-issues' }))
          })}>
            <Circle className="mr-2 h-4 w-4" />
            <span>All Projects</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {
            // Navigate to all tasks
            window.dispatchEvent(new CustomEvent('navigate', { detail: 'all-tasks' }))
          })}>
            <CheckSquare className="mr-2 h-4 w-4" />
            <span>All Tasks</span>
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
            <Folder className="mr-2 h-4 w-4" />
            <span>Backlog</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {
            // Navigate to archive
            window.dispatchEvent(new CustomEvent('navigate', { detail: 'archived' }))
          })}>
            <Archive className="mr-2 h-4 w-4" />
            <span>Archive</span>
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
            logger.userAction('open_settings', 'CommandMenu')
          })}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {
            // Open help
            logger.userAction('open_help', 'CommandMenu')
          })}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Help</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}