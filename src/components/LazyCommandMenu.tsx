import { lazy, Suspense } from 'react';

const CommandMenu = lazy(() => import('@/components/command-menu').then(m => ({ default: m.CommandMenu })));

interface LazyCommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LazyCommandMenu(props: LazyCommandMenuProps) {
  // Only render when actually needed (when open)
  if (!props.open) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <CommandMenu {...props} />
    </Suspense>
  );
}