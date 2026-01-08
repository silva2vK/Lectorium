
import React, { useRef } from 'react';
import { usePdfStore } from '../stores/usePdfStore';
import { usePdfContext } from '../context/PdfContext';
import { getDistance, getMidPoint, Point } from '../utils/geometry';

export const usePdfGestures = (visualContentRef: React.RefObject<HTMLDivElement>) => {
  const scale = usePdfStore(state => state.scale);
  const setScale = usePdfStore(state => state.setScale);
  const activeTool = usePdfStore(state => state.activeTool);
  const goNext = usePdfStore(state => state.nextPage);
  const goPrev = usePdfStore(state => state.prevPage);

  const { selection } = usePdfContext();

  const startPinchDistRef = useRef<number>(0);
  const startScaleRef = useRef<number>(1);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const touchStartRef = useRef<Point | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    if (pointersRef.current.size === 2 && activeTool !== 'ink') {
        // Fix: Explicitly cast to Point[] to resolve type errors on line 26
        const points = Array.from(pointersRef.current.values()) as Point[];
        startPinchDistRef.current = getDistance(points[0], points[1]);
        startScaleRef.current = scale;
        
        if (visualContentRef.current) {
            const rect = visualContentRef.current.getBoundingClientRect();
            // Fix: Explicitly cast to Point[] to resolve type error on line 31
            const mid = getMidPoint(points[0], points[1]);
            visualContentRef.current.style.transition = 'none';
            visualContentRef.current.style.transformOrigin = `${mid.x - rect.left}px ${mid.y - rect.top}px`;
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    if (activeTool !== 'ink' && pointersRef.current.size === 2 && startPinchDistRef.current > 0) {
        // Fix: Explicitly cast to Point[] to resolve type error on line 43
        const points = Array.from(pointersRef.current.values()) as Point[];
        const dist = getDistance(points[0], points[1]);
        const ratio = dist / startPinchDistRef.current;
        if (visualContentRef.current) {
            visualContentRef.current.style.transform = `scale(${ratio})`;
        }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    
    if (startPinchDistRef.current > 0 && pointersRef.current.size < 2) {
        if (visualContentRef.current) {
            const transform = visualContentRef.current.style.transform;
            const match = transform.match(/scale\((.*?)\)/);
            if (match) {
                setScale(startScaleRef.current * parseFloat(match[1]));
                visualContentRef.current.style.transform = 'none';
                visualContentRef.current.style.transition = ''; 
            }
        }
        startPinchDistRef.current = 0; 
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (['ink', 'eraser', 'brush'].includes(activeTool)) return;
    if (scale <= 1.2) {
        const x = e.touches[0].clientX;
        const width = window.innerWidth;
        if (x < 50 || x > width - 50) {
            touchStartRef.current = { x, y: e.touches[0].clientY };
        }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || selection || ['ink', 'eraser', 'brush'].includes(activeTool)) {
        touchStartRef.current = null;
        return;
    }

    const diffX = touchStartRef.current.x - e.changedTouches[0].clientX;
    const diffY = touchStartRef.current.y - e.changedTouches[0].clientY;
    const width = window.innerWidth;

    if (Math.abs(diffX) > 50 && Math.abs(diffY) < 100) {
        if (diffX > 0 && touchStartRef.current.x > width - 50) goNext();
        else if (diffX < 0 && touchStartRef.current.x < 50) goPrev();
    }
    touchStartRef.current = null;
  };

  return {
    handlers: {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerLeave: handlePointerUp,
        onTouchStart: handleTouchStart,
        onTouchEnd: handleTouchEnd,
    }
  };
};