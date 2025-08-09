import { useState, useEffect, useRef } from 'react';
// Removed useObject (not exported in current @ai-sdk/react)
import { useProjects } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Accordion } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ToolStatusDisplay } from '@/components/ui/tool-status-display';
import { MVPProgressBar } from '@/components/ui/mvp-progress-bar';
import { useMVPStatusStream } from '@/hooks/useMVPStatusStream';
import { X, Lightbulb, GripHorizontal, Loader2, Rocket, CheckCircle, Package } from 'lucide-react';
import { useDraggable } from '@/hooks/useDraggable';
import { useIsMobile } from '@/hooks/use-mobile';
import { getApiUrl } from '@/lib/api-config';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';

interface MVPBuilderProps {
  className?: string;
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface MVPPlan {
  projectName: string;
  description: string;
  features: string[];
  techStack: {
    frontend: string;
    backend: string;
    database: string;
    hosting?: string;
  };
  tasks: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }[];
}

interface Component {
  id: string;
  name: string;
  description: string;
  tags: string[];
}


export function MVPBuilder({ className = '', onClose, open = true, onOpenChange }: MVPBuilderProps) {
  const { refreshProjects } = useProjects();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [projectIdea, setProjectIdea] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mvpPlan, setMvpPlan] = useState<MVPPlan | null>(null);
  const [projectName, setProjectName] = useState(''); // Editable project name
  const [isSuggestingName, setIsSuggestingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generationText, setGenerationText] = useState('');
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const streamingTextRef = useRef<HTMLDivElement>(null);
  // Note: MVP plan generation now uses manual SSE parsing (see handleGenerateMVP)

  
  // Component-related state
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<Component[]>([]);
  const [componentSearch, setComponentSearch] = useState('');
  const [loadingComponents, setLoadingComponents] = useState(false);

  // Use the new MVP status streaming hook
  const {
    statusMessages,
    isCreating,
    isComplete,
    progressSteps,
    currentStepIndex,
    createMVPProject,
    clearStatusMessages
  } = useMVPStatusStream({
    onComplete: () => {
      refreshProjects();
      setSuccessMessage('MVP project created successfully!');
      
      // Reset the form after a delay
      setTimeout(() => {
        setProjectIdea('');
        setMvpPlan(null);
        setProjectName('');
        setSuccessMessage(null);
        setGenerationText('');
        onClose?.();
      }, 3000);
    },
    onError: (errorMessage) => {
      setError(errorMessage);
    }
  });

  // Funny status messages for creation process (now used as fallback display text)
  const funnyStatusMessages = [
    "Brewing some fresh code...",
    "Teaching AI to organize tasks...",
    "Assembling digital building blocks...",
    "Sprinkling magic dust on features...",
    "Convincing databases to cooperate...",
    "Drawing blueprints in the cloud...",
    "Negotiating with stubborn APIs...",
    "Building castles in the codebase...",
    "Herding cats... er, tasks...",
    "Summoning the deployment demons...",
    "Making ones and zeros dance...",
    "Caffeinating the code monkeys...",
    "Debugging the quantum flux...",
    "Optimizing for maximum awesomeness...",
    "Teaching pixels to behave..."
  ];

  // Fetch components on mount
  const fetchComponents = async () => {
    setLoadingComponents(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(getApiUrl('components'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setComponents(data.components || []);
      }
    } catch (error) {
      console.error('Failed to fetch components:', error);
    } finally {
      setLoadingComponents(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchComponents();
    }
  }, [user]);

  // Component selection handlers
  const handleComponentSelect = (component: Component) => {
    if (!selectedComponents.find(c => c.id === component.id)) {
      setSelectedComponents(prev => [...prev, component]);
    }
    setComponentSearch('');
  };

  const handleComponentRemove = (componentId: string) => {
    setSelectedComponents(prev => prev.filter(c => c.id !== componentId));
  };

  const filteredComponents = components.filter(component =>
    component.name.toLowerCase().includes(componentSearch.toLowerCase()) ||
    component.description.toLowerCase().includes(componentSearch.toLowerCase()) ||
    component.tags.some(tag => tag.toLowerCase().includes(componentSearch.toLowerCase()))
  ).filter(component => !selectedComponents.find(c => c.id === component.id));

  // Initialize draggable functionality
  const { ref: dragRef, handleMouseDown, style: dragStyle } = useDraggable({
    initialPosition: { x: window.innerWidth - 600, y: 50 },
    storageKey: 'mvp-builder-position',
    bounds: {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    },
  });

  // Auto-scroll streaming text
  const scrollStreamingText = () => {
    if (streamingTextRef.current) {
      streamingTextRef.current.scrollTop = streamingTextRef.current.scrollHeight;
    }
  };

  // Cycle through status messages during creation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCreating && !isComplete) {
      interval = setInterval(() => {
        setCurrentStatusIndex(prev => (prev + 1) % funnyStatusMessages.length);
      }, 2500); // Change message every 2.5 seconds
    } else {
      setCurrentStatusIndex(0); // Reset when not creating
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCreating, isComplete, funnyStatusMessages.length]);

  useEffect(() => {
    if (generationText) {
      scrollStreamingText();
    }
  }, [generationText]);

  const handleGenerateMVP = async () => {
    // Validation
    if (!user) {
      setError('Please log in to use the MVP Builder');
      return;
    }

    const trimmedIdea = projectIdea.trim();
    if (!trimmedIdea) {
      setError('Please enter a project idea');
      return;
    }

    if (trimmedIdea.length < 10) {
      setError('Please provide a more detailed project description (at least 10 characters)');
      return;
    }

    if (trimmedIdea.length > 500) {
      setError('Project description is too long (maximum 500 characters)');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setMvpPlan(null);
    setGenerationText('');
    setIsGenerating(true);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token missing. Please log in again.');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(getApiUrl('ai/generatemvp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream, application/json;q=0.5, */*;q=0.1',
        },
        body: JSON.stringify({
          projectIdea: trimmedIdea,
          selectedComponents: selectedComponents.map(c => ({
            name: c.name,
            description: c.description,
            tags: c.tags
          }))
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error || response.statusText;
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Failed to generate MVP plan: ${errorMessage}`);
        }
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const parsed = await response.json();
        if (!parsed.projectName || !parsed.description || !Array.isArray(parsed.features) || !parsed.techStack || !Array.isArray(parsed.tasks)) {
          throw new Error('Generated MVP plan has invalid structure');
        }
        const planWithIds = {
          ...parsed,
          tasks: parsed.tasks.map((task: any, index: number) => ({
            ...task,
            id: `task-${index}`,
            selected: true
          }))
        };
        setMvpPlan(planWithIds);
        setProjectName(parsed.projectName);
        setGenerationText('');
      } else {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let reasoningSoFar = '';
        let resultingSoFar = '';
        let finalPlan: any | null = null;

        if (reader) {
          // Initialize with empty text, will be filled by reasoning events
          setGenerationText('🤔 AI is thinking...');
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            sseBuffer += chunk;
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() ?? '';
            
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const data = JSON.parse(line.slice(6));
                const type: string | undefined = data?.type;
                
                // Log all event types for debugging
                if (type) {
                  console.log('[MVP_BUILDER] SSE Event:', {
                    type,
                    hasData: !!data,
                    hasDelta: !!(data?.delta || data?.textDelta),
                    hasObject: !!data?.object
                  });
                }
                
                // Handle different event types from the new streaming implementation
                switch (type) {
                  case 'generation.start':
                    // Initial generation info
                    console.log('[MVP_BUILDER] Generation started:', data);
                    const reasoningCapable = data.supportsReasoning;
                    setGenerationText(reasoningCapable 
                      ? `🧠 Starting AI reasoning with ${data.provider} (${data.model})...\n\nReasoning will appear below:`
                      : `🤖 Starting generation with ${data.provider} (${data.model})...\n\nNote: Switch to OpenAI in Settings to see reasoning.`
                    );
                    break;
                    
                  case 'reasoning.delta':
                    // Reasoning text from OpenAI models
                    if (typeof data.delta === 'string') {
                      reasoningSoFar += data.delta;
                      setGenerationText(`🧠 AI Reasoning:\n${reasoningSoFar}`);
                      console.log('[MVP_BUILDER] Reasoning delta:', data.delta.substring(0, 50));
                    }
                    break;
                    
                  case 'reasoning.done':
                    // Reasoning phase complete
                    console.log('[MVP_BUILDER] Reasoning phase completed');
                    setGenerationText(`${reasoningSoFar ? `🧠 AI Reasoning:\n${reasoningSoFar}\n\n` : ''}📋 Generating MVP plan structure...`);
                    break;
                    
                  case 'text.delta':
                    // Result text for the JSON plan
                    if (typeof data.delta === 'string') {
                      resultingSoFar += data.delta;
                      // Show reasoning + current result generation
                      const displayText = reasoningSoFar 
                        ? `🧠 AI Reasoning:\n${reasoningSoFar}\n\n📋 Generated Plan:\n${resultingSoFar}`
                        : `📋 Generating plan:\n${resultingSoFar}`;
                      setGenerationText(displayText);
                    }
                    break;
                    
                  case 'object.delta':
                    // Partial object updates for streamObject
                    if (data.object) {
                      console.log('[MVP_BUILDER] Partial object received');
                      setGenerationText(`${reasoningSoFar ? `🧠 AI Reasoning:\n${reasoningSoFar}\n\n` : ''}📋 Building plan structure...`);
                    }
                    break;
                    
                  case 'object.completed':
                    // Final completed object
                    if (data.object) {
                      finalPlan = data.object;
                      console.log('[MVP_BUILDER] Final plan completed:', Object.keys(data.object));
                    }
                    break;
                    
                  case 'done':
                    // Stream completion
                    console.log('[MVP_BUILDER] Stream completed');
                    setGenerationText(`${reasoningSoFar ? `🧠 AI Reasoning:\n${reasoningSoFar}\n\n` : ''}✅ MVP plan generated successfully!`);
                    break;
                    
                  case 'error':
                    // Handle streaming errors
                    console.error('[MVP_BUILDER] Stream error:', data.error);
                    throw new Error(data.error || 'Streaming error occurred');
                    
                  default:
                    // Log unknown event types for debugging
                    console.log('[MVP_BUILDER] Unknown event type:', type, data);
                    break;
                }
              } catch (parseError) {
                // Ignore malformed JSON lines but log them for debugging
                if (line.trim()) {
                  console.warn('[MVP_BUILDER] Failed to parse SSE line:', line.substring(0, 100));
                }
              }
            }
          }
        }

        if (finalPlan) {
          const parsed = finalPlan;
          if (!parsed.projectName || !parsed.description || !Array.isArray(parsed.features) || !parsed.techStack || !Array.isArray(parsed.tasks)) {
            throw new Error('Generated MVP plan has invalid structure');
          }
          const planWithIds = {
            ...parsed,
            tasks: parsed.tasks.map((task: any, index: number) => ({
              ...task,
              id: `task-${index}`,
              selected: true
            }))
          };
          setMvpPlan(planWithIds);
          setProjectName(parsed.projectName);
          setGenerationText('');
          return;
        }

        // Attempt to salvage JSON from accumulated text
        const extractBalancedJson = (text: string): string | null => {
          let working = text.trim();
          if (working.startsWith('```json')) working = working.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          else if (working.startsWith('```')) working = working.replace(/^```\s*/, '').replace(/\s*```$/, '');
          const first = working.indexOf('{');
          const last = working.lastIndexOf('}');
          if (first === -1 || last === -1 || last <= first) return null;
          let inStr = false, esc = false, depth = 0, start = -1;
          for (let i = first; i <= last; i++) {
            const ch = working[i];
            if (esc) { esc = false; continue; }
            if (ch === '\\') { if (inStr) esc = true; continue; }
            if (ch === '"') { inStr = !inStr; continue; }
            if (inStr) continue;
            if (ch === '{') { if (depth === 0) start = i; depth++; }
            else if (ch === '}') { depth--; if (depth === 0 && start !== -1) return working.substring(start, i + 1).trim(); }
          }
          return null;
        };
        const sanitizePossibleJson = (text: string): string => {
          let s = text.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
            .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, '\'')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/[\u0000-\u0019]/g, (m) => (m === '\n' || m === '\t' ? m : ''))
            .replace(/,\s*([}\]])/g, '$1');
          const start = s.indexOf('{');
          const end = s.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end > start) s = s.substring(start, end + 1).trim();
          return s;
        };
        let candidate = extractBalancedJson(fullText) || sanitizePossibleJson(fullText);
        if (!candidate) candidate = extractBalancedJson(sanitizePossibleJson(fullText)) || sanitizePossibleJson(fullText);
        if (!candidate) throw new Error('No JSON object found in response');
        const parsed = JSON.parse(candidate);
        if (!parsed.projectName || !parsed.description || !Array.isArray(parsed.features) || !parsed.techStack || !Array.isArray(parsed.tasks)) {
          throw new Error('Generated MVP plan has invalid structure');
        }
        const planWithIds = {
          ...parsed,
          tasks: parsed.tasks.map((task: any, index: number) => ({
            ...task,
            id: `task-${index}`,
            selected: true
          }))
        };
        setMvpPlan(planWithIds);
        setProjectName(parsed.projectName);
        setGenerationText('');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out. Please try again with a shorter description.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate MVP plan. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestName = async () => {
    if (!projectIdea.trim()) {
      setError('Please enter a project description first');
      return;
    }

    setIsSuggestingName(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token missing. Please log in again.');
      }

      const response = await fetch(getApiUrl('chat/stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Suggest a project name based on this description: ${projectIdea.trim()}`
            }
          ],
          tools: {
            suggestProjectName: {
              description: 'Generate a suggested project name based on a project description',
              parameters: {
                type: 'object',
                properties: {
                  description: {
                    type: 'string',
                    description: 'The project description to base the name suggestion on'
                  }
                },
                required: ['description']
              }
            }
          },
          maxSteps: 3
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get name suggestion');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
        }
      }

      // Parse the streaming response to find tool results
      const lines = fullResponse.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'tool-result' && data.toolName === 'suggestProjectName') {
              const result = JSON.parse(data.result);
              if (result.success && result.data?.suggestedName) {
                setProjectName(result.data.suggestedName);
                return;
              }
            }
          } catch (parseError) {
            // Continue to next line
          }
        }
      }

      throw new Error('No name suggestion received');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to suggest name');
    } finally {
      setIsSuggestingName(false);
    }
  };

  const handleCreateProject = async () => {
    if (!mvpPlan || !user || !projectName.trim()) {
      setError('Invalid project plan, project name, or user not authenticated');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    clearStatusMessages();

    // Use the status streaming hook to create the MVP
    await createMVPProject({
      ...mvpPlan,
      projectName: projectName.trim(), // Use the edited project name
    });
  };

  const exampleIdeas = [
    'A photo sharing app like Instagram built with Next.js',
    'A task management tool similar to Trello using React and Node.js',
    'A blog platform with markdown support using Django',
    'A real-time chat application with WebSocket support',
    'An e-commerce store for handmade crafts with Stripe integration',
  ];

  // Mobile version: use Drawer component
  if (isMobile) {
    const handleOpenChange = (newOpen: boolean) => {
      if (onOpenChange) {
        onOpenChange(newOpen);
      } else if (!newOpen && onClose) {
        onClose();
      }
    };

    return (
      <Drawer open={open} onOpenChange={handleOpenChange} direction="bottom" shouldScaleBackground={false}>
        <DrawerContent className="h-3/4 !max-h-[75vh] flex flex-col fixed">
          <DrawerHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-white" />
                </div>
                <div>
                  <DrawerTitle className="text-left text-white text-base">MVP Builder</DrawerTitle>
                </div>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/20">
                  <X className="w-4 h-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {/* Content */}
          <div className="flex-1 p-3 space-y-3 overflow-y-auto overscroll-contain min-h-0" style={{ maxHeight: 'calc(75vh - 140px)' }}>
            {!mvpPlan ? (
              <>
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
                    <Lightbulb className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Build Your MVP</h2>
                    <p className="text-muted-foreground text-sm">
                      Describe your project idea below
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Textarea
                      value={projectIdea}
                      onChange={(e) => setProjectIdea(e.target.value)}
                      placeholder="e.g., A social media app for pet owners..."
                      className="min-h-20 text-sm"
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {projectIdea.length}/500
                    </p>
                  </div>

                  {/* Components Section for Mobile */}
                  <div>
                    <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      Components
                    </label>
                    
                    {/* Selected Components */}
                    {selectedComponents.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selectedComponents.map((component) => (
                          <Badge
                            key={component.id}
                            variant="secondary"
                            className="text-xs cursor-pointer hover:bg-red-100 hover:text-red-700"
                            onClick={() => handleComponentRemove(component.id)}
                          >
                            {component.name} ×
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Component Search for Mobile */}
                    <div className="relative">
                      <Input
                        value={componentSearch}
                        onChange={(e) => setComponentSearch(e.target.value)}
                        placeholder="Add components..."
                        className="text-sm h-8"
                        disabled={isGenerating || loadingComponents}
                      />
                      
                      {/* Component Dropdown for Mobile */}
                      {componentSearch && filteredComponents.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-10 bg-background border rounded-md shadow-lg max-h-32 overflow-y-auto mt-1">
                          {filteredComponents.slice(0, 3).map((component) => (
                            <div
                              key={component.id}
                              onClick={() => handleComponentSelect(component)}
                              className="p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            >
                              <div className="text-xs font-medium">{component.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {component.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button 
                    onClick={handleGenerateMVP} 
                    disabled={projectIdea.length < 10 || isGenerating}
                    className="w-full h-9 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4 mr-2" />
                        Generate Plan
                      </>
                    )}
                  </Button>

                  {projectIdea.length === 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Try an example:</p>
                      <div className="grid gap-1">
                        {exampleIdeas.slice(0, 2).map((example, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => setProjectIdea(example)}
                            className="text-left h-auto py-1.5 px-2 whitespace-normal text-xs"
                            disabled={isGenerating}
                          >
                            {example}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Streaming text display for mobile */}
                  {isGenerating && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                        <span className="text-xs font-medium text-muted-foreground">AI is thinking...</span>
                      </div>
                      {generationText ? (
                        <div ref={streamingTextRef} className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-3 max-h-32 overflow-y-auto border border-blue-200/50 dark:border-blue-800/50">
                          <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                            {generationText.split('\n\n').map((section, index) => {
                              if (section.startsWith('🧠 AI Reasoning:')) {
                                return (
                                  <div key={index} className="mb-2">
                                    <div className="font-semibold text-blue-700 dark:text-blue-300 mb-1 text-xs">🧠 AI Reasoning:</div>
                                    <div className="font-mono text-xs bg-blue-50/50 dark:bg-blue-950/30 p-2 rounded border-l-2 border-blue-300 dark:border-blue-600 text-blue-900 dark:text-blue-100">
                                      {section.replace('🧠 AI Reasoning:\n', '')}
                                    </div>
                                  </div>
                                );
                              } else if (section.startsWith('📋 Generated Plan:') || section.startsWith('📋 Generating plan:')) {
                                return (
                                  <div key={index} className="mb-2">
                                    <div className="font-semibold text-purple-700 dark:text-purple-300 mb-1 text-xs">📋 Generated Plan:</div>
                                    <div className="font-mono text-xs bg-purple-50/50 dark:bg-purple-950/30 p-2 rounded border-l-2 border-purple-300 dark:border-purple-600 text-purple-900 dark:text-purple-100">
                                      {section.replace(/📋 Generated Plan:\n?|📋 Generating plan:\n?/, '')}
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div key={index} className="text-foreground/80 font-mono text-xs">
                                    {section}
                                  </div>
                                );
                              }
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center">
                          <p className="text-xs text-muted-foreground">Initializing analysis...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              // MVP Plan Display (same content as desktop)
              <div className="space-y-4">
                {/* Project Name Editor */}
                <Card className="p-3">
                  <label className="text-sm font-medium mb-2 block">Project Name</label>
                  <div className="flex gap-2 mb-3">
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Enter project name"
                      className="flex-1"
                      maxLength={50}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSuggestName}
                      disabled={isSuggestingName || !projectIdea.trim()}
                      className="shrink-0"
                    >
                      {isSuggestingName ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lightbulb className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{mvpPlan.description}</p>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-medium">Frontend:</span>
                      <p className="text-muted-foreground">{mvpPlan.techStack.frontend}</p>
                    </div>
                    <div>
                      <span className="font-medium">Backend:</span>
                      <p className="text-muted-foreground">{mvpPlan.techStack.backend}</p>
                    </div>
                    <div>
                      <span className="font-medium">Database:</span>
                      <p className="text-muted-foreground">{mvpPlan.techStack.database}</p>
                    </div>
                    {mvpPlan.techStack.hosting && (
                      <div>
                        <span className="font-medium">Hosting:</span>
                        <p className="text-muted-foreground">{mvpPlan.techStack.hosting}</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Simple summary for mobile - no accordions */}
                <Card className="p-3">
                  <div className="text-sm space-y-2">
                    <div>
                      <span className="font-medium text-blue-600">Features:</span>
                      <span className="text-muted-foreground ml-1">{mvpPlan.features.length} core features</span>
                    </div>
                    <div>
                      <span className="font-medium text-purple-600">Tasks:</span>
                      <span className="text-muted-foreground ml-1">{mvpPlan.tasks.length} development tasks</span>
                    </div>
                  </div>
                </Card>

                {!isCreating ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateProject}
                      disabled={isCreating || !projectName.trim()}
                      className="flex-1 text-white"
                    >
                      <Rocket className="w-4 h-4 mr-2" />
                      Create Project
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMvpPlan(null);
                        setProjectName('');
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      disabled={isCreating}
                    >
                      Start Over
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-lg border">
                      {isComplete ? (
                        <>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="relative">
                              <CheckCircle className="w-5 h-5 text-green-500 animate-pulse" />
                              <div className="absolute inset-0 w-5 h-5 border-2 border-green-500 rounded-full animate-ping opacity-75"></div>
                            </div>
                            <span className="text-sm font-medium text-green-600">
                              Project created successfully!
                            </span>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-green-600 font-medium">
                              Done!
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 mb-4">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            <div className="flex-1">
                              <span className="text-sm font-medium block">
                                Creating project with {mvpPlan.tasks.length} tasks...
                              </span>
                              {progressSteps.length > 0 && (
                                <MVPProgressBar
                                  steps={progressSteps}
                                  currentStepIndex={currentStepIndex}
                                  compact={true}
                                  className="mt-2"
                                />
                              )}
                            </div>
                          </div>
                          
                          {/* Real-time tool status display */}
                          {statusMessages.length > 0 ? (
                            <ToolStatusDisplay className="bg-muted/30" maxItems={3} autoScroll />
                          ) : (
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground animate-pulse">
                                {funnyStatusMessages[currentStatusIndex]}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop version - only render if open
  if (!open) {
    return null;
  }

  return (
    <div 
      ref={dragRef}
      style={dragStyle}
      className={`w-[560px] h-3/4 ${className}`}
    >
      <div className="bg-background shadow-2xl border rounded-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div 
          className="p-4 border-b bg-gradient-to-r from-blue-500 to-purple-600 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Rocket className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">MVP Builder</h3>
                <p className="text-white/80 text-xs">AI-powered project planning</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GripHorizontal className="w-4 h-4 text-white/60" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {error && (
            <Card className="p-3 bg-red-50 border-red-200">
              <p className="text-red-600 text-sm">{error}</p>
            </Card>
          )}
          
          {successMessage && (
            <Card className="p-3 bg-green-50 border-green-200">
              <p className="text-green-600 text-sm">{successMessage}</p>
            </Card>
          )}

          {!mvpPlan ? (
            <>
              {/* Input Section */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Describe your project idea
                  </label>
                  <Textarea
                    value={projectIdea}
                    onChange={(e) => {
                      setProjectIdea(e.target.value);
                      // Clear errors when user starts typing
                      if (error && e.target.value !== projectIdea) {
                        setError(null);
                      }
                    }}
                    placeholder="e.g., I want to build a photo sharing app like Instagram with Next.js and PostgreSQL"
                    className="min-h-[100px] resize-none"
                    disabled={isGenerating}
                    maxLength={500}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-muted-foreground">
                      Minimum 10 characters for detailed analysis
                    </p>
                    <p className={`text-xs ${
                      projectIdea.length > 450 ? 'text-orange-600' : 
                      projectIdea.length > 500 ? 'text-red-600' : 'text-muted-foreground'
                    }`}>
                      {projectIdea.length}/500
                    </p>
                  </div>
                </div>

                {/* Components Section */}
                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Components (Optional)
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Add reusable components to enhance your MVP planning
                    {loadingComponents && <span className="text-blue-600"> (Loading...)</span>}
                    {!loadingComponents && components.length === 0 && <span className="text-orange-600"> (No components found - create some in Components page)</span>}
                    {!loadingComponents && components.length > 0 && <span className="text-green-600"> ({components.length} available)</span>}
                  </p>
                  
                  {/* Selected Components */}
                  {selectedComponents.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedComponents.map((component) => (
                        <Badge
                          key={component.id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-red-100 hover:text-red-700"
                          onClick={() => handleComponentRemove(component.id)}
                        >
                          {component.name} ×
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Component Search */}
                  <div className="relative">
                    <Input
                      value={componentSearch}
                      onChange={(e) => setComponentSearch(e.target.value)}
                      placeholder="Search and select components..."
                      disabled={isGenerating || loadingComponents}
                    />
                    
                    {/* Component Dropdown */}
                    {componentSearch && filteredComponents.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto mt-1">
                        {filteredComponents.slice(0, 5).map((component) => (
                          <div
                            key={component.id}
                            onClick={() => handleComponentSelect(component)}
                            className="p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                          >
                            <div className="text-sm font-medium">{component.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {component.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleGenerateMVP}
                  disabled={!projectIdea.trim() || projectIdea.trim().length < 10 || isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing your idea with AI...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4 mr-2" />
                      Generate MVP Plan
                    </>
                  )}
                </Button>
              </div>

              {/* Example Ideas */}
              {!isGenerating ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Example ideas:</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {exampleIdeas.map((idea, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        onClick={() => setProjectIdea(idea)}
                        className="w-full text-left justify-start h-auto py-2 px-3 text-xs"
                        disabled={isGenerating}
                      >
                        {idea}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm font-medium text-muted-foreground">AI is analyzing your project idea...</span>
                  </div>
                  {generationText ? (
                    <div ref={streamingTextRef} className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-4 max-h-64 overflow-y-auto border border-blue-200/50 dark:border-blue-800/50 shadow-sm">
                      <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        {generationText.split('\n\n').map((section, index) => {
                          if (section.startsWith('🧠 AI Reasoning:')) {
                            return (
                              <div key={index} className="mb-3">
                                <div className="font-semibold text-blue-700 dark:text-blue-300 mb-2">🧠 AI Reasoning:</div>
                                <div className="font-mono text-xs bg-blue-50/50 dark:bg-blue-950/30 p-2 rounded border-l-2 border-blue-300 dark:border-blue-600 text-blue-900 dark:text-blue-100">
                                  {section.replace('🧠 AI Reasoning:\n', '')}
                                </div>
                              </div>
                            );
                          } else if (section.startsWith('📋 Generated Plan:') || section.startsWith('📋 Generating plan:')) {
                            return (
                              <div key={index} className="mb-3">
                                <div className="font-semibold text-purple-700 dark:text-purple-300 mb-2">📋 Generated Plan:</div>
                                <div className="font-mono text-xs bg-purple-50/50 dark:bg-purple-950/30 p-2 rounded border-l-2 border-purple-300 dark:border-purple-600 text-purple-900 dark:text-purple-100">
                                  {section.replace(/📋 Generated Plan:\n?|📋 Generating plan:\n?/, '')}
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div key={index} className="text-foreground/80 font-mono text-xs">
                                {section}
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-lg p-8 flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <div className="flex justify-center">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full border-4 border-blue-200 dark:border-blue-800"></div>
                            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-t-blue-600 dark:border-t-blue-400 animate-spin"></div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">Initializing AI reasoning engine...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* MVP Plan Display */}
              <div className="space-y-4">
                {/* Project Name Editor */}
                <Card className="p-3">
                  <label className="text-sm font-medium mb-2 block">Project Name</label>
                  <div className="flex gap-2 mb-3">
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Enter project name"
                      className="flex-1"
                      maxLength={50}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSuggestName}
                      disabled={isSuggestingName || !projectIdea.trim()}
                      className="shrink-0"
                    >
                      {isSuggestingName ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lightbulb className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{mvpPlan.description}</p>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-medium">Frontend:</span>
                      <p className="text-muted-foreground">{mvpPlan.techStack.frontend}</p>
                    </div>
                    <div>
                      <span className="font-medium">Backend:</span>
                      <p className="text-muted-foreground">{mvpPlan.techStack.backend}</p>
                    </div>
                    <div>
                      <span className="font-medium">Database:</span>
                      <p className="text-muted-foreground">{mvpPlan.techStack.database}</p>
                    </div>
                    {mvpPlan.techStack.hosting && (
                      <div>
                        <span className="font-medium">Hosting:</span>
                        <p className="text-muted-foreground">{mvpPlan.techStack.hosting}</p>
                      </div>
                    )}
                  </div>
                </Card>

                <Accordion 
                  title="Core Features" 
                  count={mvpPlan.features.length}
                  defaultOpen={false}
                  className="bg-card"
                >
                  <ul className="text-xs space-y-2">
                    {mvpPlan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </Accordion>

                <Accordion 
                  title="Development Tasks" 
                  count={mvpPlan.tasks.length}
                  defaultOpen={false}
                  className="bg-card"
                >
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {mvpPlan.tasks.map((task, index) => (
                      <div key={index} className="flex items-start gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                          task.priority === 'high' ? 'bg-red-500' :
                          task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}></span>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-muted-foreground text-xs leading-tight">{task.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Accordion>

                {!isCreating ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateProject}
                      disabled={isCreating || !projectName.trim()}
                      className="flex-1 text-white"
                    >
                      <Rocket className="w-4 h-4 mr-2" />
                      Create Project
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMvpPlan(null);
                        setProjectName('');
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      disabled={isCreating}
                    >
                      Start Over
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-lg border">
                      {isComplete ? (
                        <>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="relative">
                              <CheckCircle className="w-5 h-5 text-green-500 animate-pulse" />
                              <div className="absolute inset-0 w-5 h-5 border-2 border-green-500 rounded-full animate-ping opacity-75"></div>
                            </div>
                            <span className="text-sm font-medium text-green-600">
                              Project created successfully!
                            </span>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-green-600 font-medium">
                              Done!
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 mb-4">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            <div className="flex-1">
                              <span className="text-sm font-medium block">
                                Creating project with {mvpPlan.tasks.length} tasks...
                              </span>
                              {progressSteps.length > 0 && (
                                <MVPProgressBar
                                  steps={progressSteps}
                                  currentStepIndex={currentStepIndex}
                                  compact={true}
                                  className="mt-2"
                                />
                              )}
                            </div>
                          </div>
                          
                          {/* Real-time tool status display */}
                          {statusMessages.length > 0 ? (
                            <ToolStatusDisplay className="bg-muted/30" maxItems={3} autoScroll />
                          ) : (
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground animate-pulse">
                                {funnyStatusMessages[currentStatusIndex]}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}