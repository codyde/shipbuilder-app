import { useState, useEffect } from 'react'
import { 
  X, 
  MessageSquare, 
  Flag,
  User,
  Clock,
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
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Task, TaskStatus, Priority, Comment } from '@/types/types'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { getApiUrl } from '@/lib/api-config'
import { SimpleMarkdownEditor } from '@/components/SimpleMarkdownEditor'
import { SimpleMarkdownModal } from '@/components/SimpleMarkdownModal'
import { AIGenerateDialog } from '@/components/AIGenerateDialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer'

interface TaskDetailPanelProps {
  task: Task
  isOpen: boolean
  onClose: () => void
  onOpenChange?: (open: boolean) => void
}


export function TaskDetailPanel({ task, isOpen, onClose, onOpenChange }: TaskDetailPanelProps) {
  const { updateTask } = useProjects()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({
    title: task.title,
    description: task.description || '',
    details: task.details || '',
    priority: task.priority,
  })
  const [newComment, setNewComment] = useState('')
  const [comments, setComments] = useState<Comment[]>(task.comments || [])
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false)
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false)

  useEffect(() => {
    setEditValues({
      title: task.title,
      description: task.description || '',
      details: task.details || '',
      priority: task.priority,
    })
    setComments(task.comments || [])
  }, [task])

  // Handle drawer open/close state
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else if (!newOpen && onClose) {
      onClose()
    }
  }

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

    logger.userAction('add_comment', 'TaskDetailPanel', {
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
          component: 'TaskDetailPanel',
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
        component: 'TaskDetailPanel',
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
        component: 'TaskDetailPanel',
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

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange} direction={isMobile ? "bottom" : "right"} shouldScaleBackground={false}>
      <DrawerContent className={isMobile ? "h-[85vh] !max-h-[85vh] flex flex-col fixed" : "custom-width w-[400px] lg:w-[33vw] lg:min-w-[500px] lg:max-w-[800px] h-full flex flex-col fixed"}>
        <DrawerHeader className={`border-b flex-shrink-0 ${isMobile ? 'p-3' : 'p-3 lg:p-4'}`}>
          <div className="flex items-center justify-between">
            <DrawerTitle className={`text-left font-semibold ${isMobile ? 'text-base' : 'text-base lg:text-lg'}`}>Task Details</DrawerTitle>
            <div className="flex gap-1">
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className={`${isMobile ? 'h-8 w-8 p-0' : 'h-8 w-8 lg:h-9 lg:w-9 p-0'}`}>
                  <X className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4 lg:h-5 lg:w-5'}`} />
                </Button>
              </DrawerClose>
            </div>
          </div>
        </DrawerHeader>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto overscroll-contain min-h-0 ${isMobile ? 'p-3 space-y-4' : 'p-3 lg:p-4 space-y-4 lg:space-y-6'}`} style={isMobile ? { maxHeight: 'calc(85vh - 120px)' } : {}}>
          {/* Title */}
          <div>
            {editingField === 'title' ? (
              <div className="space-y-2">
                <Input
                  value={editValues.title}
                  onChange={(e) => setEditValues(prev => ({ ...prev, title: e.target.value }))}
                  autoFocus
                  className={`${isMobile ? 'h-12 text-lg font-semibold' : 'h-12 lg:h-14 text-lg lg:text-xl font-semibold'}`}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSave('title')} className={`${isMobile ? 'h-8 text-sm px-4' : 'h-8 lg:h-10 text-sm lg:text-base px-4 lg:px-6'}`}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => handleCancel('title')} className={`${isMobile ? 'h-8 text-sm px-4' : 'h-8 lg:h-10 text-sm lg:text-base px-4 lg:px-6'}`}>Cancel</Button>
                </div>
              </div>
            ) : (
              <h1 
                className={`p-3 rounded cursor-pointer hover:bg-muted font-semibold leading-tight ${isMobile ? 'text-lg' : 'text-lg lg:text-xl'} ${isMobile ? '' : 'lg:p-4'}`}
                onClick={() => setEditingField('title')}
              >
                {task.title}
              </h1>
            )}
          </div>

        {/* Status and Priority */}
        <div className={`grid grid-cols-2 ${isMobile ? 'gap-4' : 'gap-4 lg:gap-6'}`}>
          <div>
            <Label className={`font-medium ${isMobile ? 'text-base' : 'text-base lg:text-lg'}`}>Status</Label>
            <div className={`${isMobile ? 'mt-1' : 'mt-1 lg:mt-2'}`}>
              <Badge className={cn('capitalize text-sm lg:text-base px-2 lg:px-3 py-1 lg:py-1.5', getStatusColor(task.status))}>
                {task.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <div>
            <Label className={`font-medium ${isMobile ? 'text-base' : 'text-base lg:text-lg'}`}>Priority</Label>
            {editingField === 'priority' ? (
              <div className={`mt-1 space-y-2 ${isMobile ? '' : 'lg:mt-2 lg:space-y-3'}`}>
                <Select
                  value={editValues.priority}
                  onValueChange={(value: Priority) => setEditValues(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger className={`${isMobile ? 'h-10 text-base' : 'h-10 lg:h-12 text-base lg:text-lg'}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Priority.LOW} className="text-base lg:text-lg">Low</SelectItem>
                    <SelectItem value={Priority.MEDIUM} className="text-base lg:text-lg">Medium</SelectItem>
                    <SelectItem value={Priority.HIGH} className="text-base lg:text-lg">High</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSave('priority')} className={`${isMobile ? 'h-8 text-sm px-4' : 'h-8 lg:h-10 text-sm lg:text-base px-4 lg:px-6'}`}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => handleCancel('priority')} className={`${isMobile ? 'h-8 text-sm px-4' : 'h-8 lg:h-10 text-sm lg:text-base px-4 lg:px-6'}`}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div 
                className={`mt-1 inline-block cursor-pointer ${isMobile ? '' : 'lg:mt-2'}`}
                onClick={() => setEditingField('priority')}
              >
                <Badge className={cn('capitalize text-sm lg:text-base px-2 lg:px-3 py-1 lg:py-1.5', getPriorityColor(task.priority))}>
                  <Flag className={`mr-1 ${isMobile ? 'h-3 w-3' : 'h-3 w-3 lg:h-4 lg:w-4'}`} />
                  {task.priority}
                </Badge>
              </div>
            )}
          </div>
        </div>


        {/* Description */}
        <div>
          <Label className={`font-medium ${isMobile ? 'text-base' : 'text-base lg:text-lg'}`}>Description</Label>
          {editingField === 'description' ? (
            <div className={`mt-1 space-y-2 ${isMobile ? '' : 'lg:mt-2 lg:space-y-3'}`}>
              <Textarea
                value={editValues.description}
                onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                rows={isMobile ? 3 : 4}
                placeholder="Add a description..."
                className={`${isMobile ? 'text-base' : 'text-base lg:text-lg'} resize-none`}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleSave('description')} className={`${isMobile ? 'h-8 text-sm px-4' : 'h-8 lg:h-10 text-sm lg:text-base px-4 lg:px-6'}`}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => handleCancel('description')} className={`${isMobile ? 'h-8 text-sm px-4' : 'h-8 lg:h-10 text-sm lg:text-base px-4 lg:px-6'}`}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div 
              className={`mt-1 p-3 rounded cursor-pointer hover:bg-muted overflow-y-auto border border-dashed ${isMobile ? 'h-[80px] text-base' : 'h-[80px] lg:h-[100px] text-base lg:text-lg'} ${isMobile ? '' : 'lg:mt-2 lg:p-4'}`}
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
                height={120}
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
              className="p-2 rounded cursor-pointer hover:bg-muted h-[120px] overflow-y-auto border border-dashed"
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
          <div className={`flex items-center justify-between ${isMobile ? 'mb-4' : 'mb-4 lg:mb-6'}`}>
            <Label className={`font-medium flex items-center ${isMobile ? 'text-base' : 'text-base lg:text-lg'}`}>
              <MessageSquare className={`mr-2 ${isMobile ? 'h-4 w-4' : 'h-4 w-4 lg:h-5 lg:w-5'}`} />
              Comments ({comments.length})
            </Label>
          </div>

          {/* Comment Form */}
          <form onSubmit={handleAddComment} className={`${isMobile ? 'mb-4' : 'mb-4 lg:mb-6'}`}>
            <div className={`space-y-2 ${isMobile ? '' : 'lg:space-y-3'}`}>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={user ? "Add a comment..." : "Please log in to add comments"}
                rows={isMobile ? 3 : 4}
                disabled={!user}
                className={`${isMobile ? 'text-base' : 'text-base lg:text-lg'} resize-none`}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!newComment.trim() || !user} className={`${isMobile ? 'h-8 text-sm px-4' : 'h-8 lg:h-10 text-sm lg:text-base px-4 lg:px-6'}`}>
                  <Send className={`mr-2 ${isMobile ? 'h-4 w-4' : 'h-4 w-4 lg:h-5 lg:w-5'}`} />
                  Comment
                </Button>
              </div>
            </div>
          </form>

          {/* Comments List */}
          <div className={`space-y-3 ${isMobile ? '' : 'lg:space-y-4'}`}>
            {comments.map((comment) => (
              <Card key={comment.id} className={`${isMobile ? 'p-3' : 'p-3 lg:p-4'}`}>
                <div className={`flex items-start justify-between ${isMobile ? 'mb-2' : 'mb-2 lg:mb-3'}`}>
                  <div className="flex items-center gap-2">
                    <User className={`text-muted-foreground ${isMobile ? 'h-4 w-4' : 'h-4 w-4 lg:h-5 lg:w-5'}`} />
                    <span className={`font-medium ${isMobile ? 'text-sm' : 'text-sm lg:text-base'}`}>{comment.author}</span>
                  </div>
                  <div className={`flex items-center gap-1 text-muted-foreground ${isMobile ? 'text-xs' : 'text-xs lg:text-sm'}`}>
                    <Clock className={`${isMobile ? 'h-3 w-3' : 'h-3 w-3 lg:h-4 lg:w-4'}`} />
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className={`whitespace-pre-wrap ${isMobile ? 'text-sm' : 'text-sm lg:text-base'}`}>{comment.content}</div>
              </Card>
            ))}
            {comments.length === 0 && (
              <div className={`text-center text-muted-foreground ${isMobile ? 'py-8' : 'py-8 lg:py-12'}`}>
                <MessageSquare className={`mx-auto mb-2 opacity-50 ${isMobile ? 'h-8 w-8' : 'h-8 w-8 lg:h-10 lg:w-10'}`} />
                <p className={`${isMobile ? 'text-sm' : 'text-sm lg:text-base'}`}>No comments yet</p>
                <p className={`${isMobile ? 'text-xs' : 'text-xs lg:text-sm'}`}>Be the first to add a comment</p>
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
      </DrawerContent>
    </Drawer>
  )
}