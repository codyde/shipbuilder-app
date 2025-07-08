import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface AIGenerateDialogProps {
  onGenerate: (prompt: string) => void
  isLoading: boolean
  buttonText?: string
  title?: string
  placeholder?: string
}

export function AIGenerateDialog({ 
  onGenerate, 
  isLoading,
  buttonText = "Generate with AI",
  title = "Generate Task Details with AI",
  placeholder = "e.g., 'Generate a complete build process with step-by-step implementation details, acceptance criteria, and testing strategy'"
}: AIGenerateDialogProps) {
  const [prompt, setPrompt] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim()) {
      onGenerate(prompt.trim())
      setPrompt('')
      setIsOpen(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading}>
          <Sparkles className="h-4 w-4 mr-2" />
          {isLoading ? 'Generating...' : buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="prompt">Describe what details you want to generate</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholder}
              rows={4}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!prompt.trim() || isLoading}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}