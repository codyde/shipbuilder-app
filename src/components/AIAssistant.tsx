import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from 'ai/react';
import { useProjects } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { ToolInvocation } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Accordion } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { X, Lightbulb, Loader2, Rocket, CheckCircle, MessageCircle, Send, Edit2, Trash2, Package, Search } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { getApiUrl } from '@/lib/api-config';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AIAssistantProps {
  className?: string;
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialTab?: 'mvp' | 'chat';
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
    selected?: boolean;
    id?: string;
  }[];
}

interface Component {
  id: string;
  name: string;
  description: string;
  tags: string[];
}


interface ChatMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'data' | 'system';
    content: string;
    toolInvocations?: ToolInvocation[];
  };
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`max-w-[85%] lg:max-w-[90%] ${isUser ? 'self-end' : 'self-start'}`}>
      <Card className={`${
        isUser 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted'
      } p-3 lg:p-4`}>
        {isUser ? (
          <div className="text-sm lg:text-base leading-relaxed">
            {message.content}
          </div>
        ) : (
          <MarkdownRenderer 
            content={message.content} 
            className="text-sm lg:text-base leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" 
          />
        )}
        {message.toolInvocations && message.toolInvocations.length > 0 && (
          <div className="mt-3 lg:mt-4 pt-3 border-t border-border/30">
            {message.toolInvocations.map((tool, index) => (
              <div key={index} className="mb-2 last:mb-0">
                <Badge variant="secondary" className="text-xs lg:text-sm">
                  {tool.toolName}
                </Badge>
                {tool.result && (
                  <div className="mt-1 lg:mt-2 text-xs lg:text-sm">
                    {tool.result.success ? (
                      <span className="text-green-600 dark:text-green-400">✓ {tool.result.message}</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">✗ {tool.result.message}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className={`text-xs lg:text-sm text-muted-foreground mt-1 lg:mt-2 ${isUser ? 'text-right' : 'text-left'}`}>
        {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}

export function AIAssistant({ onClose, open = true, onOpenChange, initialTab = 'mvp' }: AIAssistantProps) {
  const { refreshProjects } = useProjects();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'mvp' | 'chat'>(initialTab);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // MVP Builder state
  const [projectIdea, setProjectIdea] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mvpPlan, setMvpPlan] = useState<MVPPlan | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isSuggestingName, setIsSuggestingName] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generationText, setGenerationText] = useState('');
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedTask, setEditedTask] = useState<{title: string; description: string} | null>(null);

  // Component-related state
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<Component[]>([]);
  const [componentSearch, setComponentSearch] = useState('');
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [browseDialogOpen, setBrowseDialogOpen] = useState(false);
  const [dialogSearch, setDialogSearch] = useState('');

  // Chat state
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: getApiUrl('chat/stream'),
    fetch: async (url, options) => {
      const token = localStorage.getItem('authToken');
      
      const headers = {
        ...options?.headers,
        'Content-Type': 'application/json',
      } as Record<string, string>;
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      return fetch(url, {
        ...options,
        headers,
      });
    },
    onFinish: () => {
      refreshProjects();
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

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
      setComponentSearch(''); // Clear search after selection
    }
  };

  const handleComponentRemove = (componentId: string) => {
    setSelectedComponents(prev => prev.filter(c => c.id !== componentId));
  };

  const handleComponentToggle = (component: Component) => {
    const isSelected = selectedComponents.find(c => c.id === component.id);
    if (isSelected) {
      handleComponentRemove(component.id);
    } else {
      handleComponentSelect(component);
    }
  };

  // Filter components for search dropdown
  const getSearchResults = (searchTerm: string) => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    
    return components.filter(component =>
      !selectedComponents.find(c => c.id === component.id) &&
      (component.name.toLowerCase().includes(term) ||
       component.description.toLowerCase().includes(term) ||
       component.tags.some(tag => tag.toLowerCase().includes(term)))
    ).slice(0, 5);
  };

  // Filter components for browse dialog
  const filteredDialogComponents = components.filter(component =>
    component.name.toLowerCase().includes(dialogSearch.toLowerCase()) ||
    component.description.toLowerCase().includes(dialogSearch.toLowerCase()) ||
    component.tags.some(tag => tag.toLowerCase().includes(dialogSearch.toLowerCase()))
  );

  // Status messages for MVP creation
  const statusMessages = [
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

  // Cycle through status messages during creation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCreating && !isComplete) {
      interval = setInterval(() => {
        setCurrentStatusIndex(prev => (prev + 1) % statusMessages.length);
      }, 2500);
    } else {
      setCurrentStatusIndex(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCreating, isComplete, statusMessages.length]);

  // Auto-scroll effects
  useEffect(() => {
    if (generationText && streamingTextRef.current) {
      streamingTextRef.current.scrollTop = streamingTextRef.current.scrollHeight;
    }
  }, [generationText]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // MVP Builder functions
  const handleGenerateMVP = async () => {
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

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);
    setMvpPlan(null);
    setGenerationText('');

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

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setGenerationText(fullText);
        }
      }

      try {
        let cleanedText = fullText.trim();
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        cleanedText = cleanedText.trim();
        
        const mvpPlan = JSON.parse(cleanedText);
        
        if (!mvpPlan.projectName || !mvpPlan.description || !Array.isArray(mvpPlan.features) || !mvpPlan.techStack || !Array.isArray(mvpPlan.tasks)) {
          throw new Error('Generated MVP plan has invalid structure');
        }
        
        // Add IDs and mark all tasks as selected by default
        const planWithIds = {
          ...mvpPlan,
          tasks: mvpPlan.tasks.map((task, index) => ({
            ...task,
            id: `task-${index}`,
            selected: true
          }))
        };
        
        setMvpPlan(planWithIds);
        setProjectName(mvpPlan.projectName);
        setGenerationText('');
      } catch {
        throw new Error('Failed to parse MVP plan from AI response');
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
          } catch {
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

    setIsCreating(true);
    setError(null);
    setSuccessMessage(null);
    setIsComplete(false);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token missing. Please log in again.');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(getApiUrl('ai/create-mvp-project'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          mvpPlan: {
            ...mvpPlan,
            projectName: projectName.trim(),
            tasks: mvpPlan.tasks.filter(task => task.selected)
          },
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
          throw new Error(`Failed to create MVP project: ${errorMessage}`);
        }
      }

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          decoder.decode(value, { stream: true });
        }
      }
      
      refreshProjects();
      setIsComplete(true);
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set a new timeout with proper cleanup
      timeoutRef.current = setTimeout(() => {
        // Only proceed if component is still mounted
        if (isMountedRef.current) {
          setProjectIdea('');
          setMvpPlan(null);
          setProjectName('');
          setSuccessMessage(null);
          setGenerationText('');
          setIsComplete(false);
          setIsCreating(false);
          safeClose();
        }
        timeoutRef.current = null;
      }, 3000);
      
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create MVP project. Please try again.');
      }
      setIsCreating(false);
      // Clear timeout on error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  };

  // Chat functions
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert('Please log in to use the chat feature');
      return;
    }
    
    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Authentication token missing. Please log in again.');
      return;
    }
    
    handleSubmit(e);
  };

  const quickActions = [
    'List all my projects',
    'Create a new project called "Website Redesign"',
    'Add a task to implement user authentication',
    'Show me the status of my current tasks',
    'Mark the login task as completed',
  ];

  const handleQuickAction = (action: string) => {
    const syntheticEvent = {
      target: { value: action },
      preventDefault: () => {},
    } as React.ChangeEvent<HTMLInputElement>;
    
    handleInputChange(syntheticEvent);
    
    setTimeout(() => {
      const form = document.querySelector('.chat-form') as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }, 100);
  };

  const exampleIdeas = [
    'A photo sharing app like Instagram built with Next.js',
    'A task management tool similar to Trello using React and Node.js',
    'A blog platform with markdown support using Django',
    'A real-time chat application with WebSocket support',
    'An e-commerce store for handmade crafts with Stripe integration',
  ];

  // Task management functions
  const toggleTaskSelection = (taskId: string) => {
    if (!mvpPlan) return;
    
    setMvpPlan({
      ...mvpPlan,
      tasks: mvpPlan.tasks.map(task => 
        task.id === taskId 
          ? { ...task, selected: !task.selected }
          : task
      )
    });
  };

  const startEditingTask = (taskId: string) => {
    if (!mvpPlan) return;
    
    const task = mvpPlan.tasks.find(t => t.id === taskId);
    if (task) {
      setEditingTaskId(taskId);
      setEditedTask({
        title: task.title,
        description: task.description
      });
    }
  };

  const saveTaskEdit = () => {
    if (!mvpPlan || !editingTaskId || !editedTask) return;
    
    setMvpPlan({
      ...mvpPlan,
      tasks: mvpPlan.tasks.map(task => 
        task.id === editingTaskId
          ? { ...task, title: editedTask.title, description: editedTask.description }
          : task
      )
    });
    
    setEditingTaskId(null);
    setEditedTask(null);
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setEditedTask(null);
  };

  const deleteTask = (taskId: string) => {
    if (!mvpPlan) return;
    
    setMvpPlan({
      ...mvpPlan,
      tasks: mvpPlan.tasks.filter(task => task.id !== taskId)
    });
  };

  const selectAllTasks = () => {
    if (!mvpPlan) return;
    
    setMvpPlan({
      ...mvpPlan,
      tasks: mvpPlan.tasks.map(task => ({ ...task, selected: true }))
    });
  };

  const deselectAllTasks = () => {
    if (!mvpPlan) return;
    
    setMvpPlan({
      ...mvpPlan,
      tasks: mvpPlan.tasks.map(task => ({ ...task, selected: false }))
    });
  };

  const getSelectedTasksCount = () => {
    if (!mvpPlan) return 0;
    return mvpPlan.tasks.filter(task => task.selected).length;
  };

  // Cleanup effect to handle component unmounting
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Safe close handler that checks if component is still mounted
  const safeClose = useCallback(() => {
    if (isMountedRef.current && onClose) {
      onClose();
    }
  }, [onClose]);

  // Handle open/close state
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else if (!newOpen && onClose) {
      onClose();
    }
  };

  // Use drawer for both mobile and desktop - right side on desktop, bottom on mobile
  return (
    <Drawer open={open} onOpenChange={handleOpenChange} direction={isMobile ? "bottom" : "right"} shouldScaleBackground={false}>
      <DrawerContent className={isMobile ? "h-[85vh] !max-h-[85vh] flex flex-col fixed" : "custom-width w-[400px] lg:w-[33vw] lg:min-w-[500px] lg:max-w-[1000px] h-full flex flex-col fixed"}>
        <DrawerHeader className={`bg-gradient-to-r from-blue-500 to-purple-600 text-white flex-shrink-0 ${isMobile ? 'p-3' : 'p-3 lg:p-4'}`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${isMobile ? 'gap-3' : 'gap-3 lg:gap-4'}`}>
              <div className={`bg-white/20 rounded-full flex items-center justify-center ${isMobile ? 'w-8 h-8' : 'w-8 h-8 lg:w-10 lg:h-10'}`}>
                <Rocket className={`text-white ${isMobile ? 'w-4 h-4' : 'w-4 h-4 lg:w-5 lg:h-5'}`} />
              </div>
              <div>
                <DrawerTitle className={`text-left text-white font-semibold ${isMobile ? 'text-base' : 'text-base lg:text-lg'}`}>AI Assistant</DrawerTitle>
                <p className={`text-white/80 ${isMobile ? 'text-xs' : 'text-xs lg:text-sm'}`}>MVP Builder & Chat</p>
              </div>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm" className={`p-0 text-white/80 hover:text-white hover:bg-white/20 ${isMobile ? 'h-8 w-8' : 'h-8 w-8 lg:h-9 lg:w-9'}`}>
                <X className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4 lg:w-5 lg:h-5'}`} />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Error and Success Messages */}
          {error && (
            <Card className="m-4 p-3 bg-red-50 border-red-200">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </Card>
          )}
          
          {successMessage && (
            <Card className="m-4 p-3 bg-green-50 border-green-200">
              <p className="text-green-600 dark:text-green-400 text-sm">{successMessage}</p>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'mvp' | 'chat')} className="flex-1 flex flex-col">
            <TabsList className={`!flex mx-auto bg-muted/50 border ${isMobile ? 'w-4/5 mt-3 p-0.5' : 'w-4/5 lg:w-2/3 mt-3 lg:mt-4 p-0.5 lg:p-1'}`}>
              <TabsTrigger value="mvp" className={`data-[state=active]:bg-background data-[state=active]:shadow-sm border-r flex-1 font-medium ${isMobile ? 'text-sm h-8' : 'text-sm lg:text-base h-8 lg:h-10'}`}>MVP Builder</TabsTrigger>
              <TabsTrigger value="chat" className={`data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 font-medium ${isMobile ? 'text-sm h-8' : 'text-sm lg:text-base h-8 lg:h-10'}`}>Chat</TabsTrigger>
            </TabsList>
            
            <TabsContent value="mvp" className={`flex-1 overflow-y-auto overscroll-contain min-h-0 ${isMobile ? 'px-2 pb-3 space-y-3' : 'px-2 lg:px-4 pb-3 lg:pb-4 space-y-3 lg:space-y-4 max-h-[calc(100vh-180px)] lg:max-h-[calc(100vh-200px)]'}`} style={isMobile ? { maxHeight: 'calc(85vh - 180px)' } : {}}>
              {/* MVP Builder Content */}
              {!mvpPlan ? (
                <>
                  <div className={`text-center ${isMobile ? 'space-y-3' : 'space-y-3 lg:space-y-4'}`}>
                    <div className={`bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto ${isMobile ? 'w-12 h-12' : 'w-12 h-12 lg:w-16 lg:h-16'}`}>
                      <Lightbulb className={`text-white ${isMobile ? 'w-6 h-6' : 'w-6 h-6 lg:w-8 lg:h-8'}`} />
                    </div>
                    <div>
                      <h2 className={`font-bold ${isMobile ? 'text-lg' : 'text-lg lg:text-xl'}`}>Build Your MVP</h2>
                      <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-sm lg:text-base'}`}>
                        Describe your project idea below
                      </p>
                    </div>
                  </div>

                  <div className={`${isMobile ? 'space-y-3' : 'space-y-3 lg:space-y-4'}`}>
                    <div>
                      <Textarea
                        value={projectIdea}
                        onChange={(e) => setProjectIdea(e.target.value)}
                        placeholder={isMobile ? "e.g., A social media app for pet owners..." : "e.g., A social media app for pet owners that lets them share photos, connect with local pet services, and find play dates..."}
                        className={`leading-relaxed ${isMobile ? 'min-h-20 text-sm' : 'min-h-20 lg:min-h-28 text-sm lg:text-base'}`}
                        disabled={isGenerating}
                      />
                      <p className={`text-muted-foreground ${isMobile ? 'text-xs mt-1' : 'text-xs lg:text-sm mt-1 lg:mt-2'}`}>
                        {projectIdea.length}/500 characters
                      </p>
                    </div>

                    {/* Components Section */}
                    <div>
                      <label className={`font-medium mb-2 block flex items-center gap-2 ${isMobile ? 'text-sm' : 'text-sm lg:text-base'}`}>
                        <Package className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4 lg:w-5 lg:h-5'}`} />
                        Components (Optional)
                      </label>
                      <p className={`text-muted-foreground mb-2 ${isMobile ? 'text-xs' : 'text-xs lg:text-sm'}`}>
                        Type component names or use Browse to select from available components
                        {loadingComponents && <span className="text-blue-600"> (Loading...)</span>}
                        {!loadingComponents && components.length === 0 && <span className="text-orange-600"> (No components found - create some in Components page)</span>}
                        {!loadingComponents && components.length > 0 && <span className="text-green-600"> ({components.length} available)</span>}
                      </p>
                      
                      {/* Component Tag Input */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          {/* Custom Tag Input Field */}
                          <div className={`flex flex-wrap items-center gap-1 min-h-9 lg:min-h-10 p-2 border border-input bg-background rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${isGenerating || loadingComponents ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {/* Selected Component Tags */}
                            {selectedComponents.map((component) => (
                              <Badge
                                key={component.id}
                                variant="secondary"
                                className="cursor-pointer hover:bg-red-100 hover:text-red-700 transition-colors px-2 py-1 text-xs"
                                onClick={() => handleComponentRemove(component.id)}
                              >
                                {component.name}
                                <X className="w-3 h-3 ml-1" />
                              </Badge>
                            ))}
                            
                            {/* Search Input */}
                            <input
                              type="text"
                              value={componentSearch}
                              onChange={(e) => setComponentSearch(e.target.value)}
                              placeholder={selectedComponents.length > 0 ? "Add more..." : "Search for components to add..."}
                              disabled={isGenerating || loadingComponents}
                              className={`flex-1 min-w-32 bg-transparent border-0 outline-none placeholder:text-muted-foreground ${isMobile ? 'text-sm' : 'text-sm lg:text-base'}`}
                            />
                          </div>
                          
                          {/* Search Dropdown */}
                          {(() => {
                            const searchResults = getSearchResults(componentSearch);
                            return searchResults.length > 0 && (
                              <div className="absolute top-full left-0 right-0 z-10 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto mt-1">
                                {searchResults.map((component) => (
                                  <div
                                    key={component.id}
                                    onClick={() => handleComponentSelect(component)}
                                    className="p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                                  >
                                    <div className={`font-medium ${isMobile ? 'text-sm' : 'text-sm lg:text-base'}`}>{component.name}</div>
                                    <div className={`text-muted-foreground line-clamp-1 ${isMobile ? 'text-xs' : 'text-xs lg:text-sm'}`}>
                                      {component.description}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                          
                          {/* Browse Button */}
                          <Dialog open={browseDialogOpen} onOpenChange={setBrowseDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                disabled={isGenerating || loadingComponents || components.length === 0}
                                className={`shrink-0 ${isMobile ? 'h-9 px-3' : 'h-9 lg:h-10 px-3 lg:px-4'}`}
                              >
                                <Search className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4 lg:w-5 lg:h-5'}`} />
                                {!isMobile && <span className="ml-2">Browse</span>}
                              </Button>
                            </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Browse Components</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              {/* Search within dialog */}
                              <Input
                                value={dialogSearch}
                                onChange={(e) => setDialogSearch(e.target.value)}
                                placeholder="Search components..."
                                className="w-full"
                              />
                              
                              {/* Components list */}
                              <div className="max-h-64 overflow-y-auto space-y-2">
                                {filteredDialogComponents.length > 0 ? (
                                  filteredDialogComponents.map((component) => {
                                    const isSelected = selectedComponents.find(c => c.id === component.id);
                                    return (
                                      <div
                                        key={component.id}
                                        onClick={() => handleComponentToggle(component)}
                                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                          isSelected 
                                            ? 'bg-primary/10 border-primary' 
                                            : 'hover:bg-muted border-border'
                                        }`}
                                      >
                                        <div className="flex items-start gap-2">
                                          <div className={`w-4 h-4 border-2 rounded flex-shrink-0 mt-0.5 ${
                                            isSelected 
                                              ? 'bg-primary border-primary' 
                                              : 'border-muted-foreground/30'
                                          }`}>
                                            {isSelected && (
                                              <CheckCircle className="w-3 h-3 text-primary-foreground m-0.5" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm">{component.name}</div>
                                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                              {component.description}
                                            </div>
                                            {component.tags.length > 0 && (
                                              <div className="flex flex-wrap gap-1 mt-2">
                                                {component.tags.slice(0, 3).map((tag, index) => (
                                                  <Badge key={index} variant="outline" className="text-xs">
                                                    {tag}
                                                  </Badge>
                                                ))}
                                                {component.tags.length > 3 && (
                                                  <Badge variant="outline" className="text-xs">
                                                    +{component.tags.length - 3}
                                                  </Badge>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-center py-8 text-muted-foreground">
                                    {components.length === 0 ? 'No components available' : 'No components match your search'}
                                  </div>
                                )}
                              </div>
                              
                              {/* Footer */}
                              <div className="flex justify-between items-center pt-2 border-t">
                                <span className="text-sm text-muted-foreground">
                                  {selectedComponents.length} component{selectedComponents.length !== 1 ? 's' : ''} selected
                                </span>
                                <Button onClick={() => setBrowseDialogOpen(false)}>
                                  Done
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <Button 
                      onClick={handleGenerateMVP} 
                      disabled={projectIdea.length < 10 || isGenerating}
                      className={`w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold ${isMobile ? 'h-9 text-sm' : 'h-9 lg:h-12 text-sm lg:text-base'}`}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className={`animate-spin ${isMobile ? 'w-4 h-4 mr-2' : 'w-4 h-4 lg:w-5 lg:h-5 mr-2 lg:mr-3'}`} />
                          {isMobile ? 'Generating...' : 'Generating Plan...'}
                        </>
                      ) : (
                        <>
                          <Rocket className={`${isMobile ? 'w-4 h-4 mr-2' : 'w-4 h-4 lg:w-5 lg:h-5 mr-2 lg:mr-3'}`} />
                          {isMobile ? 'Generate Plan' : 'Generate MVP Plan'}
                        </>
                      )}
                    </Button>

                    {projectIdea.length === 0 && (
                      <div className={`${isMobile ? 'space-y-2' : 'space-y-2 lg:space-y-3'}`}>
                        <p className={`text-muted-foreground font-medium ${isMobile ? 'text-xs' : 'text-xs lg:text-sm'}`}>Try an example:</p>
                        <div className={`grid ${isMobile ? 'gap-1' : 'gap-1 lg:gap-2'}`}>
                          {exampleIdeas.slice(0, isMobile ? 2 : 4).map((example, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              onClick={() => setProjectIdea(example)}
                              className={`text-left h-auto whitespace-normal leading-relaxed ${isMobile ? 'py-1.5 px-2 text-xs' : 'py-1.5 lg:py-3 px-2 lg:px-3 text-xs lg:text-sm'}`}
                              disabled={isGenerating}
                            >
                              {example}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isGenerating && (
                      <div className={`${isMobile ? 'space-y-3' : 'space-y-3 lg:space-y-4'}`}>
                        {generationText ? (
                          <div className="bg-muted/30 rounded-lg border">
                            <div className={`border-b bg-muted/20 rounded-t-lg ${isMobile ? 'px-3 py-2' : 'px-3 lg:px-4 py-2'}`}>
                              <p className={`font-medium text-muted-foreground ${isMobile ? 'text-xs' : 'text-xs lg:text-sm'}`}>AI Response Stream</p>
                            </div>
                            <div ref={streamingTextRef} className={`overflow-y-auto ${isMobile ? 'p-3 max-h-20' : 'p-3 lg:p-4 max-h-20 lg:max-h-48'}`}>
                              <p className={`text-foreground whitespace-pre-wrap leading-relaxed font-mono ${isMobile ? 'text-xs' : 'text-xs lg:text-sm'}`}>{generationText}</p>
                            </div>
                          </div>
                        ) : (
                          <div className={`flex items-center justify-center gap-2 lg:gap-3 ${isMobile ? 'py-4' : 'py-4 lg:py-8'}`}>
                            <Loader2 className={`animate-spin text-primary ${isMobile ? 'w-4 h-4' : 'w-4 h-4 lg:w-6 lg:h-6'}`} />
                            <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-sm lg:text-base'}`}>Starting AI analysis...</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-5">
                  <Card className="p-4">
                    <label className="text-base font-medium mb-3 block">Project Name</label>
                    <div className="flex gap-3 mb-4">
                      <Input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Enter project name"
                        className="flex-1 h-10 text-base"
                        maxLength={50}
                      />
                      <Button
                        variant="outline"
                        size="default"
                        onClick={handleSuggestName}
                        disabled={isSuggestingName || !projectIdea.trim()}
                        className="shrink-0 h-10 px-4"
                      >
                        {isSuggestingName ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Lightbulb className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-base text-muted-foreground mb-4 leading-relaxed">{mvpPlan.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold">Frontend:</span>
                        <p className="text-muted-foreground mt-1">{mvpPlan.techStack.frontend}</p>
                      </div>
                      <div>
                        <span className="font-semibold">Backend:</span>
                        <p className="text-muted-foreground mt-1">{mvpPlan.techStack.backend}</p>
                      </div>
                      <div>
                        <span className="font-semibold">Database:</span>
                        <p className="text-muted-foreground mt-1">{mvpPlan.techStack.database}</p>
                      </div>
                      {mvpPlan.techStack.hosting && (
                        <div>
                          <span className="font-semibold">Hosting:</span>
                          <p className="text-muted-foreground mt-1">{mvpPlan.techStack.hosting}</p>
                        </div>
                      )}
                    </div>
                  </Card>

                  {isMobile ? (
                    // Simple summary for mobile
                    <Card className="p-3">
                      <div className="text-sm space-y-2">
                        <div>
                          <span className="font-medium text-primary">Features:</span>
                          <span className="text-muted-foreground ml-1">{mvpPlan.features.length} core features</span>
                        </div>
                        <div>
                          <span className="font-medium text-primary">Tasks:</span>
                          <span className="text-muted-foreground ml-1">{getSelectedTasksCount()}/{mvpPlan.tasks.length} tasks selected</span>
                        </div>
                      </div>
                    </Card>
                  ) : (
                    // Full accordions for desktop
                    <>
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
                        <div className="space-y-3">
                          {/* Task management controls */}
                          <div className="flex items-center justify-between text-xs border-b pb-2">
                            <span className="text-muted-foreground">
                              {getSelectedTasksCount()}/{mvpPlan.tasks.length} tasks selected
                            </span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={selectAllTasks}
                                className="h-6 px-2 text-xs"
                              >
                                Select All
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={deselectAllTasks}
                                className="h-6 px-2 text-xs"
                              >
                                None
                              </Button>
                            </div>
                          </div>
                          
                          {/* Tasks list */}
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {mvpPlan.tasks.map((task) => (
                              <div key={task.id} className="border rounded-md p-3 bg-muted/20">
                                <div className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    checked={task.selected}
                                    onChange={() => toggleTaskSelection(task.id!)}
                                    className="mt-1 h-3 w-3 rounded border-muted-foreground/20"
                                  />
                                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                    task.priority === 'high' ? 'bg-red-500' :
                                    task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}></span>
                                  
                                  <div className="flex-1 min-w-0">
                                    {editingTaskId === task.id ? (
                                      <div className="space-y-2">
                                        <Input
                                          value={editedTask?.title || ''}
                                          onChange={(e) => setEditedTask(prev => prev ? {...prev, title: e.target.value} : null)}
                                          className="text-xs h-7"
                                          placeholder="Task title"
                                        />
                                        <Textarea
                                          value={editedTask?.description || ''}
                                          onChange={(e) => setEditedTask(prev => prev ? {...prev, description: e.target.value} : null)}
                                          className="text-xs min-h-16 resize-none"
                                          placeholder="Task description"
                                        />
                                        <div className="flex gap-1">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={saveTaskEdit}
                                            className="h-6 px-2 text-xs"
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={cancelTaskEdit}
                                            className="h-6 px-2 text-xs"
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <p className="font-medium text-xs">{task.title}</p>
                                        <p className="text-muted-foreground text-xs leading-tight mt-1">{task.description}</p>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {editingTaskId !== task.id && (
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => startEditingTask(task.id!)}
                                        className="h-6 w-6 p-0"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteTask(task.id!)}
                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Accordion>
                    </>
                  )}

                  {!isCreating ? (
                    <div className="flex gap-3">
                      <Button
                        onClick={handleCreateProject}
                        disabled={isCreating || !projectName.trim() || getSelectedTasksCount() === 0}
                        className="flex-1 h-12 text-base font-semibold"
                        size="lg"
                      >
                        <Rocket className="w-5 h-5 mr-3" />
                        Create Project ({getSelectedTasksCount()} tasks)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Clear any pending timeout
                          if (timeoutRef.current) {
                            clearTimeout(timeoutRef.current);
                            timeoutRef.current = null;
                          }
                          setMvpPlan(null);
                          setProjectName('');
                          setError(null);
                          setSuccessMessage(null);
                        }}
                        disabled={isCreating}
                        className="h-12 px-6 text-base"
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
                              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                Project created successfully!
                              </span>
                            </div>
                            
                            <div className="text-center">
                              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                                Done!
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 mb-4">
                              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                              <span className="text-sm font-medium">
                                Creating project with {getSelectedTasksCount()} tasks...
                              </span>
                            </div>
                            
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground animate-pulse">
                                {statusMessages[currentStatusIndex]}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="chat" className={`flex-1 flex flex-col min-h-0 ${isMobile ? 'px-2 pb-3' : 'px-2 lg:px-4 pb-3 lg:pb-4'}`}>
              {/* Chat Content */}
              <div className={`flex-1 overflow-y-auto overscroll-contain p-2 min-h-0 ${isMobile ? '' : 'max-h-[calc(100vh-180px)]'}`} style={isMobile ? { maxHeight: 'calc(85vh - 180px)' } : {}}>
                <div className="flex flex-col gap-4 min-h-fit">
                  {messages.length === 0 ? (
                    <div className={`text-center ${isMobile ? 'py-8' : 'py-8 lg:py-12'}`}>
                      <div className={`bg-primary/10 rounded-full flex items-center justify-center mx-auto ${isMobile ? 'w-16 h-16 mb-4' : 'w-16 h-16 lg:w-20 lg:h-20 mb-4 lg:mb-6'}`}>
                        <MessageCircle className={`text-primary ${isMobile ? 'w-8 h-8' : 'w-8 h-8 lg:w-10 lg:h-10'}`} />
                      </div>
                      <p className={`font-semibold ${isMobile ? 'mb-2 text-base' : 'mb-2 lg:mb-3 text-base lg:text-lg'}`}>Hi! I'm your AI assistant</p>
                      <p className={`text-muted-foreground ${isMobile ? 'text-sm mb-4' : 'text-sm lg:text-base mb-4 lg:mb-6'}`}>I can help you manage your projects and tasks</p>
                      
                      <div className={`${isMobile ? 'space-y-2' : 'space-y-2 lg:space-y-3'}`}>
                        {quickActions.slice(0, 3).map((action, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="default"
                            onClick={() => handleQuickAction(action)}
                            className={`w-full text-left justify-start h-auto ${isMobile ? 'py-2 px-3 text-xs' : 'py-2 lg:py-3 px-3 lg:px-4 text-xs lg:text-sm'}`}
                            disabled={isLoading}
                          >
                            {action}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages
                        .filter(message => message.role === 'user' || message.role === 'assistant')
                        .map((message) => (
                          <ChatMessage key={message.id} message={message} />
                        ))}
                      {isLoading && (
                        <div className="flex items-center gap-3 text-muted-foreground text-base">
                          <div className="w-3 h-3 bg-current rounded-full animate-pulse"></div>
                          <span>AI is thinking...</span>
                        </div>
                      )}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className={`border-t bg-background flex-shrink-0 ${isMobile ? 'p-2' : 'p-2 lg:p-4'}`}>
                <form onSubmit={handleChatSubmit} className={`chat-form flex ${isMobile ? 'gap-2' : 'gap-2 lg:gap-3'}`}>
                  <Input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Ask about your projects..."
                    disabled={isLoading}
                    className={`flex-1 ${isMobile ? 'h-9 text-sm' : 'h-9 lg:h-11 text-sm lg:text-base'}`}
                  />
                  <Button type="submit" disabled={isLoading} size="default" className={`${isMobile ? 'h-9 px-3' : 'h-9 lg:h-11 px-3 lg:px-4'}`}>
                    <Send className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4 lg:w-5 lg:h-5'}`} />
                  </Button>
                </form>
                
                {messages.length === 0 && (
                  <div className={`flex gap-2 ${isMobile ? 'mt-2' : 'mt-2 lg:mt-3'}`}>
                    {quickActions.slice(0, 2).map((action, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickAction(action)}
                        className={`flex-1 truncate ${isMobile ? 'text-xs h-7 px-2' : 'text-xs lg:text-sm h-7 lg:h-8 px-2 lg:px-3'}`}
                        disabled={isLoading}
                      >
                        {action}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
}