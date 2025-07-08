import { useState, useEffect } from 'react'
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

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab as "write" | "preview")
  }

  return (
    <div className="relative border rounded-md overflow-hidden">
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
          className="p-3 bg-muted/20"
          style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}
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
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-none border-b h-8">
            <TabsTrigger value="write" className="text-xs h-6">
              <Edit3 className="h-3 w-3 mr-1" />
              Write
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs h-6">
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="write" className="m-0">
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="border-0 rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ height: typeof height === 'number' ? `${height}px` : height }}
            />
          </TabsContent>
          
          <TabsContent value="preview" className="m-0">
            <div 
              className="p-3 overflow-y-auto bg-muted/10"
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
                <span className="text-muted-foreground text-sm italic">Nothing to preview</span>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}