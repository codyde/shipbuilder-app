import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { SimpleMarkdownEditor } from '@/components/SimpleMarkdownEditor'
import { X, GripHorizontal, Save, Undo } from 'lucide-react'
import { useDraggable } from '@/hooks/useDraggable'

interface SimpleMarkdownModalProps {
  isOpen: boolean
  onClose: () => void
  value: string
  onChange: (value: string) => void
  onSave: () => void
  title?: string
}

export function SimpleMarkdownModal({
  isOpen,
  onClose,
  value,
  onChange,
  onSave,
  title = "Task Implementation Details"
}: SimpleMarkdownModalProps) {
  const [localValue, setLocalValue] = useState(value)
  const [hasChanges, setHasChanges] = useState(false)

  // Draggable functionality
  const { ref: dragRef, handleMouseDown, style: dragStyle } = useDraggable({
    initialPosition: { x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 },
    storageKey: 'markdown-editor-modal-position',
    bounds: {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    },
  })

  useEffect(() => {
    setLocalValue(value)
    setHasChanges(false)
  }, [value, isOpen])

  const handleLocalChange = (newValue: string) => {
    setLocalValue(newValue)
    setHasChanges(newValue !== value)
  }

  const handleSave = () => {
    onChange(localValue)
    onSave()
    setHasChanges(false)
  }

  const handleRevert = () => {
    setLocalValue(value)
    setHasChanges(false)
  }

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div
        ref={dragRef}
        style={dragStyle}
        className="bg-background border shadow-2xl rounded-lg flex flex-col w-[800px] h-[600px] overflow-hidden"
      >
        {/* Draggable Header */}
        <div 
          className="p-4 border-b bg-muted/50 cursor-grab active:cursor-grabbing flex items-center justify-between"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{title}</h2>
            {hasChanges && (
              <span className="text-sm text-muted-foreground bg-amber-100 dark:bg-amber-900/20 px-2 py-1 rounded">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button variant="ghost" size="sm" onClick={handleRevert} title="Revert changes">
                <Undo className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSave} 
              disabled={!hasChanges}
              title="Save changes"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 p-4">
          <SimpleMarkdownEditor
            value={localValue}
            onChange={handleLocalChange}
            height="100%"
            placeholder="Add detailed implementation information..."
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/20 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Markdown supported • Write tab for editing, Preview tab to see rendered output
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              {hasChanges ? 'Cancel' : 'Close'}
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}