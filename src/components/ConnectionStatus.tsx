import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getApiUrl } from '@/lib/api-config'

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [, setLastCheck] = useState<Date>(new Date())

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    const checkConnection = async () => {
      if (!mounted) return

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        const response = await fetch(getApiUrl('health'), {
          signal: controller.signal,
          cache: 'no-cache'
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          setStatus('connected')
        } else {
          setStatus('disconnected')
        }
      } catch (error) {
        setStatus('disconnected')
      }
      
      setLastCheck(new Date())
      
      // Schedule next check
      timeoutId = setTimeout(checkConnection, status === 'connected' ? 30000 : 5000)
    }

    // Initial check
    checkConnection()

    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [status])

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-3 w-3 text-green-500" />
      case 'disconnected':
        return <AlertCircle className="h-3 w-3 text-red-500" />
      case 'connecting':
        return <Clock className="h-3 w-3 text-yellow-500 animate-pulse" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'disconnected':
        return 'Disconnected - Server may be restarting'
      case 'connecting':
        return 'Connecting...'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-600 dark:text-green-400'
      case 'disconnected':
        return 'text-red-600 dark:text-red-400'
      case 'connecting':
        return 'text-yellow-600 dark:text-yellow-400'
    }
  }

  // Only show when disconnected or connecting
  if (status === 'connected') {
    return null
  }

  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border backdrop-blur-sm',
      'bg-background/90 border-border',
      status === 'disconnected' && 'bg-red-50/90 border-red-200 dark:bg-red-950/90 dark:border-red-800'
    )}>
      {getStatusIcon()}
      <span className={cn('text-xs font-medium', getStatusColor())}>
        {getStatusText()}
      </span>
      {status === 'disconnected' && (
        <button
          onClick={() => window.location.reload()}
          className="text-xs underline hover:no-underline text-red-600 dark:text-red-400"
        >
          Reload
        </button>
      )}
    </div>
  )
}