import { useRef } from 'react'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

interface MonacoMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: string | number
  readOnly?: boolean
  showExpandButton?: boolean
  onExpand?: () => void
}

export function MonacoMarkdownEditor({
  value,
  onChange,
  placeholder = "Add detailed information...",
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
    
    // Configure markdown-specific settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).updateOptions({
      wordWrap: 'on',
      minimap: { enabled: false },
      lineNumbers: 'off',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      fontSize: 14,
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      padding: { top: 8, bottom: 8 },
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 6,
        horizontalScrollbarSize: 6
      }
    })
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
        language="markdown"
        theme={getMonacoTheme()}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        loading={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading editor...</div>}
        options={{
          readOnly,
          placeholder
        }}
      />
    </div>
  )
}