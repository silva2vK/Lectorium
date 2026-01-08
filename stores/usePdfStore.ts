
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ToolType } from '../context/PdfContext'; 

interface PdfUiState {
  // Viewport State
  scale: number;
  rotation: number;
  currentPage: number;
  numPages: number;
  
  // Layout State (Spread supported within Single View)
  isSpread: boolean;
  spreadSide: 'left' | 'right';
  
  // Dimensions
  pageDimensions: { width: number, height: number } | null;
  pageSizes: { width: number, height: number }[];
  
  // Tools
  activeTool: ToolType;
  
  // Actions
  setScale: (scale: number | ((prev: number) => number)) => void;
  setRotation: (rotation: number) => void;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  setNumPages: (num: number) => void;
  setIsSpread: (isSpread: boolean) => void;
  setSpreadSide: (side: 'left' | 'right') => void;
  setActiveTool: (tool: ToolType) => void;
  setPageDimensions: (dims: { width: number, height: number } | null) => void;
  setPageSizes: (sizes: { width: number, height: number }[]) => void;
  
  // Navigation
  zoomIn: () => void;
  zoomOut: () => void;
  fitWidth: (containerWidth: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  jumpToPage: (page: number) => void;
}

export const usePdfStore = create<PdfUiState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    scale: 1.0,
    rotation: 0,
    currentPage: 1,
    numPages: 0,
    isSpread: false,
    spreadSide: 'left',
    pageDimensions: null,
    pageSizes: [],
    activeTool: 'cursor',

    // Setters
    setScale: (input) => set((state) => {
        const nextScale = typeof input === 'function' ? input(state.scale) : input;
        return { scale: Math.min(Math.max(0.25, nextScale), 5.0) };
    }),
    
    setRotation: (rotation) => set({ rotation }),
    
    setCurrentPage: (input) => set((state) => {
        const next = typeof input === 'function' ? input(state.currentPage) : input;
        const safePage = Math.max(1, Math.min(next, state.numPages || 1));
        return { currentPage: safePage };
    }),

    setNumPages: (numPages) => set({ numPages }),
    setIsSpread: (isSpread) => set({ isSpread }),
    setSpreadSide: (spreadSide) => set({ spreadSide }),
    setActiveTool: (activeTool) => set({ activeTool }),
    setPageDimensions: (pageDimensions) => set({ pageDimensions }),
    setPageSizes: (pageSizes) => set({ pageSizes }),

    // Helpers
    zoomIn: () => {
        const { setScale } = get();
        setScale(s => s + 0.25);
    },

    zoomOut: () => {
        const { setScale } = get();
        setScale(s => s - 0.25);
    },

    fitWidth: (containerWidth) => {
        const { pageDimensions, setScale } = get();
        if (!pageDimensions) return;
        
        const padding = containerWidth < 768 ? 20 : 60;
        const availableWidth = containerWidth - padding;
        const newScale = availableWidth / pageDimensions.width;
        
        setScale(newScale);
    },

    jumpToPage: (page: number) => {
        const { setCurrentPage, setIsSpread, setSpreadSide } = get();
        setCurrentPage(page);
        // Reset spread logic on direct jump
        setIsSpread(false);
        setSpreadSide('left');
    },

    nextPage: () => {
        const { currentPage, numPages, isSpread, spreadSide, setCurrentPage, setSpreadSide } = get();
        
        // Spread Logic (Optional)
        if (isSpread && spreadSide === 'left') {
            setSpreadSide('right');
            return;
        }
        
        if (currentPage < numPages) {
            setCurrentPage(currentPage + 1);
            if (isSpread) setSpreadSide('left');
        }
    },

    prevPage: () => {
        const { currentPage, isSpread, spreadSide, setCurrentPage, setSpreadSide } = get();
        
        // Spread Logic (Optional)
        if (isSpread && spreadSide === 'right') {
            setSpreadSide('left');
            return;
        }
        
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            if (isSpread) setSpreadSide('right');
        }
    }
  }))
);
