import { useState, useEffect, useRef } from 'react';
import { useProjects } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Accordion } from '@/components/ui/accordion';
import { ToolStatusDisplay } from '@/components/ui/tool-status-display';
import { useMVPStatusStream } from '@/hooks/useMVPStatusStream';
import { X, Lightbulb, GripHorizontal, Loader2, Rocket, CheckCircle, Progress } from 'lucide-react';
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

  // Use the new MVP status streaming hook
  const {
    statusMessages,
    isCreating,
    isComplete,
    createdTasksCount,
    totalTasksCount,
    progress,
    createMVPProject,
    cancelCreation,
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
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch(getApiUrl('ai/generatemvp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectIdea: trimmedIdea,
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

      // Handle streaming response
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

      // Parse the complete JSON response
      try {
        console.log('[MVP_BUILDER] Raw response:', fullText);
        console.log('[MVP_BUILDER] Response length:', fullText.length);
        
        let cleanedText = fullText.trim();
        
        // Remove markdown code blocks
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Try to extract JSON from the response if it contains extra text
        const jsonStart = cleanedText.indexOf('{');
        const jsonEnd = cleanedText.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);
        }
        
        cleanedText = cleanedText.trim();
        
        console.log('[MVP_BUILDER] Cleaned text to parse:', cleanedText);
        
        const mvpPlan = JSON.parse(cleanedText);
        
        // Validate the MVP plan structure
        if (!mvpPlan.projectName || !mvpPlan.description || !Array.isArray(mvpPlan.features) || !mvpPlan.techStack || !Array.isArray(mvpPlan.tasks)) {
          throw new Error('Generated MVP plan has invalid structure');
        }
        
        setMvpPlan(mvpPlan);
        setProjectName(mvpPlan.projectName); // Initialize editable name
        setGenerationText(''); // Clear the raw text once parsed
      } catch (parseError) {
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
        <DrawerContent className="h-[85vh] !max-h-[85vh] flex flex-col fixed">
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
          <div className="flex-1 p-3 space-y-3 overflow-y-auto overscroll-contain min-h-0" style={{ maxHeight: 'calc(85vh - 140px)' }}>
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
                      {generationText ? (
                        <div ref={streamingTextRef} className="bg-muted/30 rounded-lg p-3 max-h-20 overflow-y-auto">
                          <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{generationText}</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-4">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <p className="text-sm text-muted-foreground">Starting AI analysis...</p>
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
                              {totalTasksCount > 0 && (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                                      style={{ width: `${progress}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {createdTasksCount}/{totalTasksCount}
                                  </span>
                                </div>
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
      className={`w-[560px] h-[580px] ${className}`}
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
                  {generationText ? (
                    <div ref={streamingTextRef} className="bg-muted/30 rounded-lg p-3 max-h-20 overflow-y-auto">
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{generationText}</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <p className="text-sm text-muted-foreground">Starting AI analysis...</p>
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
                              {totalTasksCount > 0 && (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                                      style={{ width: `${progress}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {createdTasksCount}/{totalTasksCount}
                                  </span>
                                </div>
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