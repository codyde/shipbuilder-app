import { useState, useEffect, useRef } from 'react'
import { 
  X, 
  MessageSquare, 
  Calendar,
  Flag,
  User,
  Clock,
  Sparkles,
  Send
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Task, TaskStatus, Priority, Comment } from '@/types/types'
import { useProjects } from '@/context/ProjectContext'
import { cn } from '@/lib/utils'

interface TaskDetailPanelProps {
  task: Task
  isOpen: boolean
  onClose: () => void
}

interface AIGenerateDialogProps {
  onGenerate: (prompt: string) => void
  isLoading: boolean
}

function AIGenerateDialog({ onGenerate, isLoading }: AIGenerateDialogProps) {
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
          {isLoading ? 'Generating...' : 'Generate with AI'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Task Details with AI</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="prompt">Describe what details you want to generate</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., 'Create a detailed implementation plan for this task with acceptance criteria and technical requirements'"
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

export function TaskDetailPanel({ task, isOpen, onClose }: TaskDetailPanelProps) {
  const { updateTask } = useProjects()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({
    title: task.title,
    description: task.description || '',
    details: task.details || '',
    priority: task.priority,
    dueDate: task.dueDate || '',
  })
  const [newComment, setNewComment] = useState('')
  const [comments, setComments] = useState<Comment[]>(task.comments || [])
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false)
  const detailsTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditValues({
      title: task.title,
      description: task.description || '',
      details: task.details || '',
      priority: task.priority,
      dueDate: task.dueDate || '',
    })
    setComments(task.comments || [])
  }, [task])

  const handleSave = async (field: string) => {
    const updates: Partial<Task> = {}
    
    switch (field) {
      case 'title':
        if (editValues.title.trim() !== task.title) {
          updates.title = editValues.title.trim()
        }
        break
      case 'description':
        if (editValues.description !== (task.description || '')) {
          updates.description = editValues.description || undefined
        }
        break
      case 'details':
        if (editValues.details !== (task.details || '')) {
          updates.details = editValues.details || undefined
        }
        break
      case 'priority':
        if (editValues.priority !== task.priority) {
          updates.priority = editValues.priority
        }
        break
      case 'dueDate':
        if (editValues.dueDate !== (task.dueDate || '')) {
          updates.dueDate = editValues.dueDate || undefined
        }
        break
    }

    if (Object.keys(updates).length > 0) {
      await updateTask(task.projectId, task.id, updates)
    }
    
    setEditingField(null)
  }

  const handleCancel = (field: string) => {
    switch (field) {
      case 'title':
        setEditValues(prev => ({ ...prev, title: task.title }))
        break
      case 'description':
        setEditValues(prev => ({ ...prev, description: task.description || '' }))
        break
      case 'details':
        // Clear the details field on cancel instead of reverting
        setEditValues(prev => ({ ...prev, details: '' }))
        break
      case 'priority':
        setEditValues(prev => ({ ...prev, priority: task.priority }))
        break
      case 'dueDate':
        setEditValues(prev => ({ ...prev, dueDate: task.dueDate || '' }))
        break
    }
    setEditingField(null)
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    try {
      const response = await fetch(`/api/projects/${task.projectId}/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment.trim(),
          author: 'Current User', // Replace with actual user
        }),
      })

      if (response.ok) {
        const comment = await response.json()
        setComments(prev => [...prev, comment])
        setNewComment('')
      }
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

  const handleGenerateDetails = async (prompt: string) => {
    setIsGeneratingDetails(true)
    setEditValues(prev => ({ ...prev, details: '' })) // Clear existing details
    setEditingField('details') // Switch to edit mode to show the streaming text
    
    try {
      const response = await fetch('/api/ai/generate-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: task.id,
          prompt,
          context: {
            title: task.title,
            description: task.description,
            priority: task.priority,
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate details')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          accumulatedText += chunk
          
          // Update the details in real-time as we receive chunks
          setEditValues(prev => ({ ...prev, details: accumulatedText }))
          
          // Auto-scroll to bottom of textarea
          if (detailsTextareaRef.current) {
            detailsTextareaRef.current.scrollTop = detailsTextareaRef.current.scrollHeight
          }
        }

        // Save the final details to the task
        await updateTask(task.projectId, task.id, { details: accumulatedText })
      }
    } catch (error) {
      console.error('Failed to generate details:', error)
    } finally {
      setIsGeneratingDetails(false)
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'bg-green-100 text-green-800'
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800'
      case TaskStatus.BACKLOG:
        return 'bg-amber-100 text-amber-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.HIGH:
        return 'bg-red-100 text-red-800'
      case Priority.MEDIUM:
        return 'bg-yellow-100 text-yellow-800'
      case Priority.LOW:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-background border-l shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Task Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Title */}
        <div>
          <Label className="text-sm font-medium">Title</Label>
          {editingField === 'title' ? (
            <div className="mt-1 space-y-2">
              <Input
                value={editValues.title}
                onChange={(e) => setEditValues(prev => ({ ...prev, title: e.target.value }))}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleSave('title')}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => handleCancel('title')}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div 
              className="mt-1 p-2 rounded cursor-pointer hover:bg-muted"
              onClick={() => setEditingField('title')}
            >
              {task.title}
            </div>
          )}
        </div>

        {/* Status and Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Status</Label>
            <div className="mt-1">
              <Badge className={cn('capitalize', getStatusColor(task.status))}>
                {task.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Priority</Label>
            {editingField === 'priority' ? (
              <div className="mt-1 space-y-2">
                <Select
                  value={editValues.priority}
                  onValueChange={(value: Priority) => setEditValues(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Priority.LOW}>Low</SelectItem>
                    <SelectItem value={Priority.MEDIUM}>Medium</SelectItem>
                    <SelectItem value={Priority.HIGH}>High</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSave('priority')}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => handleCancel('priority')}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div 
                className="mt-1 inline-block cursor-pointer"
                onClick={() => setEditingField('priority')}
              >
                <Badge className={cn('capitalize', getPriorityColor(task.priority))}>
                  <Flag className="h-3 w-3 mr-1" />
                  {task.priority}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Due Date */}
        <div>
          <Label className="text-sm font-medium">Due Date</Label>
          {editingField === 'dueDate' ? (
            <div className="mt-1 space-y-2">
              <Input
                type="date"
                value={editValues.dueDate}
                onChange={(e) => setEditValues(prev => ({ ...prev, dueDate: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleSave('dueDate')}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => handleCancel('dueDate')}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div 
              className="mt-1 p-2 rounded cursor-pointer hover:bg-muted flex items-center"
              onClick={() => setEditingField('dueDate')}
            >
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <Label className="text-sm font-medium">Description</Label>
          {editingField === 'description' ? (
            <div className="mt-1 space-y-2">
              <Textarea
                value={editValues.description}
                onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Add a description..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleSave('description')}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => handleCancel('description')}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div 
              className="mt-1 p-2 rounded cursor-pointer hover:bg-muted h-[80px] overflow-y-auto border border-dashed"
              onClick={() => setEditingField('description')}
            >
              {task.description ? (
                <div className="whitespace-pre-wrap">{task.description}</div>
              ) : (
                <span className="text-muted-foreground">Add a description...</span>
              )}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Details</Label>
            <AIGenerateDialog 
              onGenerate={handleGenerateDetails}
              isLoading={isGeneratingDetails}
            />
          </div>
          {editingField === 'details' ? (
            <div className="space-y-2">
              <Textarea
                ref={detailsTextareaRef}
                value={editValues.details}
                onChange={(e) => setEditValues(prev => ({ ...prev, details: e.target.value }))}
                placeholder={isGeneratingDetails ? "Generating details..." : "Add detailed information..."}
                readOnly={isGeneratingDetails}
                className={`h-[120px] resize-none ${isGeneratingDetails ? "bg-muted/50" : ""}`}
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => handleSave('details')}
                  disabled={isGeneratingDetails}
                >
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleCancel('details')}
                  disabled={isGeneratingDetails}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div 
              className="p-2 rounded cursor-pointer hover:bg-muted h-[120px] overflow-y-auto border border-dashed"
              onClick={() => setEditingField('details')}
            >
              {task.details ? (
                <div className="whitespace-pre-wrap">{task.details}</div>
              ) : (
                <span className="text-muted-foreground">Add detailed information...</span>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Comments */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <Label className="text-sm font-medium flex items-center">
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments ({comments.length})
            </Label>
          </div>

          {/* Comment Form */}
          <form onSubmit={handleAddComment} className="mb-4">
            <div className="space-y-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!newComment.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Comment
                </Button>
              </div>
            </div>
          </form>

          {/* Comments List */}
          <div className="space-y-3">
            {comments.map((comment) => (
              <Card key={comment.id} className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{comment.author}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap">{comment.content}</div>
              </Card>
            ))}
            {comments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No comments yet</p>
                <p className="text-xs">Be the first to add a comment</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}