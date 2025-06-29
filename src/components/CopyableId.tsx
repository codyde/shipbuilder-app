import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CopyableIdProps {
  id: string
  type?: 'project' | 'task'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showLabel?: boolean
}

export function CopyableId({ 
  id, 
  type = 'project', 
  size = 'sm',
  className = '',
  showLabel = true 
}: CopyableIdProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy ID:', error)
    }
  }

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm', 
    lg: 'text-base'
  }

  const buttonSizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-7 w-7',
    lg: 'h-8 w-8'
  }

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5', 
    lg: 'h-4 w-4'
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <span className="text-muted-foreground text-xs capitalize">
          {type} ID:
        </span>
      )}
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded border font-mono">
        <span className={cn(sizeClasses[size], 'text-foreground select-all')}>
          {id}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            buttonSizeClasses[size],
            'p-0 hover:bg-muted-foreground/10 transition-colors'
          )}
          onClick={handleCopy}
          title={`Copy ${type} ID`}
        >
          {copied ? (
            <Check className={cn(iconSizeClasses[size], 'text-green-600')} />
          ) : (
            <Copy className={cn(iconSizeClasses[size], 'text-muted-foreground')} />
          )}
        </Button>
      </div>
    </div>
  )
}