import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ExternalLink, Eye, Edit3 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useTheme } from '@/context/ThemeContext'

interface SimpleMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  height?: string | number
  readOnly?: boolean
  showExpandButton?: boolean
  onExpand?: () => void
  placeholder?: string
}

export function SimpleMarkdownEditor({
  value,
  onChange,
  height = 140,
  readOnly = false,
  showExpandButton = false,
  onExpand,
  placeholder = "Add detailed implementation information..."
}: SimpleMarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write")
  const { theme } = useTheme()
  const readOnlyContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load appropriate highlight.js theme
  useEffect(() => {
    const isDark = theme === 'dark' || theme === 'midnight' || theme === 'ocean'
    const styleUrl = isDark 
      ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
      : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
    
    // Remove existing highlight.js stylesheet
    const existingStyle = document.querySelector('link[data-highlight-theme]')
    if (existingStyle) {
      existingStyle.remove()
    }
    
    // Add new stylesheet
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = styleUrl
    link.setAttribute('data-highlight-theme', 'true')
    document.head.appendChild(link)
    
    return () => {
      const style = document.querySelector('link[data-highlight-theme]')
      if (style) {
        style.remove()
      }
    }
  }, [theme])

  // Auto-scroll to bottom when content changes and in readOnly mode (AI generation)
  useEffect(() => {
    if (readOnly && readOnlyContainerRef.current) {
      readOnlyContainerRef.current.scrollTop = readOnlyContainerRef.current.scrollHeight
    }
  }, [value, readOnly])

  // Auto-scroll textarea when content changes during generation
  useEffect(() => {
    if (!readOnly && activeTab === "write" && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight
    }
  }, [value, readOnly, activeTab])

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab as "write" | "preview")
  }

  return (
    <div 
      className="relative border rounded-md overflow-hidden flex flex-col"
      style={{ height: typeof height === 'string' && height.includes('%') ? height : 'auto' }}
    >
      {showExpandButton && onExpand && (
        <div className="absolute top-2 right-2 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpand}
            className="h-6 w-6 p-0 bg-background/80 hover:bg-background shadow-sm"
            title="Open in larger editor"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      )}
      
      {readOnly ? (
        <div 
          ref={readOnlyContainerRef}
          className="p-3 bg-muted/20 overflow-y-auto"
          style={{ height: typeof height === 'number' ? `${height}px` : height }}
        >
          {value ? (
            <div className="prose prose-sm max-w-none prose-slate dark:prose-invert">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {value}
              </ReactMarkdown>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm italic">{placeholder}</span>
          )}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col flex-1">
          <TabsList className="grid w-full grid-cols-2 rounded-none border-b h-8 flex-shrink-0">
            <TabsTrigger value="write" className="text-xs h-6">
              <Edit3 className="h-3 w-3 mr-1" />
              Write
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs h-6">
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="write" className="m-0 flex-1">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="border-0 rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 h-full overflow-y-auto"
              style={{ 
                height: typeof height === 'string' && height.includes('%') 
                  ? 'calc(100% - 0px)' 
                  : typeof height === 'number' 
                    ? `${height}px` 
                    : height 
              }}
            />
          </TabsContent>
          
          <TabsContent value="preview" className="m-0 flex-1">
            <div 
              className="p-3 overflow-y-auto bg-muted/10 h-full"
              style={{ 
                height: typeof height === 'string' && height.includes('%') 
                  ? 'calc(100% - 0px)' 
                  : typeof height === 'number' 
                    ? `${height}px` 
                    : height 
              }}
            >
              {value ? (
                <div className="prose prose-sm max-w-none prose-slate dark:prose-invert">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {value}
                  </ReactMarkdown>
                </div>
              ) : (
                <span className="text-muted-foreground text-sm italic">Nothing to preview</span>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}