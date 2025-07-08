import { useState, useEffect } from 'react'
import { 
  X, 
  MessageSquare, 
  Calendar,
  Flag,
  User,
  Clock,
  Send,
  GripHorizontal,
  Minimize2
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
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Task, TaskStatus, Priority, Comment } from '@/types/types'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'
import { useDraggable } from '@/hooks/useDraggable'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { getApiUrl } from '@/lib/api-config'
import { SimpleMarkdownEditor } from '@/components/SimpleMarkdownEditor'
import { SimpleMarkdownModal } from '@/components/SimpleMarkdownModal'
import { AIGenerateDialog } from '@/components/AIGenerateDialog'

interface TaskDetailsPopoutProps {
  task: Task
  isOpen: boolean
  onClose: () => void
  onMinimize: () => void
}


export function TaskDetailsPopout({ task, isOpen, onClose, onMinimize }: TaskDetailsPopoutProps) {
  const { updateTask } = useProjects()
  const { user } = useAuth()
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
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false)

  // Draggable functionality
  const { ref: dragRef, handleMouseDown, style: dragStyle } = useDraggable({
    initialPosition: { x: window.innerWidth - 600, y: 50 },
    storageKey: 'task-details-popout-position',
    bounds: {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    },
  })

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
    if (!newComment.trim() || !user) return

    const commentContent = newComment.trim()
    const authorName = user.name
    
    // Create optimistic comment
    const optimisticComment: Comment = {
      id: `temp-${Date.now()}-${Math.random()}`,
      taskId: task.id,
      content: commentContent,
      author: authorName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    logger.userAction('add_comment', 'TaskDetailsPopout', {
      taskId: task.id,
      projectId: task.projectId,
      author: authorName,
      contentLength: commentContent.length
    })

    // Optimistically add comment to UI
    setComments(prev => [...prev, optimisticComment])
    setNewComment('')

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/projects/${task.projectId}/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          content: commentContent,
          author: authorName,
        }),
      })

      if (response.ok) {
        const actualComment = await response.json()
        // Replace optimistic comment with actual comment from server
        setComments(prev => prev.map(c => 
          c.id === optimisticComment.id ? actualComment : c
        ))
        logger.info('Comment added successfully', {
          component: 'TaskDetailsPopout',
          action: 'addComment',
          taskId: task.id,
          projectId: task.projectId,
          commentId: actualComment.id,
          author: authorName
        })
      } else {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    } catch (error) {
      // Rollback: remove optimistic comment
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id))
      setNewComment(commentContent) // Restore the comment text
      
      logger.error('Failed to add comment - rolled back', {
        component: 'TaskDetailsPopout',
        action: 'addComment',
        taskId: task.id,
        projectId: task.projectId,
        author: authorName
      }, error as Error)
    }
  }

  const handleGenerateDetails = async (prompt: string) => {
    setIsGeneratingDetails(true)
    setEditValues(prev => ({ ...prev, details: '' })) // Clear existing details
    setEditingField('details') // Switch to edit mode to show the streaming text
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(getApiUrl('ai/generate-details'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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
        }

        // Save the final details to the task
        await updateTask(task.projectId, task.id, { details: accumulatedText })
      }
    } catch (error) {
      logger.error('Failed to generate task details', {
        component: 'TaskDetailsPopout',
        action: 'generateDetails',
        taskId: task.id,
        projectId: task.projectId,
        prompt,
      }, error as Error)
    } finally {
      setIsGeneratingDetails(false)
    }
  }

  const handleEditorModalSave = async () => {
    await handleSave('details')
    setIsEditorModalOpen(false)
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
    <div
      ref={dragRef}
      style={dragStyle}
      className="bg-background border shadow-2xl rounded-lg flex flex-col w-[600px] h-[700px] overflow-hidden"
    >
      {/* Draggable Header */}
      <div 
        className="p-4 border-b bg-muted/50 cursor-grab active:cursor-grabbing flex items-center justify-between"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Task Details</h2>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onMinimize} title="Minimize to panel">
            <Minimize2 className="h-4 w-4" />
          </Button>
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
            <Label className="text-sm font-medium">Implementation Details</Label>
            <AIGenerateDialog 
              onGenerate={handleGenerateDetails}
              isLoading={isGeneratingDetails}
            />
          </div>
          {editingField === 'details' ? (
            <div className="space-y-2">
              <SimpleMarkdownEditor
                value={editValues.details}
                onChange={(value) => setEditValues(prev => ({ ...prev, details: value }))}
                readOnly={isGeneratingDetails}
                height={140}
                showExpandButton={true}
                onExpand={() => setIsEditorModalOpen(true)}
                placeholder={isGeneratingDetails ? "Generating implementation details..." : "Add detailed implementation information..."}
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
              className="p-2 rounded cursor-pointer hover:bg-muted h-[140px] overflow-y-auto border border-dashed"
              onClick={() => setEditingField('details')}
            >
              {task.details ? (
                <div className="whitespace-pre-wrap">{task.details}</div>
              ) : (
                <span className="text-muted-foreground">Add detailed implementation information...</span>
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
                placeholder={user ? "Add a comment..." : "Please log in to add comments"}
                rows={3}
                disabled={!user}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!newComment.trim() || !user}>
                  <Send className="h-4 w-4 mr-2" />
                  Comment
                </Button>
              </div>
            </div>
          </form>

          {/* Comments List */}
          <div className="space-y-3 max-h-[200px] overflow-y-auto">
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

      {/* Markdown Editor Modal */}
      <SimpleMarkdownModal
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
        value={editValues.details}
        onChange={(value) => setEditValues(prev => ({ ...prev, details: value }))}
        onSave={handleEditorModalSave}
        title="Task Implementation Details"
        onGenerateAI={handleGenerateDetails}
        isGenerating={isGeneratingDetails}
      />
    </div>
  )
}