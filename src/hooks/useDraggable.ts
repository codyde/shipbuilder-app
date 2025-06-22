import { useState, useRef, useCallback, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  initialPosition?: Position;
  storageKey?: string;
  bounds?: {
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
  };
}

export function useDraggable({
  initialPosition = { x: 100, y: 100 },
  storageKey,
  bounds,
}: UseDraggableOptions = {}) {
  const [position, setPosition] = useState<Position>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Invalid saved position, use initial
        }
      }
    }
    return initialPosition;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(position));
    }
  }, [position, storageKey]);

  const constrainPosition = useCallback((pos: Position): Position => {
    if (!bounds || !elementRef.current) return pos;

    const element = elementRef.current;
    const rect = element.getBoundingClientRect();
    
    let { x, y } = pos;

    if (bounds.left !== undefined) {
      x = Math.max(bounds.left, x);
    }
    if (bounds.top !== undefined) {
      y = Math.max(bounds.top, y);
    }
    if (bounds.right !== undefined) {
      x = Math.min(bounds.right - rect.width, x);
    }
    if (bounds.bottom !== undefined) {
      y = Math.min(bounds.bottom - rect.height, y);
    }

    return { x, y };
  }, [bounds]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const newPosition = constrainPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });

    setPosition(newPosition);
  }, [isDragging, dragStart, constrainPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle window resize to keep element within bounds
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => constrainPosition(prev));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [constrainPosition]);

  return {
    ref: elementRef,
    position,
    isDragging,
    handleMouseDown,
    style: {
      position: 'fixed' as const,
      left: position.x,
      top: position.y,
      zIndex: isDragging ? 1000 : 50,
    },
  };
}