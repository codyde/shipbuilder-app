import { lazy, Suspense } from 'react';
import { LoadingAnimation } from '@/components/ui/loading-animation';

const AIAssistant = lazy(() => import('@/components/AIAssistant').then(m => ({ default: m.AIAssistant })));

interface LazyAIAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  initialTab: 'mvp' | 'chat';
}

export function LazyAIAssistant(props: LazyAIAssistantProps) {
  // Only render when actually needed (when open)
  if (!props.open) {
    return null;
  }

  return (
    <Suspense fallback={<LoadingAnimation />}>
      <AIAssistant {...props} />
    </Suspense>
  );
}