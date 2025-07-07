import { useRef } from 'react'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

interface MonacoMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  height?: string | number
  readOnly?: boolean
  showExpandButton?: boolean
  onExpand?: () => void
}

export function MonacoMarkdownEditor({
  value,
  onChange,
  height = 140,
  readOnly = false,
  showExpandButton = false,
  onExpand
}: MonacoMarkdownEditorProps) {
  const { theme } = useTheme()
  const editorRef = useRef<unknown>(null)

  // Determine Monaco theme based on current theme
  const getMonacoTheme = () => {
    // Check if it's a dark theme
    const isDark = theme === 'dark' || 
                   theme === 'midnight' || 
                   theme === 'ocean'
    return isDark ? 'vs-dark' : 'light'
  }

  const handleEditorDidMount = (editor: unknown) => {
    editorRef.current = editor
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value)
    }
  }

  return (
    <div className="relative border rounded-md overflow-hidden">
      {showExpandButton && onExpand && (
        <div className="absolute top-2 right-2 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpand}
            className="h-6 w-6 p-0 bg-background/80 hover:bg-background"
            title="Open in larger editor"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      )}
      <Editor
        height={height}
        language="plaintext"
        theme={getMonacoTheme()}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        loading={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading editor...</div>}
        options={{
          readOnly,
          wordWrap: 'on',
          minimap: { enabled: false },
          lineNumbers: 'off',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontSize: 14,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: { top: 12, bottom: 12 },
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8
          },
          renderLineHighlight: 'none',
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          overviewRulerLanes: 0
        }}
      />
    </div>
  )
}